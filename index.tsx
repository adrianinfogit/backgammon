
import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom/client';

// --- START OF TYPES (from types.ts) ---
enum Player {
  None = 0,
  Player1 = 1, // White
  Player2 = 2, // Black
}

interface PointState {
  player: Player;
  count: number;
}

type BoardState = PointState[];

interface BarState {
  [Player.Player1]: number;
  [Player.Player2]: number;
}

interface OffState {
  [Player.Player1]: number;
  [Player.Player2]: number;
}

enum GamePhase {
  START,
  ROLLING,
  MOVING,
  GAME_OVER,
}
// --- END OF TYPES ---


// --- START OF CONSTANTS (from constants.ts) ---
const NUM_POINTS = 24;
const NUM_CHECKERS = 15;
const BAR_POINT_PLAYER_1 = -1;
const BAR_POINT_PLAYER_2 = 24;
const OFF_POINT_PLAYER_1 = 25;
const OFF_POINT_PLAYER_2 = -2;

const PLAYER_NAMES: { [key in Player]: string } = {
    [Player.None]: "None",
    [Player.Player1]: "Player 1 (White)",
    [Player.Player2]: "Player 2 (Black)",
};

const PLAYER_COLORS: { [key in Player]: { base: string; text: string, border: string } } = {
  [Player.None]: { base: '', text: '', border: '' },
  [Player.Player1]: { base: 'bg-stone-100', text: 'text-stone-800', border: 'border-stone-400' },
  [Player.Player2]: { base: 'bg-stone-800', text: 'text-stone-100', border: 'border-stone-950' },
};

const INITIAL_BOARD_STATE: BoardState = [
  // Point 1 to 24 (from Player 1's perspective, index 0-23)
  { player: Player.Player2, count: 2 },   // 1
  { player: Player.None, count: 0 },      // 2
  { player: Player.None, count: 0 },      // 3
  { player: Player.None, count: 0 },      // 4
  { player: Player.None, count: 0 },      // 5
  { player: Player.Player1, count: 5 },   // 6
  { player: Player.None, count: 0 },      // 7
  { player: Player.Player1, count: 3 },   // 8
  { player: Player.None, count: 0 },      // 9
  { player: Player.None, count: 0 },      // 10
  { player: Player.None, count: 0 },      // 11
  { player: Player.Player2, count: 5 },   // 12
  { player: Player.Player1, count: 5 },   // 13
  { player: Player.None, count: 0 },      // 14
  { player: Player.None, count: 0 },      // 15
  { player: Player.None, count: 0 },      // 16
  { player: Player.Player2, count: 3 },   // 17
  { player: Player.None, count: 0 },      // 18
  { player: Player.Player2, count: 5 },   // 19
  { player: Player.None, count: 0 },      // 20
  { player: Player.None, count: 0 },      // 21
  { player: Player.None, count: 0 },      // 22
  { player: Player.None, count: 0 },      // 23
  { player: Player.Player1, count: 2 },   // 24
];
// --- END OF CONSTANTS ---


// --- START OF APP (from App.tsx) ---
const Checker: React.FC<{ player: Player; isGhost?: boolean }> = ({ player, isGhost }) => {
    const color = PLAYER_COLORS[player];
    const ghostClasses = isGhost ? 'opacity-50' : 'shadow-md';
    return (
        <div className={`w-full h-full rounded-full ${color.base} ${color.border} border-2 flex items-center justify-center ${ghostClasses} transition-opacity`}>
            <div className={`w-[60%] h-[60%] rounded-full ${color.base} border border-white/20 shadow-inner`}></div>
        </div>
    );
};

const Die: React.FC<{ value: number; used: boolean }> = ({ value, used }) => {
    const dotPositions: { [key: number]: number[][] } = {
        1: [[2, 2]], // Center
        2: [[1, 1], [3, 3]], // Top-left, Bottom-right
        3: [[1, 1], [2, 2], [3, 3]], // Top-left, Center, Bottom-right
        4: [[1, 1], [1, 3], [3, 1], [3, 3]], // Four corners
        5: [[1, 1], [1, 3], [2, 2], [3, 1], [3, 3]], // Four corners + Center
        6: [[1, 1], [2, 1], [3, 1], [1, 3], [2, 3], [3, 3]], // Two columns of three
    };

    const rowClasses: { [key: number]: string } = { 1: 'row-start-1', 2: 'row-start-2', 3: 'row-start-3' };
    const colClasses: { [key: number]: string } = { 1: 'col-start-1', 2: 'col-start-2', 3: 'col-start-3' };

    return (
        <div className={`relative w-12 h-12 bg-stone-100 rounded-lg shadow-lg grid grid-cols-3 grid-rows-3 p-1 transition-all duration-300 ${used ? 'opacity-30 scale-90' : ''}`}>
            {dotPositions[value]?.map(([row, col], i) => (
                <div key={i} className={`${rowClasses[row]} ${colClasses[col]} w-2.5 h-2.5 bg-stone-800 rounded-full place-self-center`}></div>
            ))}
        </div>
    );
};

interface PossibleMove {
    to: number;
    die: number;
}

function App() {
    const [gamePhase, setGamePhase] = useState<GamePhase>(GamePhase.START);
    const [board, setBoard] = useState<BoardState>(() => JSON.parse(JSON.stringify(INITIAL_BOARD_STATE)));
    const [currentPlayer, setCurrentPlayer] = useState<Player>(Player.Player1);
    const [dice, setDice] = useState<number[]>([]);
    const [movesRemaining, setMovesRemaining] = useState<number[]>([]);
    const [usedMoves, setUsedMoves] = useState<number[]>([]);
    const [bar, setBar] = useState<BarState>({ [Player.Player1]: 0, [Player.Player2]: 0 });
    const [off, setOff] = useState<OffState>({ [Player.Player1]: 0, [Player.Player2]: 0 });
    const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
    const [possibleMoves, setPossibleMoves] = useState<PossibleMove[]>([]);
    const [winner, setWinner] = useState<Player | null>(null);
    const [message, setMessage] = useState<string>("Welcome to Backgammon!");

    const handleNewGame = () => {
        setBoard(JSON.parse(JSON.stringify(INITIAL_BOARD_STATE)));
        setBar({ [Player.Player1]: 0, [Player.Player2]: 0 });
        setOff({ [Player.Player1]: 0, [Player.Player2]: 0 });
        const startingPlayer = Math.random() < 0.5 ? Player.Player1 : Player.Player2;
        setCurrentPlayer(startingPlayer);
        setGamePhase(GamePhase.ROLLING);
        setDice([]);
        setMovesRemaining([]);
        setUsedMoves([]);
        setSelectedPoint(null);
        setPossibleMoves([]);
        setWinner(null);
        setMessage(`${PLAYER_NAMES[startingPlayer]}'s turn to roll.`);
    };

    const handleRollDice = () => {
        if (gamePhase !== GamePhase.ROLLING) return;
        const d1 = Math.floor(Math.random() * 6) + 1;
        const d2 = Math.floor(Math.random() * 6) + 1;
        
        let rolls = d1 === d2 ? [d1, d1, d1, d1] : [d1, d2];
        setDice([d1, d2]);
        setMovesRemaining(rolls);
        setUsedMoves([]);
        setGamePhase(GamePhase.MOVING);
        setMessage(`${PLAYER_NAMES[currentPlayer]} rolled ${d1} and ${d2}.`);
    };
    
    const switchTurn = useCallback(() => {
        const nextPlayer = currentPlayer === Player.Player1 ? Player.Player2 : Player.Player1;
        setCurrentPlayer(nextPlayer);
        setGamePhase(GamePhase.ROLLING);
        setDice([]);
        setMovesRemaining([]);
        setUsedMoves([]);
        setSelectedPoint(null);
        setPossibleMoves([]);
        setMessage(`${PLAYER_NAMES[nextPlayer]}'s turn to roll.`);
    }, [currentPlayer]);

    const canBearOff = useCallback((player: Player, boardState: BoardState, barState: BarState) => {
        if (barState[player] > 0) return false;

        const isP1 = player === Player.Player1;
        const homeStart = isP1 ? 0 : 18; // P1 home: 0-5 (Points 1-6)
        const homeEnd = isP1 ? 5 : 23;   // P2 home: 18-23 (Points 19-24)
        
        let totalCheckersInHome = off[player];
        for (let i = homeStart; i <= homeEnd; i++) {
            if (boardState[i].player === player) {
                totalCheckersInHome += boardState[i].count;
            }
        }
        
        return totalCheckersInHome === NUM_CHECKERS;
    }, [off]);

    const calculatePossibleMoves = useCallback((fromPoint: number, currentMoves: number[]): PossibleMove[] => {
        if (fromPoint === null) return [];

        const isP1 = currentPlayer === Player.Player1;
        const opponent = isP1 ? Player.Player2 : Player.Player1;
        
        // Player must move from the bar if they have checkers there.
        if ((isP1 && bar[Player.Player1] > 0 && fromPoint !== BAR_POINT_PLAYER_1) ||
            (!isP1 && bar[Player.Player2] > 0 && fromPoint !== BAR_POINT_PLAYER_2)) {
            return [];
        }

        const uniqueMoves = [...new Set(currentMoves)];
        const moves: PossibleMove[] = [];
        const bearingOff = canBearOff(currentPlayer, board, bar);

        for (const move of uniqueMoves) {
            // Bar entry move
            if (fromPoint === BAR_POINT_PLAYER_1 || fromPoint === BAR_POINT_PLAYER_2) {
                const entryPoint = isP1 ? NUM_POINTS - move : move - 1;
                if (board[entryPoint].player !== opponent || board[entryPoint].count <= 1) {
                    moves.push({ to: entryPoint, die: move });
                }
                continue;
            }

            const direction = isP1 ? -1 : 1;
            const toPointIndex = fromPoint + (move * direction);

            // Bearing off moves
            if (bearingOff) {
                 const isExactBearOff = isP1 ? fromPoint + 1 === move : NUM_POINTS - fromPoint === move;

                if (isExactBearOff) {
                    moves.push({ to: isP1 ? OFF_POINT_PLAYER_1 : OFF_POINT_PLAYER_2, die: move });
                    continue;
                }
                
                const isOverBearOff = isP1 ? fromPoint + 1 < move : NUM_POINTS - fromPoint < move;
                if (isOverBearOff) {
                    let highestCheckerIndex = -1;
                    if (isP1) { // P1's highest point is the largest index (e.g., index 5 is point 6)
                        for(let i = 5; i >= 0; i--) {
                            if (board[i].player === Player.Player1) { highestCheckerIndex = i; break; }
                        }
                    } else { // P2's highest point is the one with the highest index (e.g. index 23 is point 24)
                        for(let i = 23; i >= 18; i--) {
                             if (board[i].player === Player.Player2) { highestCheckerIndex = i; break; }
                        }
                    }

                    if (fromPoint === highestCheckerIndex) {
                        moves.push({ to: isP1 ? OFF_POINT_PLAYER_1 : OFF_POINT_PLAYER_2, die: move });
                    }
                    continue;
                }
            }

            // Standard moves
            if (toPointIndex >= 0 && toPointIndex < NUM_POINTS) {
                const targetPoint = board[toPointIndex];
                if (targetPoint.player !== opponent || targetPoint.count <= 1) {
                    moves.push({ to: toPointIndex, die: move });
                }
            }
        }
        return moves;
    }, [bar, board, currentPlayer, canBearOff]);
    
    useEffect(() => {
        if(gamePhase !== GamePhase.MOVING || movesRemaining.length === 0) return;
        
        let hasAnyMove = false;
        const barCount = bar[currentPlayer];
        const barPoint = currentPlayer === Player.Player1 ? BAR_POINT_PLAYER_1 : BAR_POINT_PLAYER_2;

        if (barCount > 0) {
            if(calculatePossibleMoves(barPoint, movesRemaining).length > 0) hasAnyMove = true;
        } else {
            for (let i = 0; i < NUM_POINTS; i++) {
                if (board[i].player === currentPlayer) {
                    if (calculatePossibleMoves(i, movesRemaining).length > 0) {
                        hasAnyMove = true;
                        break;
                    }
                }
            }
        }
        
        if (!hasAnyMove) {
            setMessage(`No possible moves for ${PLAYER_NAMES[currentPlayer]}. Turn passed.`);
            setTimeout(() => {
                switchTurn();
            }, 2000);
        }

    }, [gamePhase, movesRemaining, currentPlayer, bar, board, calculatePossibleMoves, switchTurn]);

    useEffect(() => {
        if (selectedPoint === null) {
            setPossibleMoves([]);
            return;
        }
        const moves = calculatePossibleMoves(selectedPoint, movesRemaining);
        setPossibleMoves(moves);
    }, [selectedPoint, movesRemaining, calculatePossibleMoves]);

    const handlePointClick = (pointIndex: number) => {
        if (gamePhase !== GamePhase.MOVING || winner) return;

        const move = possibleMoves.find(m => m.to === pointIndex);

        if (selectedPoint !== null && move) {
            handleMove(selectedPoint, move.to, move.die);
        } else if (bar[currentPlayer] > 0) {
            const barPoint = currentPlayer === Player.Player1 ? BAR_POINT_PLAYER_1 : BAR_POINT_PLAYER_2;
            if(pointIndex === barPoint) setSelectedPoint(barPoint);
        } else if (board[pointIndex]?.player === currentPlayer) {
            setSelectedPoint(pointIndex);
        } else {
            setSelectedPoint(null);
        }
    };
    
    const handleMove = (from: number, to: number, dieUsed: number) => {
        const newMovesRemaining = [...movesRemaining];
        
        let actualDie = dieUsed;
        if(movesRemaining.indexOf(actualDie) === -1) {
            // This handles using a larger die for a smaller move (e.g. using a 5 to move 4)
            // Or over-bearing off. Find a die that is >= dieUsed.
            const availableLargerDie = movesRemaining.find(d => d >= dieUsed);
            if (availableLargerDie) {
                actualDie = availableLargerDie;
            } else {
                 console.error("Attempted to use a die that was not available.");
                 return;
            }
        }
        
        const moveIndex = newMovesRemaining.indexOf(actualDie);
        newMovesRemaining.splice(moveIndex, 1);
        
        const newBoard = [...board].map(p => ({...p}));
        const newBar = { ...bar };
        const newOff = { ...off };

        // Decrement count from starting point
        if (from === BAR_POINT_PLAYER_1) newBar[Player.Player1]--;
        else if (from === BAR_POINT_PLAYER_2) newBar[Player.Player2]--;
        else {
            newBoard[from].count--;
            if (newBoard[from].count === 0) newBoard[from].player = Player.None;
        }

        // Handle bearing off
        if (to === OFF_POINT_PLAYER_1 || to === OFF_POINT_PLAYER_2) {
            newOff[currentPlayer]++;
        } else { // Handle moving to a point on the board
            const opponent = currentPlayer === Player.Player1 ? Player.Player2 : Player.Player1;
            // Handle hit
            if (newBoard[to].player === opponent && newBoard[to].count === 1) {
                newBar[opponent]++;
                newBoard[to].count = 0;
            }
            newBoard[to].player = currentPlayer;
            newBoard[to].count++;
        }

        setBoard(newBoard);
        setBar(newBar);
        setOff(newOff);
        
        setMovesRemaining(newMovesRemaining);
        setUsedMoves(prev => [...prev, actualDie]);
        setSelectedPoint(null);
        setPossibleMoves([]);
        
        if (newOff[currentPlayer] === NUM_CHECKERS) {
            setWinner(currentPlayer);
            setGamePhase(GamePhase.GAME_OVER);
            setMessage(`${PLAYER_NAMES[currentPlayer]} wins the game!`);
            return;
        }

        if (newMovesRemaining.length === 0) {
            setMessage("Turn finished. Passing to next player...");
            setTimeout(() => {
                switchTurn();
            }, 1000);
        } else {
             setMessage(`${PLAYER_NAMES[currentPlayer]}'s turn.`);
        }
    };

    const renderPoints = (start: number, end: number, top: boolean) => {
        const points = [];
        const step = start < end ? 1 : -1;
        for (let i = start; i !== end + step; i += step) {
            const pointColor = ((i % 2) === 0) ? 'bg-amber-200' : 'bg-stone-500';
            const isSelected = selectedPoint === i;
            const isPossibleMove = possibleMoves.some(m => m.to === i);

            points.push(
                <div key={i} className={`relative w-full h-full flex flex-col ${top ? 'justify-start' : 'justify-end'}`} onClick={() => handlePointClick(i)}>
                    <div className={`absolute inset-0 ${pointColor} ${isPossibleMove ? 'opacity-70' : ''}`}>
                         <svg width="100%" height="100%" viewBox="0 0 100 400" preserveAspectRatio="none" className={`fill-current ${top ? 'transform rotate-180' : ''} ${isPossibleMove ? 'text-green-400' : 'text-transparent'}`}>
                           <polygon points="0,400 100,400 50,0" />
                        </svg>
                    </div>
                    <div className={`relative z-10 w-full h-full flex flex-col p-1 gap-[-4px] ${top ? 'justify-start' : 'justify-end'}`}>
                        {Array.from({ length: board[i].count }).map((_, j) => (
                             <div key={j} className={`w-full aspect-square ${isSelected && j === board[i].count-1 ? 'ring-4 ring-cyan-400 rounded-full' : ''}`}>
                                <Checker player={board[i].player} />
                             </div>
                        ))}
                    </div>
                </div>
            );
        }
        return points;
    };
    
    const renderControls = (player: Player) => {
        const isTurn = currentPlayer === player && gamePhase === GamePhase.ROLLING;
        
        const getDieUsedStatus = (index: number) => {
            if (dice.length === 0 || currentPlayer !== player) return false;
            if (dice[0] === dice[1]) { // Doubles
                return usedMoves.length > index;
            } else { // Not doubles
                if (index > 1) return true; // Hide 3rd/4th die
                const dieValue = dice[index];
                const dieCountInRoll = dice.filter(d => d === dieValue).length;
                const dieCountInUsed = usedMoves.filter(m => m === dieValue).length;
                return dieCountInUsed >= dieCountInRoll;
            }
        };

        return (
            <div className={`flex items-center gap-4 ${player === Player.Player2 ? 'flex-row-reverse' : ''}`}>
                 <button 
                    onClick={handleRollDice} 
                    disabled={!isTurn || winner !== null}
                    className="bg-amber-600 hover:bg-amber-500 disabled:bg-stone-600 disabled:text-stone-400 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg shadow-md transition-all duration-200"
                >
                    Roll Dice
                </button>
                <div className="flex gap-2">
                    {dice.length > 0 && currentPlayer === player && <>
                        <Die value={dice[0]} used={getDieUsedStatus(0)} />
                        <Die value={dice[1]} used={getDieUsedStatus(1)} />
                        {dice[0] === dice[1] && <>
                             <Die value={dice[0]} used={getDieUsedStatus(2)} />
                             <Die value={dice[1]} used={getDieUsedStatus(3)} />
                        </>}
                    </>}
                </div>
            </div>
        );
    };

    return (
        <div className="bg-stone-900 text-white min-h-screen flex flex-col items-center justify-center p-2 sm:p-4 font-sans select-none">
            {winner || gamePhase === GamePhase.START ? (
                <div className="text-center">
                    <h1 className="text-5xl font-bold mb-4">{winner ? `${PLAYER_NAMES[winner]} Wins!` : 'Backgammon'}</h1>
                    <button onClick={handleNewGame} className="bg-green-600 hover:bg-green-500 text-white font-bold py-4 px-8 text-2xl rounded-lg shadow-lg transition-transform hover:scale-105">
                        {winner ? 'Play Again' : 'Start New Game'}
                    </button>
                </div>
            ) : (
                <div className="w-full max-w-7xl aspect-[1.5/1] bg-amber-800 rounded-lg shadow-2xl p-2 sm:p-4 flex flex-col border-4 border-amber-950">
                    {/* Player 2 Info Bar (Top) */}
                    <div className="flex justify-between items-center p-2 text-stone-100">
                        <div className={`flex items-center gap-2 ${currentPlayer === Player.Player2 ? 'font-bold ring-2 ring-cyan-400 p-2 rounded-lg' : ''}`}>
                            <div className={`${PLAYER_COLORS[Player.Player2].base} w-6 h-6 rounded-full border-2 ${PLAYER_COLORS[Player.Player2].border}`}></div>
                            <span>{PLAYER_NAMES[Player.Player2]}</span>
                        </div>
                        {renderControls(Player.Player2)}
                    </div>
                    {/* Board Area */}
                    <div className="flex-grow flex bg-green-900 p-2 rounded gap-2 sm:gap-4 border-4 border-amber-900 shadow-inner">
                        {/* Left Side (Outer) */}
                        <div className="w-1/2 flex flex-col-reverse">
                            <div className="h-1/2 grid grid-cols-6">{renderPoints(11, 6, false)}</div>
                            <div className="h-1/2 grid grid-cols-6">{renderPoints(12, 17, true)}</div>
                        </div>
                        {/* Bar */}
                        <div className="w-12 sm:w-16 bg-amber-700 flex flex-col justify-between py-4 rounded-md shadow-inner">
                            <div className="h-1/2 flex flex-col-reverse p-1 gap-1 cursor-pointer" onClick={() => handlePointClick(BAR_POINT_PLAYER_2)}>
                                {Array.from({length: bar[Player.Player2]}).map((_, i) => <div key={i} className={`w-full aspect-square ${selectedPoint === BAR_POINT_PLAYER_2 && i === bar[Player.Player2] - 1 ? 'ring-4 ring-cyan-400 rounded-full' : ''}`}><Checker player={Player.Player2} /></div>)}
                            </div>
                            <div className="h-1/2 flex flex-col p-1 gap-1 cursor-pointer" onClick={() => handlePointClick(BAR_POINT_PLAYER_1)}>
                                 {Array.from({length: bar[Player.Player1]}).map((_, i) => <div key={i} className={`w-full aspect-square ${selectedPoint === BAR_POINT_PLAYER_1 && i === bar[Player.Player1] - 1 ? 'ring-4 ring-cyan-400 rounded-full' : ''}`}><Checker player={Player.Player1} /></div>)}
                            </div>
                        </div>
                         {/* Right Side (Homes) */}
                        <div className="w-1/2 flex flex-col-reverse">
                            <div className="h-1/2 grid grid-cols-6">{renderPoints(5, 0, false)}</div>
                            <div className="h-1/2 grid grid-cols-6">{renderPoints(18, 23, true)}</div>
                        </div>
                        {/* Off Area */}
                        <div className="w-12 sm:w-16 bg-amber-700/50 flex flex-col justify-between p-1 rounded-md">
                            <div className={`h-1/2 flex flex-col-reverse p-1 gap-1 ${possibleMoves.some(m => m.to === OFF_POINT_PLAYER_2) ? 'bg-green-400/50 rounded' : ''}`} onClick={() => handlePointClick(OFF_POINT_PLAYER_2)}>
                                {Array.from({length: off[Player.Player2]}).map((_, i) => <div key={i} className="w-full aspect-square opacity-70"><Checker player={Player.Player2} /></div>)}
                            </div>
                            <div className={`h-1/2 flex flex-col p-1 gap-1 ${possibleMoves.some(m => m.to === OFF_POINT_PLAYER_1) ? 'bg-green-400/50 rounded' : ''}`} onClick={() => handlePointClick(OFF_POINT_PLAYER_1)}>
                                {Array.from({length: off[Player.Player1]}).map((_, i) => <div key={i} className="w-full aspect-square opacity-70"><Checker player={Player.Player1} /></div>)}
                            </div>
                        </div>
                    </div>
                     {/* Player 1 Info Bar (Bottom) */}
                    <div className="flex justify-between items-center p-2 text-stone-100">
                        <div className={`flex items-center gap-2 ${currentPlayer === Player.Player1 ? 'font-bold ring-2 ring-cyan-400 p-2 rounded-lg' : ''}`}>
                            <div className={`${PLAYER_COLORS[Player.Player1].base} w-6 h-6 rounded-full border-2 ${PLAYER_COLORS[Player.Player1].border}`}></div>
                            <span>{PLAYER_NAMES[Player.Player1]}</span>
                        </div>
                        {renderControls(Player.Player1)}
                    </div>
                </div>
            )}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/50 p-2 px-4 rounded-lg text-lg transition-opacity duration-300">
                {message}
            </div>
        </div>
    );
}
// --- END OF APP ---


// --- RENDER THE APP ---
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

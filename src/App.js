import "./styles.css";
import { useRive, Layout, Fit, Alignment, useStateMachineInput } from "@rive-app/react-canvas";
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';

const MOVE_SPEED = 8;
const FRAME_RATE = 1000 / 60; // 60 FPS

const Player = React.memo(({ position, onMove, Success, onSuccessComplete }) => {
    const { rive, RiveComponent } = useRive({
        src: "topgreen.riv",
        stateMachines: "State Machine Main",
        artboard: "Player",
        layout: new Layout({
            fit: Fit.Contain,
            alignment: Alignment.Center,
        }),
        autoplay: true
    });

    // Direction state to track current direction
    const [currentDirection, setCurrentDirection] = useState(0);
    const lastDirectionRef = useRef(0);
    const successTimeoutRef = useRef(null);
    const lastMoveTimeRef = useRef(0);
    const keysRef = useRef(new Set());

    const directionInput = useStateMachineInput(
        rive,
        "State Machine Main",
        "Direction",
        0
    );

    const successInput = useStateMachineInput(
        rive,
        "State Machine Main",
        "Success",
        0
    );

    // Handle direction changes based on movement
    const updateDirection = useCallback((velocityX) => {
        if (velocityX === 0) return;

        const newDirection = velocityX > 0 ? 0 : 1;
        if (newDirection !== currentDirection && directionInput) {
            setCurrentDirection(newDirection);
            lastDirectionRef.current = newDirection;
            directionInput.value = newDirection;
        }
    }, [currentDirection, directionInput]);

    // Handle success state changes
    useEffect(() => {
        if (!successInput) return;

        if (successTimeoutRef.current) {
            clearTimeout(successTimeoutRef.current);
            successTimeoutRef.current = null;
        }

        if (Success) {
            successInput.value = 1;
            successTimeoutRef.current = setTimeout(() => {
                if (successInput && !successInput.isDisposed) {
                    successInput.value = 0;
                    onSuccessComplete();
                }
            }, 500);
        }

        return () => {
            if (successTimeoutRef.current) {
                clearTimeout(successTimeoutRef.current);
            }
        };
    }, [Success, successInput, onSuccessComplete]);

    useEffect(() => {
        let animationFrameId;

        const updatePosition = (timestamp) => {
            // Throttle updates to maintain consistent frame rate
            if (timestamp - lastMoveTimeRef.current < FRAME_RATE) {
                animationFrameId = requestAnimationFrame(updatePosition);
                return;
            }

            let deltaX = 0;
            let deltaY = 0;

            // Use ref for keys to avoid re-renders
            if (keysRef.current.has('ArrowLeft')) deltaX -= MOVE_SPEED;
            if (keysRef.current.has('ArrowRight')) deltaX += MOVE_SPEED;
            if (keysRef.current.has('ArrowUp')) deltaY -= MOVE_SPEED;
            if (keysRef.current.has('ArrowDown')) deltaY += MOVE_SPEED;

            if (deltaX !== 0) {
                updateDirection(deltaX);
            }

            if (deltaX !== 0 || deltaY !== 0) {
                onMove({ x: deltaX, y: deltaY });
                lastMoveTimeRef.current = timestamp;
            }

            animationFrameId = requestAnimationFrame(updatePosition);
        };

        const handleKeyDown = (e) => {
            keysRef.current.add(e.key);
        };

        const handleKeyUp = (e) => {
            keysRef.current.delete(e.key);
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        animationFrameId = requestAnimationFrame(updatePosition);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            cancelAnimationFrame(animationFrameId);
            keysRef.current.clear();
        };
    }, [onMove, updateDirection]);

    // Memoize style to prevent unnecessary recalculations
    const style = useMemo(() => ({
        left: position.x,
        top: position.y
    }), [position.x, position.y]);

    return (
        <div className="player-character" style={style}>
            <RiveComponent />
        </div>
    );
});

const GrassTarget = ({ position }) => {
    const { RiveComponent } = useRive({
        src: "topgreen.riv",
        autoplay: true,
        stateMachines: "Grass",
        artboard: "Grass",
        layout: new Layout({
            fit: Fit.Contain,
            alignment: Alignment.Center
        })
    });

    return (
        <div className="grass-target" style={{
            left: position.x,
            top: position.y
        }}>
            <RiveComponent />
        </div>
    );
};

export default function App() {
    const [gameOver, setGameOver] = useState(false);
    const [score, setScore] = useState(0);
    const [playerPosition, setPlayerPosition] = useState(() => {
        const PLAYER_SIZE = 160;
        const initialX = Math.max(PLAYER_SIZE, Math.min(window.innerWidth - PLAYER_SIZE, 400));
        const initialY = Math.max(PLAYER_SIZE, Math.min(window.innerHeight - PLAYER_SIZE, 400));
        return { x: initialX, y: initialY };
    });
    const [grasses, setGrasses] = useState([]);
    const [success, setSuccess] = useState(false);
    const [spawnInterval, setSpawnInterval] = useState(2000); // Make spawn interval dynamic

    const MAX_GRASS = 100;
    const MIN_SPAWN_INTERVAL = 500; // Fastest spawn rate (0.5 seconds)
    const INITIAL_SPAWN_INTERVAL = 2000; // Starting spawn rate (2 seconds)
    const SPAWN_RATE_DECREASE = 100; // How much to decrease spawn interval per score
    const CAPTURE_DISTANCE = 100;
    const SUCCESS_ANIMATION_DURATION = 500;

    // Update spawn interval when score changes
    useEffect(() => {
        const newInterval = Math.max(
            MIN_SPAWN_INTERVAL,
            INITIAL_SPAWN_INTERVAL - (score * SPAWN_RATE_DECREASE)
        );
        setSpawnInterval(newInterval);
    }, [score]);

    const spawnGrass = useCallback(() => {
        if (grasses.length >= MAX_GRASS) {
            setGameOver(true);
            return;
        }

        const PLAYER_SIZE = 160;
        const GRASS_SIZE = 50;
        const SAFE_MARGIN = PLAYER_SIZE + GRASS_SIZE;

        const newGrass = {
            id: Date.now(),
            position: {
                x: Math.random() * (window.innerWidth - 2 * SAFE_MARGIN) + SAFE_MARGIN,
                y: Math.random() * (window.innerHeight - 2 * SAFE_MARGIN) + SAFE_MARGIN
            }
        };

        setGrasses(prev => [...prev, newGrass]);
    }, [grasses.length]);

    // Update spawn interval effect
    useEffect(() => {
        if (gameOver) return;

        const interval = setInterval(spawnGrass, spawnInterval);
        return () => clearInterval(interval);
    }, [gameOver, spawnGrass, spawnInterval]);

    const handleSuccessComplete = useCallback(() => {
        setSuccess(false);
    }, []);

    const handlePlayerMove = useCallback((delta) => {
        if (gameOver) return;

        setPlayerPosition(prev => {
            // Account for character size (320px) when calculating boundaries
            const PLAYER_SIZE = 160; // Half of 320px since we're using transform: translate(-50%, -50%)

            const newPos = {
                x: Math.max(PLAYER_SIZE, Math.min(window.innerWidth - PLAYER_SIZE, prev.x + delta.x)),
                y: Math.max(PLAYER_SIZE, Math.min(window.innerHeight - PLAYER_SIZE, prev.y + delta.y))
            };

            // Check for captures with the smoothed position
            setGrasses(prevGrasses =>
                prevGrasses.filter(grass => {
                    const distance = Math.sqrt(
                        Math.pow(newPos.x - grass.position.x, 2) +
                        Math.pow(newPos.y - grass.position.y, 2)
                    );

                    if (distance < CAPTURE_DISTANCE && !success) {
                        setScore(prev => prev + 1);
                        setSuccess(true);
                        return false;
                    }
                    return true;
                })
            );

            return newPos;
        });
    }, [gameOver, success]);

    const handleReset = () => {
        const PLAYER_SIZE = 160;
        const initialX = Math.max(PLAYER_SIZE, Math.min(window.innerWidth - PLAYER_SIZE, 400));
        const initialY = Math.max(PLAYER_SIZE, Math.min(window.innerHeight - PLAYER_SIZE, 400));

        setGameOver(false);
        setScore(0);
        setSpawnInterval(INITIAL_SPAWN_INTERVAL); // Reset spawn interval
        setPlayerPosition({ x: initialX, y: initialY });
        setGrasses([]);
    };

    return (
        <div className="game-container">
            <div className="score">Score: {score}</div>

            <Player 
                position={playerPosition}
                onMove={handlePlayerMove}
                Success={success}
                onSuccessComplete={handleSuccessComplete}
            />

            {grasses.map(grass => (
                <GrassTarget 
                    key={grass.id}
                    position={grass.position}
                />
            ))}

            {gameOver && (
                <div className="game-over">
                    <h2>Game Over!</h2>
                    <p>Final Score: {score}</p>
                    <button 
                        className="play-again"
                        onClick={handleReset}
                    >
                        Play Again
                    </button>
                </div>
            )}
        </div>
    );
}
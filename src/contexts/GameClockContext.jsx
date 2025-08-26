import React, { createContext, useContext, useState, useEffect } from 'react';

const GameClockContext = createContext();

export const useGameClock = () => {
  const context = useContext(GameClockContext);
  if (!context) {
    throw new Error('useGameClock must be used within a GameClockProvider');
  }
  return context;
};

export const GameClockProvider = ({ children }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(15 * 60); // 15 minutes in seconds
  const [quarter, setQuarter] = useState(1);
  const [playClockTime, setPlayClockTime] = useState(40);
  const [playClockRunning, setPlayClockRunning] = useState(false);

  // Game clock ticker
  useEffect(() => {
    let interval;
    if (isRunning && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            setIsRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, timeRemaining]);

  // Play clock ticker
  useEffect(() => {
    let interval;
    if (playClockRunning && playClockTime > 0) {
      interval = setInterval(() => {
        setPlayClockTime(prev => {
          if (prev <= 1) {
            setPlayClockRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [playClockRunning, playClockTime]);

  const toggleGameClock = () => {
    setIsRunning(!isRunning);
  };

  const resetPlayClock = (seconds = 40) => {
    setPlayClockTime(seconds);
    setPlayClockRunning(true);
  };

  const stopPlayClock = () => {
    setPlayClockRunning(false);
  };

  const setGameTime = (minutes, seconds) => {
    setTimeRemaining(minutes * 60 + seconds);
  };

  const nextQuarter = () => {
    setQuarter(prev => prev + 1);
    setTimeRemaining(15 * 60); // Reset to 15 minutes
    setIsRunning(false);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const value = {
    // Game Clock
    isRunning,
    timeRemaining,
    quarter,
    toggleGameClock,
    setGameTime,
    nextQuarter,
    formatTime,
    
    // Play Clock
    playClockTime,
    playClockRunning,
    resetPlayClock,
    stopPlayClock,
    
    // Computed values
    gameTimeFormatted: formatTime(timeRemaining),
    playClockFormatted: playClockTime.toString()
  };

  return (
    <GameClockContext.Provider value={value}>
      {children}
    </GameClockContext.Provider>
  );
};

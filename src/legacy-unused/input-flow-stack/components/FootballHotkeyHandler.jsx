import React, { useEffect, useRef } from 'react';
import { useFootballFlow } from '../contexts/FootballFlowContext';
import { useGameState } from '../contexts/FootballGameContext';
import debug from '../utils/debug';

export default function FootballHotkeyHandler() {
  const { startFlow, currentFlow, isModalOpen } = useFootballFlow();
  const { gameData, updateGameState } = useGameState();
  const submissionInProgress = useRef(false);
  
  // Touchdown detection helper
  const detectTouchdown = (playData) => {
    if (!playData || !gameData?.live_state) return false;
    
    // Check if play explicitly marked as touchdown
    if (playData.is_touchdown || playData.isTouchdown) return true;
    
    // Check end position for scoring plays
    const endYardLine = playData.end_yard_line || playData.endYardLine || playData.finalYardLine;
    if (!endYardLine) return false;
    
    // Determine scoring end zone based on possession
    const possession = gameData.live_state.possession || 'home';
    const targetEndZone = possession === 'home' ? 'V00' : 'H00';
    
    // Check if play reached the goal line
    return endYardLine === targetEndZone || 
           endYardLine === 'V00' || 
           endYardLine === 'H00';
  };
  
  // Automatic possession flip on touchdown
  const handleTouchdownDetected = (playData) => {
    if (!detectTouchdown(playData)) return;
    
    // Gate PAT flow only; DO NOT flip possession here.
    debug.log('[TD] Touchdown detected — gating PAT flow; no early flip.');
    updateGameState({
      live_state: {
        ...gameData.live_state,
        lastPlayWasTouchdown: true
      }
    });
  };
  
  // Debounced submission guard
  const guardedStartFlow = (flowType) => {
    if (submissionInProgress.current) {
      debug.warn('Flow start blocked - submission in progress');
      return;
    }
    
    submissionInProgress.current = true;
    startFlow(flowType);
    
    // Reset guard after short delay
    setTimeout(() => {
      submissionInProgress.current = false;
    }, 500);
  };

  useEffect(() => {
    const handleKeyPress = (e) => {
      // Don't handle hotkeys if modal is open or if typing in an input
      if (isModalOpen || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      // Main play type hotkeys - R, P, U, K, A, E, G
      switch (e.key.toLowerCase()) {
        case 'r':
          e.preventDefault();
          guardedStartFlow('rush');
          break;
        case 'p':
          e.preventDefault();
          guardedStartFlow('pass');
          break;
        case 'u':
          e.preventDefault();
          guardedStartFlow('punt');
          break;
        case 'k':
          e.preventDefault();
          guardedStartFlow('kick');
          break;
        case 'a':
          e.preventDefault();
          // Allow PAT only immediately after a TD; otherwise warn.
          if (gameData?.live_state?.lastPlayWasTouchdown) {
            guardedStartFlow('pat');
          } else {
            debug.warn('[PAT] PAT is only available immediately after a touchdown.');
          }
          break;
        case 'e':
          e.preventDefault();
          guardedStartFlow('penalty');
          break;
        case 'g':
          e.preventDefault();
          guardedStartFlow('gamecontrol');
          break;
        case 'escape':
          // Escape key handled by individual flow components
          break;
        default:
          // Other keys handled by specific flow components
          break;
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [startFlow, isModalOpen, gameData, updateGameState]);
  
  // Listen for play submissions to detect touchdowns
  useEffect(() => {
    const handlePlaySubmitted = (event) => {
      if (event.detail && event.detail.playData) {
        handleTouchdownDetected(event.detail.playData);
      }
    };
    
    // Listen for custom play submission events
    document.addEventListener('playSubmitted', handlePlaySubmitted);
    return () => document.removeEventListener('playSubmitted', handlePlaySubmitted);
  }, [gameData, updateGameState]);

  // This component doesn't render anything visible
  return null;
}

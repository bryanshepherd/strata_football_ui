import React, { useState, useEffect } from 'react';
import { useGameState } from '../contexts/FootballGameContext';
import debug from '../utils/debug';

/**
 * LockStatus component for multi-user safety awareness
 * 
 * Displays current lock status and periodically checks for changes
 * to prevent multiple users from editing simultaneously.
 */
export default function LockStatus() {
  const { gameState, currentGameId } = useGameState();
  const [lockStatus, setLockStatus] = useState(null);
  const [lastPollTime, setLastPollTime] = useState(new Date());

  // Extract lock information from game state
  useEffect(() => {
    if (gameState?.lock_info) {
      setLockStatus(gameState.lock_info);
    }
  }, [gameState]);

  // Poll for lock status changes every 30 seconds
  useEffect(() => {
    if (!currentGameId) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/strata_football/api/football/get_lock_status.php?game_id=${currentGameId}`);
        const data = await response.json();
        
        if (data.success) {
          // Transform flat response to expected lock_info format
          const lockInfo = {
            is_locked: data.locked || false,
            locked_by: data.owner || null,
            locked_by_user: data.owner || null,
            locked_at: data.ts || null,
            can_edit: !data.locked
          };
          setLockStatus(lockInfo);
          setLastPollTime(new Date());
          debug.debug('[LockStatus] Lock status updated:', lockInfo);
        }
      } catch (error) {
        debug.error('[LockStatus] Error polling lock status:', error);
      }
    }, 30000); // Poll every 30 seconds

    return () => clearInterval(pollInterval);
  }, [currentGameId]);

  // Don't render if no game or no lock info
  if (!gameState || !lockStatus) {
    return null;
  }

  // If game is not locked, show green status
  if (!lockStatus.is_locked || !lockStatus.locked_by) {
    return (
      <div className="flex items-center space-x-2 text-green-300">
        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
        <span className="text-sm">Available</span>
      </div>
    );
  }

  // If locked by current user, show blue status
  if (lockStatus.can_edit) {
    return (
      <div className="flex items-center space-x-2 text-blue-300">
        <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
        <span className="text-sm">You are scoring</span>
      </div>
    );
  }

  // If locked by another user, show red warning
  return (
    <div className="flex items-center space-x-2 text-red-300">
      <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
      <div className="text-sm">
        <div className="font-semibold">🔒 Locked</div>
        <div className="text-xs">By: {lockStatus.locked_by_user || 'Another user'}</div>
        <div className="text-xs opacity-75">
          Since: {lockStatus.locked_at ? new Date(lockStatus.locked_at).toLocaleTimeString() : 'Unknown'}
        </div>
      </div>
    </div>
  );
}
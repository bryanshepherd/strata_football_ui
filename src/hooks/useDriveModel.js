// src/hooks/useDriveModel.js
import { useMemo } from 'react';
import { buildDriveModel } from '../utils/driveModel';

/**
 * Hook to build a drive model from game state data
 */
export function useDriveModel(gameState, playLog = []) {
  return useMemo(() => {
    if (!gameState?.live_state) return null;

    // Find active drive - look for drives data in game state
    const drives = gameState.drives || [];
    const activeDrive = drives.find(d => d.IsActive === 1) || drives[drives.length - 1];

    if (!activeDrive) {
      // Create a minimal drive model from current state
      const liveState = gameState.live_state;
      if (!liveState.possession || !liveState.yard_line) return null;
      
      return {
        offense: liveState.possession === 'HOME' ? 'H' : 'V',
        number: null,
        start: liveState.yard_line,
        current: liveState.yard_line,
        down: liveState.down,
        distance: liveState.yards_to_go,
        yardsSoFar: 0,
        events: [],
        breakdown: {
          rush: 0, pass: 0, pen: 0,
          fdRush: 0, fdPass: 0, fdPen: 0
        }
      };
    }

    // Use buildDriveModel with real drive data
    return buildDriveModel(
      gameState.live_state, 
      activeDrive, 
      playLog || gameState.plays || []
    );
  }, [gameState, playLog]);
}

export default useDriveModel;
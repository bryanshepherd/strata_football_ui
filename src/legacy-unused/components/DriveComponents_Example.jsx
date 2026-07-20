// Example showing both drive components side by side
import React from 'react';
import DriveStatusBar from './DriveStatusBar';
import DriveSummary from './DriveSummary';
import { useDriveModel } from '../hooks/useDriveModel';
import { useSimpleDriveModel } from '../hooks/useSimpleDriveModel';
import { useGameState } from '../contexts/FootballGameContext';

export default function DriveComponents_Example() {
  const { gameState } = useGameState();
  
  // Complex drive model (with progress bar)
  const complexDriveModel = useDriveModel(gameState, gameState?.plays);
  
  // Simple drive model (stats only)
  const { driveModel: simpleDriveModel, loading, error } = useSimpleDriveModel(gameState);

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold">Drive Component Examples</h2>
      
      {/* Complex Drive Status Bar */}
      <div>
        <h3 className="text-lg font-semibold mb-2">1. DriveStatusBar (Visual Progress)</h3>
        <DriveStatusBar model={complexDriveModel} />
        {!complexDriveModel && (
          <div className="text-gray-500 text-sm">No drive model available</div>
        )}
      </div>
      
      {/* Simple Drive Summary */}
      <div>
        <h3 className="text-lg font-semibold mb-2">2. DriveSummary (Database Stats)</h3>
        {loading && <div className="text-gray-500 text-sm">Loading...</div>}
        {error && <div className="text-red-500 text-sm">Error: {error}</div>}
        {simpleDriveModel && <DriveSummary model={simpleDriveModel} />}
        {!simpleDriveModel && !loading && !error && (
          <div className="text-gray-500 text-sm">No active drive found</div>
        )}
      </div>

      {/* Debug Info */}
      <div className="mt-8 p-3 bg-gray-100 rounded text-xs">
        <h4 className="font-bold">Debug Info:</h4>
        <div>Game ID: {gameState?.game_info?.game_id}</div>
        <div>Possession: {gameState?.live_state?.possession}</div>
        <div>Ball on: {gameState?.live_state?.yard_line}</div>
        <div>Down & Distance: {gameState?.live_state?.down}&{gameState?.live_state?.yards_to_go}</div>
      </div>
    </div>
  );
}
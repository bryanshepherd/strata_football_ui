import React from 'react';
import debug from '../utils/debug';
import { useGameClock } from '../contexts/GameClockContext';

export default function Scoreboard({ gameState }) {
  const { isRunning } = useGameClock();

  // debug.log('Scoreboard received gameState:', gameState);
  // debug.log('Scoreboard gameState keys:', gameState ? Object.keys(gameState) : 'null');
  // debug.log('Scoreboard has live_state:', !!gameState?.live_state);

  if (!gameState || !gameState.live_state) {
    return (
      <div className="bg-black text-white p-4 text-center">
        <div className="text-lg">Loading scoreboard...</div>
        <div className="text-xs text-red-400">
          Debug: gameState = {gameState ? 'exists' : 'null'}, 
          live_state = {gameState?.live_state ? 'exists' : 'missing'}
        </div>
      </div>
    );
  }

  const { live_state: state, game_info, game_rules } = gameState;

  // Format time function specific to scoreboard using game state
  const formatGameTime = (timeInSeconds) => {
    if (typeof timeInSeconds !== 'number' || isNaN(timeInSeconds)) {
      return '15:00'; // Default fallback
    }
    const mins = Math.floor(timeInSeconds / 60);
    const secs = timeInSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Helper function to get quarter/period display
  const getQuarterDisplay = (quarter) => {
    if (quarter === 1) return '1ST QTR';
    if (quarter === 2) return '2ND QTR';
    if (quarter === 3) return '3RD QTR';
    if (quarter === 4) return '4TH QTR';
    if (quarter > 4) return `OT${quarter - 4}`;
    return `Q${quarter}`;
  };

  // Helper function to get down and distance display
  const getDownAndDistance = () => {
    if (!state.down || !state.distance) return '';
    
    let downText = '';
    switch(state.down) {
      case 1: downText = '1st'; break;
      case 2: downText = '2nd'; break;
      case 3: downText = '3rd'; break;
      case 4: downText = '4th'; break;
      default: downText = `${state.down}th`;
    }
    
    return `${downText} & ${state.distance}`;
  };

  // Helper function to format yard line
  const getYardLineDisplay = () => {
    if (!state.yard_line) return '';
    
    // Handle various yard line formats
    let yardLineStr = state.yard_line.toString();
    
    // If it already contains team abbreviation (like "FROST 30"), use as is
    if (yardLineStr.includes(' ')) {
      return yardLineStr.toUpperCase();
    }
    
    // Try to extract numeric yard line
    const yardLineMatch = yardLineStr.match(/(\d+)/);
    if (!yardLineMatch) {
      // If no number found, return the original string
      return yardLineStr.toUpperCase();
    }
    
    const relativeYL = parseInt(yardLineMatch[1]);
    
    // Handle 50 yard line
    if (relativeYL === 50) return '50 YL';
    
    // Convert relative yard line to traditional display
    // Use possession to pick which team abbreviation to show on the yardline
    const possession = (state.possession || '').toLowerCase();
    if (relativeYL < 50) {
      const teamCode = possession === 'home' ? (game_info.home_team_abbr || 'HOME') : (game_info.visitor_team_abbr || 'VIS');
      return `${teamCode} ${relativeYL}`;
    } else {
      const oppYL = 100 - relativeYL;
      const teamCode = possession === 'home' ? (game_info.visitor_team_abbr || 'VIS') : (game_info.home_team_abbr || 'HOME');
      return `${teamCode} ${oppYL}`;
    }
  };

  // Helper function to render timeout chips
  const renderTimeoutChips = (currentTimeouts, maxTimeouts = 3) => {
    const timeoutCount = currentTimeouts || 0;
    
    return (
      <div className="flex gap-1 justify-center items-center">
        {/* Show remaining timeouts as yellow chips */}
        {Array.from({ length: maxTimeouts }, (_, i) => (
          <div
            key={`timeout-${i}`}
            className={`w-6 h-4 rounded-sm text-xs font-bold flex items-center justify-center ${
              i < timeoutCount 
                ? 'bg-yellow-500 text-black' 
                : 'hidden' // Hide used timeouts completely
            }`}
          >
            TO
          </div>
        ))}
        {/* Show "No TO" text when no timeouts remaining */}
        {timeoutCount === 0 && (
          <div className="text-xs text-gray-400">No TO</div>
        )}
      </div>
    );
  };
  
  // Possession indicator (football icon) - handle both "HOME"/"home" and "VISITOR"/"visitor"
  const possessionTeam = (state.possession || '').toLowerCase();
  const leftPossessionIndicator = possessionTeam === 'home' ? '🏈' : ' ';
  const rightPossessionIndicator = possessionTeam === 'visitor' ? '🏈' : ' ';

  return (
    <div className="bg-black text-white px-8 py-4 w-full">
      {/* Main scoreboard layout */}
      <div className="flex justify-center items-center text-xl">
        
        {/* Home Team Section */}
        <div className="flex items-center space-x-2">
          <span className="font-bold">{(game_info.home_team_short || game_info.home_team_name || 'HOME').toUpperCase()}</span>
          <span>-</span>
          <span className="text-3xl scoreboard-font">{state.home_score}</span>
          <span>{leftPossessionIndicator}</span>
        </div>

        {/* Center separator */}
        <div className="mx-4">|</div>

        {/* Center Section - Clock, Quarter, Down & Distance */}
        <div className="flex items-center space-x-2">
          <span className="text-xl clock-font">{formatGameTime(state.time_remaining)}</span>
          <span>-</span>
          <span className="text-lg scoreboard-font">{getQuarterDisplay(state.quarter)}</span>
        </div>

        {/* Center separator */}
        <div className="mx-4">|</div>

        {/* Visitor Team Section */}
        <div className="flex items-center space-x-2">
          <span>{rightPossessionIndicator}</span>
          <span className="text-3xl scoreboard-font">{state.visitor_score}</span>
          <span>-</span>
          <span className="font-bold">{(game_info.visitor_team_short || game_info.visitor_team_name || 'AWAY').toUpperCase()}</span>
        </div>
      </div>

      {/* Secondary row - Down & Distance, Yard Line, Timeouts */}
      <div className="flex justify-between items-center mt-3 text-sm">
        
        {/* Home Team Timeouts */}
        <div className="text-center" style={{ minWidth: '150px' }}>
          {renderTimeoutChips(state.home_timeouts, 3)}
        </div>

        {/* Center - Down & Distance and Field Position */}
        <div className="flex-1 text-center">
          <div className="text-lg font-bold text-yellow-400">
            {getDownAndDistance()}
          </div>
          <div className="text-sm text-gray-300">
            {getYardLineDisplay()}
          </div>
        </div>

        {/* Visitor Team Timeouts */}
        <div className="text-center" style={{ minWidth: '150px' }}>
          {renderTimeoutChips(state.visitor_timeouts, 3)}
        </div>
      </div>

      {/* Game Status Footer */}
      <div className="text-center mt-2 text-xs text-gray-400">
        {state.game_status}
      </div>
    </div>
  );
}

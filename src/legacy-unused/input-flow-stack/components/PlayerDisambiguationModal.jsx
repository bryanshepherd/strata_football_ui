import React, { useEffect } from 'react';
import debug from '../utils/debug';

export default function PlayerDisambiguationModal({ 
  isOpen, 
  matches, 
  candidates, 
  jersey, 
  defaultIndex, 
  defaultSelection,
  onChoose, 
  onConfirm, 
  onCancel,
  playType = 'rush' // Added to determine which position to prioritize
}) {
  if (!isOpen) return null;
  
  // Use candidates or matches, whichever is provided
  const playerList = candidates || matches || [];
  
  // Smart defaulting based on play type and player positions
  const getSmartDefaultIndex = (players, playType) => {
    if (!players || players.length === 0) return 0;
    
    // Define position priorities based on play type using your position scoring system
    const getPositionScore = (player, playType) => {
      debug.log(`[DISAMBIGUATION] Full player object:`, player);
      debug.log(`[DISAMBIGUATION] All player keys:`, Object.keys(player));
      debug.log(`[DISAMBIGUATION] Scoring player:`, {
        name: player.full_name || player.name,
        jersey: player.jersey_number || player.jersey,
        off_position: player.off_position,
        def_position: player.def_position,
        st_position: player.st_position,
        position_score: player.position_score,
        positionScore: player.positionScore,
        PositionScore: player.PositionScore,
        playType
      });
      
      // Helper to determine position category from position score
      const getPositionCategory = (positionScore) => {
        const score = parseInt(positionScore) || 0;
        if (score >= 300 && score <= 399) return 'offense';
        if (score >= 200 && score <= 299) return 'defense'; 
        if (score >= 100 && score <= 199) return 'special_teams';
        return 'none';
      };
      
      // Map position abbreviations to numerical scores if position_score is missing
      const getNumericScoreFromPosition = (player) => {
        // Try to get existing numerical score first
        const existingScore = player.position_score || player.positionScore;
        if (existingScore && existingScore > 0) {
          return existingScore;
        }
        
        // Map position abbreviations to scores
        const offensePositions = ['QB', 'RB', 'FB', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT', 'OL', 'OT', 'OG'];
        const defensePositions = ['DE', 'DT', 'NT', 'LB', 'ILB', 'OLB', 'MLB', 'CB', 'FS', 'SS', 'S', 'DB'];
        const specialTeamsPositions = ['K', 'P', 'LS', 'KR', 'PR'];
        
        // Check offensive positions
        if (player.off_position && offensePositions.includes(player.off_position.toUpperCase())) {
          return 350; // Mid-range offensive score
        }
        
        // Check defensive positions  
        if (player.def_position && defensePositions.includes(player.def_position.toUpperCase())) {
          return 250; // Mid-range defensive score
        }
        
        // Check special teams positions
        if (player.st_position && specialTeamsPositions.includes(player.st_position.toUpperCase())) {
          return 150; // Mid-range special teams score
        }
        
        return 0; // No valid position found
      };
      
      const positionScore = getNumericScoreFromPosition(player);
      const category = getPositionCategory(positionScore);
      
      debug.log(`[DISAMBIGUATION] Position score: ${positionScore}, category: ${category}`);
      
      switch (playType.toLowerCase()) {
        case 'rush':
          // For rush plays, prioritize offensive positions (300-399)
          if (category === 'offense') {
            debug.log(`[DISAMBIGUATION] Offensive player (${positionScore}), priority: 3`);
            return 3; // Highest priority
          }
          if (category === 'special_teams') {
            debug.log(`[DISAMBIGUATION] Special teams player (${positionScore}), priority: 2`);
            return 2;  // Special teams second
          }
          if (category === 'defense') {
            debug.log(`[DISAMBIGUATION] Defensive player (${positionScore}), priority: 1`);
            return 1; // Defense last
          }
          debug.log(`[DISAMBIGUATION] No valid position score, priority: 0`);
          return 0;
          
        case 'pass':
          // For pass plays, prioritize offensive positions (300-399)
          if (category === 'offense') return 3;
          if (category === 'special_teams') return 2;
          if (category === 'defense') return 1;
          return 0;
          
        case 'kick':
        case 'punt':
          // For kicks/punts, prioritize special teams positions (100-199)
          if (category === 'special_teams') return 3;
          if (category === 'offense') return 2;
          if (category === 'defense') return 1;
          return 0;
          
        case 'defense':
        case 'tackle':
          // For defensive plays, prioritize defensive positions (200-299)
          if (category === 'defense') return 3;
          if (category === 'special_teams') return 2;
          if (category === 'offense') return 1;
          return 0;
          
        default:
          // Default case - prefer offensive positions
          if (category === 'offense') return 3;
          if (category === 'defense') return 2;
          if (category === 'special_teams') return 1;
          return 0;
      }
    };
    
    // Find the player with the highest position score
    debug.log(`[DISAMBIGUATION] Evaluating ${players.length} players for ${playType} play`);
    
    let bestIndex = 0;
    let bestScore = getPositionScore(players[0], playType);
    
    debug.log(`[DISAMBIGUATION] Initial best: index ${bestIndex}, score ${bestScore}`);
    
    for (let i = 1; i < players.length; i++) {
      const score = getPositionScore(players[i], playType);
      debug.log(`[DISAMBIGUATION] Player ${i} score: ${score} (current best: ${bestScore})`);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
        debug.log(`[DISAMBIGUATION] New best: index ${bestIndex}, score ${bestScore}`);
      }
    }
    
    debug.log(`[DISAMBIGUATION] Final selection: index ${bestIndex} with score ${bestScore}`);
    return bestIndex;
  };
  
  const smartDefaultIndex = getSmartDefaultIndex(playerList, playType);
  debug.log(`[DISAMBIGUATION] smartDefaultIndex: ${smartDefaultIndex}, defaultIndex: ${defaultIndex}`);
  const safeIndex = Number.isInteger(defaultIndex) && defaultIndex >= 0 
    ? defaultIndex 
    : smartDefaultIndex;
  debug.log(`[DISAMBIGUATION] safeIndex final: ${safeIndex}`);
  const displayJersey = jersey || playerList[0]?.jersey_number || playerList[0]?.jersey;

  // Handle Enter key to select recommended player
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        const recommendedPlayer = playerList[safeIndex];
        if (recommendedPlayer) {
          debug.log(`[DISAMBIGUATION] Enter pressed - selecting recommended player:`, recommendedPlayer);
          handlePlayerSelect(recommendedPlayer);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, playerList, safeIndex]);
  
  // Handle the callback - use onConfirm or onChoose, whichever is provided
  const handlePlayerSelect = (player) => {
    if (onConfirm) {
      onConfirm(player);
    } else if (onChoose) {
      onChoose(player);
    }
  };
  
  const formatPositions = (match) => {
    const positions = [];
    if (match.off_position) positions.push(`OFF: ${match.off_position}`);
    if (match.def_position) positions.push(`DEF: ${match.def_position}`);
    if (match.st_position) positions.push(`ST: ${match.st_position}`);
    
    // Fallback to legacy position if no specific positions
    if (positions.length === 0 && match.position) {
      positions.push(match.position);
    }
    
    return positions.length > 0 ? positions.join(' • ') : '—';
  };
  
  // Return early if no players to show
  if (!playerList || playerList.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-lg p-4 w-[480px]">
          <h3 className="text-lg font-semibold mb-2">No Players Found</h3>
          <p className="text-sm text-gray-600 mb-3">No players found with jersey #{displayJersey}</p>
          <div className="text-right">
            <button className="text-sm text-gray-600 hover:text-gray-800" onClick={onCancel}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-4 w-[480px]">
        <h3 className="text-lg font-semibold mb-2">Select Player</h3>
        <p className="text-sm text-gray-600 mb-2">Multiple players wear jersey #{displayJersey}. Choose the correct one:</p>
        <p className="text-xs text-blue-600 mb-3">
          💡 The recommended player has the appropriate position for this {playType} play
        </p>
        <ul className="divide-y border rounded">
          {playerList.map((m, i) => {
            const isRecommended = i === safeIndex;
            return (
              <li 
                key={`${m.player_id}-${i}`} 
                className={`p-3 flex items-center justify-between ${
                  isRecommended ? 'bg-blue-50 border-blue-200' : ''
                }`}
              >
                <div className="flex-1">
                  <div className="font-medium flex items-center gap-2">
                    {m.full_name || m.name || `${m.first_name || ''} ${m.last_name || ''}`.trim()} 
                    <span className="text-gray-500">#{m.jersey_number || m.jersey}</span>
                    {isRecommended && (
                      <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-800 bg-blue-100 rounded-full">
                        Recommended
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">{formatPositions(m)}</div>
                  {m.side && <div className="text-xs text-blue-600">{m.side}</div>}
                </div>
                <button
                  autoFocus={i === safeIndex}
                  className={`px-3 py-1 text-sm rounded ml-3 ${
                    isRecommended 
                      ? 'bg-blue-600 text-white hover:bg-blue-700' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  onClick={() => handlePlayerSelect(m)}
                >
                  Select
                </button>
              </li>
            );
          })}
        </ul>
        <div className="mt-3 text-right">
          <button className="text-sm text-gray-600 hover:text-gray-800" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

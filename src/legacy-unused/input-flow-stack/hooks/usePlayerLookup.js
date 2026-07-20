import { useMemo } from 'react';
import debug from '../utils/debug';
import { getPositionPriority } from '../utils/positionPriority';

export default function usePlayerLookup(gameState) {
  // rosters shape: { home: [...], visitor: [...] } players contain {player_id, jersey, name, pos}
  const rosters = gameState?.rosters || { home: [], visitor: [] };

  function findByJersey(teamKey, jerseyNum) {
    const jersey = String(jerseyNum||'').trim();
    if (!jersey) return [];
    const list = Array.isArray(rosters[teamKey]) ? rosters[teamKey] : [];
    
    // debug.debug('[usePlayerLookup] findByJersey search:', {
    //   teamKey, jerseyNum, jersey, listLength: list.length
    // });
    
    const matches = list.filter(p => {
      const playerJersey = String(p.jersey_number || p.JerseyNumber || p.jersey).trim();
      const isMatch = playerJersey === jersey;
      // if (isMatch) {
      //   debug.debug('[usePlayerLookup] Found match:', { player: p, searchJersey: jersey, playerJersey });
      // }
      return isMatch;
    });
    
    // debug.debug('[usePlayerLookup] Search complete:', {
    //   searchJersey: jersey, matchesFound: matches.length
    // });
    
    return matches;
  }

  function pickBestCandidate(players) {
    if (!players?.length) return null;
    const sorted = [...players].sort((a,b) => getPositionPriority(a.position || a.pos) - getPositionPriority(b.position || b.pos));
    return sorted[0];
  }

  return useMemo(() => ({ findByJersey, pickBestCandidate }), [rosters.home, rosters.visitor]);
}

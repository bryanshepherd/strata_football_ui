import React, { useState, useEffect } from 'react';
import debug from '../utils/debug';
import { playerManager } from '../utils/playerManager';

const PlayDescription = ({ play, gameId, gameState }) => {
  const [description, setDescription] = useState('Loading play description...');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const buildDescription = async () => {
      try {
        setLoading(true);
        
        // Get basic play info
        const playType = play.play_type || play.PlayType || 'Unknown';
        const possession = play.possession_team || play.PossessionTeam || '';
        
        let desc = '';
        
        // Get player names if PlayerIDs exist
        const primaryPlayerId = play.primary_player_id || play.PrimaryPlayerID;
        const secondaryPlayerId = play.secondary_player_id || play.SecondaryPlayerID;
        
        let primaryPlayerName = 'Unknown Player';
        let secondaryPlayerName = 'Unknown Player';
        
        // Load player names in parallel
        const playerPromises = [];
        if (primaryPlayerId) {
          playerPromises.push(
            playerManager.getPlayerName(primaryPlayerId)
              .then(name => ({ type: 'primary', name: name || 'Unknown Player' }))
              .catch(() => ({ type: 'primary', name: 'Unknown Player' }))
          );
        }
        if (secondaryPlayerId) {
          playerPromises.push(
            playerManager.getPlayerName(secondaryPlayerId)
              .then(name => ({ type: 'secondary', name: name || 'Unknown Player' }))
              .catch(() => ({ type: 'secondary', name: 'Unknown Player' }))
          );
        }
        
        if (playerPromises.length > 0) {
          const playerResults = await Promise.all(playerPromises);
          playerResults.forEach(result => {
            if (result.type === 'primary') {
              primaryPlayerName = result.name;
            } else if (result.type === 'secondary') {
              secondaryPlayerName = result.name;
            }
          });
        }
        
        // Get jersey numbers from minimal roster data
        const getJerseyNumber = (playerId) => {
          if (!gameState?.rosters || !playerId) return null;
          
          const allPlayers = [
            ...(gameState.rosters.home || []),
            ...(gameState.rosters.visitor || [])
          ];
          
          const player = allPlayers.find(p => p.player_id === playerId);
          return player?.jersey_number || null;
        };
        
        const primaryPlayerNumber = getJerseyNumber(primaryPlayerId);
        const secondaryPlayerNumber = getJerseyNumber(secondaryPlayerId);
        
        // Build description based on play type
        if (playType === 'PASS') {
          desc = `${primaryPlayerName}`;
          if (primaryPlayerNumber) desc += ` (#${primaryPlayerNumber})`;
          desc += ` pass`;
          
          if (secondaryPlayerId && secondaryPlayerName !== 'Unknown Player') {
            desc += ` to ${secondaryPlayerName}`;
            if (secondaryPlayerNumber) desc += ` (#${secondaryPlayerNumber})`;
          }
        } else if (playType === 'RUSH') {
          desc = `${primaryPlayerName}`;
          if (primaryPlayerNumber) desc += ` (#${primaryPlayerNumber})`;
          desc += ` rush`;
        } else if (playType === 'PUNT') {
          desc = `${primaryPlayerName}`;
          if (primaryPlayerNumber) desc += ` (#${primaryPlayerNumber})`;
          desc += ` punt`;
        } else if (playType === 'KICK') {
          desc = `${primaryPlayerName}`;
          if (primaryPlayerNumber) desc += ` (#${primaryPlayerNumber})`;
          desc += ` kick`;
        } else {
          desc = `${playType}`;
          if (primaryPlayerId && primaryPlayerName !== 'Unknown Player') {
            desc += ` by ${primaryPlayerName}`;
            if (primaryPlayerNumber) desc += ` (#${primaryPlayerNumber})`;
          }
        }
        
        // Add yardage
        const yardsGained = play.yards_gained !== undefined ? play.yards_gained : play.YardsGained;
        if (yardsGained !== undefined && yardsGained !== null) {
          if (yardsGained > 0) {
            desc += ` for ${yardsGained} yards`;
          } else if (yardsGained < 0) {
            desc += ` for ${Math.abs(yardsGained)} yard loss`;
          } else {
            desc += ` for no gain`;
          }
        }
        
        // Add result
        const result = play.end_of_play || play.result || play.PlayResult;
        if (result && result !== 'TACKLE') {
          desc += ` (${result.toLowerCase()})`;
        }
        
        // Add penalty info if present
        const penaltyType = play.penalty_type || play.PenaltyType;
        const hasPenalty = play.has_penalty || play.HasPenalty;
        
        if (hasPenalty || penaltyType) {
          desc += ` - PENALTY: ${penaltyType || 'Unknown penalty'}`;
        }
        
        // Add turnover info
        if (play.is_turnover || play.IsTurnover) {
          desc += ` - TURNOVER`;
        }
        
        // Add touchdown info
        if (play.is_touchdown || play.IsTouchdown) {
          desc += ` - TOUCHDOWN`;
        }
        
        if (mounted) {
          setDescription(desc);
          setLoading(false);
        }
        
      } catch (error) {
        console.error('Error building play description:', error);
        if (mounted) {
          setDescription(play.play_description || play.PlayDescription || 'Error loading description');
          setLoading(false);
        }
      }
    };

    buildDescription();

    return () => {
      mounted = false;
    };
  }, [play, gameId, gameState]);

  if (loading) {
    return <span className="text-gray-400">Loading...</span>;
  }

  return <span>{description}</span>;
};

export default PlayDescription;

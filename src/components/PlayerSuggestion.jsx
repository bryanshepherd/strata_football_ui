import React, { useState, useEffect } from 'react';
import { playerManager } from '../utils/playerManager';

const PlayerSuggestion = ({ player, onClick, gameId }) => {
  const [playerName, setPlayerName] = useState('Loading...');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadPlayerName = async () => {
      try {
        const name = await playerManager.getPlayerName(player.id);
        if (mounted) {
          setPlayerName(name || 'Unknown Player');
          setLoading(false);
        }
      } catch (error) {
        if (mounted) {
          setPlayerName('Unknown Player');
          setLoading(false);
        }
      }
    };

    if (player.id) {
      loadPlayerName();
    } else {
      setPlayerName('Unknown Player');
      setLoading(false);
    }

    return () => {
      mounted = false;
    };
  }, [player.id]);

  const handleClick = () => {
    onClick({
      ...player,
      name: playerName
    });
  };

  return (
    <div
      onClick={handleClick}
      className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
    >
      <div className="flex justify-between items-center">
        <div>
          <span className="font-medium">
            {loading ? 'Loading...' : playerName}
          </span>
          <span className="text-gray-500 ml-2">#{player.jersey_number}</span>
          {player.team && (
            <span className={`ml-2 px-1 py-0.5 text-xs rounded ${
              player.team === 'home' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
            }`}>
              {player.team.toUpperCase()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlayerSuggestion;

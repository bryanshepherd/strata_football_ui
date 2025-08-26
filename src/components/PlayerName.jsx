import React, { useState, useEffect } from 'react';
import { playerManager } from '../utils/playerManager';

const PlayerName = ({ playerId, gameId, possession, showNumber = false, className = "" }) => {
  const [playerInfo, setPlayerInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!playerId) {
      setPlayerInfo(null);
      setLoading(false);
      return;
    }

    let mounted = true;

    const loadPlayerInfo = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const playerDetails = await playerManager.getPlayerDetails(playerId);
        
        if (mounted) {
          setPlayerInfo(playerDetails);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError(err.message);
          setLoading(false);
        }
      }
    };

    loadPlayerInfo();

    return () => {
      mounted = false;
    };
  }, [playerId]);

  if (loading) {
    return <span className={`text-gray-400 ${className}`}>Loading...</span>;
  }

  if (error || !playerInfo) {
    return <span className={`text-gray-500 ${className}`}>Unknown Player</span>;
  }

  return (
    <span className={className}>
      {playerInfo.full_name}
      {showNumber && <span className="text-gray-600"> (#{playerId})</span>}
    </span>
  );
};

export default PlayerName;

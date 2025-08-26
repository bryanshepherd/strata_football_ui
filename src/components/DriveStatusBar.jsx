import React, { useEffect, useState } from 'react';
import debug from '../utils/debug';
import PropTypes from 'prop-types';
import { toPossessionRelative } from '../utils/DownDistanceCalculator';
import { useGameState } from '../contexts/FootballGameContext';

export default function DriveStatusBar({ gameId: propGameId, currentDriveId: propDriveId, lastPlayNumber: propLastPlayNumber }) {
  const { gameState } = useGameState();
  const currentDrive = gameState?.current_drive || null;
  const gameId = propGameId || gameState?.game_info?.game_id;
  const currentDriveId = propDriveId || gameState?.current_drive?.DriveID;
  const lastPlayNumber = propLastPlayNumber || gameState?.recent_plays?.[0]?.OverallPlayNum;

  const [driveStats, setDriveStats] = useState(null);
  const [playerStats, setPlayerStats] = useState([]);
debug.log("DriveStatusBar rendering...");
  useEffect(() => {
    if (!currentDriveId) {
      setDriveStats(null);
      return;
    }

    fetch(`/php/load_drive_stats.php?drive_id=${currentDriveId}`)
      .then(res => res.json())
      .then(data => setDriveStats(data))
      .catch(err => {
        console.error('Drive stats error:', err);
        setDriveStats(null);
      });
  }, [currentDriveId]);

  useEffect(() => {
    if (!lastPlayNumber || !gameId) {
      setPlayerStats([]);
      return;
    }

    fetch(`/php/load_play_participants.php?game_id=${gameId}&play_number=${lastPlayNumber}`)
      .then(res => res.json())
      .then(data => setPlayerStats(Array.isArray(data) ? data : []))
      .catch(err => {
        console.error('Player stats error:', err);
        setPlayerStats([]);
      });
  }, [lastPlayNumber, gameId]);

  if (!driveStats) {
    debug.log("No driveStats");
    return (
      <div style={{ backgroundColor: 'orange', color: 'black', padding: '10px' }}>
        No drive data available.
      </div>
    );
  }

  const {
    StartYardLine = null,
    EndYardLine = null,
    StartTime = null,
    EndTime = null,
    PlayCount = 0
  } = driveStats;

  const yards = toPossessionRelative(StartYardLine, EndYardLine);
  const playCount = PlayCount || 0;

  return (
    <div className="bg-gray-100 border-t border-b border-gray-300 py-2 px-4 text-sm flex justify-between items-center">
      <div className="font-semibold">
        Drive Summary: {yards} yards on {playCount} plays
        {StartTime && <span className="ml-3 text-gray-600">Start: {StartTime}</span>}
        {EndTime && <span className="ml-2 text-gray-600">End: {EndTime}</span>}
      </div>
      <div className="text-right">
        <div className="font-semibold mb-1">Players in Last Play:</div>
        {playerStats.length === 0 ? (
          <div className="text-gray-500">None</div>
        ) : (
          playerStats.map((p, i) => (
            <div key={i} className="text-xs">
              #{p.Jersey} {p.Name} — {p.StatLine}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

DriveStatusBar.propTypes = {
  gameId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  currentDriveId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  lastPlayNumber: PropTypes.oneOfType([PropTypes.number, PropTypes.string])
};

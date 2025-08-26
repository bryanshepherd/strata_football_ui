import React, { useContext, useEffect, useState } from 'react';
import { FootballGameContext, useGameState } from '../contexts/FootballGameContext';

export default function PlayerRosterBar() {
  const { gameData, currentDrive, lastPlayData } = useGameState();
  const [playersInvolved, setPlayersInvolved] = useState([]);

  // Update players involved when a new play is submitted
  useEffect(() => {
    if (lastPlayData) {
      updatePlayersInvolved(lastPlayData);
    }
  }, [lastPlayData]);

  const updatePlayersInvolved = (playData) => {
    const players = [];
    
    // Extract players based on play type
    switch (playData.playType) {
      case 'rush':
        if (playData.rusher) {
          players.push({
            player: playData.rusher,
            role: 'Rusher',
            stats: getPlayerStats(playData.rusher.id, 'rushing')
          });
        }
        if (playData.tackler1) {
          players.push({
            player: playData.tackler1,
            role: 'Tackler',
            stats: getPlayerStats(playData.tackler1.id, 'defense')
          });
        }
        if (playData.tackler2) {
          players.push({
            player: playData.tackler2,
            role: 'Assist',
            stats: getPlayerStats(playData.tackler2.id, 'defense')
          });
        }
        break;
        
      case 'pass':
        if (playData.quarterback) {
          players.push({
            player: playData.quarterback,
            role: 'QB',
            stats: getPlayerStats(playData.quarterback.id, 'passing')
          });
        }
        if (playData.receiver && playData.passResult === 'complete') {
          players.push({
            player: playData.receiver,
            role: 'Receiver',
            stats: getPlayerStats(playData.receiver.id, 'receiving')
          });
        }
        if (playData.tackler1) {
          players.push({
            player: playData.tackler1,
            role: 'Tackler',
            stats: getPlayerStats(playData.tackler1.id, 'defense')
          });
        }
        if (playData.defender) {
          players.push({
            player: playData.defender,
            role: 'Defender',
            stats: getPlayerStats(playData.defender.id, 'defense')
          });
        }
        break;
        
      case 'punt':
        if (playData.punter) {
          players.push({
            player: playData.punter,
            role: 'Punter',
            stats: getPlayerStats(playData.punter.id, 'kicking')
          });
        }
        if (playData.returner) {
          players.push({
            player: playData.returner,
            role: 'Returner',
            stats: getPlayerStats(playData.returner.id, 'returning')
          });
        }
        break;
        
      case 'kick':
        if (playData.kicker) {
          players.push({
            player: playData.kicker,
            role: 'Kicker',
            stats: getPlayerStats(playData.kicker.id, 'kicking')
          });
        }
        if (playData.returner) {
          players.push({
            player: playData.returner,
            role: 'Returner',
            stats: getPlayerStats(playData.returner.id, 'returning')
          });
        }
        break;
    }
    
    setPlayersInvolved(players);
  };

  const getPlayerStats = (playerId, statType) => {
    // Mock stats data - in real implementation, this would come from your stats API
    const mockStats = {
      rushing: { attempts: 12, yards: 78, avg: 6.5, tds: 1 },
      passing: { attempts: 24, completions: 16, yards: 203, tds: 2, ints: 0 },
      receiving: { catches: 5, yards: 67, avg: 13.4, tds: 1 },
      defense: { tackles: 8, assists: 3, sacks: 1.5, ints: 0 },
      kicking: { fgm: 2, fga: 3, pats: 4, punts: 3, avg: 42.7 },
      returning: { returns: 2, yards: 45, avg: 22.5, tds: 0 }
    };
    
    return mockStats[statType] || {};
  };

  const formatStatLine = (stats, statType) => {
    switch (statType) {
      case 'rushing':
        return `${stats.attempts || 0} att, ${stats.yards || 0} yds, ${stats.avg || 0} avg`;
      case 'passing':
        return `${stats.completions || 0}/${stats.attempts || 0}, ${stats.yards || 0} yds, ${stats.tds || 0} TD`;
      case 'receiving':
        return `${stats.catches || 0} rec, ${stats.yards || 0} yds, ${stats.avg || 0} avg`;
      case 'defense':
        return `${stats.tackles || 0} tkl, ${stats.assists || 0} ast, ${stats.sacks || 0} sck`;
      case 'kicking':
        return `${stats.fgm || 0}/${stats.fga || 0} FG, ${stats.pats || 0} PAT`;
      case 'returning':
        return `${stats.returns || 0} ret, ${stats.yards || 0} yds, ${stats.avg || 0} avg`;
      default:
        return 'No stats';
    }
  };

  // Default drive data if none available
  const driveData = currentDrive || {
    plays: 0,
    yards: 0,
    startYardLine: 'Own 25',
    startTime: '15:00',
    possessionTeam: 'home'
  };

  return (
    <div className="mb-4 bg-white border border-gray-200 rounded-lg shadow-sm">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
        
        {/* Drive Status Half */}
        <div className="space-y-3">
          <h3 className="text-lg font-bold text-gray-800 border-b border-gray-200 pb-2">
            Current Drive Status
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 p-3 rounded">
              <div className="text-sm text-gray-600">Plays</div>
              <div className="text-2xl font-bold text-blue-600">{driveData.plays}</div>
            </div>
            
            <div className="bg-green-50 p-3 rounded">
              <div className="text-sm text-gray-600">Yards</div>
              <div className="text-2xl font-bold text-green-600">{driveData.yards}</div>
            </div>
            
            <div className="bg-purple-50 p-3 rounded">
              <div className="text-sm text-gray-600">Start Position</div>
              <div className="text-lg font-bold text-purple-600">{driveData.startYardLine}</div>
            </div>
            
            <div className="bg-orange-50 p-3 rounded">
              <div className="text-sm text-gray-600">Start Time</div>
              <div className="text-lg font-bold text-orange-600">{driveData.startTime}</div>
            </div>
          </div>
        </div>

        {/* Player Stats Half */}
        <div className="space-y-3">
          <h3 className="text-lg font-bold text-gray-800 border-b border-gray-200 pb-2">
            Players in Last Play
          </h3>
          
          {playersInvolved.length > 0 ? (
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {playersInvolved.map((playerData, index) => (
                <div key={index} className="bg-gray-50 p-2 rounded border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                        {playerData.player.number}
                      </div>
                      <div>
                        <div className="font-bold text-sm">{playerData.player.name}</div>
                        <div className="text-xs text-gray-600">{playerData.role}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-medium text-gray-800">
                        {formatStatLine(playerData.stats, playerData.role.toLowerCase())}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-6">
              <div className="text-3xl mb-2">�</div>
              <div className="text-sm">Player stats will appear here after plays are submitted</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

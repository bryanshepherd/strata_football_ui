import React, { useState, useEffect, useMemo } from 'react';
import debug from '../utils/debug';
import { playerManager } from '../utils/playerManager';
import { getTeamTotals, getPlayerTotals } from '../utils/apiClient';
import PlayerName from './PlayerName';
import DriveSummary from './DriveSummary';
import { useSimpleDriveModel } from '../hooks/useSimpleDriveModel';

export default function TeamPlayerStats({ gameState, gameId, refreshKey = 0 }) {
  // State for real stats data
  const [teamStats, setTeamStats] = useState([]);
  const [players, setPlayers] = useState({ rushing: [], passing: [], receiving: [] });
  const [statsLoading, setStatsLoading] = useState(false);

  // Debug logging
  debug.log('TeamPlayerStats received gameState:', gameState);
  debug.log('gameState keys:', gameState ? Object.keys(gameState) : 'gameState is null/undefined');
  
  // Get simplified drive model
  const { driveModel, loading: driveLoading, error: driveError } = useSimpleDriveModel(gameState);

  // Load team stats from DB
  useEffect(() => {
    if (!gameId) return;
    (async () => {
      try {
        setStatsLoading(true);
        const teams = await getTeamTotals(gameId);
        setTeamStats(teams); // [{Team:'HOME', RushPlays, RushYards, PassAtt, PassComp, PassYards, ...}, ...]
        debug.log('Loaded team stats from DB:', teams);
      } catch (e) { 
        console.error('Team stats load failed', e); 
      } finally {
        setStatsLoading(false);
      }
    })();
  }, [gameId, refreshKey]); // refreshKey should bump when CRUD ops succeed

  // Load player stats from DB  
  useEffect(() => {
    if (!gameId) return;
    (async () => {
      try {
        const data = await getPlayerTotals(gameId);
        setPlayers({
          rushing:  data.rushing,
          passing:  data.passing,
          receiving: data.receiving
        });
        debug.log('Loaded player stats from DB:', data);
      } catch (e) { 
        console.error('Player stats load failed', e); 
      }
    })();
  }, [gameId, refreshKey]);
  
  if (!gameState?.game_info || !gameState?.live_state) {
    debug.log('Missing game_info or live_state:', {
      hasGameInfo: !!gameState?.game_info,
      hasLiveState: !!gameState?.live_state,
      gameStateKeys: gameState ? Object.keys(gameState) : null
    });
    
    return (
      <div className="p-4">
        <h2 className="text-lg font-bold mb-2">TEAM/PLAYER STATS</h2>
        <div className="text-gray-500">Loading...</div>
        <div className="text-xs text-red-500 mt-2">
          Debug: gameState keys = {gameState ? Object.keys(gameState).join(', ') : 'null'}
        </div>
      </div>
    );
  }

  const { game_info: gameInfo, live_state: liveState } = gameState;

  // Extract team stats from the DB data
  const getTeamStats = (team) => {
    const teamName = team === 'home' ? 'HOME' : 'VISITOR';
    const teamData = teamStats.find(t => t.Team === teamName) || {};
    return {
      // First Downs (we don't have this in basic stats, use 0 for now)
      firstDowns: 0,
      
      // Passing - from DB with sack exclusion
      passComp: teamData.PassComp || 0,
      passAtt: teamData.PassAtt || 0,
      passYds: teamData.PassYards || 0,
      passTD: 0, // TD info not in basic team totals
      passInt: teamData.Interceptions || 0,
      
      // Rushing - from DB including sacks
      rushAtt: teamData.RushPlays || 0,
      rushYds: teamData.RushYards || 0,
      rushTD: 0, // TD info not in basic team totals
      
      // Total Offense
      totalYds: (teamData.RushYards || 0) + (teamData.PassYards || 0),
      totalPlays: (teamData.RushPlays || 0) + (teamData.PassAtt || 0),
      totalTD: 0, // TD info not in basic team totals
      
      // Defense (not available in basic stats)
      sacks: 0,
      tackles: 0,
      tackleForLoss: 0,
      interceptions: teamData.Interceptions || 0,
      fumbles: 0,
      fumblesLost: 0,
      
      // Special Teams - from DB
      punts: teamData.Punts || 0,
      puntAverage: 0, // Not calculated in basic stats
      puntStats: `${teamData.Punts || 0}-0.0`,
      fieldGoals: teamData.FGM || 0,
      fieldGoalAtt: teamData.FGA || 0,
      
      // Penalties - from DB
      penalties: teamData.Penalties || 0,
      penaltyYds: teamData.PenaltyYards || 0,
      
      // Down conversions (not in basic stats)
      thirdDownAttempts: 0,
      thirdDownConversions: 0,
      fourthDownAttempts: 0,
      fourthDownConversions: 0,
      
      players: [] // Will use separate players state
    };
  };

  const homeStats = getTeamStats('home');
  const visitorStats = getTeamStats('visitor');

  // Format passing stats as "Comp-Att, Yds, TD-INT"
  const formatPassingStat = (comp, att, yds, td, int) => {
    const compPct = att > 0 ? ((comp / att) * 100).toFixed(1) : '0.0';
    return `${comp}-${att} (${compPct}%), ${yds} yds, ${td}-${int}`;
  };

  // Get top players across both teams from real DB data
  const getAllPlayers = () => {
    const allPlayers = [];
    
    // Combine rushing, passing, and receiving stats from DB
    if (players.rushing) {
      players.rushing.forEach(p => {
        allPlayers.push({
          id: p.PlayerID,
          team: p.Team === 'HOME' ? 'home' : 'visitor',
          name: `Player #${p.PlayerID}`,
          type: 'rushing',
          stats: { rushes: p.Rushes, rushYards: p.RushYards }
        });
      });
    }
    
    if (players.passing) {
      players.passing.forEach(p => {
        allPlayers.push({
          id: p.PlayerID,
          team: p.Team === 'HOME' ? 'home' : 'visitor',
          name: `Player #${p.PlayerID}`,
          type: 'passing',
          stats: { 
            attempts: p.Attempts, 
            completions: p.Completions, 
            passYards: p.PassYards,
            interceptions: p.Interceptions 
          }
        });
      });
    }
    
    if (players.receiving) {
      players.receiving.forEach(p => {
        allPlayers.push({
          id: p.PlayerID,
          team: p.Team === 'HOME' ? 'home' : 'visitor',
          name: `Player #${p.PlayerID}`,
          type: 'receiving',
          stats: { receptions: p.Receptions, recYards: p.RecYards }
        });
      });
    }
    
    return allPlayers;
  };

  // Memoize players list to avoid recalculating on every render
  const allPlayers = useMemo(() => getAllPlayers(), [players]);

  // Find top players - only show if they have actual stats
  const topPasser = allPlayers.reduce((top, player) => 
    (player.stats.passYards || 0) > (top?.stats?.passYards || 0) ? player : top, null
  );

  const topRusher = allPlayers.reduce((top, player) => 
    (player.stats.rushYards || 0) > (top?.stats?.rushYards || 0) ? player : top, null
  );

  const topReceiver = allPlayers.reduce((top, player) => 
    (player.stats.receivingYards || 0) > (top?.stats?.receivingYards || 0) ? player : top, null
  );

  const topTackler = allPlayers.reduce((top, player) => 
    (player.stats.tackles || 0) > (top?.stats?.tackles || 0) ? player : top, null
  );

  // Check if we have any meaningful stats to display
  const hasStats = allPlayers.length > 0 && allPlayers.some(p => 
    (p.stats.passYards || 0) > 0 || (p.stats.rushYards || 0) > 0 || (p.stats.receivingYards || 0) > 0 || (p.stats.tackles || 0) > 0
  );

  const renderTeamStat = (label, homeValue, visitorValue) => (
    <tr>
      <td className="border border-black text-left pl-1 text-xs">{label}</td>
      <td className="border border-black text-center text-xs">{homeValue}</td>
      <td className="border border-black text-center text-xs">{visitorValue}</td>
    </tr>
  );

  // Get top 2 players in each category by team
  const getTopPlayersByCategory = (statKey) => {
    const homePlayers = allPlayers
      .filter(p => p.team === 'home' && (p.stats[statKey] || 0) > 0)
      .sort((a, b) => (b.stats[statKey] || 0) - (a.stats[statKey] || 0))
      .slice(0, 2);
    
    const visitorPlayers = allPlayers
      .filter(p => p.team === 'visitor' && (p.stats[statKey] || 0) > 0)
      .sort((a, b) => (b.stats[statKey] || 0) - (a.stats[statKey] || 0))
      .slice(0, 2);
    
    return { home: homePlayers, visitor: visitorPlayers };
  };

  const formatPlayerStat = (player, statKey, suffix) => {
    if (!player || (player.stats[statKey] || 0) === 0) return '-';
    
    const playerNumber = player.id;
    const statValue = player.stats[statKey];
    
    return (
      <span>
        <PlayerName 
          playerId={player.id} 
          gameId={gameId}
          className="inline-block bg-blue-600 text-white px-1 py-0.5 rounded text-xs font-bold mr-1"
        />
        <span className="text-xs">{statValue} {suffix}</span>
      </span>
    );
  };

  const renderTopPlayersByCategory = (categoryKey, statKey, suffix) => {
    const topPlayers = getTopPlayersByCategory(statKey);
    
    return Array.from({ length: 2 }).map((_, i) => (
      <tr key={`${categoryKey}-row-${i}`}>
        <td className="border border-black text-left pl-1 text-xs">{i + 1}.</td>
        <td className="border border-black text-left px-1 text-xs">
          {formatPlayerStat(topPlayers.home[i], statKey, suffix)}
        </td>
        <td className="border border-black text-left px-1 text-xs">
          {formatPlayerStat(topPlayers.visitor[i], statKey, suffix)}
        </td>
      </tr>
    ));
  };

  return (
    <div className="p-2 overflow-y-auto h-full">
      <h2 className="text-lg font-bold mb-2">TEAM/PLAYER STATS</h2>
      
      {/* Quarter Scores */}
      <table className="w-full text-xs border border-black mb-4">
        <thead>
          <tr className="bg-gray-200">
            <th className="border border-black text-xs">Team</th>
            <th className="border border-black text-xs">1st</th>
            <th className="border border-black text-xs">2nd</th>
            <th className="border border-black text-xs">3rd</th>
            <th className="border border-black text-xs">4th</th>
            <th className="border border-black text-xs">Final</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-black font-bold text-xs">
              {gameInfo.visitor_team_abbr || gameInfo.visitor_team_name?.substring(0, 6).toUpperCase()}
            </td>
            <td className="border border-black text-center text-xs">
              {liveState.quarter_stats?.[1]?.visitor_score || 0}
            </td>
            <td className="border border-black text-center text-xs">
              {liveState.quarter_stats?.[2]?.visitor_score || 0}
            </td>
            <td className="border border-black text-center text-xs">
              {liveState.quarter_stats?.[3]?.visitor_score || 0}
            </td>
            <td className="border border-black text-center text-xs">
              {liveState.quarter_stats?.[4]?.visitor_score || 0}
            </td>
            <td className="border border-black text-center font-bold text-xs">
              {liveState.visitor_score}
            </td>
          </tr>
          <tr>
            <td className="border border-black font-bold text-xs">
              {gameInfo.home_team_abbr || gameInfo.home_team_name?.substring(0, 6).toUpperCase()}
            </td>
            <td className="border border-black text-center text-xs">
              {liveState.quarter_stats?.[1]?.home_score || 0}
            </td>
            <td className="border border-black text-center text-xs">
              {liveState.quarter_stats?.[2]?.home_score || 0}
            </td>
            <td className="border border-black text-center text-xs">
              {liveState.quarter_stats?.[3]?.home_score || 0}
            </td>
            <td className="border border-black text-center text-xs">
              {liveState.quarter_stats?.[4]?.home_score || 0}
            </td>
            <td className="border border-black text-center font-bold text-xs">
              {liveState.home_score}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Team Statistics */}
      <table className="w-full text-xs border border-black">
        <thead>
          <tr className="bg-gray-200">
            <th className="border border-black text-left pl-1 text-xs">Stat</th>
            <th className="border border-black text-xs">
              {gameInfo.home_team_abbr || gameInfo.home_team_name?.substring(0, 6).toUpperCase()}
            </th>
            <th className="border border-black text-xs">
              {gameInfo.visitor_team_abbr || gameInfo.visitor_team_name?.substring(0, 6).toUpperCase()}
            </th>
          </tr>
        </thead>
        <tbody>
          {renderTeamStat('1st Downs', homeStats.firstDowns, visitorStats.firstDowns)}
          {renderTeamStat('Rushes-Yds', 
            `${homeStats.rushAtt}-${homeStats.rushYds}`,
            `${visitorStats.rushAtt}-${visitorStats.rushYds}`
          )}
          {renderTeamStat('Passes', 
            `${homeStats.passComp}-${homeStats.passAtt}-${homeStats.passInt}`,
            `${visitorStats.passComp}-${visitorStats.passAtt}-${visitorStats.passInt}`
          )}
          {renderTeamStat('Passing Yards', homeStats.passYds, visitorStats.passYds)}
          {renderTeamStat('Total Off.', 
            `${homeStats.totalPlays}-${homeStats.totalYds}`,
            `${visitorStats.totalPlays}-${visitorStats.totalYds}`
          )}
          {renderTeamStat('Avg Per Play', 
            homeStats.totalPlays > 0 ? (homeStats.totalYds / homeStats.totalPlays).toFixed(1) : '0.0',
            visitorStats.totalPlays > 0 ? (visitorStats.totalYds / visitorStats.totalPlays).toFixed(1) : '0.0'
          )}
          {renderTeamStat('Fumbles-Lost', 
            `${homeStats.fumbles}-${homeStats.fumblesLost}`,
            `${visitorStats.fumbles}-${visitorStats.fumblesLost}`
          )}
          {renderTeamStat('Penalties', 
            `${homeStats.penalties}-${homeStats.penaltyYds}`,
            `${visitorStats.penalties}-${visitorStats.penaltyYds}`
          )}
          {renderTeamStat('Punts', 
            homeStats.puntStats,
            visitorStats.puntStats
          )}
          {renderTeamStat('T.O.P', 
            liveState.time_of_possession?.home || '00:00',
            liveState.time_of_possession?.visitor || '00:00'
          )}
          {renderTeamStat('3rd Downs', 
            `${homeStats.thirdDownConversions}-${homeStats.thirdDownAttempts}`,
            `${visitorStats.thirdDownConversions}-${visitorStats.thirdDownAttempts}`
          )}
          {renderTeamStat('4th Downs', 
            `${homeStats.fourthDownConversions}-${homeStats.fourthDownAttempts}`,
            `${visitorStats.fourthDownConversions}-${visitorStats.fourthDownAttempts}`
          )}
        </tbody>
      </table>

      {/* Top Players Section */}
      <div className="mt-4">
        <table className="w-full text-xs border border-black">
          <thead>
            <tr className="bg-gray-200">
              <th className="border border-black text-left pl-1 text-xs">Rank</th>
              <th className="border border-black text-xs">
                {gameInfo.home_team_abbr || gameInfo.home_team_name?.substring(0, 6).toUpperCase()}
              </th>
              <th className="border border-black text-xs">
                {gameInfo.visitor_team_abbr || gameInfo.visitor_team_name?.substring(0, 6).toUpperCase()}
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Top Passers */}
            <tr className="bg-gray-200">
              <td colSpan="3" className="text-left pl-1 font-bold text-xs">Passing Yards</td>
            </tr>
            {renderTopPlayersByCategory('passer', 'passYards', 'yds')}
            
            {/* Top Rushers */}
            <tr className="bg-gray-200">
              <td colSpan="3" className="text-left pl-1 font-bold text-xs">Rushing Yards</td>
            </tr>
            {renderTopPlayersByCategory('rusher', 'rushYards', 'yds')}
            
            {/* Top Receivers */}
            <tr className="bg-gray-200">
              <td colSpan="3" className="text-left pl-1 font-bold text-xs">Receiving Yards</td>
            </tr>
            {renderTopPlayersByCategory('receiver', 'receivingYards', 'yds')}
            
            {/* Top Tacklers */}
            <tr className="bg-gray-200">
              <td colSpan="3" className="text-left pl-1 font-bold text-xs">Tackles</td>
            </tr>
            {renderTopPlayersByCategory('tackler', 'tackles', 'tack')}
            
            {/* Tackles For Loss */}
            <tr className="bg-gray-200">
              <td colSpan="3" className="text-left pl-1 font-bold text-xs">Tackles For Loss</td>
            </tr>
            {renderTopPlayersByCategory('tackler-loss', 'tackleForLoss', 'tfl')}
          </tbody>
        </table>
        
        {/* Drive Summary */}
        <div className="mt-4">
          <h3 className="text-sm font-bold mb-2">CURRENT DRIVE</h3>
          {driveLoading && <div className="text-xs text-gray-500">Loading drive info...</div>}
          {driveError && <div className="text-xs text-red-500">Error: {driveError}</div>}
          {driveModel && <DriveSummary model={driveModel} />}
          {!driveModel && !driveLoading && !driveError && (
            <div className="text-xs text-gray-500">No active drive</div>
          )}
        </div>
      </div>
    </div>
  );
}

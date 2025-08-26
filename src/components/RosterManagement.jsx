import React, { useState, useEffect } from 'react';
import debug from '../utils/debug';

const RosterManagement = ({ gameState, onRosterUpdate, gameId }) => {
  const [homeRoster, setHomeRoster] = useState([]);
  const [visitorRoster, setVisitorRoster] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  // Initialize roster data from gameState
  useEffect(() => {
    if (gameState?.rosters) {
      setHomeRoster([...(gameState.rosters.home || [])]);
      setVisitorRoster([...(gameState.rosters.visitor || [])]);
    }
  }, [gameState]);

  const updatePlayerJersey = (playerId, newJerseyNumber, team) => {
    const roster = team === 'home' ? homeRoster : visitorRoster;
    const setRoster = team === 'home' ? setHomeRoster : setVisitorRoster;
    
    const updatedRoster = roster.map(player => 
      player.player_id === playerId 
        ? { ...player, jersey_number: newJerseyNumber }
        : player
    );
    
    setRoster(updatedRoster);
    setHasChanges(true);
  };

  const saveRosterChanges = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/strata_football/api/update_rosters.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          game_id: gameId,
          home_roster: homeRoster,
          visitor_roster: visitorRoster
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update rosters');
      }

      const result = await response.json();
      if (result.success) {
        setHasChanges(false);
        setIsEditing(false);
        if (onRosterUpdate) {
          onRosterUpdate({ home: homeRoster, visitor: visitorRoster });
        }
        alert('Rosters updated successfully!');
      } else {
        throw new Error(result.message || 'Failed to update rosters');
      }
    } catch (error) {
      console.error('Error updating rosters:', error);
      alert(`Error updating rosters: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const resetChanges = () => {
    if (gameState?.rosters) {
      setHomeRoster([...(gameState.rosters.home || [])]);
      setVisitorRoster([...(gameState.rosters.visitor || [])]);
    }
    setHasChanges(false);
    setIsEditing(false);
  };

  const RosterTable = ({ roster, setRoster, teamName, teamColor }) => (
    <div className="bg-white rounded-lg shadow-md p-4">
      <h3 className={`text-lg font-bold mb-4 ${teamColor}`}>
        {teamName} Roster
      </h3>
      
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-300">
              <th className="text-left p-2 font-semibold">#</th>
              <th className="text-left p-2 font-semibold">Name</th>
              <th className="text-left p-2 font-semibold">Position</th>
              <th className="text-left p-2 font-semibold">Class</th>
              {isEditing && <th className="text-left p-2 font-semibold">Jersey #</th>}
            </tr>
          </thead>
          <tbody>
            {roster.map((player) => (
              <tr key={player.player_id} className="border-b border-gray-200 hover:bg-gray-50">
                <td className="p-2 font-mono">
                  {isEditing ? (
                    <input
                      type="number"
                      min="0"
                      max="99"
                      value={player.jersey_number}
                      onChange={(e) => updatePlayerJersey(player.player_id, parseInt(e.target.value) || 0, teamName.toLowerCase())}
                      className="w-16 px-2 py-1 border border-gray-300 rounded text-center"
                    />
                  ) : (
                    player.jersey_number
                  )}
                </td>
                <td className="p-2">
                  <div className="flex flex-col">
                    <span className="font-medium">{player.full_name}</span>
                    <span className="text-sm text-gray-500">
                      {player.first_name} {player.last_name}
                    </span>
                  </div>
                </td>
                <td className="p-2">
                  <div className="flex flex-col text-sm">
                    {player.off_position && (
                      <span className="text-blue-600">OFF: {player.off_position}</span>
                    )}
                    {player.def_position && (
                      <span className="text-red-600">DEF: {player.def_position}</span>
                    )}
                    {player.st_position && (
                      <span className="text-green-600">ST: {player.st_position}</span>
                    )}
                  </div>
                </td>
                <td className="p-2 text-sm">
                  {player.class}
                </td>
                {isEditing && (
                  <td className="p-2 text-xs text-gray-500">
                    ID: {player.player_id}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="mt-4 text-sm text-gray-600">
        {roster.length} players
      </div>
    </div>
  );

  if (!gameState?.rosters) {
    return (
      <div className="bg-yellow-100 border-l-4 border-yellow-500 p-4 rounded">
        <div className="flex items-center">
          <span className="text-lg mr-2">⚠️</span>
          <div>
            <p className="font-semibold text-yellow-800">No Roster Data Available</p>
            <p className="text-yellow-700">Roster information has not been loaded for this game.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex justify-between items-center bg-gray-50 p-4 rounded-lg">
        <div>
          <h2 className="text-xl font-bold">Game Roster Management</h2>
          <p className="text-gray-600">Manage jersey numbers for this specific game</p>
        </div>
        
        <div className="flex space-x-2">
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Edit Rosters
            </button>
          ) : (
            <div className="flex space-x-2">
              <button
                onClick={resetChanges}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={saveRosterChanges}
                disabled={!hasChanges || saving}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:bg-gray-400"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Changes Indicator */}
      {hasChanges && (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 p-4 rounded">
          <div className="flex items-center">
            <span className="text-lg mr-2">💾</span>
            <p className="font-semibold text-yellow-800">
              You have unsaved changes. Remember to save your roster modifications.
            </p>
          </div>
        </div>
      )}

      {/* Roster Tables */}
      <div className="grid md:grid-cols-2 gap-6">
        <RosterTable 
          roster={homeRoster}
          setRoster={setHomeRoster}
          teamName="Home"
          teamColor="text-blue-600"
        />
        
        <RosterTable 
          roster={visitorRoster}
          setRoster={setVisitorRoster}
          teamName="Visitor"
          teamColor="text-red-600"
        />
      </div>

      {/* Footer Information */}
      <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-600">
        <h4 className="font-semibold mb-2">Roster Management Notes:</h4>
        <ul className="list-disc list-inside space-y-1">
          <li>Jersey numbers can be modified for individual games without affecting master roster</li>
          <li>Changes are saved to the game_state table for this specific game</li>
          <li>Player names and positions are from the master players table and cannot be changed here</li>
          <li>All play input forms will use these game-specific jersey numbers</li>
        </ul>
      </div>
    </div>
  );
};

export default RosterManagement;

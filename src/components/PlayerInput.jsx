import React, { useState, useEffect } from 'react';

const PlayerInput = ({ 
  label, 
  value, 
  onChange, 
  onSelect,
  required = false, 
  placeholder = "Enter jersey number",
  className = "",
  disabled = false,
  autoFocus = false,
  gameState = null,
  team = null // 'home', 'visitor', or null for both teams
}) => {
  const [inputValue, setInputValue] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [loading, setLoading] = useState(false);

  // Get offense and defense teams based on possession
  const getTeamContext = () => {
    if (!gameState?.live_state?.possession) {
      return { offenseTeam: 'home', defenseTeam: 'visitor' };
    }
    
    const offenseTeam = gameState.live_state.possession.toLowerCase(); // 'home' or 'visitor'
    const defenseTeam = offenseTeam === 'home' ? 'visitor' : 'home';
    
    return { offenseTeam, defenseTeam };
  };

  const { offenseTeam, defenseTeam } = getTeamContext();

  // Get appropriate roster based on team prop or default to offense
  const getTargetRoster = () => {
    if (!gameState?.rosters) return [];
    
    let targetTeam = team;
    if (!targetTeam) {
      // Default to offensive team roster for player selection
      targetTeam = offenseTeam;
    }
    
    return gameState.rosters[targetTeam] || [];
  };

  const roster = getTargetRoster();

  // Initialize input value from prop
  useEffect(() => {
    if (value !== undefined && value !== null && value !== '') {
      // If it's a player ID (large number), convert to jersey number
      const numValue = parseInt(value);
      if (numValue > 99 && roster.length > 0) {
        const player = roster.find(p => p.player_id.toString() === value.toString());
        if (player) {
          setInputValue(player.jersey_number.toString());
          setSelectedPlayer(player);
          return;
        }
      }
      // Otherwise use the value as-is (jersey number)
      setInputValue(value.toString());
    } else {
      setInputValue('');
      setSelectedPlayer(null);
    }
  }, [value, roster]);

  const lookupPlayerByJersey = (jerseyNumber) => {
    if (!jerseyNumber.trim() || !roster.length) return [];
    
    // Find all players on the target team with this jersey number
    const matchingPlayers = roster.filter(player => 
      player.jersey_number.toString() === jerseyNumber.toString()
    );
    
    return matchingPlayers;
  };

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    
    if (!newValue.trim()) {
      setSelectedPlayer(null);
      onChange?.('');
      onSelect?.(null);
      return;
    }

    // Look up players by jersey number on the target team
    const matchingPlayers = lookupPlayerByJersey(newValue);
    
    if (matchingPlayers.length === 1) {
      // Exactly one match - auto-select
      const player = matchingPlayers[0];
      setSelectedPlayer(player);
      onChange?.(player.player_id.toString());
      onSelect?.(player);
    } else if (matchingPlayers.length > 1) {
      // Multiple matches - show modal for user to choose
      setSelectedPlayer(null);
      showPlayerSelectionModal(matchingPlayers, newValue);
    } else {
      // No matches - clear selection but keep jersey number
      setSelectedPlayer(null);
      onChange?.(newValue); // Pass the jersey number as-is
      onSelect?.(null);
    }
  };

  const showPlayerSelectionModal = (players, jerseyNumber) => {
    const playerNames = players.map((p, idx) => 
      `${idx + 1}. ${p.first_name} ${p.last_name} - ${p.off_position || p.def_position || p.st_position || 'Unknown'}`
    ).join('\n');
    
    const choice = prompt(
      `Multiple players found with jersey #${jerseyNumber}:\n\n${playerNames}\n\nEnter the number (1-${players.length}) of the correct player:`
    );
    
    const choiceIndex = parseInt(choice) - 1;
    if (choiceIndex >= 0 && choiceIndex < players.length) {
      const selectedPlayer = players[choiceIndex];
      setSelectedPlayer(selectedPlayer);
      onChange?.(selectedPlayer.player_id.toString());
      onSelect?.(selectedPlayer);
    }
  };

  const handleBlur = () => {
    // On blur, if we have input but no selected player, try lookup again
    if (inputValue.trim() && !selectedPlayer) {
      const matchingPlayers = lookupPlayerByJersey(inputValue);
      if (matchingPlayers.length === 1) {
        const player = matchingPlayers[0];
        setSelectedPlayer(player);
        onChange?.(player.player_id.toString());
        onSelect?.(player);
      }
    }
  };

  return (
    <div className={`relative ${className}`}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      
      <div className="relative">
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          className={`
            w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm 
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
            ${required && !inputValue ? 'border-red-300' : ''}
          `}
        />
        
        {/* Team indicator */}
        <div className="absolute right-3 top-2 text-xs text-gray-500">
          {team || offenseTeam}
        </div>
      </div>

      {/* Selected player display */}
      {selectedPlayer && (
        <div className="mt-1 text-sm text-green-600">
          {selectedPlayer.first_name} {selectedPlayer.last_name}, {selectedPlayer.off_position || selectedPlayer.def_position || selectedPlayer.st_position || 'Unknown'}
        </div>
      )}

      {/* No match indicator */}
      {inputValue.trim() && !selectedPlayer && roster.length > 0 && (
        <div className="mt-1 text-sm text-amber-600">
          No player found with jersey #{inputValue} on {team || offenseTeam} team
        </div>
      )}

      {/* No roster data */}
      {roster.length === 0 && (
        <div className="mt-1 text-sm text-gray-500">
          No roster data available for {team || offenseTeam} team
        </div>
      )}

      {required && !inputValue && (
        <p className="mt-1 text-sm text-red-600">This field is required</p>
      )}
    </div>
  );
};

export default PlayerInput;

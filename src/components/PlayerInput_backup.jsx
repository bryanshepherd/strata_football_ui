import React, { useState, useEffect } from 'react';

// PlayerInput component for entering player names with autocomplete
const PlayerInput = ({ 
  label, 
  value, 
  onChange, 
  required = false, 
  placeholder = "Enter player name or number",
  className = "",
  disabled = false 
}) => {
  const [inputValue, setInputValue] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Mock player data - in a real app this would come from roster data
  const players = [
    { id: 1, name: "John Smith", number: "12", position: "QB" },
    { id: 2, name: "Mike Johnson", number: "23", position: "RB" },
    { id: 3, name: "Tom Wilson", number: "87", position: "WR" },
    { id: 4, name: "Dave Brown", number: "45", position: "FB" },
    { id: 5, name: "Steve Davis", number: "77", position: "OL" },
    { id: 6, name: "Chris Taylor", number: "9", position: "K" },
    { id: 7, name: "Mark Anderson", number: "15", position: "P" },
    { id: 8, name: "Paul Miller", number: "55", position: "LB" },
    { id: 9, name: "Jake Thompson", number: "31", position: "DB" },
    { id: 10, name: "Ryan Garcia", number: "99", position: "DL" }
  ];

  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    
    // Filter suggestions based on input
    if (newValue.trim()) {
      const filtered = players.filter(player => 
        player.name.toLowerCase().includes(newValue.toLowerCase()) ||
        player.number.includes(newValue) ||
        player.position.toLowerCase().includes(newValue.toLowerCase())
      );
      setSuggestions(filtered);
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
    
    onChange(newValue);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      // If there's an exact jersey number match, select that player
      const exactNumberMatch = players.find(player => player.number === inputValue.trim());
      if (exactNumberMatch) {
        e.preventDefault();
        handleSuggestionClick(exactNumberMatch);
        return;
      }
      
      // If there are suggestions and the first one matches, select it
      if (suggestions.length > 0 && showSuggestions) {
        e.preventDefault();
        handleSuggestionClick(suggestions[0]);
        return;
      }
      
      // If no suggestions, allow form submission to proceed naturally
      setShowSuggestions(false);
      // Don't prevent default - let the form handle the Enter key
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (player) => {
    const playerValue = `${player.name} (#${player.number})`;
    setInputValue(playerValue);
    onChange(playerValue);
    setShowSuggestions(false);
  };

  const handleBlur = () => {
    // Delay hiding suggestions to allow for clicks
    setTimeout(() => {
      setShowSuggestions(false);
    }, 150);
  };

  const handleFocus = () => {
    if (inputValue.trim() && suggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onFocus={handleFocus}
        placeholder={placeholder}
        disabled={disabled}
        className={`
          w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm 
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
          ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
          ${required && !inputValue ? 'border-red-300' : ''}
        `}
      />

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((player) => (
            <div
              key={player.id}
              onClick={() => handleSuggestionClick(player)}
              className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
            >
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-medium">{player.name}</span>
                  <span className="text-gray-500 ml-2">#{player.number}</span>
                </div>
                <span className="text-sm text-gray-400">{player.position}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {required && !inputValue && (
        <p className="mt-1 text-sm text-red-600">This field is required</p>
      )}
    </div>
  );
};

export default PlayerInput;

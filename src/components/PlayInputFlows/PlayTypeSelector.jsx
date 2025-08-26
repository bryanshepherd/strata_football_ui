import React, { useState, useEffect } from 'react';
import RushInputFlow from './RushInputFlow';
import PassInputFlow from './PassInputFlow';
import PuntInputFlow from './PuntInputFlow';
import KickInputFlow from './KickInputFlow';
import PenaltyInputFlow from './PenaltyInputFlow';
import GameControlInputFlow from './GameControlInputFlow';

const PlayTypeSelector = ({ onComplete, onCancel, gameState }) => {
  
  const [selectedPlayType, setSelectedPlayType] = useState(null);
  const [showSelector, setShowSelector] = useState(true);

  // Play types with keyboard shortcuts as per specification
  const playTypes = [
    { 
      key: 'R', 
      name: 'Rush', 
      description: 'Running plays including handoffs, quarterback scrambles, and kneels',
      component: RushInputFlow,
      color: 'bg-green-100 border-green-500 hover:border-green-600'
    },
    { 
      key: 'P', 
      name: 'Pass', 
      description: 'Passing plays including completions, incompletions, and sacks',
      component: PassInputFlow,
      color: 'bg-blue-100 border-blue-500 hover:border-blue-600'
    },
    { 
      key: 'U', 
      name: 'Punt', 
      description: 'Punting plays including blocked punts and fake punts',
      component: PuntInputFlow,
      color: 'bg-yellow-100 border-yellow-500 hover:border-yellow-600'
    },
    { 
      key: 'K', 
      name: 'Kick', 
      description: 'Kicking plays including field goals, extra points, and kickoffs',
      component: KickInputFlow,
      color: 'bg-purple-100 border-purple-500 hover:border-purple-600'
    },
    { 
      key: 'E', 
      name: 'Penalty', 
      description: 'Penalty enforcement and calls',
      component: PenaltyInputFlow,
      color: 'bg-red-100 border-red-500 hover:border-red-600'
    },
    { 
      key: 'G', 
      name: 'Game Control', 
      description: 'Game management actions (timeouts, end of quarter, etc.)',
      component: GameControlInputFlow,
      color: 'bg-gray-100 border-gray-500 hover:border-gray-600'
    }
  ];

  // Handle keyboard shortcuts for play type selection
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (showSelector) {
        const playType = playTypes.find(pt => pt.key.toLowerCase() === e.key.toLowerCase());
        if (playType) {
          setSelectedPlayType(playType);
          setShowSelector(false);
        }
      }
      
      if (e.key === 'Escape') {
        if (selectedPlayType) {
          // Return to selector if in a play flow
          setSelectedPlayType(null);
          setShowSelector(true);
        } else {
          // Cancel entirely if on selector
          onCancel();
        }
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [showSelector, selectedPlayType, playTypes, onCancel]);

  const handlePlayTypeSelect = (playType) => {
    setSelectedPlayType(playType);
    setShowSelector(false);
  };

  const handlePlayComplete = (playData) => {
    // Call completion callback - submitEvent already handles game state updates
    onComplete(playData);
    
    // Reset to selector for next play
    setSelectedPlayType(null);
    setShowSelector(true);
  };

  const handlePlayCancel = () => {
    // Return to play type selector
    setSelectedPlayType(null);
    setShowSelector(true);
  };

  const getCurrentGameContext = () => {
    if (!gameState) return null;
    
    return (
      <div className="bg-gray-50 p-4 rounded-lg mb-6">
        <h3 className="text-lg font-bold mb-2">Current Game Situation</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="font-medium">Quarter:</span> {gameState.quarter || 'N/A'}
          </div>
          <div>
            <span className="font-medium">Time:</span> {gameState.time || 'N/A'}
          </div>
          <div>
            <span className="font-medium">Down & Distance:</span> {gameState.down ? `${gameState.down} & ${gameState.distance}` : 'N/A'}
          </div>
          <div>
            <span className="font-medium">Field Position:</span> {gameState.yardLine || 'N/A'}
          </div>
          <div>
            <span className="font-medium">Possession:</span> {gameState.possession || 'N/A'}
          </div>
          <div>
            <span className="font-medium">Score:</span> {gameState.score ? `${gameState.score.home} - ${gameState.score.visitor}` : 'N/A'}
          </div>
          <div>
            <span className="font-medium">Timeouts:</span> {gameState.timeouts ? `H:${gameState.timeouts.home} V:${gameState.timeouts.visitor}` : 'N/A'}
          </div>
          <div>
            <span className="font-medium">Play Clock:</span> {gameState.playClock || 'N/A'}
          </div>
        </div>
      </div>
    );
  };

  const renderPlayTypeSelector = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Select Play Type</h2>
        <p className="text-gray-600">Use keyboard shortcuts or click to select the type of play</p>
      </div>

      {getCurrentGameContext()}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {playTypes.map((playType, index) => (
          <button
            key={index}
            onClick={() => handlePlayTypeSelect(playType)}
            className={`p-6 border-2 rounded-lg transition-all duration-200 text-left ${playType.color} focus:outline-none focus:ring-2 focus:ring-blue-500`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-2xl font-bold text-gray-800">
                {playType.key}
              </div>
              <div className="text-lg font-semibold text-gray-700">
                {playType.name}
              </div>
            </div>
            <div className="text-sm text-gray-600">
              {playType.description}
            </div>
            <div className="mt-3 text-xs text-gray-500">
              Press <kbd className="px-2 py-1 bg-gray-200 rounded text-gray-700">{playType.key}</kbd> or click to select
            </div>
          </button>
        ))}
      </div>

      <div className="text-center space-y-4">
        <div className="text-sm text-gray-500">
          <div className="mb-2">Quick Reference:</div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div><kbd className="px-1 py-0.5 bg-gray-200 rounded">R</kbd> Rush</div>
            <div><kbd className="px-1 py-0.5 bg-gray-200 rounded">P</kbd> Pass</div>
            <div><kbd className="px-1 py-0.5 bg-gray-200 rounded">U</kbd> Punt</div>
            <div><kbd className="px-1 py-0.5 bg-gray-200 rounded">K</kbd> Kick</div>
            <div><kbd className="px-1 py-0.5 bg-gray-200 rounded">E</kbd> Penalty</div>
            <div><kbd className="px-1 py-0.5 bg-gray-200 rounded">G</kbd> Game Control</div>
          </div>
        </div>
        
        <button
          onClick={onCancel}
          className="px-6 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );

  const renderSelectedPlayFlow = () => {
    if (!selectedPlayType) return null;

    const PlayComponent = selectedPlayType.component;
    
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">
              {selectedPlayType.name} Play Input
            </h2>
            <p className="text-gray-600">{selectedPlayType.description}</p>
          </div>
          <button
            onClick={handlePlayCancel}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
          >
            ← Back to Play Types
          </button>
        </div>

        {getCurrentGameContext()}

        <PlayComponent
          onComplete={handlePlayComplete}
          onCancel={handlePlayCancel}
          gameState={gameState}
        />
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      {showSelector ? renderPlayTypeSelector() : renderSelectedPlayFlow()}
    </div>
  );
};

export default PlayTypeSelector;

import React, { useState, useContext, useEffect } from 'react';
import { FootballFlowContext, useFootballFlow } from '../contexts/FootballFlowContext';
import { FootballGameContext, useGameState } from '../contexts/FootballGameContext';

export default function EventControls({ gameState }) {
  const { submitEvent } = useGameState();
  const { currentFlow, flowStep, eventData, isModalOpen } = useFootballFlow();
  const [selectedTeam, setSelectedTeam] = useState('visitor');

  if (!gameState || !gameState.live_state) {
    return (
      <div className="bg-white p-6">
        <div className="text-gray-500">Loading event controls...</div>
      </div>
    );
  }

  const { live_state: state, game_info } = gameState;

  const renderHotkeyButton = (key, label, description, color = 'bg-blue-600') => (
    <div className="flex items-center space-x-3 p-2 border border-gray-200 rounded">
      <kbd className={`px-3 py-1 ${color} text-white rounded text-sm font-mono font-bold`}>
        {key}
      </kbd>
      <div className="flex-1">
        <div className="font-bold text-sm">{label}</div>
        <div className="text-xs text-gray-600">{description}</div>
      </div>
    </div>
  );

  const renderFlowStatus = () => {
    if (!currentFlow) return null;

    return (
      <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
        <h4 className="font-bold text-sm text-yellow-800 mb-2">
          Active Flow: {currentFlow.toUpperCase()}
        </h4>
        <div className="text-xs text-yellow-700">
          Step: {flowStep} | Data collected: {Object.keys(eventData).length} fields
        </div>
        {isModalOpen && (
          <div className="text-xs text-yellow-700 mt-1">
            ⏳ Waiting for input in modal...
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white p-4 h-full overflow-y-auto">
      <h3 className="text-lg font-bold mb-4">Football Play Input</h3>
      
      {renderFlowStatus()}

      {/* Main Play Types - R, P, U, K, E, G */}
      <div className="mb-6">
        <h4 className="font-bold text-gray-700 mb-3">Play Types</h4>
        <div className="grid grid-cols-3 gap-2">
          {renderHotkeyButton('R', 'Rush', 'Running play', 'bg-green-600')}
          {renderHotkeyButton('P', 'Pass', 'Passing play', 'bg-blue-600')}
          {renderHotkeyButton('U', 'Punt', 'Punt play', 'bg-purple-600')}
          {renderHotkeyButton('K', 'Kick', 'Field goal, XP, kickoff', 'bg-orange-600')}
          {renderHotkeyButton('E', 'Penalty', 'Penalty enforcement', 'bg-red-600')}
          {renderHotkeyButton('G', 'Game Control', 'Timeouts, clock, admin', 'bg-gray-600')}
        </div>
      </div>
    </div>
  );
}

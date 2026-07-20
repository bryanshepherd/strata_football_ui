import React from 'react';
import debug from '../utils/debug';
import { useFootballFlow } from '../contexts/FootballFlowContext';
import { useGameState } from '../contexts/FootballGameContext';
import PlayTypeSelector from './PlayInputFlows/PlayTypeSelector';
import RushInputFlow from './PlayInputFlows/RushInputFlow';
import PassInputFlow from './PlayInputFlows/PassInputFlow';
import PuntInputFlow from './PlayInputFlows/PuntInputFlow';
import KickInputFlow from './PlayInputFlows/KickInputFlow';
import PenaltyInputFlow from './PlayInputFlows/PenaltyInputFlow';
import GameControlInputFlow from './PlayInputFlows/GameControlInputFlow';

export default function FootballFlowModal() {
  const { currentFlow, isModalOpen, cancelFlow, eventData } = useFootballFlow();
  const { gameState } = useGameState();

  if (!isModalOpen || !currentFlow) {
    return null;
  }

  const renderFlowComponent = () => {
    const commonProps = {
      onComplete: (data) => {
        // Handle completion
        debug.log('Flow completed:', data);
        cancelFlow();
      },
      onCancel: () => {
        cancelFlow();
      },
      gameState: gameState || {}
    };

    switch (currentFlow) {
      case 'rush':
        return <RushInputFlow {...commonProps} />;
      case 'pass':
        return <PassInputFlow {...commonProps} />;
      case 'punt':
        return <PuntInputFlow {...commonProps} />;
      case 'kick':
        return <KickInputFlow {...commonProps} />;
      case 'penalty':
        return <PenaltyInputFlow {...commonProps} />;
      case 'gamecontrol':
        return <GameControlInputFlow {...commonProps} />;
      default:
        return <PlayTypeSelector {...commonProps} />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">
              Play Input: {currentFlow ? currentFlow.replace('-', ' ').toUpperCase() : 'Select Play Type'}
            </h2>
            <button
              onClick={() => cancelFlow()}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
            </button>
          </div>
        </div>
        <div className="p-6">
          {renderFlowComponent()}
        </div>
      </div>
    </div>
  );
}

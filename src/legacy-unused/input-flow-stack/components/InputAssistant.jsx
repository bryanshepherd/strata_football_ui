import React, { useContext } from 'react';
import { FootballFlowContext, useFootballFlow } from '../contexts/FootballFlowContext';
import { FootballGameContext, useGameState } from '../contexts/FootballGameContext';

export default function InputAssistant({ gameState }) {
  const { 
    currentFlow, 
    flowStep, 
    eventData, 
    isModalOpen, 
    availableShortcuts,
    lastAction 
  } = useFootballFlow();
  
  const { submitEvent, isSubmitting } = useGameState();

  if (!gameState || !gameState.live_state) {
    return (
      <div className="bg-gray-100 p-3 text-center">
        <div className="text-gray-500 text-sm">Loading input assistant...</div>
      </div>
    );
  }

  const { live_state: state } = gameState;

  const getFlowInstructions = () => {
    if (!currentFlow) {
      return {
        title: 'Ready for Input',
        message: 'Press R, P, U, K, E, or G to start recording a play',
        shortcuts: ['R - Rush', 'P - Pass', 'U - Punt', 'K - Kick', 'E - Penalty', 'G - Game Control'],
        color: 'bg-green-100 text-green-800'
      };
    }

    const flowInstructions = {
      rush: {
        title: 'Rush Play Input',
        message: 'Recording rushing play - follow prompts for player and result',
        shortcuts: ['T - Tackle', 'O - Out of Bounds', 'F - Fumble', '. - End of Play'],
        color: 'bg-green-100 text-green-800'
      },
      pass: {
        title: 'Pass Play Input', 
        message: 'Recording passing play - select completion status first',
        shortcuts: ['C - Complete', 'I - Incomplete', 'S - Sack', 'F - Fumble'],
        color: 'bg-blue-100 text-blue-800'
      },
      punt: {
        title: 'Punt Play Input',
        message: 'Recording punt - select punt result',
        shortcuts: ['R - Returned', 'D - Downed', 'C - Fair Catch', 'T - Touchback', 'M - Muffed', 'K - Kicking Error'],
        color: 'bg-purple-100 text-purple-800'
      },
      kick: {
        title: 'Kick Play Input',
        message: 'Recording kick play - specify kick type',
        shortcuts: ['F - Field Goal', 'X - Extra Point', 'K - Kickoff', 'O - Onside'],
        color: 'bg-orange-100 text-orange-800'
      },
      penalty: {
        title: 'Penalty Input',
        message: 'Recording penalty - enter penalty details',
        shortcuts: ['A - Accept', 'D - Decline', 'O - Offset'],
        color: 'bg-red-100 text-red-800'
      },
      gamecontrol: {
        title: 'Game Control',
        message: 'Game administration - select action type',
        shortcuts: ['T - Timeout', 'Q - Quarter Change', 'C - Clock Adjustment', 'S - Score Correction'],
        color: 'bg-gray-100 text-gray-800'
      }
    };

    return flowInstructions[currentFlow] || flowInstructions.rush;
  };

  const instructions = getFlowInstructions();

  const getStepDetails = () => {
    if (!flowStep || !currentFlow) return null;

    const stepMessages = {
      'player-selection': 'Select the player involved in this play',
      'yard-line-input': 'Enter the yard line where the play occurred',
      'result-selection': 'Choose how the play ended',
      'yardage-input': 'Enter the yards gained or lost on this play',
      'penalty-details': 'Enter penalty type and enforcement details',
      'timeout-team': 'Select which team called the timeout',
      'completion-status': 'Was the pass complete, incomplete, or intercepted?',
      'punt-result': 'What happened to the punt?',
      'kick-type': 'What type of kick was this?',
      'final-review': 'Review play details before submitting'
    };

    return stepMessages[flowStep] || `Step: ${flowStep}`;
  };

  const getModalStatus = () => {
    if (!isModalOpen) return null;
    
    return (
      <div className="flex items-center space-x-2 text-yellow-600">
        <div className="animate-pulse w-2 h-2 bg-yellow-500 rounded-full"></div>
        <span className="text-sm">Waiting for input...</span>
      </div>
    );
  };

  const getDataCollected = () => {
    if (!eventData || Object.keys(eventData).length === 0) return null;

    const dataKeys = Object.keys(eventData);
    const displayData = dataKeys.slice(0, 3).map(key => {
      let value = eventData[key];
      if (key === 'player' && typeof value === 'object') {
        value = `#${value.number} ${value.name}`;
      }
      return `${key}: ${value}`;
    });

    if (dataKeys.length > 3) {
      displayData.push(`+${dataKeys.length - 3} more`);
    }

    return (
      <div className="text-xs text-gray-600">
        Collected: {displayData.join(', ')}
      </div>
    );
  };

  const getLastActionStatus = () => {
    if (!lastAction) return null;

    const actionMessages = {
      'submit-success': { text: 'Play recorded successfully', color: 'text-green-600' },
      'submit-error': { text: 'Error recording play', color: 'text-red-600' },
      'flow-cancelled': { text: 'Input cancelled', color: 'text-yellow-600' },
      'validation-error': { text: 'Input validation failed', color: 'text-red-600' }
    };

    const action = actionMessages[lastAction.type];
    if (!action) return null;

    return (
      <div className={`text-sm ${action.color} mb-2`}>
        {action.text}
        {lastAction.message && typeof lastAction.message === 'string' && (
          <div className="text-xs text-gray-600">{lastAction.message}</div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white border-t border-gray-200 p-4">
      {/* Last Action Status */}
      {getLastActionStatus()}

      {/* Main Status */}
      <div className={`p-3 rounded mb-3 ${instructions.color}`}>
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-bold text-sm">{instructions.title}</h4>
          {isSubmitting && (
            <div className="flex items-center space-x-1 text-blue-600">
              <div className="animate-spin w-3 h-3 border border-blue-600 border-t-transparent rounded-full"></div>
              <span className="text-xs">Submitting...</span>
            </div>
          )}
          {getModalStatus()}
        </div>
        
        <div className="text-sm mb-2">{instructions.message}</div>
        
        {/* Step Details */}
        {flowStep && (
          <div className="text-xs mb-2 opacity-80">
            {getStepDetails()}
          </div>
        )}

        {/* Data Collected */}
        {getDataCollected()}
      </div>
    </div>
  );
}

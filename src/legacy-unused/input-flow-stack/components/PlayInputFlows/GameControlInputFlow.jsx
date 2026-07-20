import React, { useState, useEffect, useMemo } from 'react';
import debug from '../../utils/debug';
import { useGameState } from '../../contexts/FootballGameContext';
import PlayerInput from '../PlayerInput';
import PenaltyInputModal from '../PenaltyInputModal';
import { usePlayInputFlow, PenaltyQueuedIndicator } from '../../hooks/usePlayInputFlow.jsx';

// Game control actions based on outline - moved outside component to prevent re-creation
const gameActions = [
  { 
    key: 'set-period', 
    label: 'Set Period', 
    description: 'Set the current game period',
    requiresPeriod: true,
    keyboard: 'P'
  },
  { 
    key: 'new-half', 
    label: 'New Half', 
    description: 'Start new half with coin toss',
    requiresCoinToss: true,
    keyboard: 'N'
  },
  { 
    key: 'end-half', 
    label: 'End Half', 
    description: 'End current half',
    requiresConfirm: true,
    keyboard: 'E'
  },
  { 
    key: 'timeout', 
    label: 'Timeout', 
    description: 'Record a timeout',
    requiresTimeout: true,
    keyboard: 'T'
  },
  { 
    key: 'uniform-change', 
    label: 'Uniform Change', 
    description: 'Record player uniform number change',
    requiresUniform: true,
    keyboard: 'U'
  },
  { 
    key: 'manual-adjustments', 
    label: 'Manual Adjustments', 
    description: 'Manual drive/possession/game state adjustments',
    requiresManual: true,
    keyboard: 'M'
  },
  { 
    key: 'initialize-rosters', 
    label: 'Initialize Rosters', 
    description: 'Load team rosters from database into game state',
    requiresConfirm: true,
    keyboard: 'R'
  },
  { 
    key: 'game-delayed', 
    label: 'Game Delayed', 
    description: 'Record game delay',
    requiresDelay: true,
    keyboard: 'D'
  },
  { 
    key: 'game-suspended', 
    label: 'Game Suspended', 
    description: 'Record game suspension',
    requiresSuspension: true,
    keyboard: 'S'
  },
  { 
    key: 'set-game-clock', 
    label: 'Set Game Clock', 
    description: 'Manual clock adjustment',
    requiresClock: true,
    keyboard: 'C'
  }
];

const GameControlInputFlow = ({ onComplete, onCancel, gameState }) => {
  const { submitEvent, initializeRosters } = useGameState();
  
  // Use shared play input flow hook
  const {
    currentStep,
    setCurrentStep,
    errors,
    setErrors,
    penaltyQueued,
    setPenaltyQueued,
    showPenaltyModal,
    setShowPenaltyModal,
    setupKeyboardHandler,
    validateStep,
    handleSubmit,
    handlePenaltySubmit,
    debugLog,
    getKeyFeedbackClass
  } = usePlayInputFlow({
    initialStep: 'action-type',
    onComplete,
    onCancel,
    gameState,
    submitEvent,
    playType: 'game-control'
  });
  
  const [controlData, setControlData] = useState({
    actionType: null,
    team: null,
    period: 1,
    clockMinutes: 0,
    clockSeconds: 0,
    timeoutType: null,
    oldNumber: null,
    newNumber: null,
    manualType: null,
    yardline: null,
    down: null,
    distance: null,
    howGained: '',
    howEnded: '',
    delayReason: '',
    delayDuration: '',
    suspensionDetails: '',
    confirmAction: false,
    // Coin toss data
    coinTossWinner: null,
    winnerChoice: null,
    loserChoice: null,
    defendDirection: null,
    isSecondHalf: false,
    winnerDeferred: false
  });

  // Setup keyboard handler with custom logic
  setupKeyboardHandler({
    handleEnterKeyPress: () => {
      debugLog('Enter key pressed', { currentStep });
      handleNext();
    },
    handleCustomKeys: (e) => {
      if (currentStep === 'action-type') {
        const action = gameActions.find(a => a.keyboard.toLowerCase() === e.key.toLowerCase());
        if (action) {
          debugLog('Action selected via keyboard', { action: action.key });
          handleActionSelect(action);
        }
      }
    }
  });

  const validateGameControlStep = (step, setErrorsFlag = true) => {
    const newErrors = {};
    
    switch (step) {
      case 'action-type':
        if (!controlData.actionType) {
          newErrors.actionType = 'Action type is required';
        }
        break;
      case 'action-details':
        const action = gameActions.find(a => a.key === controlData.actionType);
        
        if (action?.requiresPeriod && (!controlData.period || controlData.period < 1)) {
          newErrors.period = 'Period must be 1 or greater';
        }
        
        if (action?.requiresTimeout) {
          if (!controlData.timeoutType) {
            newErrors.timeoutType = 'Timeout type is required';
          }
          if (controlData.clockMinutes < 0 || controlData.clockMinutes > 15) {
            newErrors.clockMinutes = 'Minutes must be between 0 and 15';
          }
          if (controlData.clockSeconds < 0 || controlData.clockSeconds > 59) {
            newErrors.clockSeconds = 'Seconds must be between 0 and 59';
          }
        }
        
        if (action?.requiresUniform) {
          if (!controlData.team) {
            newErrors.team = 'Team selection is required';
          }
          if (!controlData.oldNumber) {
            newErrors.oldNumber = 'Old number is required';
          }
          if (!controlData.newNumber) {
            newErrors.newNumber = 'New number is required';
          }
        }
        
        if (action?.requiresCoinToss) {
          if (!controlData.coinTossWinner) {
            newErrors.coinTossWinner = 'Coin toss winner is required';
          }
          if (!controlData.winnerChoice) {
            newErrors.winnerChoice = 'Winner choice is required';
          }
          if (controlData.winnerChoice === 'defend' && !controlData.defendDirection) {
            newErrors.defendDirection = 'Defend direction is required';
          }
          if (controlData.winnerChoice !== 'defer') {
            if (!controlData.loserChoice) {
              newErrors.loserChoice = 'Loser choice is required';
            }
            // If loser chose defend, they must pick direction
            if (controlData.loserChoice === 'defend' && !controlData.defendDirection) {
              newErrors.defendDirection = 'Defend direction is required';
            }
          }
        }
        
        // Additional validations for other action types...
        if (action?.requiresConfirm && !controlData.confirmAction) {
          newErrors.confirmAction = 'Please confirm this action';
        }
        break;
    }
    
    if (setErrorsFlag) {
      setErrors(newErrors);
    }
    return Object.keys(newErrors).length === 0;
  };

  // Memoize validation to prevent infinite re-renders
  const isCurrentStepValid = useMemo(() => {
    return validateGameControlStep(currentStep, false); // Don't set errors in memoized version
  }, [currentStep, controlData]);

  const handleActionSelect = (action) => {
    const updates = { actionType: action.key };
    
    if (action.key === 'new-half') {
      const currentPeriod = gameState?.quarter || 1;
      updates.isSecondHalf = currentPeriod >= 3;
      updates.winnerDeferred = false;
    }
    
    setControlData(prev => ({ ...prev, ...updates }));
    
    if (action.requiresPeriod || action.requiresTimeout || action.requiresUniform || 
        action.requiresManual || action.requiresDelay || action.requiresSuspension || 
        action.requiresClock || action.requiresConfirm || action.requiresCoinToss) {
      setCurrentStep('action-details');
    } else {
      handleGameControlSubmit();
    }
  };

  const handleGameControlSubmit = async () => {
    if (!validateGameControlStep(currentStep)) return;
    
    // Special handling for roster initialization
    if (controlData.actionType === 'initialize-rosters') {
      try {
        setErrors({}); // Clear any previous errors
        const result = await initializeRosters();
        
        if (result.success) {
          // Show success message with details
          const message = `Rosters initialized successfully!\nHome: ${result.home_player_count} players\nVisitor: ${result.visitor_player_count} players`;
          alert(message);
          onComplete(result);
        } else {
          throw new Error(result.error || 'Failed to initialize rosters');
        }
      } catch (error) {
        console.error('Error initializing rosters:', error);
        setErrors({ submit: 'Error initializing rosters: ' + error.message });
      }
      return;
    }
    
    // Regular game control action handling
    const actionData = {
      event_type: 'GAME_CONTROL',
      game_id: gameState?.game_info?.game_id || 1000, // Fallback for testing
      game_control_type: controlData.actionType,
      team: controlData.team,
      period: controlData.period,
      clock_minutes: controlData.clockMinutes,
      clock_seconds: controlData.clockSeconds,
      timeout_type: controlData.timeoutType,
      old_number: controlData.oldNumber,
      new_number: controlData.newNumber,
      coin_toss_winner: controlData.coinTossWinner,
      winner_choice: controlData.winnerChoice,
      loser_choice: controlData.loserChoice,
      defend_direction: controlData.defendDirection,
      is_second_half: controlData.isSecondHalf,
      winner_deferred: controlData.winnerDeferred,
      timestamp: new Date().toISOString()
    };

    // Check for penalty queued
    if (penaltyQueued) {
      setShowPenaltyModal(true);
      return;
    }

    try {
      const response = await fetch('/strata_football/api/football/submit_event.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(actionData)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        onComplete(result);
      } else {
        throw new Error(result.error || 'Unknown error occurred');
      }
    } catch (error) {
      console.error('Error submitting game control action:', error);
      setErrors({ submit: 'Error submitting action: ' + error.message });
    }
  };

  const renderActionTypeStep = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Game Control - Select Action</h3>
      
      <div className="text-sm text-gray-600 mb-4">
        Use keyboard shortcuts or click buttons:
      </div>
      
      <div className="grid grid-cols-3 gap-3">
        {gameActions.map(action => (
          <button
            key={action.key}
            onClick={() => handleActionSelect(action)}
            className="p-3 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500 text-left"
          >
            <div className="flex flex-col items-start">
              <div className="w-full flex justify-between items-start mb-2">
                <div className="font-bold text-lg">{action.keyboard}</div>
                <div className="text-xs bg-gray-100 px-2 py-1 rounded">
                  {action.keyboard}
                </div>
              </div>
              <div className="font-semibold text-sm mb-1">{action.label}</div>
              <div className="text-xs text-gray-600">{action.description}</div>
            </div>
          </button>
        ))}
      </div>
      
      <button
        onClick={onCancel}
        className="px-4 py-2 bg-gray-500 text-white rounded"
      >
        Cancel
      </button>
    </div>
  );

  const renderActionDetails = () => {
    const action = gameActions.find(a => a.key === controlData.actionType);
    if (!action) return null;

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-bold">{action.label} - Details</h3>
        
        {/* Set Period */}
        {action.requiresPeriod && (
          <div className="space-y-2">
            <label className="block font-bold">Period Number</label>
            <input
              type="number"
              min="1"
              max="10"
              value={controlData.period}
              onChange={(e) => setControlData(prev => ({ ...prev, period: parseInt(e.target.value) || 1 }))}
              className="w-24 px-3 py-2 border border-gray-300 rounded focus:border-blue-500"
            />
            <div className="text-sm text-gray-600">Clock will default to period length</div>
            {errors.period && <div className="text-red-500 text-sm">{errors.period}</div>}
          </div>
        )}
        
        {/* Coin Toss for New Half */}
        {action.requiresCoinToss && (
          <div className="space-y-4">
            <div className="bg-blue-50 p-3 rounded">
              <div className="text-sm font-bold text-blue-800">
                {controlData.isSecondHalf ? 'Second Half' : 'First Half'} Coin Toss
              </div>
              <div className="text-xs text-blue-600">
                {controlData.isSecondHalf && controlData.winnerDeferred 
                  ? 'Winner deferred in first half - gets choice now'
                  : controlData.isSecondHalf
                  ? 'Loser gets choice in second half'
                  : 'Winner gets first choice'}
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="block font-bold">Coin Toss Winner</label>
              <div className="flex space-x-4">
                <button
                  onClick={() => setControlData(prev => ({ ...prev, coinTossWinner: 'home' }))}
                  className={`px-4 py-2 rounded ${controlData.coinTossWinner === 'home' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                >
                  Home
                </button>
                <button
                  onClick={() => setControlData(prev => ({ ...prev, coinTossWinner: 'visitor' }))}
                  className={`px-4 py-2 rounded ${controlData.coinTossWinner === 'visitor' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                >
                  Visitor
                </button>
              </div>
              {errors.coinTossWinner && <div className="text-red-500 text-sm">{errors.coinTossWinner}</div>}
            </div>
            
            {controlData.coinTossWinner && (
              <div className="space-y-2">
                <label className="block font-bold">
                  {(controlData.isSecondHalf && controlData.winnerDeferred) || (!controlData.isSecondHalf)
                    ? 'Winner Choice'
                    : 'Loser Choice (Winner chose in first half)'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setControlData(prev => ({ ...prev, winnerChoice: 'kick' }))}
                    className={`px-4 py-2 rounded ${controlData.winnerChoice === 'kick' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                  >
                    Kick
                  </button>
                  <button
                    onClick={() => setControlData(prev => ({ ...prev, winnerChoice: 'receive' }))}
                    className={`px-4 py-2 rounded ${controlData.winnerChoice === 'receive' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                  >
                    Receive
                  </button>
                  <button
                    onClick={() => setControlData(prev => ({ ...prev, winnerChoice: 'defend' }))}
                    className={`px-4 py-2 rounded ${controlData.winnerChoice === 'defend' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                  >
                    Defend
                  </button>
                  {!controlData.isSecondHalf && (
                    <button
                      onClick={() => setControlData(prev => ({ ...prev, winnerChoice: 'defer' }))}
                      className={`px-4 py-2 rounded ${controlData.winnerChoice === 'defer' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                    >
                      Defer
                    </button>
                  )}
                </div>
                {errors.winnerChoice && <div className="text-red-500 text-sm">{errors.winnerChoice}</div>}
              </div>
            )}
            
            {controlData.winnerChoice === 'defend' && (
              <div className="space-y-2">
                <label className="block font-bold">Defend Direction</label>
                <div className="grid grid-cols-4 gap-2">
                  {['N', 'S', 'E', 'W'].map(direction => (
                    <button
                      key={direction}
                      onClick={() => setControlData(prev => ({ ...prev, defendDirection: direction }))}
                      className={`px-4 py-2 rounded ${controlData.defendDirection === direction ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                    >
                      {direction}
                    </button>
                  ))}
                </div>
                {errors.defendDirection && <div className="text-red-500 text-sm">{errors.defendDirection}</div>}
              </div>
            )}
            
            {controlData.winnerChoice && controlData.winnerChoice !== 'defer' && (
              <div className="space-y-2">
                <label className="block font-bold">
                  Loser Choice (from remaining options)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {controlData.winnerChoice === 'defend' ? (
                    // If winner chose defend, loser gets kick/receive
                    ['kick', 'receive'].map(choice => (
                      <button
                        key={choice}
                        onClick={() => setControlData(prev => ({ ...prev, loserChoice: choice }))}
                        className={`px-4 py-2 rounded ${controlData.loserChoice === choice ? 'bg-green-600 text-white' : 'bg-gray-200'}`}
                      >
                        {choice.charAt(0).toUpperCase() + choice.slice(1)}
                      </button>
                    ))
                  ) : (
                    // If winner chose kick/receive, loser must defend
                    <button
                      onClick={() => setControlData(prev => ({ ...prev, loserChoice: 'defend' }))}
                      className={`px-4 py-2 rounded ${controlData.loserChoice === 'defend' ? 'bg-green-600 text-white' : 'bg-gray-200'}`}
                    >
                      Defend
                    </button>
                  )}
                </div>
                {errors.loserChoice && <div className="text-red-500 text-sm">{errors.loserChoice}</div>}
              </div>
            )}
            
            {controlData.loserChoice === 'defend' && (
              <div className="space-y-2">
                <label className="block font-bold">Defend Direction</label>
                <div className="grid grid-cols-4 gap-2">
                  {['N', 'S', 'E', 'W'].map(direction => (
                    <button
                      key={direction}
                      onClick={() => setControlData(prev => ({ ...prev, defendDirection: direction }))}
                      className={`px-4 py-2 rounded ${controlData.defendDirection === direction ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                    >
                      {direction}
                    </button>
                  ))}
                </div>
                {errors.defendDirection && <div className="text-red-500 text-sm">{errors.defendDirection}</div>}
              </div>
            )}
            
            {controlData.winnerChoice === 'defer' && (
              <div className="bg-yellow-50 p-3 rounded">
                <div className="text-sm text-yellow-800">
                  <strong>Defer:</strong> Winner deferred choice to second half.
                  <br />
                  Loser will choose from remaining options now.
                </div>
              </div>
            )}
          </div>
        )}

        {/* Timeout */}
        {action.requiresTimeout && (
          <>
            <div className="space-y-2">
              <label className="block font-bold">Timeout Type</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setControlData(prev => ({ ...prev, timeoutType: 'H' }))}
                  className={`px-4 py-2 rounded ${controlData.timeoutType === 'H' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                >
                  H - Home
                </button>
                <button
                  onClick={() => setControlData(prev => ({ ...prev, timeoutType: 'V' }))}
                  className={`px-4 py-2 rounded ${controlData.timeoutType === 'V' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                >
                  V - Visitor
                </button>
                <button
                  onClick={() => setControlData(prev => ({ ...prev, timeoutType: 'M' }))}
                  className={`px-4 py-2 rounded ${controlData.timeoutType === 'M' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                >
                  M - Media
                </button>
                <button
                  onClick={() => setControlData(prev => ({ ...prev, timeoutType: 'O' }))}
                  className={`px-4 py-2 rounded ${controlData.timeoutType === 'O' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                >
                  O - Official
                </button>
              </div>
              {errors.timeoutType && <div className="text-red-500 text-sm">{errors.timeoutType}</div>}
            </div>
            
            <div className="space-y-2">
              <label className="block font-bold">Clock Time</label>
              <div className="flex space-x-2 items-center">
                <input
                  type="number"
                  placeholder="Minutes"
                  min="0"
                  max="15"
                  value={controlData.clockMinutes}
                  onChange={(e) => setControlData(prev => ({ ...prev, clockMinutes: parseInt(e.target.value) || 0 }))}
                  className="w-24 px-3 py-2 border border-gray-300 rounded focus:border-blue-500"
                />
                <span>:</span>
                <input
                  type="number"
                  placeholder="Seconds"
                  min="0"
                  max="59"
                  value={controlData.clockSeconds}
                  onChange={(e) => setControlData(prev => ({ ...prev, clockSeconds: parseInt(e.target.value) || 0 }))}
                  className="w-24 px-3 py-2 border border-gray-300 rounded focus:border-blue-500"
                />
              </div>
            </div>
          </>
        )}

        {/* Uniform Change */}
        {action.requiresUniform && (
          <>
            <div className="space-y-2">
              <label className="block font-bold">Team</label>
              <div className="flex space-x-4">
                <button
                  onClick={() => setControlData(prev => ({ ...prev, team: 'home' }))}
                  className={`px-4 py-2 rounded ${controlData.team === 'home' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                >
                  Home
                </button>
                <button
                  onClick={() => setControlData(prev => ({ ...prev, team: 'visitor' }))}
                  className={`px-4 py-2 rounded ${controlData.team === 'visitor' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                >
                  Visitor
                </button>
              </div>
              {errors.team && <div className="text-red-500 text-sm">{errors.team}</div>}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block font-bold">Old Number</label>
                <input
                  type="number"
                  min="0"
                  max="99"
                  value={controlData.oldNumber || ''}
                  onChange={(e) => setControlData(prev => ({ ...prev, oldNumber: parseInt(e.target.value) || null }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:border-blue-500"
                />
                {errors.oldNumber && <div className="text-red-500 text-sm">{errors.oldNumber}</div>}
              </div>
              
              <div className="space-y-2">
                <label className="block font-bold">New Number</label>
                <input
                  type="number"
                  min="0"
                  max="99"
                  value={controlData.newNumber || ''}
                  onChange={(e) => setControlData(prev => ({ ...prev, newNumber: parseInt(e.target.value) || null }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:border-blue-500"
                />
                {errors.newNumber && <div className="text-red-500 text-sm">{errors.newNumber}</div>}
              </div>
            </div>
          </>
        )}

        {/* Set Game Clock */}
        {action.requiresClock && (
          <div className="space-y-2">
            <label className="block font-bold">Set Clock Time</label>
            <div className="flex space-x-2 items-center">
              <input
                type="number"
                placeholder="Minutes"
                min="0"
                max="15"
                value={controlData.clockMinutes}
                onChange={(e) => setControlData(prev => ({ ...prev, clockMinutes: parseInt(e.target.value) || 0 }))}
                className="w-24 px-3 py-2 border border-gray-300 rounded focus:border-blue-500"
              />
              <span>:</span>
              <input
                type="number"
                placeholder="Seconds"
                min="0"
                max="59"
                value={controlData.clockSeconds}
                onChange={(e) => setControlData(prev => ({ ...prev, clockSeconds: parseInt(e.target.value) || 0 }))}
                className="w-24 px-3 py-2 border border-gray-300 rounded focus:border-blue-500"
              />
            </div>
            {(errors.clockMinutes || errors.clockSeconds) && (
              <div className="text-red-500 text-sm">
                {errors.clockMinutes || errors.clockSeconds}
              </div>
            )}
          </div>
        )}
        
        {/* Confirmation */}
        {action.requiresConfirm && (
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="confirmAction"
                checked={controlData.confirmAction}
                onChange={(e) => setControlData(prev => ({ ...prev, confirmAction: e.target.checked }))}
                className="h-4 w-4"
              />
              <label htmlFor="confirmAction" className="text-sm">
                I confirm this action: {action.label}
              </label>
            </div>
            {errors.confirmAction && <div className="text-red-500 text-sm">{errors.confirmAction}</div>}
          </div>
        )}
        
        {/* Action Summary */}
        <div className="bg-yellow-50 p-3 rounded">
          <div className="text-sm">
            <strong>Action:</strong> {action.label}
            <br />
            <strong>Description:</strong> {action.description}
            {controlData.coinTossWinner && (
              <>
                <br />
                <strong>Coin Toss Winner:</strong> {controlData.coinTossWinner === 'home' ? 'Home' : 'Visitor'}
                <br />
                <strong>Winner Choice:</strong> {controlData.winnerChoice}
                {controlData.defendDirection && (
                  <>
                    <br />
                    <strong>Defend Direction:</strong> {controlData.defendDirection}
                  </>
                )}
                {controlData.loserChoice && (
                  <>
                    <br />
                    <strong>Loser Choice:</strong> {controlData.loserChoice}
                  </>
                )}
              </>
            )}
          </div>
        </div>
        
        <div className="flex space-x-2">
          <button
            onClick={handleGameControlSubmit}
            disabled={!isCurrentStepValid}
            className="px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-400"
          >
            Execute Action
          </button>
          <button
            onClick={() => setCurrentStep('action-type')}
            className="px-4 py-2 bg-gray-500 text-white rounded"
          >
            Back
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-500 text-white rounded"
          >
            Cancel
          </button>
        </div>
        
        {errors.submit && <div className="text-red-500 text-sm">{errors.submit}</div>}
      </div>
    );
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'action-type':
        return renderActionTypeStep();
      case 'action-details':
        return renderActionDetails();
      default:
        return renderActionTypeStep();
    }
  };

  return (
    <div className="p-6 bg-white border border-gray-300 rounded-lg shadow-lg max-w-2xl">
      {/* Penalty Queued Indicator */}
      <PenaltyQueuedIndicator penaltyQueued={penaltyQueued} />
      
      {renderCurrentStep()}
      
      {/* Penalty Input Modal */}
      {showPenaltyModal && (
        <PenaltyInputModal
          isOpen={showPenaltyModal}
          onClose={() => setShowPenaltyModal(false)}
          onSubmit={(penaltyData) => handlePenaltySubmit(penaltyData, {
            play_type: 'game_control',
            game_control_type: controlData.actionType,
            team: controlData.team
          })}
          gameState={gameState}
        />
      )}
    </div>
  );
};

export default GameControlInputFlow;

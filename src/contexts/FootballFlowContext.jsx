import React, { createContext, useContext, useReducer, useEffect } from 'react';
import debug from '../utils/debug';

const FootballFlowContext = createContext();

const initialFlowState = {
  currentFlow: null, // 'rush', 'pass', 'punt', 'kick', 'penalty', 'gamecontrol'
  flowStep: null,
  eventData: {},
  isModalOpen: false,
  availableShortcuts: [],
  lastAction: null,
  flowHistory: []
};

function flowReducer(state, action) {
  switch (action.type) {
    case 'START_FLOW':
      return {
        ...state,
        currentFlow: action.payload.flowType,
        flowStep: action.payload.initialStep || 'start',
        eventData: { play_type: action.payload.flowType.toUpperCase() },
        isModalOpen: true, // ✅ FIXED: Open modal when flow starts
        availableShortcuts: action.payload.shortcuts || [],
        flowHistory: [...state.flowHistory, {
          action: 'start_flow',
          flowType: action.payload.flowType,
          timestamp: new Date().toISOString()
        }]
      };

    case 'ADVANCE_STEP':
      return {
        ...state,
        flowStep: action.payload.nextStep,
        eventData: { ...state.eventData, ...action.payload.data },
        isModalOpen: action.payload.openModal || false,
        availableShortcuts: action.payload.shortcuts || state.availableShortcuts
      };

    case 'UPDATE_EVENT_DATA':
      return {
        ...state,
        eventData: { ...state.eventData, ...action.payload }
      };

    case 'SET_MODAL_OPEN':
      return {
        ...state,
        isModalOpen: action.payload
      };

    case 'COMPLETE_FLOW':
      return {
        ...state,
        currentFlow: null,
        flowStep: null,
        eventData: {},
        isModalOpen: false,
        availableShortcuts: [],
        lastAction: {
          type: 'submit-success',
          timestamp: new Date().toISOString(),
          data: action.payload
        },
        flowHistory: [...state.flowHistory, {
          action: 'complete_flow',
          data: action.payload,
          timestamp: new Date().toISOString()
        }]
      };

    case 'CANCEL_FLOW':
      return {
        ...state,
        currentFlow: null,
        flowStep: null,
        eventData: {},
        isModalOpen: false,
        availableShortcuts: [],
        lastAction: {
          type: 'flow-cancelled',
          timestamp: new Date().toISOString(),
          message: action.payload?.reason
        }
      };

    case 'SET_ERROR':
      return {
        ...state,
        lastAction: {
          type: action.payload.type || 'submit-error',
          timestamp: new Date().toISOString(),
          message: action.payload.message
        }
      };

    case 'CLEAR_LAST_ACTION':
      return {
        ...state,
        lastAction: null
      };

    default:
      return state;
  }
}

export function FootballFlowProvider({ children }) {
  const [state, dispatch] = useReducer(flowReducer, initialFlowState);

  // Flow type configurations
  const flowConfigs = {
    rush: {
      initialStep: 'player-selection',
      steps: ['player-selection', 'result-selection', 'yardage-input', 'final-review'],
      shortcuts: ['T - Tackle', 'O - Out of Bounds', 'F - Fumble', '. - End of Play']
    },
    pass: {
      initialStep: 'completion-status',
      steps: ['completion-status', 'player-selection', 'yardage-input', 'result-selection', 'final-review'],
      shortcuts: ['C - Complete', 'I - Incomplete', 'S - Sack', 'F - Fumble']
    },
    punt: {
      initialStep: 'punt-result',
      steps: ['punt-result', 'player-selection', 'yardage-input', 'final-review'],
      shortcuts: ['R - Returned', 'D - Downed', 'C - Fair Catch', 'T - Touchback', 'M - Muffed', 'K - Kicking Error']
    },
    kick: {
      initialStep: 'kick-type',
      steps: ['kick-type', 'player-selection', 'result-selection', 'final-review'],
      shortcuts: ['F - Field Goal', 'X - Extra Point', 'K - Kickoff', 'O - Onside']
    },
    penalty: {
      initialStep: 'penalty-details',
      steps: ['penalty-details', 'enforcement', 'final-review'],
      shortcuts: ['A - Accept', 'D - Decline', 'O - Offset']
    },
    gamecontrol: {
      initialStep: 'control-type',
      steps: ['control-type', 'team-selection', 'final-review'],
      shortcuts: ['T - Timeout', 'Q - Quarter Change', 'C - Clock Adjustment', 'S - Score Correction']
    }
  };

  const startFlow = (flowType) => {
    const config = flowConfigs[flowType];
    if (!config) {
      console.error(`Unknown flow type: ${flowType}`);
      return;
    }

    dispatch({
      type: 'START_FLOW',
      payload: {
        flowType,
        initialStep: config.initialStep,
        shortcuts: config.shortcuts
      }
    });
  };

  const advanceStep = (nextStep, data = {}, options = {}) => {
    dispatch({
      type: 'ADVANCE_STEP',
      payload: {
        nextStep,
        data,
        openModal: options.openModal,
        shortcuts: options.shortcuts
      }
    });
  };

  const updateEventData = (data) => {
    dispatch({
      type: 'UPDATE_EVENT_DATA',
      payload: data
    });
  };

  const setModalOpen = (isOpen) => {
    dispatch({
      type: 'SET_MODAL_OPEN',
      payload: isOpen
    });
  };

  const completeFlow = (finalData = {}) => {
    const completeEventData = { ...state.eventData, ...finalData };
    
    dispatch({
      type: 'COMPLETE_FLOW',
      payload: completeEventData
    });

    return completeEventData;
  };

  const cancelFlow = (reason = 'User cancelled') => {
    // Ensure reason is always a string to prevent React render errors
    const safeReason = typeof reason === 'string' ? reason : 'User cancelled';
    dispatch({
      type: 'CANCEL_FLOW',
      payload: { reason: safeReason }
    });
  };

  const setError = (errorType, message) => {
    dispatch({
      type: 'SET_ERROR',
      payload: { type: errorType, message }
    });
  };

  const clearLastAction = () => {
    dispatch({ type: 'CLEAR_LAST_ACTION' });
  };

  // Get next step in flow
  const getNextStep = (currentStep) => {
    if (!state.currentFlow) return null;
    
    const config = flowConfigs[state.currentFlow];
    const currentIndex = config.steps.indexOf(currentStep);
    
    if (currentIndex === -1 || currentIndex === config.steps.length - 1) {
      return null; // No next step
    }
    
    return config.steps[currentIndex + 1];
  };

  // Check if flow is complete
  const isFlowComplete = () => {
    if (!state.currentFlow || !state.flowStep) return false;
    
    const config = flowConfigs[state.currentFlow];
    return state.flowStep === config.steps[config.steps.length - 1];
  };

  // Validate current step data
  const validateStepData = (step) => {
    const validations = {
      'player-selection': () => state.eventData.player_id || state.eventData.player,
      'yardage-input': () => state.eventData.yards_gained !== undefined,
      'result-selection': () => state.eventData.end_of_play,
      'completion-status': () => state.eventData.pass_result,
      'punt-result': () => state.eventData.punt_result,
      'kick-type': () => state.eventData.kick_type,
      'penalty-details': () => state.eventData.penalty_type,
      'control-type': () => state.eventData.control_type
    };

    const validator = validations[step];
    return validator ? validator() : true;
  };

  // Auto-clear last action after delay
  useEffect(() => {
    if (state.lastAction) {
      const timer = setTimeout(() => {
        clearLastAction();
      }, 5000); // Clear after 5 seconds

      return () => clearTimeout(timer);
    }
  }, [state.lastAction]);

  // Keyboard event handling
  useEffect(() => {
    const handleKeyPress = (event) => {
      // Ignore if modal is open or user is typing in an input
      if (state.isModalOpen || 
          event.target.tagName === 'INPUT' || 
          event.target.tagName === 'TEXTAREA' || 
          event.target.isContentEditable) {
        return;
      }

      const key = event.key.toLowerCase();

      // Global shortcuts
      if (key === 'escape') {
        if (state.currentFlow) {
          cancelFlow('Escape key pressed');
        }
        return;
      }

      // Flow initiation shortcuts
      if (!state.currentFlow) {
        const flowShortcuts = {
          'r': 'rush',
          'p': 'pass', 
          'u': 'punt',
          'k': 'kick',
          'e': 'penalty',
          'g': 'gamecontrol'
        };

        if (flowShortcuts[key]) {
          event.preventDefault();
          startFlow(flowShortcuts[key]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [state.currentFlow, state.isModalOpen]);

  const contextValue = {
    ...state,
    startFlow,
    advanceStep,
    updateEventData,
    setModalOpen,
    completeFlow,
    cancelFlow,
    setError,
    clearLastAction,
    getNextStep,
    isFlowComplete,
    validateStepData
  };

  return (
    <FootballFlowContext.Provider value={contextValue}>
      {children}
    </FootballFlowContext.Provider>
  );
}

export function useFootballFlow() {
  const context = useContext(FootballFlowContext);
  if (!context) {
    throw new Error('useFootballFlow must be used within a FootballFlowProvider');
  }
  return context;
}

export { FootballFlowContext };

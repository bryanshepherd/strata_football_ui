import { useState, useEffect, useRef } from 'react';
import debug from '../utils/debug';

/**
 * Shared hook for common PlayInputFlow functionality
 * Based on KickInputFlow's comprehensive implementation
 */
export const usePlayInputFlow = ({
  initialStep,
  onComplete,
  onCancel,
  gameState,
  submitEvent,
  playType = 'generic'
}) => {
  // Common state
  const [currentStep, setCurrentStep] = useState(initialStep || 'initial');
  const [errors, setErrors] = useState({});
  const [penaltyQueued, setPenaltyQueued] = useState(false);
  const [showPenaltyModal, setShowPenaltyModal] = useState(false);
  const [lastKeyPressed, setLastKeyPressed] = useState('');
  const [keyPressTime, setKeyPressTime] = useState(0);

  // Debug logging (like KickInputFlow)
  const debugLog = (message, data = {}) => {
    debug.log(`[${playType.toUpperCase()} FLOW] ${message}`, data);
  };

  // Store custom handlers in ref to avoid stale closures
  const customHandlersRef = useRef(null);

  // Base keyboard handler setup (to be extended by each flow)
  const setupKeyboardHandler = (customKeyHandler) => {
    customHandlersRef.current = customKeyHandler;
  };

  // Keyboard event handler with direct access to current state
  useEffect(() => {
    const handleKeyPress = (e) => {
      debug.log(`[${playType.toUpperCase()} FLOW] Key pressed:`, e.key, 'Target:', e.target.tagName, 'Current step:', currentStep);
      
      // Track key presses for visual feedback
      setLastKeyPressed(e.key);
      setKeyPressTime(Date.now());

      // Handle Escape key for consistent modal closing
      if (e.key === 'Escape') {
        e.preventDefault();
        debugLog('Escape key pressed - closing modal');
        onCancel();
        return;
      }

      // Handle penalty queuing with 'E' key - available at any time
      if (e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setPenaltyQueued(prev => {
          debugLog('E key pressed - toggling penalty queued', { newState: !prev });
          return !prev;
        });
        return;
      }

      // Handle Enter key for navigation (allow even in input fields for form submission)
      if (e.key === 'Enter') {
        e.preventDefault();
        debug.log(`[${playType.toUpperCase()} FLOW] Enter key detected, calling handler`);
        if (customHandlersRef.current?.handleEnterKeyPress) {
          customHandlersRef.current.handleEnterKeyPress();
        } else {
          debug.log(`[${playType.toUpperCase()} FLOW] No Enter key handler provided`);
        }
        return;
      }

      // Don't handle other keyboard shortcuts if user is typing in an input field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
        return;
      }

      // Call custom key handler for flow-specific shortcuts
      if (customHandlersRef.current?.handleCustomKeys) {
        customHandlersRef.current.handleCustomKeys(e);
      }
    };

    debug.log(`[${playType.toUpperCase()} FLOW] Setting up keyboard handler for step:`, currentStep);
    document.addEventListener('keydown', handleKeyPress);
    
    return () => {
      debug.log(`[${playType.toUpperCase()} FLOW] Removing keyboard handler for step:`, currentStep);
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [currentStep, penaltyQueued, onCancel, playType, debugLog]);

  // Common validation helper
  const validateStep = (step, validationRules) => {
    const newErrors = {};
    
    if (validationRules && validationRules[step]) {
      const rules = validationRules[step];
      for (const [field, rule] of Object.entries(rules)) {
        if (rule.required && !rule.value) {
          newErrors[field] = rule.message || `${field} is required`;
        }
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Common penalty handling
  const handlePenaltySubmit = async (penaltyData, playData) => {
    try {
      debugLog('Submitting play with penalties', { playData, penaltyData });
      
      const response = await fetch('/strata_football/api/submit_play_enhanced.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...playData,
          penalties: penaltyData.penalties,
          penaltyEnforcement: penaltyData.enforcement
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      setShowPenaltyModal(false);
      setPenaltyQueued(false);
      onComplete(playData);
      return result;
    } catch (error) {
      debugLog('Error submitting play with penalties', { error: error.message });
      setErrors({ submit: 'Error submitting play with penalties. Please try again.' });
      throw error;
    }
  };

  // Common submit handler
  const handleSubmit = async (playData) => {
    try {
      debugLog('Submitting play', { playData, penaltyQueued });

      if (penaltyQueued) {
        setShowPenaltyModal(true);
        return;
      }

      const result = await submitEvent({
        ...playData,
        timestamp: new Date().toISOString()
      });
      
      onComplete(playData);
      return result;
    } catch (error) {
      debugLog('Error submitting play', { error: error.message });
      setErrors({ submit: 'Error submitting play. Please try again.' });
      throw error;
    }
  };

  // Visual feedback for key presses
  const getKeyFeedbackClass = (targetKey) => {
    const timeDiff = Date.now() - keyPressTime;
    return lastKeyPressed.toLowerCase() === targetKey.toLowerCase() && timeDiff < 200
      ? 'bg-blue-200 border-blue-500 transform scale-105'
      : '';
  };

  return {
    // State
    currentStep,
    setCurrentStep,
    errors,
    setErrors,
    penaltyQueued,
    setPenaltyQueued,
    showPenaltyModal,
    setShowPenaltyModal,
    lastKeyPressed,
    keyPressTime,

    // Functions
    setupKeyboardHandler,
    validateStep,
    handleSubmit,
    handlePenaltySubmit,
    debugLog,
    getKeyFeedbackClass
  };
};

// Common penalty indicator component
export const PenaltyQueuedIndicator = ({ penaltyQueued }) => {
  if (!penaltyQueued) return null;

  return (
    <div className="mb-4 p-3 bg-yellow-200 border-l-4 border-yellow-500 text-yellow-800">
      <div className="flex items-center">
        <span className="text-lg mr-2">⚠️</span>
        <span className="font-semibold">PENALTY QUEUED</span>
        <span className="ml-2 text-sm">(Press E to toggle)</span>
      </div>
    </div>
  );
};
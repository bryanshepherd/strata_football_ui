import React, { useState, useEffect, useContext } from 'react';
import { useGameState } from './src/contexts/FootballGameContext';
import PlayerInput from './PlayerInput';
import YardlineInput from './YardlineInput';
import PenaltyInputModal from './components/PenaltyInputModal';

const KickInputFlow = ({ onComplete, onCancel, gameState }) => {
  const { submitEvent, refetchGameState, gameState } = useGameState();
  const submitPlay = submitEvent; // adapter name used by this component
  
  const [kickData, setKickData] = useState({
    kicker: null,
    kickType: null, // 'field-goal', 'extra-point', 'kickoff'
    kickResult: null,
    // Field Goal / Extra Point results: 'good', 'missed', 'blocked'
    // Kickoff results: 'returned', 'touchback', 'out-of-bounds', 'onside'
    returner: null,
    globalResult: null, // For returned kicks: T, O, F, .
    finalYardLine: '',
    tackler1: null,
    tackler2: null,
    forcedBy: null,
    recoveringTeam: null,
    recoveringPlayer: null,
    recoverySpot: '',
    kickYardLine: '',
    blockingPlayer: null,
    onsideRecoveringTeam: null,
    onsideRecoveringPlayer: null,
    onsideRecoverySpot: ''
  });

  const [currentStep, setCurrentStep] = useState('kicker'); // kicker -> kick-type -> kick-result -> result-details
  const [errors, setErrors] = useState({});
  const [penaltyQueued, setPenaltyQueued] = useState(false);
  const [showPenaltyModal, setShowPenaltyModal] = useState(false);
  const [lastKeyPressed, setLastKeyPressed] = useState('');
  const [keyPressTime, setKeyPressTime] = useState(null);

  // Handle keyboard shortcuts for kick types, results and penalty queuing (E)
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Track key presses for visual feedback
      setLastKeyPressed(e.key);
      setKeyPressTime(Date.now());
      
      // Don't handle keyboard shortcuts if user is typing in an input field
      const isInputField = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable;
      
      // Handle penalty queuing with 'E' key - ALWAYS toggle penalty, no matter what
      if (e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setPenaltyQueued(prev => !prev);
        return;
      }
      
      // Handle Enter key for navigation (NEXT/SUBMIT) - ALWAYS advance, no matter what
      if (e.key === 'Enter') {
        e.preventDefault();
        handleNext();
        return;
      }

      if (currentStep === 'kick-type' && !isInputField) {
        switch (e.key.toLowerCase()) {
          case 'f':
            setKickData(prev => ({ ...prev, kickType: 'field-goal' }));
            setCurrentStep('field-goal-result');
            break;
          case 'x':
            setKickData(prev => ({ ...prev, kickType: 'extra-point' }));
            setCurrentStep('extra-point-result');
            break;
          case 'k':
            setKickData(prev => ({ ...prev, kickType: 'kickoff' }));
            setCurrentStep('kickoff-result');
            break;
        }
      }
      
      if ((currentStep === 'field-goal-result' || currentStep === 'extra-point-result') && !isInputField) {
        switch (e.key.toLowerCase()) {
          case 'g':
            setKickData(prev => ({ ...prev, kickResult: 'good' }));
            setCurrentStep('kick-good-details');
            break;
          case 'm':
            setKickData(prev => ({ ...prev, kickResult: 'missed' }));
            setCurrentStep('kick-missed-details');
            break;
          case 'b':
            setKickData(prev => ({ ...prev, kickResult: 'blocked' }));
            setCurrentStep('kick-blocked-details');
            break;
        }
      }
      
      if (currentStep === 'kickoff-result' && !isInputField) {
        switch (e.key.toLowerCase()) {
          case 'r':
            setKickData(prev => ({ ...prev, kickResult: 'returned' }));
            setCurrentStep('kickoff-returned-details');
            break;
          case 't':
            setKickData(prev => ({ ...prev, kickResult: 'touchback' }));
            setCurrentStep('kickoff-touchback-details');
            break;
          case 'o':
            setKickData(prev => ({ ...prev, kickResult: 'out-of-bounds' }));
            setCurrentStep('kickoff-out-of-bounds-details');
            break;
          case 's':
            setKickData(prev => ({ ...prev, kickResult: 'onside' }));
            setCurrentStep('kickoff-onside-details');
            break;
        }
      }
      
      if (currentStep === 'kickoff-returned-global-result' && !isInputField) {
        switch (e.key.toLowerCase()) {
          case 't':
            setKickData(prev => ({ ...prev, globalResult: 'tackle' }));
            setCurrentStep('kickoff-returned-tackle-details');
            break;
          case 'o':
            setKickData(prev => ({ ...prev, globalResult: 'out-of-bounds' }));
            setCurrentStep('kickoff-returned-out-of-bounds-details');
            break;
          case 'f':
            setKickData(prev => ({ ...prev, globalResult: 'fumble' }));
            setCurrentStep('kickoff-returned-fumble-details');
            break;
          case '.':
            setKickData(prev => ({ ...prev, globalResult: 'end-of-play' }));
            setCurrentStep('kickoff-returned-end-of-play-details');
            break;
        }
      }
      
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [currentStep, onCancel]);

  const validateStep = (step) => {
    const newErrors = {};
    
    switch (step) {
      case 'kicker':
        if (!kickData.kicker) {
          newErrors.kicker = 'Kicker selection is required';
        }
        break;
      case 'kick-type':
        if (!kickData.kickType) {
          newErrors.kickType = 'Kick type is required';
        }
        break;
      case 'field-goal-result':
      case 'extra-point-result':
      case 'kickoff-result':
        if (!kickData.kickResult) {
          newErrors.kickResult = 'Kick result is required';
        }
        break;
      case 'kick-blocked-details':
        if (!kickData.blockingPlayer) {
          newErrors.blockingPlayer = 'Blocking player is required';
        }
        break;
      case 'kickoff-returned-details':
        if (!kickData.returner) {
          newErrors.returner = 'Returner selection is required';
        }
        break;
      case 'kickoff-out-of-bounds-details':
        if (!kickData.kickYardLine) {
          newErrors.kickYardLine = 'Kick yard line is required';
        }
        break;
      case 'kickoff-onside-details':
        if (!kickData.onsideRecoveringTeam) {
          newErrors.onsideRecoveringTeam = 'Recovering team is required';
        }
        if (!kickData.onsideRecoveringPlayer) {
          newErrors.onsideRecoveringPlayer = 'Recovering player is required';
        }
        if (!kickData.onsideRecoverySpot) {
          newErrors.onsideRecoverySpot = 'Recovery spot is required';
        }
        break;
      case 'kickoff-returned-tackle-details':
        if (!kickData.tackler1) {
          newErrors.tackler1 = 'Primary tackler is required';
        }
        if (!kickData.finalYardLine) {
          newErrors.finalYardLine = 'Final yard line is required';
        }
        break;
      case 'kickoff-returned-out-of-bounds-details':
      case 'kickoff-returned-end-of-play-details':
        if (!kickData.finalYardLine) {
          newErrors.finalYardLine = 'Final yard line is required';
        }
        break;
      case 'kickoff-returned-fumble-details':
        if (!kickData.recoveringTeam) {
          newErrors.recoveringTeam = 'Recovering team is required';
        }
        if (!kickData.recoveringPlayer) {
          newErrors.recoveringPlayer = 'Recovering player is required';
        }
        if (!kickData.recoverySpot) {
          newErrors.recoverySpot = 'Recovery spot is required';
        }
        break;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (!validateStep(currentStep)) return;
    
    switch (currentStep) {
      case 'kicker':
        setCurrentStep('kick-type');
        break;
      case 'kick-type':
        // This is handled by keyboard shortcuts or button clicks
        break;
      case 'kickoff-returned-details':
        setCurrentStep('kickoff-returned-global-result');
        break;
      default:
        handleSubmit();
        break;
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;
    
    // Build play data structure expected by backend API (snake_case)
    const playData = {
      play_type: 'kick',
      sub_type: kickData.kickType, // backend may use sub_type for kick subtype
      is_kickoff: kickData.kickType === 'kickoff',
      kicker: kickData.kicker,
      kick_result: kickData.kickResult,
      returner: kickData.returner,
      global_result: kickData.globalResult,
      // canonical final spot - backend expects end_yard_line / post_yard_line
      end_yard_line: kickData.finalYardLine || null,
      // where the ball was kicked to (out of bounds handling)
      kicked_to_yard_line: kickData.kickYardLine || null,
      tackler1: kickData.tackler1,
      tackler2: kickData.tackler2,
      forced_by: kickData.forcedBy,
      recovering_team: kickData.recoveringTeam,
      recovering_player: kickData.recoveringPlayer,
      recovery_spot: kickData.recoverySpot,
      blocking_player: kickData.blockingPlayer,
      onside_recovering_team: kickData.onsideRecoveringTeam,
      onside_recovering_player: kickData.onsideRecoveringPlayer,
      onside_recovery_spot: kickData.onsideRecoverySpot,
      penalty_queued: penaltyQueued // Add penalty status to play data
    };

    // Sanitize empty-string player fields to null to avoid DB binding warnings
    ['kicker','returner','tackler1','tackler2','forced_by','recovering_player','blocking_player','onside_recovering_player'].forEach(key => {
      if (playData[key] === '') playData[key] = null;
    });

    try {
      // If penalty is queued, hold play data and start penalty flow
      if (penaltyQueued) {
        // Open penalty input modal with play data held in memory
        console.log('Penalty queued - opening penalty input flow with play data:', playData);
        setShowPenaltyModal(true);
        return;
      }

  // Normal play submission if no penalty queued
  const result = await submitPlay(playData);

    // If this was a kickoff, request a full game state refresh so server-side drive logic is authoritative
    const isKickoff = playData.play_type === 'kick' && (playData.sub_type === 'kickoff' || playData.is_kickoff);
      if (isKickoff) {
        try {
          // Flip local possession if available (best-effort)
      const currentPossession = gameState?.live_state?.possession || 'home';
      const newPossession = currentPossession === 'home' ? 'visitor' : 'home';
      // Force a server-backed refresh so authoritative state (drives, play_participants) is applied
      await refetchGameState();
      console.log('Possession flipped after kickoff (requested server refresh). Prev:', currentPossession, 'New(assumed):', newPossession);
        } catch (e) {
          console.warn('Failed to refetch game state after kickoff:', e);
        }
      }

    // Keep legacy onComplete signature (playData) for compatibility. Consumers can read server result via refetchGameState.
    try { onComplete(playData); } catch (e) { console.warn('onComplete callback error:', e); }
    } catch (error) {
      console.error('Error submitting kick play:', error);
      setErrors({ submit: 'Error submitting play. Please try again.' });
    }
  };

  const handlePenaltySubmit = async (penaltyData) => {
    try {
      // Submit play with penalty data
      const playData = {
        playType: 'kick',
        kickType: kickData.kickType,
        kicker: kickData.kicker,
        miscFumble: kickData.miscFumble,
        fieldGoalResult: kickData.fieldGoalResult,
        kickoffResult: kickData.kickoffResult,
        returner: kickData.returner,
        globalResult: kickData.globalResult,
        tackler1: kickData.tackler1,
        tackler2: kickData.tackler2,
        finalYardLine: kickData.finalYardLine,
        forcedBy: kickData.forcedBy,
        recoveringTeam: kickData.recoveringTeam,
        recoveringPlayer: kickData.recoveringPlayer,
        recoverySpot: kickData.recoverySpot,
        onsideResult: kickData.onsideResult,
        penalties: penaltyData.penalties
      };

      await submitPlayWithPenalties(playData, penaltyData);
      setShowPenaltyModal(false);
      setPenaltyQueued(false);
      onComplete(playData);
    } catch (error) {
      console.error('Error submitting play with penalties:', error);
      setErrors({ submit: 'Error submitting play with penalties. Please try again.' });
    }
  };

  const submitPlayWithPenalties = async (playData, penaltyData) => {
    const response = await fetch('/api/submit_play_enhanced.php', {
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

    return response.json();
  };

  const renderKickerStep = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold">Kick Play - Select Kicker</h3>
        
        {/* Debug/Status Indicator */}
        <div className="text-xs bg-gray-100 p-2 rounded">
          <div>Step: {currentStep}</div>
          <div>Penalty: {penaltyQueued ? '🚨 QUEUED' : '✅ None'}</div>
          {lastKeyPressed && keyPressTime && (Date.now() - keyPressTime < 2000) && (
            <div className="text-blue-600 font-bold">
              Key: {lastKeyPressed.toUpperCase()}
            </div>
          )}
        </div>
      </div>
      
      <PlayerInput
        label="Kicker"
        value={kickData.kicker}
        onChange={(player) => setKickData(prev => ({ ...prev, kicker: player }))}
        error={errors.kicker}
        gameState={gameState}
        required
      />
      
      <div className="flex space-x-2">
        <button
          onClick={handleNext}
          disabled={!kickData.kicker}
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-400"
        >
          Next
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-gray-500 text-white rounded"
        >
          Cancel
        </button>
      </div>
    </div>
  );

  const renderKickTypeStep = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold">Kick Play - Select Type</h3>
        
        {/* Debug/Status Indicator */}
        <div className="text-xs bg-gray-100 p-2 rounded">
          <div>Step: {currentStep}</div>
          <div>Penalty: {penaltyQueued ? '🚨 QUEUED' : '✅ None'}</div>
          {lastKeyPressed && keyPressTime && (Date.now() - keyPressTime < 2000) && (
            <div className="text-blue-600 font-bold">
              Key: {lastKeyPressed.toUpperCase()}
            </div>
          )}
        </div>
      </div>
      
      <div className="text-sm text-gray-600 mb-4">
        Use keyboard shortcuts or click buttons:
      </div>
      
      <div className="grid grid-cols-1 gap-4">
        <button
          onClick={() => {
            setKickData(prev => ({ ...prev, kickType: 'field-goal' }));
            setCurrentStep('field-goal-result');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">F - Field Goal</div>
          <div className="text-sm text-gray-600">Attempt at field goal</div>
        </button>
        
        <button
          onClick={() => {
            setKickData(prev => ({ ...prev, kickType: 'extra-point' }));
            setCurrentStep('extra-point-result');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">X - Extra Point</div>
          <div className="text-sm text-gray-600">PAT attempt after touchdown</div>
        </button>
        
        <button
          onClick={() => {
            setKickData(prev => ({ ...prev, kickType: 'kickoff' }));
            setCurrentStep('kickoff-result');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">K - Kickoff</div>
          <div className="text-sm text-gray-600">Kickoff to start half or after score</div>
        </button>
      </div>
      
      <button
        onClick={() => setCurrentStep('kicker')}
        className="px-4 py-2 bg-gray-500 text-white rounded"
      >
        Back
      </button>
    </div>
  );

  const renderFieldGoalResultStep = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Field Goal - Select Result</h3>
      
      <div className="text-sm text-gray-600 mb-4">
        Use keyboard shortcuts or click buttons:
      </div>
      
      <div className="grid grid-cols-1 gap-4">
        <button
          onClick={() => {
            setKickData(prev => ({ ...prev, kickResult: 'good' }));
            setCurrentStep('kick-good-details');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">G - Good</div>
          <div className="text-sm text-gray-600">Field goal successful</div>
        </button>
        
        <button
          onClick={() => {
            setKickData(prev => ({ ...prev, kickResult: 'missed' }));
            setCurrentStep('kick-missed-details');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">M - Missed</div>
          <div className="text-sm text-gray-600">Field goal missed</div>
        </button>
        
        <button
          onClick={() => {
            setKickData(prev => ({ ...prev, kickResult: 'blocked' }));
            setCurrentStep('kick-blocked-details');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">B - Blocked</div>
          <div className="text-sm text-gray-600">Field goal blocked</div>
        </button>
      </div>
      
      <button
        onClick={() => setCurrentStep('kick-type')}
        className="px-4 py-2 bg-gray-500 text-white rounded"
      >
        Back
      </button>
    </div>
  );

  const renderExtraPointResultStep = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Extra Point - Select Result</h3>
      
      <div className="text-sm text-gray-600 mb-4">
        Use keyboard shortcuts or click buttons:
      </div>
      
      <div className="grid grid-cols-1 gap-4">
        <button
          onClick={() => {
            setKickData(prev => ({ ...prev, kickResult: 'good' }));
            setCurrentStep('kick-good-details');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">G - Good</div>
          <div className="text-sm text-gray-600">Extra point successful</div>
        </button>
        
        <button
          onClick={() => {
            setKickData(prev => ({ ...prev, kickResult: 'missed' }));
            setCurrentStep('kick-missed-details');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">M - Missed</div>
          <div className="text-sm text-gray-600">Extra point missed</div>
        </button>
        
        <button
          onClick={() => {
            setKickData(prev => ({ ...prev, kickResult: 'blocked' }));
            setCurrentStep('kick-blocked-details');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">B - Blocked</div>
          <div className="text-sm text-gray-600">Extra point blocked</div>
        </button>
      </div>
      
      <button
        onClick={() => setCurrentStep('kick-type')}
        className="px-4 py-2 bg-gray-500 text-white rounded"
      >
        Back
      </button>
    </div>
  );

  const renderKickoffResultStep = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Kickoff - Select Result</h3>
      
      <div className="text-sm text-gray-600 mb-4">
        Use keyboard shortcuts or click buttons:
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => {
            setKickData(prev => ({ ...prev, kickResult: 'returned' }));
            setCurrentStep('kickoff-returned-details');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">R - Returned</div>
          <div className="text-sm text-gray-600">Kickoff was returned</div>
        </button>
        
        <button
          onClick={() => {
            setKickData(prev => ({ ...prev, kickResult: 'touchback' }));
            setCurrentStep('kickoff-touchback-details');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">T - Touchback</div>
          <div className="text-sm text-gray-600">Kickoff into end zone</div>
        </button>
        
        <button
          onClick={() => {
            setKickData(prev => ({ ...prev, kickResult: 'out-of-bounds' }));
            setCurrentStep('kickoff-out-of-bounds-details');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">O - Out of Bounds</div>
          <div className="text-sm text-gray-600">Kickoff went out of bounds</div>
        </button>
        
        <button
          onClick={() => {
            setKickData(prev => ({ ...prev, kickResult: 'onside' }));
            setCurrentStep('kickoff-onside-details');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">S - Onside</div>
          <div className="text-sm text-gray-600">Onside kick attempt</div>
        </button>
      </div>
      
      <button
        onClick={() => setCurrentStep('kick-type')}
        className="px-4 py-2 bg-gray-500 text-white rounded"
      >
        Back
      </button>
    </div>
  );

  const renderKickGoodDetails = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">{kickData.kickType === 'field-goal' ? 'Field Goal' : 'Extra Point'} Good</h3>
      
      <div className="text-sm text-gray-600 mb-4">
        {kickData.kickType === 'field-goal' ? 'Field goal successful! 3 points scored.' : 'Extra point successful! 1 point scored.'}
      </div>
      
      <div className="flex space-x-2">
        <button
          onClick={handleSubmit}
          className="px-4 py-2 bg-green-600 text-white rounded"
        >
          Submit Play
        </button>
        <button
          onClick={() => setCurrentStep(kickData.kickType === 'field-goal' ? 'field-goal-result' : 'extra-point-result')}
          className="px-4 py-2 bg-gray-500 text-white rounded"
        >
          Back
        </button>
      </div>
    </div>
  );

  const renderKickMissedDetails = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">{kickData.kickType === 'field-goal' ? 'Field Goal' : 'Extra Point'} Missed</h3>
      
      <div className="text-sm text-gray-600 mb-4">
        {kickData.kickType === 'field-goal' ? 'Field goal missed. No points scored.' : 'Extra point missed. No points scored.'}
      </div>
      
      <div className="flex space-x-2">
        <button
          onClick={handleSubmit}
          className="px-4 py-2 bg-green-600 text-white rounded"
        >
          Submit Play
        </button>
        <button
          onClick={() => setCurrentStep(kickData.kickType === 'field-goal' ? 'field-goal-result' : 'extra-point-result')}
          className="px-4 py-2 bg-gray-500 text-white rounded"
        >
          Back
        </button>
      </div>
    </div>
  );

  const renderKickBlockedDetails = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">{kickData.kickType === 'field-goal' ? 'Field Goal' : 'Extra Point'} Blocked</h3>
      
      <PlayerInput
        label="Blocking Player"
        value={kickData.blockingPlayer}
        onChange={(player) => setKickData(prev => ({ ...prev, blockingPlayer: player }))}
        error={errors.blockingPlayer}
        gameState={gameState}
        required
      />
      
      <div className="flex space-x-2">
        <button
          onClick={handleSubmit}
          disabled={!kickData.blockingPlayer}
          className="px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-400"
        >
          Submit Play
        </button>
        <button
          onClick={() => setCurrentStep(kickData.kickType === 'field-goal' ? 'field-goal-result' : 'extra-point-result')}
          className="px-4 py-2 bg-gray-500 text-white rounded"
        >
          Back
        </button>
      </div>
    </div>
  );

  const renderKickoffReturnedDetails = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Kickoff Returned - Select Returner</h3>
      
      <PlayerInput
        label="Returner"
        value={kickData.returner}
        onChange={(player) => setKickData(prev => ({ ...prev, returner: player }))}
        error={errors.returner}
        gameState={gameState}
        required
      />
      
      <div className="flex space-x-2">
        <button
          onClick={handleNext}
          disabled={!kickData.returner}
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-400"
        >
          Next
        </button>
        <button
          onClick={() => setCurrentStep('kickoff-result')}
          className="px-4 py-2 bg-gray-500 text-white rounded"
        >
          Back
        </button>
      </div>
    </div>
  );

  const renderKickoffReturnedGlobalResultStep = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Kickoff Return - Select Final Result</h3>
      
      <div className="text-sm text-gray-600 mb-4">
        Use keyboard shortcuts or click buttons:
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => {
            setKickData(prev => ({ ...prev, globalResult: 'tackle' }));
            setCurrentStep('kickoff-returned-tackle-details');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">T - Tackle</div>
          <div className="text-sm text-gray-600">Returner tackled</div>
        </button>
        
        <button
          onClick={() => {
            setKickData(prev => ({ ...prev, globalResult: 'out-of-bounds' }));
            setCurrentStep('kickoff-returned-out-of-bounds-details');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">O - Out of Bounds</div>
          <div className="text-sm text-gray-600">Returner went out of bounds</div>
        </button>
        
        <button
          onClick={() => {
            setKickData(prev => ({ ...prev, globalResult: 'fumble' }));
            setCurrentStep('kickoff-returned-fumble-details');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">F - Fumble</div>
          <div className="text-sm text-gray-600">Returner fumbled during return</div>
        </button>
        
        <button
          onClick={() => {
            setKickData(prev => ({ ...prev, globalResult: 'end-of-play' }));
            setCurrentStep('kickoff-returned-end-of-play-details');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">. - End of Play</div>
          <div className="text-sm text-gray-600">Special circumstances</div>
        </button>
      </div>
      
      <button
        onClick={() => setCurrentStep('kickoff-returned-details')}
        className="px-4 py-2 bg-gray-500 text-white rounded"
      >
        Back
      </button>
    </div>
  );

  const renderKickoffTouchbackDetails = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Kickoff Touchback</h3>
      
      <div className="text-sm text-gray-600 mb-4">
        Kickoff went into the end zone resulting in a touchback.
        Ball will be placed at the 25-yard line.
      </div>
      
      <div className="flex space-x-2">
        <button
          onClick={handleSubmit}
          className="px-4 py-2 bg-green-600 text-white rounded"
        >
          Submit Play
        </button>
        <button
          onClick={() => setCurrentStep('kickoff-result')}
          className="px-4 py-2 bg-gray-500 text-white rounded"
        >
          Back
        </button>
      </div>
    </div>
  );

  const renderKickoffOutOfBoundsDetails = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Kickoff Out of Bounds</h3>
      
      <YardlineInput
        label="Kick Yard Line (where it went out)"
        value={kickData.kickYardLine}
        onChange={(yardLine) => setKickData(prev => ({ ...prev, kickYardLine: yardLine }))}
        error={errors.kickYardLine}
        gameState={gameState}
        required
      />
      
      <div className="text-sm text-gray-600">
        Penalty: Ball will be placed at the 40-yard line or where it went out of bounds, whichever is more favorable to the receiving team.
      </div>
      
      <div className="flex space-x-2">
        <button
          onClick={handleSubmit}
          disabled={!kickData.kickYardLine}
          className="px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-400"
        >
          Submit Play
        </button>
        <button
          onClick={() => setCurrentStep('kickoff-result')}
          className="px-4 py-2 bg-gray-500 text-white rounded"
        >
          Back
        </button>
      </div>
    </div>
  );

  const renderKickoffOnsideDetails = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Onside Kick</h3>
      
      <div className="space-y-2">
        <label className="block font-bold">Recovering Team</label>
        <div className="flex space-x-4">
          <button
            onClick={() => setKickData(prev => ({ ...prev, onsideRecoveringTeam: 'kicking' }))}
            className={`px-4 py-2 rounded ${kickData.onsideRecoveringTeam === 'kicking' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            Kicking Team
          </button>
          <button
            onClick={() => setKickData(prev => ({ ...prev, onsideRecoveringTeam: 'receiving' }))}
            className={`px-4 py-2 rounded ${kickData.onsideRecoveringTeam === 'receiving' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            Receiving Team
          </button>
        </div>
        {errors.onsideRecoveringTeam && <div className="text-red-500 text-sm">{errors.onsideRecoveringTeam}</div>}
      </div>
      
      <PlayerInput
        label="Recovering Player"
        value={kickData.onsideRecoveringPlayer}
        onChange={(player) => setKickData(prev => ({ ...prev, onsideRecoveringPlayer: player }))}
        error={errors.onsideRecoveringPlayer}
        gameState={gameState}
        required
      />
      
      <YardlineInput
        label="Recovery Spot"
        value={kickData.onsideRecoverySpot}
        onChange={(spot) => setKickData(prev => ({ ...prev, onsideRecoverySpot: spot }))}
        error={errors.onsideRecoverySpot}
        gameState={gameState}
        required
      />
      
      <div className="flex space-x-2">
        <button
          onClick={handleSubmit}
          disabled={!kickData.onsideRecoveringTeam || !kickData.onsideRecoveringPlayer || !kickData.onsideRecoverySpot}
          className="px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-400"
        >
          Submit Play
        </button>
        <button
          onClick={() => setCurrentStep('kickoff-result')}
          className="px-4 py-2 bg-gray-500 text-white rounded"
        >
          Back
        </button>
      </div>
    </div>
  );

  const renderKickoffReturnedTackleDetails = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Kickoff Return - Tackle Details</h3>
      
      <PlayerInput
        label="Primary Tackler"
        value={kickData.tackler1}
        onChange={(player) => setKickData(prev => ({ ...prev, tackler1: player }))}
        error={errors.tackler1}
        gameState={gameState}
        required
      />
      
      <PlayerInput
        label="Assist Tackler (Optional)"
        value={kickData.tackler2}
        onChange={(player) => setKickData(prev => ({ ...prev, tackler2: player }))}
        gameState={gameState}
      />
      
      <YardlineInput
        label="Final Yard Line (where tackled)"
        value={kickData.finalYardLine}
        onChange={(yardLine) => setKickData(prev => ({ ...prev, finalYardLine: yardLine }))}
        error={errors.finalYardLine}
        gameState={gameState}
        required
      />
      
      <div className="flex space-x-2">
        <button
          onClick={handleSubmit}
          disabled={!kickData.tackler1 || !kickData.finalYardLine}
          className="px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-400"
        >
          Submit Play
        </button>
        <button
          onClick={() => setCurrentStep('kickoff-returned-global-result')}
          className="px-4 py-2 bg-gray-500 text-white rounded"
        >
          Back
        </button>
      </div>
    </div>
  );

  const renderKickoffReturnedOutOfBoundsDetails = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Kickoff Return - Out of Bounds Details</h3>
      
      <PlayerInput
        label="Tackler (Optional - if forced out)"
        value={kickData.tackler1}
        onChange={(player) => setKickData(prev => ({ ...prev, tackler1: player }))}
        gameState={gameState}
      />
      
      <YardlineInput
        label="Final Yard Line (where went out of bounds)"
        value={kickData.finalYardLine}
        onChange={(yardLine) => setKickData(prev => ({ ...prev, finalYardLine: yardLine }))}
        error={errors.finalYardLine}
        gameState={gameState}
        required
      />
      
      <div className="flex space-x-2">
        <button
          onClick={handleSubmit}
          disabled={!kickData.finalYardLine}
          className="px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-400"
        >
          Submit Play
        </button>
        <button
          onClick={() => setCurrentStep('kickoff-returned-global-result')}
          className="px-4 py-2 bg-gray-500 text-white rounded"
        >
          Back
        </button>
      </div>
    </div>
  );

  const renderKickoffReturnedFumbleDetails = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Kickoff Return Fumble - Details</h3>
      
      <PlayerInput
        label="Forced By"
        value={kickData.forcedBy}
        onChange={(player) => setKickData(prev => ({ ...prev, forcedBy: player }))}
        gameState={gameState}
      />
      
      <div className="space-y-2">
        <label className="block font-bold">Recovering Team</label>
        <div className="flex space-x-4">
          <button
            onClick={() => setKickData(prev => ({ ...prev, recoveringTeam: 'home' }))}
            className={`px-4 py-2 rounded ${kickData.recoveringTeam === 'home' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            Home
          </button>
          <button
            onClick={() => setKickData(prev => ({ ...prev, recoveringTeam: 'visitor' }))}
            className={`px-4 py-2 rounded ${kickData.recoveringTeam === 'visitor' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            Visitor
          </button>
        </div>
        {errors.recoveringTeam && <div className="text-red-500 text-sm">{errors.recoveringTeam}</div>}
      </div>
      
      <PlayerInput
        label="Recovering Player"
        value={kickData.recoveringPlayer}
        onChange={(player) => setKickData(prev => ({ ...prev, recoveringPlayer: player }))}
        error={errors.recoveringPlayer}
        gameState={gameState}
        required
      />
      
      <YardlineInput
        label="Recovery Spot"
        value={kickData.recoverySpot}
        onChange={(spot) => setKickData(prev => ({ ...prev, recoverySpot: spot }))}
        error={errors.recoverySpot}
        gameState={gameState}
        required
      />
      
      <div className="flex space-x-2">
        <button
          onClick={handleSubmit}
          disabled={!kickData.recoveringTeam || !kickData.recoveringPlayer || !kickData.recoverySpot}
          className="px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-400"
        >
          Submit Play
        </button>
        <button
          onClick={() => setCurrentStep('kickoff-returned-global-result')}
          className="px-4 py-2 bg-gray-500 text-white rounded"
        >
          Back
        </button>
      </div>
    </div>
  );

  const renderKickoffReturnedEndOfPlayDetails = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Kickoff Return - End of Play</h3>
      
      <YardlineInput
        label="Final Yard Line"
        value={kickData.finalYardLine}
        onChange={(yardLine) => setKickData(prev => ({ ...prev, finalYardLine: yardLine }))}
        error={errors.finalYardLine}
        gameState={gameState}
        required
      />
      
      <div className="text-sm text-gray-600">
        <div>Special handling:</div>
        <div>• Own 00 (0 Relative YL) = Safety</div>
        <div>• Opp 00 (100 Relative YL) = Touchdown</div>
      </div>
      
      <div className="flex space-x-2">
        <button
          onClick={handleSubmit}
          disabled={!kickData.finalYardLine}
          className="px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-400"
        >
          Submit Play
        </button>
        <button
          onClick={() => setCurrentStep('kickoff-returned-global-result')}
          className="px-4 py-2 bg-gray-500 text-white rounded"
        >
          Back
        </button>
      </div>
      
      {errors.submit && <div className="text-red-500 text-sm">{errors.submit}</div>}
    </div>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'kicker':
        return renderKickerStep();
      case 'kick-type':
        return renderKickTypeStep();
      case 'field-goal-result':
        return renderFieldGoalResultStep();
      case 'extra-point-result':
        return renderExtraPointResultStep();
      case 'kickoff-result':
        return renderKickoffResultStep();
      case 'kick-good-details':
        return renderKickGoodDetails();
      case 'kick-missed-details':
        return renderKickMissedDetails();
      case 'kick-blocked-details':
        return renderKickBlockedDetails();
      case 'kickoff-returned-details':
        return renderKickoffReturnedDetails();
      case 'kickoff-returned-global-result':
        return renderKickoffReturnedGlobalResultStep();
      case 'kickoff-touchback-details':
        return renderKickoffTouchbackDetails();
      case 'kickoff-out-of-bounds-details':
        return renderKickoffOutOfBoundsDetails();
      case 'kickoff-onside-details':
        return renderKickoffOnsideDetails();
      case 'kickoff-returned-tackle-details':
        return renderKickoffReturnedTackleDetails();
      case 'kickoff-returned-out-of-bounds-details':
        return renderKickoffReturnedOutOfBoundsDetails();
      case 'kickoff-returned-fumble-details':
        return renderKickoffReturnedFumbleDetails();
      case 'kickoff-returned-end-of-play-details':
        return renderKickoffReturnedEndOfPlayDetails();
      default:
        return renderKickerStep();
    }
  };

  return (
    <div className="p-6 bg-white border border-gray-300 rounded-lg shadow-lg max-w-2xl">
      {/* Penalty Queued Indicator */}
      {penaltyQueued && (
        <div className="mb-4 p-3 bg-yellow-200 border-l-4 border-yellow-500 text-yellow-800">
          <div className="flex items-center">
            <span className="text-lg mr-2">⚠️</span>
            <span className="font-semibold">PENALTY QUEUED</span>
            <span className="ml-2 text-sm">(Press E to toggle)</span>
          </div>
        </div>
      )}
      
      {renderCurrentStep()}
      
      {/* Penalty Input Modal */}
      {showPenaltyModal && (
        <PenaltyInputModal
          isOpen={showPenaltyModal}
          onClose={() => setShowPenaltyModal(false)}
          onSubmit={handlePenaltySubmit}
          gameState={gameState}
        />
      )}
    </div>
  );
};

export default KickInputFlow;

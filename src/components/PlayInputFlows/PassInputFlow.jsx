import React, { useState, useEffect } from 'react';
import debug from '../../utils/debug';
import { useGameState } from '../../contexts/FootballGameContext';
import PlayerInput from '../PlayerInput';
import YardlineInput from '../YardlineInput';
import PenaltyInputModal from '../PenaltyInputModal';
import DownDistanceCalculator from '../../utils/DownDistanceCalculator';

const PassInputFlow = ({ onComplete, onCancel, gameState }) => {
  const { submitEvent, currentGameId } = useGameState();
  
  const [passData, setPassData] = useState({
    quarterback: null,
    receiver: null,
    passResult: null, // 'complete', 'incomplete', 'sack', 'fumble', 'intercepted'
    globalResult: null, // For complete passes and interceptions: T, O, F, .
    finalYardLine: '',
    tackler1: null,
    tackler2: null,
    forcedBy: null,
    recoveringTeam: null,
    recoveringPlayer: null,
    recoverySpot: '',
    sackYardLine: '',
    incompleteReason: null, // 'dropped', 'defended', 'overthrown', 'underthrown', 'out-of-bounds'
    defender: null,
    interceptor: null,
    interceptedAt: '',
    passBreakupPlayer: null,
    qbHurried: false,
    hurryDefender1: null,
    hurryDefender2: null
  });

  const [currentStep, setCurrentStep] = useState('quarterback'); // quarterback -> receiver -> pass-result -> complete-details OR incomplete-details
  const [errors, setErrors] = useState({});
  const [penaltyQueued, setPenaltyQueued] = useState(false);
  const [showPenaltyModal, setShowPenaltyModal] = useState(false);

  // C1. Centralized validation for pass flow steps
  const validByStep = {
    'quarterback': !!passData.quarterback?.player_id || !!passData.quarterback?.id,
    'receiver': passData.passResult === 'complete' ? (!!passData.receiver?.player_id || !!passData.receiver?.id) : true,
    'pass-result': !!passData.passResult,
    'incomplete-details': !!passData.incompleteReason,
    'sack-details': !!passData.tackler1 && !!passData.sackYardLine,
    'complete-tackle-details': !!passData.tackler1 && !!passData.finalYardLine,
    'complete-out-of-bounds-details': !!passData.finalYardLine,
    'complete-fumble-details': !!passData.recoveringTeam && !!passData.recoveringPlayer && !!passData.recoverySpot,
    'complete-end-of-play-details': !!passData.finalYardLine,
    'intercepted-details': !!passData.interceptor && !!passData.interceptedAt,
    'intercepted-tackle-details': !!passData.tackler1 && !!passData.finalYardLine,
    'intercepted-out-of-bounds-details': !!passData.finalYardLine,
    'intercepted-fumble-details': !!passData.recoveringTeam && !!passData.recoveringPlayer && !!passData.recoverySpot,
    'intercepted-end-of-play-details': !!passData.finalYardLine,
    'spot-yardline': !!passData.endYardLine,
  };
  const isStepValid = !!validByStep[currentStep];

  // Handle keyboard shortcuts for pass results (C, I, S, F), global results (T, O, F, .) and penalty queuing (E)
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Don't handle keyboard shortcuts if user is typing in an input field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
        return;
      }

      // Handle penalty queuing with 'E' key - available at any time during play input
      if (e.key.toLowerCase() === 'e') {
        e.preventDefault();
        debug.log('E key pressed - toggling penalty queued');
        setPenaltyQueued(prev => !prev);
        return;
      }

      // Handle Enter key for navigation
      if (e.key === 'Enter') {
        e.preventDefault();
        handleEnterKeyPress();
        return;
      }

      if (currentStep === 'pass-result') {
        switch (e.key.toLowerCase()) {
          case 'c':
            setPassData(prev => ({ ...prev, passResult: 'complete' }));
            setCurrentStep('complete-global-result');
            break;
          case 'i':
            setPassData(prev => ({ ...prev, passResult: 'incomplete' }));
            setCurrentStep('incomplete-details');
            break;
          case 's':
            setPassData(prev => ({ ...prev, passResult: 'sack' }));
            setCurrentStep('sack-details');
            break;
          case 'f':
            setPassData(prev => ({ ...prev, passResult: 'fumble' }));
            setCurrentStep('fumble-details');
            break;
          case 'x':
            setPassData(prev => ({ ...prev, passResult: 'intercepted' }));
            setCurrentStep('intercepted-details');
            break;
        }
      }
      
      if (currentStep === 'complete-global-result') {
        switch (e.key.toLowerCase()) {
          case 't':
            setPassData(prev => ({ ...prev, globalResult: 'TACKLE' }));
            setCurrentStep('complete-tackle-details');
            break;
          case 'o':
            setPassData(prev => ({ ...prev, globalResult: 'OUT_OF_BOUNDS' }));
            setCurrentStep('complete-out-of-bounds-details');
            break;
          case 'f':
            setPassData(prev => ({ ...prev, globalResult: 'FUMBLE' }));
            setCurrentStep('complete-fumble-details');
            break;
          case '.':
            setPassData(prev => ({ ...prev, globalResult: 'END_OF_PLAY' }));
            setCurrentStep('complete-end-of-play-details');
            break;
        }
      }
      
      if (currentStep === 'intercepted-global-result') {
        switch (e.key.toLowerCase()) {
          case 't':
            setPassData(prev => ({ ...prev, globalResult: 'TACKLE' }));
            setCurrentStep('intercepted-tackle-details');
            break;
          case 'o':
            setPassData(prev => ({ ...prev, globalResult: 'OUT_OF_BOUNDS' }));
            setCurrentStep('intercepted-out-of-bounds-details');
            break;
          case 'f':
            setPassData(prev => ({ ...prev, globalResult: 'FUMBLE' }));
            setCurrentStep('intercepted-fumble-details');
            break;
          case '.':
            setPassData(prev => ({ ...prev, globalResult: 'END_OF_PLAY' }));
            setCurrentStep('intercepted-end-of-play-details');
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

  const handleEnterKeyPress = () => {
    if (!isStepValid) return; // Use centralized validation
    
    switch (currentStep) {
      case 'quarterback':
        setCurrentStep('receiver');
        break;
      case 'receiver':
        setCurrentStep('pass-result');
        break;
      case 'pass-result':
        // Use existing keyboard shortcuts for result selection
        break;
      case 'complete-global-result':
        // Use existing keyboard shortcuts for global result selection
        break;
      case 'intercepted-global-result':
        // Use existing keyboard shortcuts for intercepted global result selection
        break;
      case 'incomplete-details':
        handleSubmit();
        break;
      case 'sack-details':
        handleSubmit();
        break;
      case 'fumble-details':
        if (passData.recoveringTeam && passData.recoveringPlayer && passData.recoverySpot) {
          handleSubmit();
        }
        break;
      case 'complete-tackle-details':
        if (passData.tackler1 && passData.finalYardLine) {
          handleSubmit();
        }
        break;
      case 'complete-out-of-bounds-details':
        if (passData.finalYardLine) {
          handleSubmit();
        }
        break;
      case 'complete-fumble-details':
        if (passData.recoveringTeam && passData.recoveringPlayer && passData.recoverySpot) {
          handleSubmit();
        }
        break;
      case 'complete-end-of-play-details':
        if (passData.finalYardLine) {
          handleSubmit();
        }
        break;
      case 'intercepted-details':
        if (passData.interceptor && passData.interceptedAt) {
          setCurrentStep('intercepted-global-result');
        }
        break;
      case 'intercepted-tackle-details':
        if (passData.tackler1 && passData.finalYardLine) {
          handleSubmit();
        }
        break;
      case 'intercepted-out-of-bounds-details':
        if (passData.finalYardLine) {
          handleSubmit();
        }
        break;
      case 'intercepted-fumble-details':
        if (passData.recoveringTeam && passData.recoveringPlayer && passData.recoverySpot) {
          handleSubmit();
        }
        break;
      case 'intercepted-end-of-play-details':
        if (passData.finalYardLine) {
          handleSubmit();
        }
        break;
      default:
        break;
    }
  };

  const validatePassStep = (step) => {
    const newErrors = {};
    
    switch (step) {
      case 'quarterback':
        if (!passData.quarterback) {
          newErrors.quarterback = 'Quarterback selection is required';
        }
        break;
      case 'receiver':
        if (!passData.receiver) {
          newErrors.receiver = 'Receiver selection is required';
        }
        break;
      case 'pass-result':
        if (!passData.passResult) {
          newErrors.passResult = 'Pass result is required';
        }
        break;
      case 'incomplete-details':
        if (!passData.incompleteReason) {
          newErrors.incompleteReason = 'Incomplete reason is required';
        }
        break;
      case 'sack-details':
        if (!passData.tackler1) {
          newErrors.tackler1 = 'Primary tackler is required';
        }
        if (!passData.sackYardLine) {
          newErrors.sackYardLine = 'Sack yard line is required';
        }
        break;
      case 'complete-tackle-details':
        if (!passData.tackler1) {
          newErrors.tackler1 = 'Primary tackler is required';
        }
        if (!passData.finalYardLine) {
          newErrors.finalYardLine = 'Final yard line is required';
        }
        break;
      case 'complete-out-of-bounds-details':
        if (!passData.finalYardLine) {
          newErrors.finalYardLine = 'Final yard line is required';
        }
        break;
      case 'complete-fumble-details':
      case 'fumble-details':
        if (!passData.recoveringTeam) {
          newErrors.recoveringTeam = 'Recovering team is required';
        }
        if (!passData.recoveringPlayer) {
          newErrors.recoveringPlayer = 'Recovering player is required';
        }
        if (!passData.recoverySpot) {
          newErrors.recoverySpot = 'Recovery spot is required';
        }
        break;
      case 'complete-end-of-play-details':
        if (!passData.finalYardLine) {
          newErrors.finalYardLine = 'Final yard line is required';
        }
        break;
      case 'intercepted-details':
        if (!passData.interceptor) {
          newErrors.interceptor = 'Interceptor is required';
        }
        if (!passData.interceptedAt) {
          newErrors.interceptedAt = 'Intercepted yard line is required';
        }
        break;
      case 'intercepted-tackle-details':
        if (!passData.tackler1) {
          newErrors.tackler1 = 'Primary tackler is required';
        }
        if (!passData.finalYardLine) {
          newErrors.finalYardLine = 'Final yard line is required';
        }
        break;
      case 'intercepted-out-of-bounds-details':
        if (!passData.finalYardLine) {
          newErrors.finalYardLine = 'Final yard line is required';
        }
        break;
      case 'intercepted-fumble-details':
        if (!passData.recoveringTeam) {
          newErrors.recoveringTeam = 'Recovering team is required';
        }
        if (!passData.recoveringPlayer) {
          newErrors.recoveringPlayer = 'Recovering player is required';
        }
        if (!passData.recoverySpot) {
          newErrors.recoverySpot = 'Recovery spot is required';
        }
        break;
      case 'intercepted-end-of-play-details':
        if (!passData.finalYardLine) {
          newErrors.finalYardLine = 'Final yard line is required';
        }
        break;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (!validatePassStep(currentStep)) return;
    
    switch (currentStep) {
      case 'quarterback':
        setCurrentStep('receiver');
        break;
      case 'receiver':
        setCurrentStep('pass-result');
        break;
      case 'pass-result':
        // This is handled by keyboard shortcuts or button clicks
        break;
      default:
        handleSubmit();
        break;
    }
  };

  const handleSubmit = async () => {
    if (!validatePassStep(currentStep)) return;
    
    // Calculate post-play down and distance using PRE-PLAY game state
    // CRITICAL: Use the game state as it exists BEFORE this play, not after
    const currentGameStateForCalc = {
      YardLinePosition: gameState?.live_state?.yard_line_position || gameState?.live_state?.yard_line || 'V28',  // PRE-PLAY position
      CurrentDown: gameState?.live_state?.current_down || gameState?.live_state?.down || 1,              // PRE-PLAY down
      YardsToGo: gameState?.live_state?.yards_to_go || gameState?.live_state?.distance || 10,            // PRE-PLAY distance
      LineToGain: gameState?.live_state?.line_to_gain,
      Possession: gameState?.live_state?.possession === 'visitor' ? 'V' : 'H'
    };
    
    debug.log('[PASS CALC DEBUG] Using PRE-PLAY state for calculation:', {
      YardLinePosition: currentGameStateForCalc.YardLinePosition,
      CurrentDown: currentGameStateForCalc.CurrentDown,
      YardsToGo: currentGameStateForCalc.YardsToGo,
      endPosition: passData.finalYardLine
    });
    
    const playDataForCalc = {
      startPosition: currentGameStateForCalc.YardLinePosition,
      endPosition: passData.finalYardLine,
      possession: currentGameStateForCalc.Possession,
      isFirstDown: passData.passResult === 'complete' && (passData.globalResult === 'first_down' || passData.globalResult === 'touchdown'),
      isTouchdown: passData.globalResult === 'touchdown',
      isTurnover: passData.passResult === 'intercepted',
      isSafety: false,
      is_kickoff: false,
      play_type: 'pass'
    };
    
    const postPlayState = DownDistanceCalculator.calculatePostPlayState(playDataForCalc, currentGameStateForCalc);
    
    // Build play data structure compatible with API (per FLOW_VARIABLE_TO_SQL_MAPPING.md)
    const playData = {
      playType: 'pass',                               // Standard API field
      primaryPlayerID: passData.quarterback,        // quarterback → primaryPlayerID
      secondaryPlayerID: passData.receiver,         // receiver → secondaryPlayerID (if complete)
      resultCode: passData.passResult,                    // passResult → resultCode ('COMPLETE', 'INCOMPLETE', 'SACK', 'INTERCEPTION')
      endYardLine: passData.finalYardLine,           // For frontend consistency
      end_yard_line: passData.finalYardLine,         // finalYardLine → end_yard_line
      
      // Post-play state for backend game_state updates
      post_down: postPlayState.postDown,
      post_distance: postPlayState.postDistance,
      has_fumble: passData.miscFumble || false,      // miscFumble → has_fumble
      penaltyQueued: penaltyQueued,                   // Add penalty status to play data
      
      // Additional pass-specific data (stored in RawData)
      globalResult: passData.globalResult,           // For completions: 'TACKLE', 'OUT_OF_BOUNDS', 'FUMBLE'
      caughtAt: passData.caughtAt,                   // Yard line where pass was caught
      sackYardLine: passData.sackYardLine,           // Yard line where sack occurred
      intendedFor: passData.intendedFor,             // Intended receiver for incompletions
      incompleteReason: passData.incompleteReason,
      
      // Participant data (will be processed separately by API)
      tackler1: passData.tackler1,                   // → play_participants table
      tackler2: passData.tackler2,                   // → play_participants table
      sacker1: passData.sacker1,                     // → play_participants table
      sacker2: passData.sacker2,                     // → play_participants table
      forcedBy: passData.forcedBy,                   // → play_participants table
      defender: passData.defender,                   // passBreakupPlayer → play_participants table
      
      // Fumble recovery data (calculated by API)
      recoveringTeam: passData.recoveringTeam,       // → Fumble1RecoveredBy
      recoveringPlayer: passData.recoveringPlayer,   // → Fumble1RecoveredByPlayerID
      recoverySpot: passData.recoverySpot            // → Fumble1YardLine
    };

    debug.log('[PASS SUBMIT] payload:', playData);

    try {
      // If penalty is queued, hold play data and start penalty flow
      if (penaltyQueued) {
        // Open penalty input modal with play data held in memory
        debug.log('Penalty queued - opening penalty input flow with play data:', playData);
        setShowPenaltyModal(true);
        return;
      }

      // Normal play submission if no penalty queued
      await submitEvent(playData);
      onComplete(playData);
    } catch (error) {
      console.error('Error submitting pass play:', error);
      setErrors({ submit: 'Error submitting play. Please try again.' });
    }
  };

  const handlePenaltySubmit = async (penaltyData) => {
    try {
      // Submit play with penalty data
      const playData = {
        playType: 'pass',
        quarterback: passData.quarterback,
        receiver: passData.receiver,
        passResult: passData.passResult,
        globalResult: passData.globalResult,
        finalYardLine: passData.finalYardLine,
        tackler1: passData.tackler1,
        tackler2: passData.tackler2,
        forcedBy: passData.forcedBy,
        recoveringTeam: passData.recoveringTeam,
        recoveringPlayer: passData.recoveringPlayer,
        recoverySpot: passData.recoverySpot,
        sackYardLine: passData.sackYardLine,
        incompleteReason: passData.incompleteReason,
        defender: passData.defender,
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

  const renderQuarterbackStep = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Pass Play - Select Quarterback</h3>
      
      <PlayerInput
        label="Quarterback"
        value={passData.quarterback?.player_id || passData.quarterback?.id}
        onChange={(playerId) => setPassData(prev => ({ ...prev, quarterback: { player_id: playerId, id: playerId } }))}
        onSelect={(player) => setPassData(prev => ({ ...prev, quarterback: player }))}
        error={errors.quarterback}
        gameState={gameState}
        team={gameState?.live_state?.possession === 'home' ? 'home' : 'visitor'}
        required
        autoFocus={true}
      />
      
      <div className="flex space-x-2">
        <button
          onClick={handleNext}
          disabled={!isStepValid}
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

  const renderReceiverStep = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Pass Play - Select Receiver</h3>
      
      <PlayerInput
        label="Receiver"
        value={passData.receiver?.player_id || passData.receiver?.id}
        onChange={(playerId) => setPassData(prev => ({ ...prev, receiver: { player_id: playerId, id: playerId } }))}
        onSelect={(player) => setPassData(prev => ({ ...prev, receiver: player }))}
        error={errors.receiver}
        gameState={gameState}
        team={gameState?.live_state?.possession === 'home' ? 'home' : 'visitor'}
        required
      />
      
      <div className="flex space-x-2">
        <button
          onClick={handleNext}
          disabled={!passData.receiver}
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-400"
        >
          Next
        </button>
        <button
          onClick={() => setCurrentStep('quarterback')}
          className="px-4 py-2 bg-gray-500 text-white rounded"
        >
          Back
        </button>
      </div>
    </div>
  );

  const renderPassResultStep = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Pass Play - Select Result</h3>
      
      <div className="text-sm text-gray-600 mb-4">
        Use keyboard shortcuts or click buttons:
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => {
            setPassData(prev => ({ ...prev, passResult: 'complete' }));
            setCurrentStep('complete-global-result');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">C - Complete</div>
          <div className="text-sm text-gray-600">Pass was caught</div>
        </button>
        
        <button
          onClick={() => {
            setPassData(prev => ({ ...prev, passResult: 'incomplete' }));
            setCurrentStep('incomplete-details');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">I - Incomplete</div>
          <div className="text-sm text-gray-600">Pass not caught</div>
        </button>
        
        <button
          onClick={() => {
            setPassData(prev => ({ ...prev, passResult: 'sack' }));
            setCurrentStep('sack-details');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">S - Sack</div>
          <div className="text-sm text-gray-600">QB tackled behind line</div>
        </button>
        
        <button
          onClick={() => {
            setPassData(prev => ({ ...prev, passResult: 'fumble' }));
            setCurrentStep('fumble-details');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">F - Fumble</div>
          <div className="text-sm text-gray-600">QB fumbled before pass</div>
        </button>
        
        <button
          onClick={() => {
            setPassData(prev => ({ ...prev, passResult: 'intercepted' }));
            setCurrentStep('intercepted-details');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500 col-span-2"
        >
          <div className="font-bold">X - Intercepted</div>
          <div className="text-sm text-gray-600">Pass was intercepted by defense</div>
        </button>
      </div>
      
      <button
        onClick={() => setCurrentStep('receiver')}
        className="px-4 py-2 bg-gray-500 text-white rounded"
      >
        Back
      </button>
    </div>
  );

  const renderCompleteGlobalResultStep = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Pass Complete - Select Final Result</h3>
      
      <div className="text-sm text-gray-600 mb-4">
        Use keyboard shortcuts or click buttons:
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => {
            setPassData(prev => ({ ...prev, globalResult: 'TACKLE' }));
            setCurrentStep('complete-tackle-details');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">T - Tackle</div>
          <div className="text-sm text-gray-600">Receiver tackled</div>
        </button>
        
        <button
          onClick={() => {
            setPassData(prev => ({ ...prev, globalResult: 'OUT_OF_BOUNDS' }));
            setCurrentStep('complete-out-of-bounds-details');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">O - Out of Bounds</div>
          <div className="text-sm text-gray-600">Receiver went out of bounds</div>
        </button>
        
        <button
          onClick={() => {
            setPassData(prev => ({ ...prev, globalResult: 'FUMBLE' }));
            setCurrentStep('complete-fumble-details');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">F - Fumble</div>
          <div className="text-sm text-gray-600">Receiver fumbled after catch</div>
        </button>
        
        <button
          onClick={() => {
            setPassData(prev => ({ ...prev, globalResult: 'END_OF_PLAY' }));
            setCurrentStep('complete-end-of-play-details');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">. - End of Play</div>
          <div className="text-sm text-gray-600">Special circumstances</div>
        </button>
      </div>
      
      <button
        onClick={() => setCurrentStep('pass-result')}
        className="px-4 py-2 bg-gray-500 text-white rounded"
      >
        Back
      </button>
    </div>
  );

  const renderIncompleteDetails = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Pass Incomplete - Details</h3>
      
      <div className="space-y-2">
        <label className="block font-bold">Reason for Incomplete</label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: 'dropped', label: 'Dropped' },
            { value: 'defended', label: 'Defended' },
            { value: 'overthrown', label: 'Overthrown' },
            { value: 'underthrown', label: 'Underthrown' },
            { value: 'out-of-bounds', label: 'Out of Bounds' }
          ].map(reason => (
            <button
              key={reason.value}
              onClick={() => setPassData(prev => ({ ...prev, incompleteReason: reason.value }))}
              className={`px-3 py-2 rounded ${passData.incompleteReason === reason.value ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
            >
              {reason.label}
            </button>
          ))}
        </div>
        {errors.incompleteReason && <div className="text-red-500 text-sm">{errors.incompleteReason}</div>}
      </div>
      
      {passData.incompleteReason === 'defended' && (
        <PlayerInput
          label="Defending Player"
          value={passData.defender}
          onChange={(player) => setPassData(prev => ({ ...prev, defender: player }))}
          gameState={gameState}
        />
      )}
      
      <div className="flex space-x-2">
        <button
          onClick={handleSubmit}
          disabled={!passData.incompleteReason}
          className="px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-400"
        >
          Submit Play
        </button>
        <button
          onClick={() => setCurrentStep('pass-result')}
          className="px-4 py-2 bg-gray-500 text-white rounded"
        >
          Back
        </button>
      </div>
    </div>
  );

  const renderSackDetails = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Sack - Details</h3>
      
      <PlayerInput
        label="Primary Tackler"
        value={passData.tackler1}
        onChange={(player) => setPassData(prev => ({ ...prev, tackler1: player }))}
        error={errors.tackler1}
        gameState={gameState}
        team={gameState?.live_state?.possession === 'home' ? 'visitor' : 'home'}
        required
      />
      
      <PlayerInput
        label="Assist Tackler (Optional)"
        value={passData.tackler2}
        onChange={(player) => setPassData(prev => ({ ...prev, tackler2: player }))}
        gameState={gameState}
        team={gameState?.live_state?.possession === 'home' ? 'visitor' : 'home'}
      />
      
      <YardlineInput
        label="Sack Yard Line"
        value={passData.sackYardLine}
        onChange={(yardLine) => setPassData(prev => ({ ...prev, sackYardLine: yardLine }))}
        error={errors.sackYardLine}
        gameState={gameState}
        required
      />
      
      <div className="flex space-x-2">
        <button
          onClick={handleSubmit}
          disabled={!passData.tackler1 || !passData.sackYardLine}
          className="px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-400"
        >
          Submit Play
        </button>
        <button
          onClick={() => setCurrentStep('pass-result')}
          className="px-4 py-2 bg-gray-500 text-white rounded"
        >
          Back
        </button>
      </div>
    </div>
  );

  const renderCompleteTackleDetails = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Pass Complete - Tackle Details</h3>
      
      <PlayerInput
        label="Primary Tackler"
        value={passData.tackler1}
        onChange={(player) => setPassData(prev => ({ ...prev, tackler1: player }))}
        error={errors.tackler1}
        gameState={gameState}
        required
      />
      
      <PlayerInput
        label="Assist Tackler (Optional)"
        value={passData.tackler2}
        onChange={(player) => setPassData(prev => ({ ...prev, tackler2: player }))}
        gameState={gameState}
      />
      
      <YardlineInput
        label="Final Yard Line (where tackled)"
        value={passData.finalYardLine}
        onChange={(yardLine) => setPassData(prev => ({ ...prev, finalYardLine: yardLine }))}
        error={errors.finalYardLine}
        gameState={gameState}
        required
      />
      
      <div className="flex space-x-2">
        <button
          onClick={handleSubmit}
          disabled={!passData.tackler1 || !passData.finalYardLine}
          className="px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-400"
        >
          Submit Play
        </button>
        <button
          onClick={() => setCurrentStep('complete-global-result')}
          className="px-4 py-2 bg-gray-500 text-white rounded"
        >
          Back
        </button>
      </div>
    </div>
  );

  const renderCompleteOutOfBoundsDetails = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Pass Complete - Out of Bounds Details</h3>
      
      <PlayerInput
        label="Tackler (Optional - if forced out)"
        value={passData.tackler1}
        onChange={(player) => setPassData(prev => ({ ...prev, tackler1: player }))}
        gameState={gameState}
      />
      
      <YardlineInput
        label="Final Yard Line (where went out of bounds)"
        value={passData.finalYardLine}
        onChange={(yardLine) => setPassData(prev => ({ ...prev, finalYardLine: yardLine }))}
        error={errors.finalYardLine}
        gameState={gameState}
        required
      />
      
      <div className="flex space-x-2">
        <button
          onClick={handleSubmit}
          disabled={!passData.finalYardLine}
          className="px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-400"
        >
          Submit Play
        </button>
        <button
          onClick={() => setCurrentStep('complete-global-result')}
          className="px-4 py-2 bg-gray-500 text-white rounded"
        >
          Back
        </button>
      </div>
    </div>
  );

  const renderFumbleDetails = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">{passData.passResult === 'fumble' ? 'QB Fumble' : 'Receiver Fumble'} - Details</h3>
      
      <PlayerInput
        label="Forced By"
        value={passData.forcedBy}
        onChange={(player) => setPassData(prev => ({ ...prev, forcedBy: player }))}
        gameState={gameState}
      />
      
      <div className="space-y-2">
        <label className="block font-bold">Recovering Team</label>
        <div className="flex space-x-4">
          <button
            onClick={() => setPassData(prev => ({ ...prev, recoveringTeam: 'home' }))}
            className={`px-4 py-2 rounded ${passData.recoveringTeam === 'home' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            Home
          </button>
          <button
            onClick={() => setPassData(prev => ({ ...prev, recoveringTeam: 'visitor' }))}
            className={`px-4 py-2 rounded ${passData.recoveringTeam === 'visitor' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            Visitor
          </button>
        </div>
        {errors.recoveringTeam && <div className="text-red-500 text-sm">{errors.recoveringTeam}</div>}
      </div>
      
      <PlayerInput
        label="Recovering Player"
        value={passData.recoveringPlayer}
        onChange={(player) => setPassData(prev => ({ ...prev, recoveringPlayer: player }))}
        error={errors.recoveringPlayer}
        gameState={gameState}
        required
      />
      
      <YardlineInput
        label="Recovery Spot"
        value={passData.recoverySpot}
        onChange={(recoverySpot) => setPassData(prev => ({ ...prev, recoverySpot }))}
        error={errors.recoverySpot}
        gameState={gameState}
        required
      />
      
      <div className="flex space-x-2">
        <button
          onClick={handleSubmit}
          disabled={!passData.recoveringTeam || !passData.recoveringPlayer || !passData.recoverySpot}
          className="px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-400"
        >
          Submit Play
        </button>
        <button
          onClick={() => setCurrentStep(passData.passResult === 'fumble' ? 'pass-result' : 'complete-global-result')}
          className="px-4 py-2 bg-gray-500 text-white rounded"
        >
          Back
        </button>
      </div>
    </div>
  );

  const renderCompleteEndOfPlayDetails = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Pass Complete - End of Play</h3>
      
      <YardlineInput
        label="Final Yard Line"
        value={passData.finalYardLine}
        onChange={(yardLine) => setPassData(prev => ({ ...prev, finalYardLine: yardLine }))}
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
          disabled={!passData.finalYardLine}
          className="px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-400"
        >
          Submit Play
        </button>
        <button
          onClick={() => setCurrentStep('complete-global-result')}
          className="px-4 py-2 bg-gray-500 text-white rounded"
        >
          Back
        </button>
      </div>
      
      {errors.submit && <div className="text-red-500 text-sm">{errors.submit}</div>}
    </div>
  );

  const renderInterceptedDetails = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Pass Intercepted - Details</h3>
      
      <PlayerInput
        label="Intercepted By"
        value={passData.interceptor}
        onChange={(player) => setPassData(prev => ({ ...prev, interceptor: player }))}
        error={errors.interceptor}
        gameState={gameState}
        required
      />
      
      <PlayerInput
        label="Pass Breakup (Optional)"
        value={passData.passBreakupPlayer}
        onChange={(player) => setPassData(prev => ({ ...prev, passBreakupPlayer: player }))}
        gameState={gameState}
      />
      
      <div className="space-y-2">
        <label className="block font-bold">QB Hurried?</label>
        <div className="flex space-x-4">
          <button
            onClick={() => setPassData(prev => ({ ...prev, qbHurried: false, hurryDefender1: null, hurryDefender2: null }))}
            className={`px-4 py-2 rounded ${!passData.qbHurried ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            No
          </button>
          <button
            onClick={() => setPassData(prev => ({ ...prev, qbHurried: true }))}
            className={`px-4 py-2 rounded ${passData.qbHurried ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            Yes
          </button>
        </div>
      </div>
      
      {passData.qbHurried && (
        <>
          <PlayerInput
            label="Hurry Defender 1"
            value={passData.hurryDefender1}
            onChange={(player) => setPassData(prev => ({ ...prev, hurryDefender1: player }))}
            error={errors.hurryDefender1}
            gameState={gameState}
            required
          />
          
          <PlayerInput
            label="Hurry Defender 2 (Optional)"
            value={passData.hurryDefender2}
            onChange={(player) => setPassData(prev => ({ ...prev, hurryDefender2: player }))}
            gameState={gameState}
          />
        </>
      )}
      
      <YardlineInput
        label="Intercepted At"
        value={passData.interceptedAt}
        onChange={(yardLine) => setPassData(prev => ({ ...prev, interceptedAt: yardLine }))}
        error={errors.interceptedAt}
        gameState={gameState}
        required
      />
      
      <div className="flex space-x-2">
        <button
          onClick={() => setCurrentStep('intercepted-global-result')}
          disabled={!passData.interceptor || !passData.interceptedAt || (passData.qbHurried && !passData.hurryDefender1)}
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-400"
        >
          Next - Select Result
        </button>
        <button
          onClick={() => setCurrentStep('pass-result')}
          className="px-4 py-2 bg-gray-500 text-white rounded"
        >
          Back
        </button>
      </div>
    </div>
  );

  const renderInterceptedGlobalResult = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Interception Return - Select Final Result</h3>
      
      <div className="text-sm text-gray-600 mb-4">
        Use keyboard shortcuts or click buttons:
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => {
            setPassData(prev => ({ ...prev, globalResult: 'TACKLE' }));
            setCurrentStep('intercepted-tackle-details');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">T - Tackle</div>
          <div className="text-sm text-gray-600">Interceptor tackled</div>
        </button>
        
        <button
          onClick={() => {
            setPassData(prev => ({ ...prev, globalResult: 'OUT_OF_BOUNDS' }));
            setCurrentStep('intercepted-out-of-bounds-details');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">O - Out of Bounds</div>
          <div className="text-sm text-gray-600">Interceptor went out of bounds</div>
        </button>
        
        <button
          onClick={() => {
            setPassData(prev => ({ ...prev, globalResult: 'FUMBLE' }));
            setCurrentStep('intercepted-fumble-details');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">F - Fumble</div>
          <div className="text-sm text-gray-600">Interceptor fumbled during return</div>
        </button>
        
        <button
          onClick={() => {
            setPassData(prev => ({ ...prev, globalResult: 'END_OF_PLAY' }));
            setCurrentStep('intercepted-end-of-play-details');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">. - End of Play</div>
          <div className="text-sm text-gray-600">Special circumstances</div>
        </button>
      </div>
      
      <button
        onClick={() => setCurrentStep('intercepted-details')}
        className="px-4 py-2 bg-gray-500 text-white rounded"
      >
        Back
      </button>
    </div>
  );

  const renderInterceptedTackleDetails = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Interception Return - Tackle Details</h3>
      
      <PlayerInput
        label="Primary Tackler"
        value={passData.tackler1}
        onChange={(player) => setPassData(prev => ({ ...prev, tackler1: player }))}
        error={errors.tackler1}
        gameState={gameState}
        required
      />
      
      <PlayerInput
        label="Assist Tackler (Optional)"
        value={passData.tackler2}
        onChange={(player) => setPassData(prev => ({ ...prev, tackler2: player }))}
        gameState={gameState}
      />
      
      <YardlineInput
        label="Final Yard Line (where tackled)"
        value={passData.finalYardLine}
        onChange={(yardLine) => setPassData(prev => ({ ...prev, finalYardLine: yardLine }))}
        error={errors.finalYardLine}
        gameState={gameState}
        required
      />
      
      <div className="flex space-x-2">
        <button
          onClick={handleSubmit}
          disabled={!passData.tackler1 || !passData.finalYardLine}
          className="px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-400"
        >
          Submit Play
        </button>
        <button
          onClick={() => setCurrentStep('intercepted-global-result')}
          className="px-4 py-2 bg-gray-500 text-white rounded"
        >
          Back
        </button>
      </div>
    </div>
  );

  const renderInterceptedOutOfBoundsDetails = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Interception Return - Out of Bounds Details</h3>
      
      <PlayerInput
        label="Tackler (Optional - if forced out)"
        value={passData.tackler1}
        onChange={(player) => setPassData(prev => ({ ...prev, tackler1: player }))}
        gameState={gameState}
      />
      
      <YardlineInput
        label="Final Yard Line (where went out of bounds)"
        value={passData.finalYardLine}
        onChange={(yardLine) => setPassData(prev => ({ ...prev, finalYardLine: yardLine }))}
        error={errors.finalYardLine}
        gameState={gameState}
        required
      />
      
      <div className="flex space-x-2">
        <button
          onClick={handleSubmit}
          disabled={!passData.finalYardLine}
          className="px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-400"
        >
          Submit Play
        </button>
        <button
          onClick={() => setCurrentStep('intercepted-global-result')}
          className="px-4 py-2 bg-gray-500 text-white rounded"
        >
          Back
        </button>
      </div>
    </div>
  );

  const renderInterceptedFumbleDetails = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Interception Return Fumble - Details</h3>
      
      <PlayerInput
        label="Forced By"
        value={passData.forcedBy}
        onChange={(player) => setPassData(prev => ({ ...prev, forcedBy: player }))}
        gameState={gameState}
      />
      
      <div className="space-y-2">
        <label className="block font-bold">Recovering Team</label>
        <div className="flex space-x-4">
          <button
            onClick={() => setPassData(prev => ({ ...prev, recoveringTeam: 'home' }))}
            className={`px-4 py-2 rounded ${passData.recoveringTeam === 'home' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            Home
          </button>
          <button
            onClick={() => setPassData(prev => ({ ...prev, recoveringTeam: 'visitor' }))}
            className={`px-4 py-2 rounded ${passData.recoveringTeam === 'visitor' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            Visitor
          </button>
        </div>
        {errors.recoveringTeam && <div className="text-red-500 text-sm">{errors.recoveringTeam}</div>}
      </div>
      
      <PlayerInput
        label="Recovering Player"
        value={passData.recoveringPlayer}
        onChange={(player) => setPassData(prev => ({ ...prev, recoveringPlayer: player }))}
        error={errors.recoveringPlayer}
        gameState={gameState}
        required
      />
      
      <YardlineInput
        label="Recovery Spot"
        value={passData.recoverySpot}
        onChange={(spot) => setPassData(prev => ({ ...prev, recoverySpot: spot }))}
        error={errors.recoverySpot}
        gameState={gameState}
        required
      />
      
      <div className="flex space-x-2">
        <button
          onClick={handleSubmit}
          disabled={!passData.recoveringTeam || !passData.recoveringPlayer || !passData.recoverySpot}
          className="px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-400"
        >
          Submit Play
        </button>
        <button
          onClick={() => setCurrentStep('intercepted-global-result')}
          className="px-4 py-2 bg-gray-500 text-white rounded"
        >
          Back
        </button>
      </div>
    </div>
  );

  const renderInterceptedEndOfPlayDetails = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Interception Return - End of Play</h3>
      
      <YardlineInput
        label="Final Yard Line"
        value={passData.finalYardLine}
        onChange={(yardLine) => setPassData(prev => ({ ...prev, finalYardLine: yardLine }))}
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
          disabled={!passData.finalYardLine}
          className="px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-400"
        >
          Submit Play
        </button>
        <button
          onClick={() => setCurrentStep('intercepted-global-result')}
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
      case 'quarterback':
        return renderQuarterbackStep();
      case 'receiver':
        return renderReceiverStep();
      case 'pass-result':
        return renderPassResultStep();
      case 'complete-global-result':
        return renderCompleteGlobalResultStep();
      case 'incomplete-details':
        return renderIncompleteDetails();
      case 'sack-details':
        return renderSackDetails();
      case 'intercepted-details':
        return renderInterceptedDetails();
      case 'intercepted-global-result':
        return renderInterceptedGlobalResult();
      case 'intercepted-tackle-details':
        return renderInterceptedTackleDetails();
      case 'intercepted-out-of-bounds-details':
        return renderInterceptedOutOfBoundsDetails();
      case 'intercepted-fumble-details':
        return renderInterceptedFumbleDetails();
      case 'intercepted-end-of-play-details':
        return renderInterceptedEndOfPlayDetails();
      case 'complete-tackle-details':
        return renderCompleteTackleDetails();
      case 'complete-out-of-bounds-details':
        return renderCompleteOutOfBoundsDetails();
      case 'fumble-details':
      case 'complete-fumble-details':
        return renderFumbleDetails();
      case 'complete-end-of-play-details':
        return renderCompleteEndOfPlayDetails();
      default:
        return renderQuarterbackStep();
    }
  };

  return (
    <div className="p-6 bg-white border border-gray-300 rounded-lg shadow-lg max-w-2xl">
      {/* Debug: Show penalty state */}
      <div className="mb-2 text-xs text-gray-500">
        Debug: penaltyQueued = {penaltyQueued ? 'true' : 'false'}
      </div>
      
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

export default PassInputFlow;

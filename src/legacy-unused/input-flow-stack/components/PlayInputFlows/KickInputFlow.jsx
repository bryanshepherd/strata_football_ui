// === COPILOT: FIX THE KICKOFF SUBMISSION ===
// Context:
// This is for football stat tracking. When a kickoff is entered, it should:
// - NOT assign a DriveResult
// - Start a new drive at the end of the return (e.g., V28)
// - Store key play data like end_yard_line, kick_to_yard_line, and tackler1
//
// Bugs to fix:
// 1. Variables entered in the modal (like tackler1, end_yard_line, kick_to_yard_line) are NOT being passed into the final JSON sent to submitEvent().
// 2. DriveResult is being set to "received", which is incorrect for a kickoff — it should be omitted.
// 3. Ensure the new drive starts correctly based on where the return ends.
//
// You must:
// - Trace where the state variables are stored
// - Confirm onChange bindings in the modal fields
// - Confirm they are included in the submit payload
// - Remove or guard the logic that adds DriveResult during kickoff

import React, { useState, useEffect, useRef } from 'react';
import debug from '../../utils/debug';
import { useGameState } from '../../contexts/FootballGameContext';
import PlayerInput from '../PlayerInput';
import YardlineInput from '../YardlineInput';
import PenaltyInputModal from '../PenaltyInputModal';

const KickInputFlow = ({ onComplete, onCancel, gameState }) => {
  const { submitEvent } = useGameState();
  
  // --- STATE MUST BE DECLARED BEFORE ANY REFERENCES ---
  const [kickData, setKickData] = React.useState({
    kicker: null,
    kickType: 'kickoff',
    kickResult: '',
    returner: null,
    globalResult: '',
    finalYardLine: '',        // <-- "Tackled at" writes here
    kickYardLine: '',         // <-- "Kicked to" writes here
    tackler1: null,
    tackler2: null,
    forcedBy: null,
    recoveringTeam: null,
    recoveringPlayer: null,
    recoverySpot: '',
    blockingPlayer: null,
    onsideRecoveringTeam: null,
    onsideRecoveringPlayer: null,
    onsideRecoverySpot: '',
    fairCatchPlayer: null,
    muffedPlayer: null
  });
  
  // DEV: freeze to surface illegal direct mutations
  if (import.meta.env?.DEV) {
    try { Object.freeze(kickData); } catch {}
  }
  
  // === DEBUG WRAPPER: log every setKickData write (who wrote, and diff) ===
  const setKickDataLogged = (updater) => {
    const prev = kickData;
    const next = typeof updater === 'function' ? updater(prev) : updater;
    // Only log when finalYardLine changes or when we're in penalty paths
    if (prev?.finalYardLine !== next?.finalYardLine) {
      debug.trace('[KICK WRITE] finalYardLine change', { prev: prev?.finalYardLine ?? '', next: next?.finalYardLine ?? '' });
    }
    return setKickData(next);
  };
  
  // Add source-of-truth ref to beat stale state
  const finalSpotRef = React.useRef('');
  useEffect(() => {
    finalSpotRef.current = kickData?.finalYardLine || '';
  }, [kickData?.finalYardLine]);
  
  // Watch the penalty flags
  useEffect(() => {
    debug.log('[PENALTY WATCH] penaltyQueued:', kickData?.penaltyQueued, 'hasAcceptedPenalty:', kickData?.hasAcceptedPenalty, 'finalYardLine:', kickData?.finalYardLine);
  }, [kickData?.penaltyQueued, kickData?.hasAcceptedPenalty]);
  
  // Track finalYardLine changes
  React.useEffect(() => {
    debug.log('[KICK STATE] kickData.finalYardLine changed:', kickData?.finalYardLine);
  }, [kickData?.finalYardLine]);
  
  // 1) Add tracer for finalYardLine changes
  const prevFinalRef = useRef(undefined);
  useEffect(() => {
    const curr = kickData?.finalYardLine;
    if (prevFinalRef.current !== curr) {
      debug.log('[TRACE] finalYardLine changed:', { prev: prevFinalRef.current, curr });
      // If it flipped from a value to empty string/null, dump a stack
      if ((prevFinalRef.current && prevFinalRef.current !== '') && (curr === '' || curr == null)) {
        debug.warn('⚠️ [TRACE] finalYardLine was CLEARED. Call stack follows:');
        // eslint-disable-next-line no-console
        debug.trace();
      }
      prevFinalRef.current = curr;
    }
  }, [kickData?.finalYardLine]);

  const [currentStep, setCurrentStep] = useState('kick-type'); // kick-type -> kicker -> kick-result -> result-details
  const [errors, setErrors] = useState({});
  const [penaltyQueued, setPenaltyQueued] = useState(false);

  // 2) Helper to log field writes and prevent undefined overwrites
  const setKickField = (key, value) => {
    debug.log('[KICK FIELD WRITE]', key, '=>', value);
    setKickDataLogged(prev => {
      // never clobber with undefined
      const safe = (value === undefined) ? prev?.[key] : value;
      return { ...prev, [key]: safe };
    });
  };
  const [showPenaltyModal, setShowPenaltyModal] = useState(false);
  const [lastKeyPressed, setLastKeyPressed] = useState('');
  const [keyPressTime, setKeyPressTime] = useState(null);

  // Refs for autofocus
  const firstButtonRef = useRef(null);

  // Autofocus first element when modal opens or step changes
  useEffect(() => {
    if (currentStep === 'kick-type' && firstButtonRef.current) {
      firstButtonRef.current.focus();
    }
  }, [currentStep]);

  // Handle keyboard shortcuts for kick types, results and penalty queuing (E)
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Track key presses for visual feedback
      setLastKeyPressed(e.key);
      setKeyPressTime(Date.now());
      
      // Handle Escape key for consistent modal closing
      if (e.key === 'Escape') {
        e.preventDefault();
        debug.log('Escape key pressed - closing modal and resetting state');
        // Reset play input state
        setKickDataLogged({
          kicker: null,
          kickType: null,
          kickResult: null,
          returner: null,
          globalResult: null,
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
          onsideRecoverySpot: '',
          fairCatchPlayer: null,
          muffedPlayer: null
        });
        setCurrentStep('kick-type');
        setErrors({});
        setPenaltyQueued(false);
        setShowPenaltyModal(false);
        onCancel(); // Close the modal
        return;
      }
      
      // Handle penalty queuing with 'E' key - ALWAYS toggle penalty, no matter what
      if (e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setPenaltyQueued(prev => !prev);
        return;
      }
      
      // Handle Enter key for navigation (NEXT/SUBMIT) - ALWAYS advance, no matter what
      if (e.key === 'Enter') {
        e.preventDefault();
        handleEnterKeyPress();
        return;
      }
      
      // Don't handle other keyboard shortcuts if user is typing in an input field
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
      }      if (currentStep === 'kick-type') {
        switch (e.key.toLowerCase()) {
          case 'o':
            e.preventDefault();
            e.stopPropagation();
            setKickDataLogged(prev => ({ ...prev, kickType: 'kickoff' }));
            setCurrentStep('kicker');
            break;
          case 'f':
            e.preventDefault();
            e.stopPropagation();
            setKickDataLogged(prev => ({ ...prev, kickType: 'field-goal' }));
            setCurrentStep('kicker');
            break;
          case 'u':
            e.preventDefault();
            e.stopPropagation();
            // Redirect to Punt flow - this should be handled by parent component
            onCancel(); // For now, cancel and let parent handle punt flow
            break;
        }
      }
      
      if (currentStep === 'field-goal-result') {
        switch (e.key.toLowerCase()) {
          case 'g':
            setKickField('kickResult', 'good');
            setCurrentStep('kick-good-details');
            break;
          case 'm':
            setKickField('kickResult', 'missed');
            setCurrentStep('kick-missed-details');
            break;
          case 'f':
            setKickField('kickResult', 'fumbled');
            setCurrentStep('kick-fumbled-details');
            break;
          case 'b':
            setKickField('kickResult', 'blocked');
            setCurrentStep('kick-blocked-details');
            break;
        }
      }
      
      if (currentStep === 'kickoff-result') {
        switch (e.key.toLowerCase()) {
          case 'r':
            setKickField('kickResult', 'returned');
            setCurrentStep('kickoff-returned-details');
            break;
          case 'd':
            setKickField('kickResult', 'downed');
            setCurrentStep('kickoff-downed-details');
            break;
          case 'c':
            setKickField('kickResult', 'fair-catch');
            setCurrentStep('kickoff-fair-catch-details');
            break;
          case 't':
            setKickField('kickResult', 'touchback');
            setCurrentStep('kickoff-touchback-details');
            break;
          case 'm':
            setKickField('kickResult', 'muffed');
            setCurrentStep('kickoff-muffed-details');
            break;
          case 'n':
            setKickField('kickResult', 'onside');
            setCurrentStep('kickoff-onside-details');
            break;
          case 'o':
            e.preventDefault();
            e.stopPropagation();
            setKickField('kickResult', 'out-of-bounds');
            setCurrentStep('kickoff-out-of-bounds-details');
            break;
        }
      }
      
      if (currentStep === 'kickoff-returned-global-result') {
        switch (e.key.toLowerCase()) {
          case 't':
            setKickField('globalResult', 'TACKLE');
            setCurrentStep('kickoff-returned-tackle-details');
            break;
          case 'o':
            e.preventDefault();
            e.stopPropagation();
            setKickField('globalResult', 'OUT_OF_BOUNDS');
            setCurrentStep('kickoff-returned-out-of-bounds-details');
            break;
          case 'f':
            setKickField('globalResult', 'FUMBLE');
            setCurrentStep('kickoff-returned-fumble-details');
            break;
          case '.':
            setKickField('globalResult', 'END_OF_PLAY');
            setCurrentStep('kickoff-returned-end-of-play-details');
            break;
        }
      }
      
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [currentStep, onCancel]);

  const handleEnterKeyPress = () => {
    switch (currentStep) {
      case 'kick-type':
        // Always advance to kicker selection
        setCurrentStep('kicker');
        break;
      case 'kicker':
        // Always advance - if no kick type selected, go back to kick-type, otherwise go to result
        if (!kickData.kickType) {
          setCurrentStep('kick-type');
        } else if (kickData.kickType === 'field-goal') {
          setCurrentStep('field-goal-result');
        } else if (kickData.kickType === 'kickoff') {
          setCurrentStep('kickoff-result');
        }
        break;
      case 'field-goal-result':
      case 'kickoff-result':
        // Always try to submit if we have result data
        handleKickSubmit();
        break;
      case 'kickoff-returned-details':
        // Always advance to global result
        setCurrentStep('kickoff-returned-global-result');
        break;
      case 'kickoff-returned-global-result':
        // Always try to submit
        handleKickSubmit();
        break;
      case 'kick-good-details':
        handleKickSubmit();
        break;
      case 'kick-missed-details':
        // Always submit
        handleKickSubmit();
        break;
      case 'kick-fumbled-details':
        // Always submit
        handleKickSubmit();
        break;
      case 'kick-blocked-details':
        // Always submit
        handleKickSubmit();
        break;
      case 'kickoff-downed-details':
        // Always submit
        handleKickSubmit();
        break;
      case 'kickoff-fair-catch-details':
        // Always submit
        handleKickSubmit();
        break;
      case 'kickoff-touchback-details':
        handleKickSubmit();
        break;
      case 'kickoff-muffed-details':
        // Always submit
        handleKickSubmit();
        break;
      case 'kickoff-onside-details':
        // Always submit
        handleKickSubmit();
        break;
      case 'kickoff-out-of-bounds-details':
        // Always submit
        handleKickSubmit();
        break;
      case 'kickoff-returned-tackle-details':
        // Always submit
        handleKickSubmit();
        break;
      case 'kickoff-returned-out-of-bounds-details':
        // Always submit
        handleKickSubmit();
        break;
      case 'kickoff-returned-fumble-details':
        // Always submit
        handleKickSubmit();
        break;
      case 'kickoff-returned-end-of-play-details':
        // Always submit
        handleKickSubmit();
        break;
      default:
        // For any other step, try to submit
        handleKickSubmit();
        break;
    }
  };

  const validateKickStep = (step) => {
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
        if (!kickData.kickYardLine) {
          newErrors.kickYardLine = 'Kick yard line is required';
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
    if (!validateKickStep(currentStep)) return;
    
    switch (currentStep) {
      case 'kicker':
        // After selecting kicker, go to appropriate result step based on kick type
        if (kickData.kickType === 'field-goal') {
          setCurrentStep('field-goal-result');
        } else if (kickData.kickType === 'kickoff') {
          setCurrentStep('kickoff-result');
        }
        break;
      case 'kick-type':
        // This step now goes to kicker selection
        setCurrentStep('kicker');
        break;
      case 'kickoff-returned-details':
        setCurrentStep('kickoff-returned-global-result');
        break;
      default:
        handleKickSubmit();
        break;
    }
  };

  const handleKickSubmit = async () => {
    // Note: Removed validation check to allow flexible submission
    // The API will handle any missing required fields
    
    const currentFinal = finalSpotRef.current?.trim();
    debug.log('[SUBMIT GUARD] kickoff return finalSpotRef.current =', currentFinal, ' | kickData.finalYardLine =', kickData?.finalYardLine);

    if (kickData.kickType === 'kickoff' && kickData.kickResult === 'returned') {
      if (!currentFinal) {
        console.error('❌ Missing finalYardLine for kickoff return — blocking submit');
        alert('Please enter the Tackled at yard line (e.g., V28).');
        return; // STOP: do not submit
      }
    }
    
    debug.log('🔥 KickInputFlow handleKickSubmit - RAW kickData NOW:', JSON.parse(JSON.stringify(kickData)));
    
    // Build play data structure compatible with API (per FLOW_VARIABLE_TO_SQL_MAPPING.md)
    const playData = {
      playType: 'kick',                               // Standard API field
      primaryPlayerID: kickData.kicker,            // kicker → primaryPlayerID
      sub_type: kickData.kickType,                   // kickType → sub_type  
      resultCode: kickData.kickResult,                   // kickResult → resultCode
      secondaryPlayerID: kickData.returner,        // returner → secondaryPlayerID
      has_fumble: kickData.miscFumble || false,     // miscFumble → has_fumble
      penaltyQueued: penaltyQueued,                 // Add penalty status to play data
      
      // Participant data (will be processed separately by API)
      tackler1: kickData.tackler1,
      tackler2: kickData.tackler2,
      forcedBy: kickData.forcedBy,
      
      // Fumble recovery data (calculated by API)
      recoveringTeam: kickData.recoveringTeam,
      recoveringPlayer: kickData.recoveringPlayer,
      recoverySpot: kickData.recoverySpot,
      
      // Special kick data
      blockingPlayer: kickData.blockingPlayer,
      onsideRecoveringTeam: kickData.onsideRecoveringTeam,
      onsideRecoveringPlayer: kickData.onsideRecoveringPlayer,
      onsideRecoverySpot: kickData.onsideRecoverySpot,
      fairCatchPlayer: kickData.fairCatchPlayer,
      muffedPlayer: kickData.muffedPlayer,
      
      // CRITICAL: Mark this as a kickoff to prevent DriveResult assignment
      is_kickoff: kickData.kickType === 'kickoff',
      
      // If you already include these elsewhere, keep only one copy (no duplicates):
      kicked_to_yard_line: kickData.kickYardLine || kickData.kickedToYardLine || ''
    };

    // Apply field mappings for API compatibility
    playData.endYardLine = currentFinal;    // For frontend consistency
    playData.end_yard_line = currentFinal; // MUST be the tackle spot
    playData.post_yard_line = currentFinal; // next snap at tackle spot

    debug.log('[KICK SUBMIT] playData before submitEvent:', {
      finalYardLine_state: kickData.finalYardLine,
      finalYardLine_ref: currentFinal,
      end_yard_line: playData.end_yard_line,
      post_yard_line: playData.post_yard_line
    });

    // Convert blank strings in numeric/player fields to null before submitting
    Object.keys(playData).forEach((key) => {
      if (
        ['primary_player_id', 'secondary_player_id', 'tackler1', 'tackler2', 'forcedBy', 'recoveringPlayer', 'onsideRecoveringPlayer', 'fairCatchPlayer', 'muffedPlayer', 'blockingPlayer'].includes(key) &&
        playData[key] === ''
      ) {
        playData[key] = null;
      }
    });

    try {
      // If penalty is queued, hold play data and start penalty flow
      if (penaltyQueued) {
        // Open penalty input modal with play data held in memory
        debug.log('Penalty queued - opening penalty input flow with play data:', playData);
        setShowPenaltyModal(true);
        return;
      }

      // Add a one-time debug right before calling submitEvent
      debug.log('[KICK SUBMIT] payload to submitEvent:', playData);

      // Normal play submission if no penalty queued
      await submitEvent(playData);
      onComplete(playData);
    } catch (error) {
      console.error('Error submitting kick play:', error);
      console.error('Error details:', error.message);
      console.error('Play data that failed:', playData);
      setErrors({ submit: 'Error submitting play. Please try again.' });
    }
  };

  const handlePenaltySubmit = async (penaltyData) => {
    try {
      debug.log('🔥 KickInputFlow handlePenaltySubmit - RAW kickData NOW:', JSON.parse(JSON.stringify(kickData)));
      
      // Submit play with penalty data
      const playData = {
        playType: 'kick',
        kicker: kickData.kicker,
        kickType: kickData.kickType,
        kickResult: kickData.kickResult,
        returner: kickData.returner,
        globalResult: kickData.globalResult,
        tackler1: kickData.tackler1,
        tackler2: kickData.tackler2,
        forcedBy: kickData.forcedBy,
        recoveringTeam: kickData.recoveringTeam,
        recoveringPlayer: kickData.recoveringPlayer,
        recoverySpot: kickData.recoverySpot,
        kickYardLine: kickData.kickYardLine,
        blockingPlayer: kickData.blockingPlayer,
        onsideRecoveringTeam: kickData.onsideRecoveringTeam,
        onsideRecoveringPlayer: kickData.onsideRecoveringPlayer,
        onsideRecoverySpot: kickData.onsideRecoverySpot,
        penalties: penaltyData.penalties,
        kicked_to_yard_line: kickData.kickYardLine || kickData.kickedToYardLine || '',
        is_kickoff: kickData.kickType === 'kickoff'
      };

      // HARD BLOCK if missing and map exactly (NO fallbacks)
      if (kickData.kickType === 'kickoff') {
        // HARD BLOCK if missing
        if (!kickData.finalYardLine) {
          debug.warn('[KICK SUBMIT] Missing finalYardLine; blocking submit.');
          alert('Please enter the "Tackled at" yard line (e.g., V28).');
          return;
        }

        // Map exactly to payload. NO fallbacks.
        playData.endYardLine = kickData.finalYardLine;     // For frontend consistency
        playData.end_yard_line  = kickData.finalYardLine;
        playData.post_yard_line = kickData.finalYardLine;

        debug.log('[KICK SUBMIT] playData before submitEvent:', {
          finalYardLine: kickData.finalYardLine,
          end_yard_line: playData.end_yard_line,
          post_yard_line: playData.post_yard_line
        });
      }

      debug.log('[KICK SUBMIT] payload to submitEvent (with penalties):', playData);

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
      <h3 className="text-lg font-bold">Kick Play - Select Kicker</h3>
      
      <PlayerInput
        label="Kicker"
        value={kickData.kicker}
        onChange={(player) => setKickDataLogged(prev => ({ ...prev, kicker: player }))}
        error={errors.kicker}
        gameId={gameState?.game_info?.game_id || 1000}
        team={gameState?.live_state?.possession}
        autoFocus={true}
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
      <h3 className="text-lg font-bold">Kick Play - Select Type</h3>
      
      <div className="text-sm text-gray-600 mb-4">
        Use keyboard shortcuts or click buttons:
      </div>
      
      <div className="grid grid-cols-1 gap-4">
        <button
          ref={firstButtonRef}
          onClick={() => {
            setKickDataLogged(prev => ({ ...prev, kickType: 'kickoff' }));
            setCurrentStep('kicker');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">O - Kickoff/Free Kick</div>
          <div className="text-sm text-gray-600">Kickoff to start half or after score</div>
        </button>
        
        <button
          onClick={() => {
            setKickDataLogged(prev => ({ ...prev, kickType: 'field-goal' }));
            setCurrentStep('kicker');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">F - Field Goal</div>
          <div className="text-sm text-gray-600">Attempt at field goal</div>
        </button>
        
        <button
          onClick={() => {
            // Redirect to Punt flow - for now just cancel and let parent handle
            onCancel();
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">U - Punt</div>
          <div className="text-sm text-gray-600">Redirect to established Punt Flow</div>
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
            setKickField('kickResult', 'good');
            setCurrentStep('kick-good-details');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">G - Good</div>
          <div className="text-sm text-gray-600">Field goal successful</div>
        </button>
        
        <button
          onClick={() => {
            setKickField('kickResult', 'missed');
            setCurrentStep('kick-missed-details');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">M - Missed</div>
          <div className="text-sm text-gray-600">Field goal missed</div>
        </button>
        
        <button
          onClick={() => {
            setKickField('kickResult', 'fumbled');
            setCurrentStep('kick-fumbled-details');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">F - Fumbled</div>
          <div className="text-sm text-gray-600">Field goal fumbled</div>
        </button>
        
        <button
          onClick={() => {
            setKickField('kickResult', 'blocked');
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



  const renderKickoffResultStep = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Kickoff - Select Result</h3>
      
      <div className="text-sm text-gray-600 mb-4">
        Use keyboard shortcuts or click buttons:
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => {
            setKickField('kickResult', 'returned');
            setCurrentStep('kickoff-returned-details');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">R - Returned</div>
          <div className="text-sm text-gray-600">Kickoff was returned</div>
        </button>
        
        <button
          onClick={() => {
            setKickField('kickResult', 'downed');
            setCurrentStep('kickoff-downed-details');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">D - Downed</div>
          <div className="text-sm text-gray-600">Kickoff was downed</div>
        </button>
        
        <button
          onClick={() => {
            setKickField('kickResult', 'fair-catch');
            setCurrentStep('kickoff-fair-catch-details');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">C - Fair Catch</div>
          <div className="text-sm text-gray-600">Fair catch made</div>
        </button>
        
        <button
          onClick={() => {
            setKickField('kickResult', 'touchback');
            setCurrentStep('kickoff-touchback-details');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">T - Touchback</div>
          <div className="text-sm text-gray-600">Kickoff into end zone</div>
        </button>
        
        <button
          onClick={() => {
            setKickField('kickResult', 'muffed');
            setCurrentStep('kickoff-muffed-details');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">M - Muffed</div>
          <div className="text-sm text-gray-600">Kickoff was muffed</div>
        </button>
        
        <button
          onClick={() => {
            setKickField('kickResult', 'onside');
            setCurrentStep('kickoff-onside-details');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">N - Onside</div>
          <div className="text-sm text-gray-600">Onside kick attempt</div>
        </button>
        
        <button
          onClick={() => {
            setKickDataLogged(prev => ({ ...prev, kickResult: 'out-of-bounds' }));
            setCurrentStep('kickoff-out-of-bounds-details');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">O - Out Of Bounds</div>
          <div className="text-sm text-gray-600">Kickoff went out of bounds</div>
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
      <h3 className="text-lg font-bold">Field Goal Good</h3>
      
      <div className="text-sm text-gray-600 mb-4">
        Field goal successful! 3 points scored.
      </div>
      
      <div className="flex space-x-2">
        <button
          onClick={handleKickSubmit}
          className="px-4 py-2 bg-green-600 text-white rounded"
        >
          Submit Play
        </button>
        <button
          onClick={() => setCurrentStep('field-goal-result')}
          className="px-4 py-2 bg-gray-500 text-white rounded"
        >
          Back
        </button>
      </div>
    </div>
  );

  const renderKickMissedDetails = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Field Goal Missed</h3>
      
      <div className="text-sm text-gray-600 mb-4">
        Field goal missed. No points scored.
      </div>
      
      <div className="flex space-x-2">
        <button
          onClick={handleKickSubmit}
          className="px-4 py-2 bg-green-600 text-white rounded"
        >
          Submit Play
        </button>
        <button
          onClick={() => setCurrentStep('field-goal-result')}
          className="px-4 py-2 bg-gray-500 text-white rounded"
        >
          Back
        </button>
      </div>
    </div>
  );

  const renderKickBlockedDetails = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Field Goal Blocked</h3>
      
      <PlayerInput
        label="Blocking Player"
        value={kickData.blockingPlayer}
        onChange={(player) => setKickDataLogged(prev => ({ ...prev, blockingPlayer: player }))}
        error={errors.blockingPlayer}
        gameId={gameState?.game_info?.game_id || 1000}
        team={gameState?.live_state?.possession === 'home' ? 'visitor' : 'home'}
        required
      />
      
      <div className="flex space-x-2">
        <button
          onClick={handleKickSubmit}
          disabled={!kickData.blockingPlayer}
          className="px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-400"
        >
          Submit Play
        </button>
        <button
          onClick={() => setCurrentStep('field-goal-result')}
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
        onChange={(player) => setKickDataLogged(prev => ({ ...prev, returner: player }))}
        error={errors.returner}
        gameId={gameState?.game_info?.game_id || 1000}
        team={(() => {
          const possession = gameState?.live_state?.possession;
          const receivingTeam = possession === 'home' ? 'visitor' : 'home';
          debug.log('KickInputFlow Returner - possession:', possession, 'receiving team:', receivingTeam);
          return receivingTeam;
        })()}
        required
      />
      
      <YardlineInput
        label="Kicked To Yard Line (where ball was kicked to)"
        value={kickData.kickYardLine}
        onChange={(yardLine) => setKickDataLogged(prev => ({ ...prev, kickYardLine: yardLine }))}
        error={errors.kickYardLine}
        gameState={gameState}
        required
      />
      
      <div className="flex space-x-2">
        <button
          onClick={handleNext}
          disabled={!kickData.returner || !kickData.kickYardLine}
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
            setKickField('globalResult', 'TACKLE');
            setCurrentStep('kickoff-returned-tackle-details');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">T - Tackle</div>
          <div className="text-sm text-gray-600">Returner tackled</div>
        </button>
        
        <button
          onClick={() => {
            setKickField('globalResult', 'OUT_OF_BOUNDS');
            setCurrentStep('kickoff-returned-out-of-bounds-details');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">O - Out of Bounds</div>
          <div className="text-sm text-gray-600">Returner went out of bounds</div>
        </button>
        
        <button
          onClick={() => {
            setKickField('globalResult', 'FUMBLE');
            setCurrentStep('kickoff-returned-fumble-details');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">F - Fumble</div>
          <div className="text-sm text-gray-600">Returner fumbled during return</div>
        </button>
        
        <button
          onClick={() => {
            setKickField('globalResult', 'END_OF_PLAY');
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
          onClick={handleKickSubmit}
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
        onChange={(yardLine) => setKickDataLogged(prev => ({ ...prev, kickYardLine: yardLine }))}
        error={errors.kickYardLine}
        gameState={gameState}
        required
      />
      
      <div className="text-sm text-gray-600">
        Penalty: Ball will be placed at the 40-yard line or where it went out of bounds, whichever is more favorable to the receiving team.
      </div>
      
      <div className="flex space-x-2">
        <button
          onClick={handleKickSubmit}
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
            onClick={() => setKickDataLogged(prev => ({ ...prev, onsideRecoveringTeam: 'kicking' }))}
            className={`px-4 py-2 rounded ${kickData.onsideRecoveringTeam === 'kicking' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            Kicking Team
          </button>
          <button
            onClick={() => setKickDataLogged(prev => ({ ...prev, onsideRecoveringTeam: 'receiving' }))}
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
        onChange={(player) => setKickDataLogged(prev => ({ ...prev, onsideRecoveringPlayer: player }))}
        error={errors.onsideRecoveringPlayer}
        gameState={gameState}
        required
      />
      
      <YardlineInput
        label="Recovery Spot"
        value={kickData.onsideRecoverySpot}
        onChange={(spot) => setKickDataLogged(prev => ({ ...prev, onsideRecoverySpot: spot }))}
        error={errors.onsideRecoverySpot}
        gameState={gameState}
        required
      />
      
      <div className="flex space-x-2">
        <button
          onClick={handleKickSubmit}
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
        onChange={(player) => setKickDataLogged(prev => ({ ...prev, tackler1: player }))}
        error={errors.tackler1}
        gameId={gameState?.game_info?.game_id || 1000}
        team={gameState?.live_state?.possession}
        required
      />
      
      <PlayerInput
        label="Assist Tackler (Optional)"
        value={kickData.tackler2}
        onChange={(player) => setKickDataLogged(prev => ({ ...prev, tackler2: player }))}
        gameId={gameState?.game_info?.game_id || 1000}
        team={gameState?.live_state?.possession}
      />
      
      <YardlineInput
        label="Tackled at"
        value={kickData.finalYardLine || ''}
        onChange={(value) => {
          debug.log('[KICK UI] onChange(Tackled at):', value);
          finalSpotRef.current = value;                 // <-- keep a synchronous source of truth
          setKickDataLogged(prev => ({ ...prev, finalYardLine: value }));
        }}
        error={errors.finalYardLine}
        gameState={gameState}
        required
      />
      
      <div className="flex space-x-2">
        <button
          onClick={handleKickSubmit}
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
        onChange={(player) => setKickDataLogged(prev => ({ ...prev, tackler1: player }))}
        gameState={gameState}
      />
      
      <YardlineInput
        label="Final Yard Line (where went out of bounds)"
        value={kickData.finalYardLine}
        onChange={(yardLine) => setKickDataLogged(prev => ({ ...prev, finalYardLine: yardLine }))}
        error={errors.finalYardLine}
        gameState={gameState}
        required
      />
      
      <div className="flex space-x-2">
        <button
          onClick={handleKickSubmit}
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
        onChange={(player) => setKickDataLogged(prev => ({ ...prev, forcedBy: player }))}
        gameState={gameState}
      />
      
      <div className="space-y-2">
        <label className="block font-bold">Recovering Team</label>
        <div className="flex space-x-4">
          <button
            onClick={() => setKickDataLogged(prev => ({ ...prev, recoveringTeam: 'home' }))}
            className={`px-4 py-2 rounded ${kickData.recoveringTeam === 'home' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            Home
          </button>
          <button
            onClick={() => setKickDataLogged(prev => ({ ...prev, recoveringTeam: 'visitor' }))}
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
        onChange={(player) => setKickDataLogged(prev => ({ ...prev, recoveringPlayer: player }))}
        error={errors.recoveringPlayer}
        gameState={gameState}
        required
      />
      
      <YardlineInput
        label="Recovery Spot"
        value={kickData.recoverySpot}
        onChange={(spot) => setKickDataLogged(prev => ({ ...prev, recoverySpot: spot }))}
        error={errors.recoverySpot}
        gameState={gameState}
        required
      />
      
      <div className="flex space-x-2">
        <button
          onClick={handleKickSubmit}
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
        onChange={(yardLine) => setKickDataLogged(prev => ({ ...prev, finalYardLine: yardLine }))}
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
          onClick={handleKickSubmit}
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

  const renderKickFumbledDetails = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Field Goal Fumbled</h3>
      
      <div className="text-sm text-gray-600 mb-4">
        Field goal attempt resulted in a fumble. This flows to Fumble Flow.
      </div>
      
      <div className="flex space-x-2">
        <button
          onClick={handleKickSubmit}
          className="px-4 py-2 bg-green-600 text-white rounded"
        >
          Continue to Fumble Flow
        </button>
        <button
          onClick={() => setCurrentStep('field-goal-result')}
          className="px-4 py-2 bg-gray-500 text-white rounded"
        >
          Back
        </button>
      </div>
    </div>
  );

  const renderKickoffDownedDetails = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Kickoff Downed</h3>
      
      <YardlineInput
        label="Kicked To Yard Line (where downed)"
        value={kickData.kickYardLine}
        onChange={(yardLine) => setKickDataLogged(prev => ({ ...prev, kickYardLine: yardLine, finalYardLine: yardLine }))}
        error={errors.kickYardLine}
        gameState={gameState}
        required
      />
      
      <div className="text-sm text-gray-600">
        Auto submit with Kicked To Yard Line set as end of play yard line.
        NCAA rules: If within KOTouchbackYardline (usually 25), drive starts at KOTouchbackYardline.
      </div>
      
      <div className="flex space-x-2">
        <button
          onClick={handleKickSubmit}
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

  const renderKickoffFairCatchDetails = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Kickoff Fair Catch</h3>
      
      <PlayerInput
        label="Player No. (who fair caught)"
        value={kickData.fairCatchPlayer}
        onChange={(player) => setKickDataLogged(prev => ({ ...prev, fairCatchPlayer: player }))}
        error={errors.fairCatchPlayer}
        gameState={gameState}
        required
      />
      
      <YardlineInput
        label="Kicked To Yard Line (where fair caught)"
        value={kickData.kickYardLine}
        onChange={(yardLine) => setKickDataLogged(prev => ({ ...prev, kickYardLine: yardLine, finalYardLine: yardLine }))}
        error={errors.kickYardLine}
        gameState={gameState}
        required
      />
      
      <div className="text-sm text-gray-600">
        Kicked to Yard Line set as end of play yard line.
        NCAA rules: If within KOTouchbackYardline (usually 25), drive starts at KOTouchbackYardline.
      </div>
      
      <div className="flex space-x-2">
        <button
          onClick={handleKickSubmit}
          disabled={!kickData.fairCatchPlayer || !kickData.kickYardLine}
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

  const renderKickoffMuffedDetails = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Kickoff Muffed</h3>
      
      <PlayerInput
        label="Player No. (who muffed)"
        value={kickData.muffedPlayer}
        onChange={(player) => setKickDataLogged(prev => ({ ...prev, muffedPlayer: player }))}
        error={errors.muffedPlayer}
        gameState={gameState}
        required
      />
      
      <div className="text-sm text-gray-600 mb-4">
        Kickoff was muffed. This flows to Fumble Flow.
      </div>
      
      <div className="flex space-x-2">
        <button
          onClick={handleKickSubmit}
          disabled={!kickData.muffedPlayer}
          className="px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-400"
        >
          Continue to Fumble Flow
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

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'kicker':
        return renderKickerStep();
      case 'kick-type':
        return renderKickTypeStep();
      case 'field-goal-result':
        return renderFieldGoalResultStep();
      case 'kickoff-result':
        return renderKickoffResultStep();
      case 'kick-good-details':
        return renderKickGoodDetails();
      case 'kick-missed-details':
        return renderKickMissedDetails();
      case 'kick-fumbled-details':
        return renderKickFumbledDetails();
      case 'kick-blocked-details':
        return renderKickBlockedDetails();
      case 'kickoff-returned-details':
        return renderKickoffReturnedDetails();
      case 'kickoff-returned-global-result':
        return renderKickoffReturnedGlobalResultStep();
      case 'kickoff-downed-details':
        return renderKickoffDownedDetails();
      case 'kickoff-fair-catch-details':
        return renderKickoffFairCatchDetails();
      case 'kickoff-touchback-details':
        return renderKickoffTouchbackDetails();
      case 'kickoff-muffed-details':
        return renderKickoffMuffedDetails();
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
      {/* Enhanced Debug/Status Indicator */}
      <div className="mb-2 p-3 bg-gray-50 border rounded text-xs">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <strong>Step:</strong> {currentStep}
          </div>
          <div>
            <strong>Penalty:</strong> {penaltyQueued ? '🚨 QUEUED' : '✅ None'}
          </div>
          <div>
            <strong>Kicker:</strong> {kickData.kicker ? JSON.stringify(kickData.kicker) : 'null'}
          </div>
          <div>
            <strong>Kick Type:</strong> {kickData.kickType || 'null'}
          </div>
          {lastKeyPressed && keyPressTime && (Date.now() - keyPressTime < 3000) && (
            <div className="col-span-2 text-blue-600 font-bold">
              <strong>Last Key:</strong> {lastKeyPressed.toUpperCase()} 
              <span className="text-gray-500 ml-2">
                ({Math.round((Date.now() - keyPressTime) / 100) / 10}s ago)
              </span>
            </div>
          )}
        </div>
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

export default KickInputFlow;

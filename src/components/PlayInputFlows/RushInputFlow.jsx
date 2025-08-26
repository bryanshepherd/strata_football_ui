import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useGameState } from '../../contexts/FootballGameContext';
import usePlayerLookup from '../../hooks/usePlayerLookup';
import { offenseKey, defenseKey } from '../../utils/teamSide';
import JerseyNumberInput from '../JerseyNumberInput';
import PlayerDisambiguationModal from '../PlayerDisambiguationModal';
import YardlineInput from '../YardlineInput';
import PenaltyInputModal from '../PenaltyInputModal';
import PlayerInput from '../PlayerInput';
import { usePlayInputFlow, PenaltyQueuedIndicator } from '../../hooks/usePlayInputFlow.jsx';
import DownDistanceCalculator from '../../utils/DownDistanceCalculator';
import debug from '../../utils/debug';

const RushInputFlow = ({ onComplete, onCancel, gameState }) => {
  const { submitEvent } = useGameState();
  const { findByJersey, pickBestCandidate } = usePlayerLookup(gameState);
  
  debug.log('[RUSHFLOW] Component mounting/re-rendering');
  
  // Use shared play input flow hook
  const {
    currentStep,
    setCurrentStep: originalSetCurrentStep,
    errors,
    setErrors,
    penaltyQueued,
    setPenaltyQueued,
    showPenaltyModal,
    setShowPenaltyModal,
    setupKeyboardHandler,
    handleSubmit,
    handlePenaltySubmit,
    debugLog,
    getKeyFeedbackClass
  } = usePlayInputFlow({
    initialStep: 'rusher',
    onComplete,
    onCancel,
    gameState,
    submitEvent,
    playType: 'rush'
  });
  
  // Wrap setCurrentStep to add logging and modal cleanup
  const setCurrentStep = (newStep) => {
    debug.log(`[RUSHFLOW] Changing step from '${currentStep}' to '${newStep}'`);
    debug.trace(); // This will show us the call stack
    
    // Always close all modals when changing steps
    setShowDisambiguate(false);
    setShowTackler1Disambiguate(false);
    setShowTackler2Disambiguate(false);
    
    originalSetCurrentStep(newStep);
  };
  
  // Possession-aware team calculation - check multiple possible locations
  const possession = gameState?.live_state?.possession || 
                    gameState?.possession || 
                    (gameState?.gameState?.possession === 'H' ? 'home' : 
                     gameState?.gameState?.possession === 'V' ? 'visitor' : 'home');
  const offense = offenseKey(possession);   // 'home' | 'visitor'
  const defense = defenseKey(possession);
  const offenseName = offense === 'home' 
    ? (gameState?.game_info?.home_team_short || 'HOME') 
    : (gameState?.game_info?.visitor_team_short || 'VIS');
  const defenseName = defense === 'home'
    ? (gameState?.game_info?.home_team_short || 'HOME')
    : (gameState?.game_info?.visitor_team_short || 'VIS');

  // debug.debug('[RushInputFlow] Possession Debug:', { 
  //   possession, offense, defense, offenseName, defenseName,
  //   currentStep, rostersAvailable: !!gameState?.rosters,
  //   homeRosterCount: gameState?.rosters?.home?.length || 0,
  //   visitorRosterCount: gameState?.rosters?.visitor?.length || 0
  // });
  
  const gameId = gameState?.game_info?.game_id || 1000;
  
  const [rushData, setRushData] = useState({
    rusher: null,
    miscFumble: false,
    globalResult: null,
    tackler1: null,
    tackler2: null,
    finalYardLine: '',
    forcedBy: null,
    recoveringTeam: null,
    recoveringPlayer: null,
    recoverySpot: ''
  });

  // Jersey lookup state - new clean variables
  const [rusherJersey, setRusherJersey] = useState('');
  const [rusherCandidate, setRusherCandidate] = useState(null);
  const [rusherMatches, setRusherMatches] = useState([]);
  const [showDisambiguate, setShowDisambiguate] = useState(false);
  
  // Tackler state
  const [tackler1Jersey, setTackler1Jersey] = useState('');
  const [tackler2Jersey, setTackler2Jersey] = useState('');
  const [tackler1Candidate, setTackler1Candidate] = useState(null);
  const [tackler2Candidate, setTackler2Candidate] = useState(null);
  const [tackler1Matches, setTackler1Matches] = useState([]);
  const [tackler2Matches, setTackler2Matches] = useState([]);
  const [showTackler1Disambiguate, setShowTackler1Disambiguate] = useState(false);
  const [showTackler2Disambiguate, setShowTackler2Disambiguate] = useState(false);
  const [modalJustClosed, setModalJustClosed] = useState(false);


  // Central "can proceed" guards
  const canProceedSelectRusher = !!rusherCandidate?.player_id;

  // Handle rusher lookup
  const handleRusherLookup = () => {
    if (!rusherJersey.trim()) {
      setErrors({ jersey: 'Enter a jersey number.' });
      return;
    }
    
    setErrors({});
    const matches = findByJersey(offense, rusherJersey);
    
    if (matches.length === 0) {
      // Create synthetic unknown player
      const unknown = { 
        player_id: `unknown-${offense}-${rusherJersey}`, 
        jersey: rusherJersey, 
        name: 'UNKNOWN PLAYER', 
        pos: 'RB' 
      };
      setRusherMatches([unknown]);
      setRusherCandidate(unknown);
      setCurrentStep('global-result');
      return;
    }
    
    if (matches.length === 1) {
      debug.debug('[RushInputFlow] Single match found:', matches[0]);
      setRusherCandidate(matches[0]);
      setCurrentStep('global-result');
      return;
    }
    
    // Multiple matches
    setRusherMatches(matches);
    setShowDisambiguate(true);
  };

  // Disambiguation handlers
  const handleDisambigConfirm = (player) => {
    debug.log('[RUSHFLOW] handleDisambigConfirm called, current step:', currentStep);
    if (currentStep !== 'rusher') {
      console.error('[RUSHFLOW] ERROR: Rusher disambiguation modal is open but we are not in rusher step!');
      setShowDisambiguate(false);
      return;
    }
    setRusherCandidate(player);
    setShowDisambiguate(false);
    setModalJustClosed(true);
    setTimeout(() => setModalJustClosed(false), 100); // Clear flag after 100ms
    setCurrentStep('global-result');
  };

  const handleDisambigCancel = () => {
    setShowDisambiguate(false);
  };

  // Tackler lookup functions
  const handleTackler1Lookup = () => {
    if (!tackler1Jersey.trim()) return;
    
    // If we already have a candidate with matching jersey, don't lookup again
    if (tackler1Candidate && 
        (tackler1Candidate.jersey_number == tackler1Jersey || 
         tackler1Candidate.jersey == tackler1Jersey)) {
      debug.log('[RUSH] Tackler1 already selected with matching jersey, skipping lookup');
      return;
    }
    
    const matches = findByJersey(defense, tackler1Jersey);
    
    if (matches.length === 0) {
      const unknown = { 
        player_id: `unknown-${defense}-${tackler1Jersey}`, 
        jersey: tackler1Jersey, 
        name: 'UNKNOWN PLAYER', 
        pos: 'LB' 
      };
      setTackler1Candidate(unknown);
      return;
    }
    
    if (matches.length === 1) {
      setTackler1Candidate(matches[0]);
      return;
    }
    
    setTackler1Matches(matches);
    setShowTackler1Disambiguate(true);
  };

  const handleTackler2Lookup = () => {
    if (!tackler2Jersey.trim()) return;
    
    // If we already have a candidate with matching jersey, don't lookup again
    if (tackler2Candidate && 
        (tackler2Candidate.jersey_number == tackler2Jersey || 
         tackler2Candidate.jersey == tackler2Jersey)) {
      debug.log('[RUSH] Tackler2 already selected with matching jersey, skipping lookup');
      return;
    }
    
    const matches = findByJersey(defense, tackler2Jersey);
    
    if (matches.length === 0) {
      const unknown = { 
        player_id: `unknown-${defense}-${tackler2Jersey}`, 
        jersey: tackler2Jersey, 
        name: 'UNKNOWN PLAYER', 
        pos: 'LB' 
      };
      setTackler2Candidate(unknown);
      return;
    }
    
    if (matches.length === 1) {
      setTackler2Candidate(matches[0]);
      return;
    }
    
    setTackler2Matches(matches);
    setShowTackler2Disambiguate(true);
  };

  const handleTackler1Confirm = (player) => {
    setTackler1Candidate(player);
    setShowTackler1Disambiguate(false);
    setModalJustClosed(true);
    setTimeout(() => setModalJustClosed(false), 100); // Clear flag after 100ms
  };

  const handleTackler2Confirm = (player) => {
    setTackler2Candidate(player);
    setShowTackler2Disambiguate(false);
    setModalJustClosed(true);
    setTimeout(() => setModalJustClosed(false), 100); // Clear flag after 100ms
  };

  // Clear player selection if jersey changes
  useEffect(() => {
    if (currentStep === 'rusher' && rusherCandidate) {
      setRusherCandidate(null);
      setRushData(prev => ({ ...prev, rusher: null }));
    }
  }, [rusherJersey]);

  // Reset component state when possession changes to avoid stale team assignments
  useEffect(() => {
    // debug.debug('[RushInputFlow] Possession changed, resetting state:', possession);
    setRushData({
      rusher: null,
      miscFumble: false,
      globalResult: null,
      tackler1: null,
      tackler2: null,
      finalYardLine: '',
      forcedBy: null,
      recoveringTeam: null,
      recoveringPlayer: null,
      recoverySpot: ''
    });
    setRusherCandidate(null);
    setRusherJersey('');
    setTackler1Jersey('');
    setTackler2Jersey('');
    setTackler1Candidate(null);
    setTackler2Candidate(null);
    setTackler1Matches([]);
    setTackler2Matches([]);
    setShowTackler1Disambiguate(false);
    setShowTackler2Disambiguate(false);
    setErrors({});
    if (currentStep !== 'rusher') {
      setCurrentStep('rusher');
    }
  }, [possession]);

  // Setup keyboard handler with custom logic
  setupKeyboardHandler({
    handleEnterKeyPress: () => {
      // Don't handle Enter if any modal is open
      if (showDisambiguate || showTackler1Disambiguate || showTackler2Disambiguate) {
        debugLog('Enter key pressed but modal is open, ignoring');
        return;
      }
      
      // Don't handle Enter immediately after modal closes to prevent bleed-through
      if (modalJustClosed) {
        debugLog('Enter key pressed but modal just closed, ignoring');
        return;
      }
      
      debugLog('Enter key pressed', { currentStep });
      switch (currentStep) {
        case 'rusher':
          if (canProceedSelectRusher) {
            setCurrentStep('global-result');
          } else {
            // Try to look up the jersey if not already selected
            if (rusherJersey.trim()) {
              handleRusherLookup();
            } else {
              debug.warn('[RUSH] Enter pressed but no jersey entered.');
            }
          }
          break;
        case 'global-result':
          // Result selection handled by keyboard shortcuts or buttons
          // Don't do anything on Enter in this step
          break;
        case 'tackle-details':
          debug.log('[RUSH] Enter in tackle-details, checking conditions:', {
            tackler1Jersey,
            finalYardLine: rushData.finalYardLine,
            rushData: rushData,
            canSubmit: !!(tackler1Jersey && rushData.finalYardLine)
          });
          if (tackler1Jersey && rushData.finalYardLine) {
            debug.log('[RUSH] Conditions met, calling handleRushSubmit()');
            handleRushSubmit();
          } else {
            debug.warn('[RUSH] Enter pressed but tackle details incomplete:', {
              tackler1Jersey,
              finalYardLine: rushData.finalYardLine,
              rushDataKeys: Object.keys(rushData),
              fullRushData: rushData
            });
          }
          break;
        case 'out-of-bounds-details':
          if (rushData.finalYardLine) {
            handleRushSubmit();
          }
          break;
        case 'fumble-details':
          if (rushData.recoveringTeam && rushData.recoveringPlayer && rushData.recoverySpot) {
            handleRushSubmit();
          }
          break;
        case 'end-of-play-details':
          if (rushData.finalYardLine) {
            handleRushSubmit();
          }
          break;
        default:
          break;
      }
    },
    handleCustomKeys: (event) => {
      if (currentStep === 'global-result') {
        switch (event.key.toLowerCase()) {
          case 't':
            event.preventDefault();
            event.stopPropagation();
            debugLog('T key pressed - selecting tackle');
            // Close any open modals before transitioning
            setShowDisambiguate(false);
            setShowTackler1Disambiguate(false);
            setShowTackler2Disambiguate(false);
            setRushData(prev => ({ ...prev, globalResult: 'TACKLE' }));
            setCurrentStep('tackle-details');
            break;
          case 'o':
            event.preventDefault();
            event.stopPropagation();
            debugLog('O key pressed - selecting out-of-bounds');
            setRushData(prev => ({ ...prev, globalResult: 'OUT_OF_BOUNDS' }));
            setCurrentStep('out-of-bounds-details');
            break;
          case 'f':
            event.preventDefault();
            event.stopPropagation();
            debugLog('F key pressed - selecting fumble');
            setRushData(prev => ({ ...prev, globalResult: 'FUMBLE' }));
            setCurrentStep('fumble-details');
            break;
          case '.':
            event.preventDefault();
            event.stopPropagation();
            debugLog('. key pressed - selecting end-of-play');
            setRushData(prev => ({ ...prev, globalResult: 'END_OF_PLAY' }));
            setCurrentStep('end-of-play-details');
            break;
        }
      }
    }
  });


  const validateRushStep = (step) => {
    debug.log('[RushInputFlow] validateRushStep called', { 
      step, 
      rushData,
      tackler1Jersey,
      tackler2Jersey 
    });
    
    const newErrors = {};
    
    switch (step) {
      case 'rusher':
        if (!rusherCandidate?.player_id) {
          newErrors.rusher = 'Rusher selection is required';
        }
        break;
      case 'global-result':
        if (!rushData.globalResult) {
          newErrors.globalResult = 'Result selection is required';
        }
        break;
      case 'tackle-details':
        if (!tackler1Jersey) {
          newErrors.tackler1 = 'Primary tackler is required';
        }
        if (!rushData.finalYardLine) {
          newErrors.finalYardLine = 'Final yard line is required';
        }
        break;
      case 'out-of-bounds-details':
        if (!rushData.finalYardLine) {
          newErrors.finalYardLine = 'Final yard line is required';
        }
        break;
      case 'fumble-details':
        if (!rushData.recoveringTeam) {
          newErrors.recoveringTeam = 'Recovering team is required';
        }
        if (!rushData.recoveringPlayer) {
          newErrors.recoveringPlayer = 'Recovering player is required';
        }
        if (!rushData.recoverySpot) {
          newErrors.recoverySpot = 'Recovery spot is required';
        }
        break;
      case 'end-of-play-details':
        if (!rushData.finalYardLine) {
          newErrors.finalYardLine = 'Final yard line is required';
        }
        break;
    }
    
    debug.log('[RushInputFlow] validation errors:', newErrors);
    setErrors(newErrors);
    const isValid = Object.keys(newErrors).length === 0;
    debug.log('[RushInputFlow] validation result:', isValid);
    return isValid;
  };

  const handleNext = () => {
    if (!validateRushStep(currentStep)) return;
    
    switch (currentStep) {
      case 'rusher':
        setCurrentStep('global-result');
        break;
      case 'global-result':
        // This is handled by keyboard shortcuts or button clicks
        break;
      default:
        handleRushSubmit();
        break;
    }
  };

  const handleRushSubmit = async () => {
    debug.log('[RushInputFlow] handleRushSubmit called', { 
      currentStep, 
      rusherCandidate, 
      tackler1Jersey, 
      tackler2Jersey,
      finalYardLine: rushData.finalYardLine,
      rushData 
    });
    
    const validationResult = validateRushStep(currentStep);
    debug.log('[RushInputFlow] validation result:', validationResult);
    
    if (!validationResult) {
      debug.warn('[RushInputFlow] Validation failed, not submitting');
      return;
    }
    
    // Handle synthetic unknown player
    const playerId = rusherCandidate?.player_id;
    const isUnknownPlayer = typeof playerId === 'string' && playerId.startsWith('unknown-');
    
    if (isUnknownPlayer) {
      debug.warn('[RushInputFlow] Submitting with synthetic UNKNOWN PLAYER:', rusherCandidate);
    }
    
    // Calculate post-play down and distance using PRE-PLAY game state
    // CRITICAL: Use the game state as it exists BEFORE this play, not after
    const currentGameStateForCalc = {
      YardLinePosition: gameState?.live_state?.yard_line_position || gameState?.live_state?.yard_line || 'V28',  // PRE-PLAY position
      CurrentDown: gameState?.live_state?.current_down || gameState?.live_state?.down || 1,              // PRE-PLAY down
      YardsToGo: gameState?.live_state?.yards_to_go || gameState?.live_state?.distance || 10,            // PRE-PLAY distance
      LineToGain: null, // Calculate from pre-play state, don't use post-play value
      Possession: gameState?.live_state?.possession === 'visitor' ? 'V' : 'H'
    };
    
    // Calculate the correct PRE-PLAY LineToGain from pre-play position and distance
    const prePlayPosition = currentGameStateForCalc.YardLinePosition;
    const prePlayDistance = currentGameStateForCalc.YardsToGo;
    const possession = currentGameStateForCalc.Possession;
    
    // LineToGain calculation for the team with possession
    // For V possession at V28 with 10 yards to go: V28 → V18 (10 yards closer to opponent goal)
    // But relative positioning counts UP toward opponent goal, so we ADD the distance
    const currentRelative = DownDistanceCalculator.toPossessionRelative(prePlayPosition, possession);
    const lineToGainRelative = currentRelative + prePlayDistance;
    currentGameStateForCalc.LineToGain = DownDistanceCalculator.relativeToFieldPosition(lineToGainRelative, possession);
    
    debug.log('[RUSH CALC DEBUG] Calculated PRE-PLAY LineToGain:', {
      prePlayPosition,
      prePlayDistance, 
      currentRelative,
      lineToGainRelative,
      calculatedLineToGain: currentGameStateForCalc.LineToGain
    });
    
    debug.log('[RUSH CALC DEBUG] Raw gameState.live_state data:', {
      yard_line_position: gameState?.live_state?.yard_line_position,
      yard_line: gameState?.live_state?.yard_line,
      current_down: gameState?.live_state?.current_down,
      down: gameState?.live_state?.down,
      yards_to_go: gameState?.live_state?.yards_to_go,
      distance: gameState?.live_state?.distance,
      possession: gameState?.live_state?.possession
    });
    
    debug.log('[RUSH CALC DEBUG] Using PRE-PLAY state for calculation:', {
      YardLinePosition: currentGameStateForCalc.YardLinePosition,
      CurrentDown: currentGameStateForCalc.CurrentDown,
      YardsToGo: currentGameStateForCalc.YardsToGo,
      LineToGain: currentGameStateForCalc.LineToGain,
      endPosition: rushData.finalYardLine,
      possession: currentGameStateForCalc.Possession
    });
    
    const playDataForCalc = {
      startPosition: currentGameStateForCalc.YardLinePosition,
      endPosition: rushData.finalYardLine,
      possession: currentGameStateForCalc.Possession,
      isFirstDown: rushData.globalResult === 'first_down' || rushData.globalResult === 'touchdown',
      isTouchdown: rushData.globalResult === 'touchdown',
      isTurnover: false,
      isSafety: false,
      is_kickoff: false,
      play_type: 'rush'
    };
    
    const postPlayState = DownDistanceCalculator.calculatePostPlayState(playDataForCalc, currentGameStateForCalc);
    
    debug.log('[RUSH SUBMIT] Post-play calculation:', {
      currentState: currentGameStateForCalc,
      playData: playDataForCalc,
      postPlayState
    });

    // Build play data structure - using API contract field names
    const playData = {
      // Standard API fields
      playType: 'rush',
      primaryPlayerID: isUnknownPlayer ? null : playerId,
      resultCode: rushData.globalResult,
      endYardLine: rushData.finalYardLine,
      post_yard_line: rushData.finalYardLine, // Backend expects PostYardLinePosition
      
      // Post-play state for backend game_state updates
      post_down: postPlayState.postDown,
      post_distance: postPlayState.postDistance,
      
      // Additional fields
      has_fumble: rushData.miscFumble || false,
      penaltyQueued: penaltyQueued,
      
      // For unknown players, include jersey and name
      ...(isUnknownPlayer && {
        jersey: rusherCandidate.jersey,
        name: rusherCandidate.name
      }),
      
      // Tackler jerseys (will be resolved server-side)
      tackler1_jersey: tackler1Jersey,
      tackler2_jersey: tackler2Jersey,
      
      // Tackler player IDs if we have them
      tackler1_id: tackler1Candidate?.player_id || null,
      tackler2_id: tackler2Candidate?.player_id || null,
      
      // Legacy participant data
      tackler1: tackler1Candidate || rushData.tackler1,
      tackler2: tackler2Candidate || rushData.tackler2,
      forcedBy: rushData.forcedBy,
      recoveringTeam: rushData.recoveringTeam,
      recoveringPlayer: rushData.recoveringPlayer,
      recoverySpot: rushData.recoverySpot
    };

    try {
      debug.log('[RUSH SUBMIT] Full play data being sent:', JSON.stringify(playData, null, 2));
      debugLog('Submitting rush play', { playData, penaltyQueued });
      
      // Use shared submit handling
      const result = await handleSubmit(playData);
      debug.log('[RUSH SUBMIT] Submission result:', result);
    } catch (error) {
      console.error('[RUSH SUBMIT] Error details:', error);
      debugLog('Error submitting rush play', { error: error.message });
      setErrors({ submit: 'Error submitting play. Please try again.' });
    }
  };

  const handleRushPenaltySubmit = async (penaltyData) => {
    const playData = {
      playType: 'rush',
      primaryPlayerID: rusherCandidate?.player_id ?? null,
      has_fumble: rushData.miscFumble,
      resultCode: rushData.globalResult,
      endYardLine: rushData.finalYardLine,
      tackler1_jersey: tackler1Jersey,
      tackler2_jersey: tackler2Jersey,
      tackler1_id: tackler1Candidate?.player_id || null,
      tackler2_id: tackler2Candidate?.player_id || null,
      tackler1: tackler1Candidate || rushData.tackler1,
      tackler2: tackler2Candidate || rushData.tackler2,
      forcedBy: rushData.forcedBy,
      recoveringTeam: rushData.recoveringTeam,
      recoveringPlayer: rushData.recoveringPlayer,
      recoverySpot: rushData.recoverySpot
    };

    return await handlePenaltySubmit(penaltyData, playData);
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

  const handleRusherEnter = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (canProceedSelectRusher) {
        setCurrentStep('global-result');
      } else {
        // Optional: auto-select the first exact jersey match when user typed a number
        debug.warn('[RUSH] Enter pressed but rusher not selected.');
      }
    }
  };

  const handleNextFromRusher = () => {
    if (canProceedSelectRusher) {
      setCurrentStep('global-result');
    }
  };

  const renderRusherStep = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Rush Play - Select Rusher</h3>
      
      <JerseyNumberInput
        label={`Rusher Jersey # (${offenseName.toLowerCase()} team)`}
        value={rusherJersey}
        onChange={setRusherJersey}
        onEnter={handleRusherLookup}
        autoFocus
      />

      <button
        type="button"
        className="btn-primary px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        onClick={handleRusherLookup}
        disabled={!String(rusherJersey).trim()}
      >
        Next
      </button>

      {rusherCandidate && (
        <div className="p-2 bg-green-50 border border-green-200 rounded">
          <div className="font-medium text-green-800">
            Selected: {rusherCandidate.full_name || rusherCandidate.name} #{rusherCandidate.jersey_number || rusherCandidate.jersey}
          </div>
          <div className="text-sm text-green-600">
            {rusherCandidate.off_position || rusherCandidate.def_position || rusherCandidate.st_position || rusherCandidate.pos || rusherCandidate.position} {rusherCandidate.side ? `• ${rusherCandidate.side}` : ''}
          </div>
        </div>
      )}

      {errors.jersey && (
        <div className="p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {errors.jersey}
        </div>
      )}
      
      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="miscFumble"
          checked={rushData.miscFumble}
          onChange={(e) => setRushData(prev => ({ ...prev, miscFumble: e.target.checked }))}
          className="h-4 w-4"
        />
        <label htmlFor="miscFumble" className="text-sm">
          Misc Fumble (fumbled snap recovered by offense - affects fumble stat only)
        </label>
      </div>
      
      <div className="flex space-x-2">
        <button
          onClick={() => {
            if (rusherCandidate) {
              setCurrentStep('global-result');
            } else {
              handleRusherLookup();
            }
          }}
          disabled={!rusherJersey.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-400"
        >
          {rusherCandidate ? 'Next' : 'Look Up Player'}
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

  const renderGlobalResultStep = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">
        Enter result for rush by #{rusherJersey} — {rusherCandidate?.full_name || rusherCandidate?.name || 'Player'}
      </h3>
      
      <div className="text-sm text-gray-600 mb-4">
        Use keyboard shortcuts or click buttons:
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => {
            setRushData(prev => ({ ...prev, globalResult: 'TACKLE' }));
            setCurrentStep('tackle-details');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">T - Tackle</div>
          <div className="text-sm text-gray-600">Player tackled at spot</div>
        </button>
        
        <button
          onClick={() => {
            setRushData(prev => ({ ...prev, globalResult: 'OUT_OF_BOUNDS' }));
            setCurrentStep('out-of-bounds-details');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">O - Out of Bounds</div>
          <div className="text-sm text-gray-600">Player went out of bounds</div>
        </button>
        
        <button
          onClick={() => {
            setRushData(prev => ({ ...prev, globalResult: 'FUMBLE' }));
            setCurrentStep('fumble-details');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">F - Fumble</div>
          <div className="text-sm text-gray-600">Ball was fumbled during play</div>
        </button>
        
        <button
          onClick={() => {
            setRushData(prev => ({ ...prev, globalResult: 'END_OF_PLAY' }));
            setCurrentStep('end-of-play-details');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">. - End of Play</div>
          <div className="text-sm text-gray-600">Play completed without special circumstances</div>
        </button>
      </div>
      
      <button
        onClick={() => setCurrentStep('rusher')}
        className="px-4 py-2 bg-gray-500 text-white rounded"
      >
        Back
      </button>
    </div>
  );

  const renderTackleDetails = () => {
    const defenseRoster = gameState?.rosters?.[defense] || [];
    const showRosterHint = defenseRoster.length === 0;
    
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-bold">Rush Play - Tackle Details</h3>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Primary Tackler Jersey # <span className="inline-block px-1 py-0.5 text-xs bg-gray-200 rounded">{defenseName}</span>
          </label>
          <input
            autoFocus // Auto-focus tackler1 only on first render
            value={tackler1Jersey}
            onChange={e => {
              const newValue = e.target.value.replace(/\D+/g,'');
              setTackler1Jersey(newValue);
              // Clear previous candidate when jersey changes
              if (tackler1Candidate) {
                setTackler1Candidate(null);
              }
            }}
            onBlur={handleTackler1Lookup}
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="Enter jersey number"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
          {tackler1Candidate && (
            <div className="p-2 bg-green-50 border border-green-200 rounded mt-1">
              <div className="font-medium text-green-800">
                Selected: {tackler1Candidate.full_name || tackler1Candidate.name} #{tackler1Candidate.jersey_number || tackler1Candidate.jersey}
              </div>
              <div className="text-sm text-green-600">
                {tackler1Candidate.off_position || tackler1Candidate.def_position || tackler1Candidate.st_position || tackler1Candidate.pos || tackler1Candidate.position}
              </div>
            </div>
          )}
          {showRosterHint && (
            <p className="text-xs text-gray-500 mt-1">
              No roster data available for {defenseName}
            </p>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Assist Tackler Jersey # (Optional) <span className="inline-block px-1 py-0.5 text-xs bg-gray-200 rounded">{defenseName}</span>
          </label>
          <input
            value={tackler2Jersey}
            onChange={e => {
              const newValue = e.target.value.replace(/\D+/g,'');
              setTackler2Jersey(newValue);
              // Clear previous candidate when jersey changes
              if (tackler2Candidate) {
                setTackler2Candidate(null);
              }
            }}
            onBlur={handleTackler2Lookup}
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="Enter jersey number"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
          {tackler2Candidate && (
            <div className="p-2 bg-green-50 border border-green-200 rounded mt-1">
              <div className="font-medium text-green-800">
                Selected: {tackler2Candidate.full_name || tackler2Candidate.name} #{tackler2Candidate.jersey_number || tackler2Candidate.jersey}
              </div>
              <div className="text-sm text-green-600">
                {tackler2Candidate.off_position || tackler2Candidate.def_position || tackler2Candidate.st_position || tackler2Candidate.pos || tackler2Candidate.position}
              </div>
            </div>
          )}
        </div>
        
        <YardlineInput
          label="Final Yard Line (where tackled)"
          value={rushData.finalYardLine}
          onChange={(yardLine) => {
            setRushData(prev => ({ ...prev, finalYardLine: yardLine }));
          }}
          onKeyDown={e => e.stopPropagation()}
          error={errors.finalYardLine}
          gameId={gameState?.game_info?.game_id || 1000}
          required
        />
        
        <div className="flex space-x-2">
          <button
            onClick={handleRushSubmit}
            disabled={!tackler1Jersey || !rushData.finalYardLine}
            className="px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-400"
          >
            Submit Play
          </button>
          <button
            onClick={() => {
              // Clear tackler data when going back
              setTackler1Jersey('');
              setTackler2Jersey('');
              setTackler1Candidate(null);
              setTackler2Candidate(null);
              setCurrentStep('global-result');
            }}
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
      </div>
    );
  };

  const renderOutOfBoundsDetails = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Rush Play - Out of Bounds Details</h3>
      
      <PlayerInput
        label="Tackler (Optional - if forced out)"
        value={rushData.tackler1}
        onChange={(player) => setRushData(prev => ({ ...prev, tackler1: player }))}
        gameId={gameState?.game_info?.game_id || 1000}
        team={gameState?.live_state?.possession === 'home' ? 'visitor' : 'home'}
      />
      
      <YardlineInput
        label="Final Yard Line (where went out of bounds)"
        value={rushData.finalYardLine}
        onChange={(yardLine) => setRushData(prev => ({ ...prev, finalYardLine: yardLine }))}
        error={errors.finalYardLine}
        gameId={gameState?.game_info?.game_id || 1000}
        required
      />
      
      <div className="flex space-x-2">
        <button
          onClick={handleRushSubmit}
          disabled={!rushData.finalYardLine}
          className="px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-400"
        >
          Submit Play
        </button>
        <button
          onClick={() => setCurrentStep('global-result')}
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
    </div>
  );

  const renderFumbleDetails = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Rush Play - Fumble Details</h3>
      
      <PlayerInput
        label="Forced By"
        value={rushData.forcedBy}
        onChange={(player) => setRushData(prev => ({ ...prev, forcedBy: player }))}
        gameState={gameState}
      />
      
      <div className="space-y-2">
        <label className="block font-bold">Recovering Team</label>
        <div className="flex space-x-4">
          <button
            onClick={() => setRushData(prev => ({ ...prev, recoveringTeam: 'home' }))}
            className={`px-4 py-2 rounded ${rushData.recoveringTeam === 'home' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            Home
          </button>
          <button
            onClick={() => setRushData(prev => ({ ...prev, recoveringTeam: 'visitor' }))}
            className={`px-4 py-2 rounded ${rushData.recoveringTeam === 'visitor' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            Visitor
          </button>
        </div>
        {errors.recoveringTeam && <div className="text-red-500 text-sm">{errors.recoveringTeam}</div>}
      </div>
      
      <PlayerInput
        label="Recovering Player"
        value={rushData.recoveringPlayer}
        onChange={(player) => setRushData(prev => ({ ...prev, recoveringPlayer: player }))}
        error={errors.recoveringPlayer}
        gameState={gameState}
        required
      />
      
      <YardlineInput
        label="Recovery Spot"
        value={rushData.recoverySpot}
        onChange={(recoverySpot) => setRushData(prev => ({ ...prev, recoverySpot }))}
        error={errors.recoverySpot}
        gameState={gameState}
        required
      />
      
      <div className="text-sm text-gray-600">
        Note: After fumble recovery, you'll be prompted for the final result of the play.
      </div>
      
      <div className="flex space-x-2">
        <button
          onClick={handleRushSubmit}
          disabled={!rushData.recoveringTeam || !rushData.recoveringPlayer || !rushData.recoverySpot}
          className="px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-400"
        >
          Submit Play
        </button>
        <button
          onClick={() => setCurrentStep('global-result')}
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
    </div>
  );

  const renderEndOfPlayDetails = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Rush Play - End of Play</h3>
      
      <YardlineInput
        label="Final Yard Line"
        value={rushData.finalYardLine}
        onChange={(yardLine) => setRushData(prev => ({ ...prev, finalYardLine: yardLine }))}
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
          onClick={handleRushSubmit}
          disabled={!rushData.finalYardLine}
          className="px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-400"
        >
          Submit Play
        </button>
        <button
          onClick={() => setCurrentStep('global-result')}
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

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'rusher':
        return renderRusherStep();
      case 'global-result':
        return renderGlobalResultStep();
      case 'tackle-details':
        return renderTackleDetails();
      case 'out-of-bounds-details':
        return renderOutOfBoundsDetails();
      case 'fumble-details':
        return renderFumbleDetails();
      case 'end-of-play-details':
        return renderEndOfPlayDetails();
      default:
        return renderRusherStep();
    }
  };

  return (
    <div className="p-6 bg-white border border-gray-300 rounded-lg shadow-lg max-w-2xl">
      {/* Penalty Queued Indicator */}
      <PenaltyQueuedIndicator penaltyQueued={penaltyQueued} />
      
      {renderCurrentStep()}
      
      {/* Rusher Disambiguation Modal - only show in rusher step */}
      {currentStep === 'rusher' && (
        <PlayerDisambiguationModal
          isOpen={showDisambiguate}
          jersey={rusherJersey}
          candidates={rusherMatches}
          playType="rush"
          onConfirm={handleDisambigConfirm}
          onCancel={handleDisambigCancel}
        />
      )}

      {/* Tackler 1 Disambiguation Modal - only show in tackle-details step */}
      {currentStep === 'tackle-details' && (
        <PlayerDisambiguationModal
          isOpen={showTackler1Disambiguate}
          jersey={tackler1Jersey}
          candidates={tackler1Matches}
          playType="tackle"
          onConfirm={handleTackler1Confirm}
          onCancel={() => setShowTackler1Disambiguate(false)}
        />
      )}

      {/* Tackler 2 Disambiguation Modal - only show in tackle-details step */}
      {currentStep === 'tackle-details' && (
        <PlayerDisambiguationModal
          isOpen={showTackler2Disambiguate}
          jersey={tackler2Jersey}
          candidates={tackler2Matches}
          playType="tackle"
          onConfirm={handleTackler2Confirm}
          onCancel={() => setShowTackler2Disambiguate(false)}
        />
      )}

      {/* Penalty Input Modal */}
      {showPenaltyModal && (
        <PenaltyInputModal
          isOpen={showPenaltyModal}
          onClose={() => setShowPenaltyModal(false)}
          onSubmit={handleRushPenaltySubmit}
          gameState={gameState}
        />
      )}
    </div>
  );
};

export default RushInputFlow;

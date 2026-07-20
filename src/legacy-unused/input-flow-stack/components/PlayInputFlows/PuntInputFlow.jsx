import React, { useState, useEffect } from 'react';
import debug from '../../utils/debug';
import { useGameState } from '../../contexts/FootballGameContext';
import PlayerInput from '../PlayerInput';
import YardlineInput from '../YardlineInput';
import PenaltyInputModal from '../PenaltyInputModal';
import DownDistanceCalculator from '../../utils/DownDistanceCalculator';

const PuntInputFlow = ({ onComplete, onCancel, gameState }) => {
  const { submitEvent } = useGameState();
  
  const [puntData, setPuntData] = useState({
    punter: null,
    puntResult: null, // 'returned', 'downed', 'caught', 'touchback', 'muffed', 'kicking-error'
    returner: null,
    downedBy: null,
    caughtBy: null,
    muffedBy: null,
    globalResult: null, // For returned punts: T, O, F, .
    finalYardLine: '',
    tackler1: null,
    tackler2: null,
    forcedBy: null,
    recoveringTeam: null,
    recoveringPlayer: null,
    recoverySpot: '',
    puntYardLine: '',
    downedSpot: '',
    fairCatchSpot: ''
  });

  const [currentStep, setCurrentStep] = useState('punter'); // punter -> punt-result -> result-details
  const [errors, setErrors] = useState({});
  const [penaltyQueued, setPenaltyQueued] = useState(false);
  const [showPenaltyModal, setShowPenaltyModal] = useState(false);

  // Handle keyboard shortcuts for punt results (R, D, C, T, M, K), global results (T, O, F, .) and penalty queuing (E)
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

      if (currentStep === 'punt-result') {
        switch (e.key.toLowerCase()) {
          case 'r':
            setPuntData(prev => ({ ...prev, puntResult: 'returned' }));
            setCurrentStep('returned-details');
            break;
          case 'd':
            setPuntData(prev => ({ ...prev, puntResult: 'downed' }));
            setCurrentStep('downed-details');
            break;
          case 'c':
            setPuntData(prev => ({ ...prev, puntResult: 'caught' }));
            setCurrentStep('caught-details');
            break;
          case 't':
            setPuntData(prev => ({ ...prev, puntResult: 'touchback' }));
            setCurrentStep('touchback-details');
            break;
          case 'm':
            setPuntData(prev => ({ ...prev, puntResult: 'muffed' }));
            setCurrentStep('muffed-details');
            break;
          case 'k':
            setPuntData(prev => ({ ...prev, puntResult: 'kicking-error' }));
            setCurrentStep('kicking-error-details');
            break;
        }
      }
      
      if (currentStep === 'returned-global-result') {
        switch (e.key.toLowerCase()) {
          case 't':
            setPuntData(prev => ({ ...prev, globalResult: 'TACKLE' }));
            setCurrentStep('returned-tackle-details');
            break;
          case 'o':
            setPuntData(prev => ({ ...prev, globalResult: 'OUT_OF_BOUNDS' }));
            setCurrentStep('returned-out-of-bounds-details');
            break;
          case 'f':
            setPuntData(prev => ({ ...prev, globalResult: 'FUMBLE' }));
            setCurrentStep('returned-fumble-details');
            break;
          case '.':
            setPuntData(prev => ({ ...prev, globalResult: 'END_OF_PLAY' }));
            setCurrentStep('returned-end-of-play-details');
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
    switch (currentStep) {
      case 'punter':
        if (puntData.punter) {
          setCurrentStep('punt-result');
        }
        break;
      case 'punt-result':
        // Use existing keyboard shortcuts for result selection
        break;
      case 'returned-details':
      case 'downed-details':
      case 'out-of-bounds-details':
      case 'touchback-details':
      case 'blocked-details':
      case 'returned-global-result':
        if (puntData.finalYardLine) {
          handlePuntSubmit();
        }
        break;
      default:
        break;
    }
  };

  const validatePuntStep = (step) => {
    const newErrors = {};
    
    switch (step) {
      case 'punter':
        if (!puntData.punter) {
          newErrors.punter = 'Punter selection is required';
        }
        break;
      case 'punt-result':
        if (!puntData.puntResult) {
          newErrors.puntResult = 'Punt result is required';
        }
        break;
      case 'returned-details':
        if (!puntData.returner) {
          newErrors.returner = 'Returner selection is required';
        }
        break;
      case 'downed-details':
        if (!puntData.downedBy) {
          newErrors.downedBy = 'Player who downed punt is required';
        }
        if (!puntData.downedSpot) {
          newErrors.downedSpot = 'Downed spot is required';
        }
        break;
      case 'caught-details':
        if (!puntData.caughtBy) {
          newErrors.caughtBy = 'Player who caught punt is required';
        }
        if (!puntData.fairCatchSpot) {
          newErrors.fairCatchSpot = 'Fair catch spot is required';
        }
        break;
      case 'muffed-details':
        if (!puntData.muffedBy) {
          newErrors.muffedBy = 'Player who muffed punt is required';
        }
        if (!puntData.recoveringTeam) {
          newErrors.recoveringTeam = 'Recovering team is required';
        }
        if (!puntData.recoveringPlayer) {
          newErrors.recoveringPlayer = 'Recovering player is required';
        }
        if (!puntData.recoverySpot) {
          newErrors.recoverySpot = 'Recovery spot is required';
        }
        break;
      case 'kicking-error-details':
        if (!puntData.puntYardLine) {
          newErrors.puntYardLine = 'Punt yard line is required';
        }
        break;
      case 'returned-tackle-details':
        if (!puntData.tackler1) {
          newErrors.tackler1 = 'Primary tackler is required';
        }
        if (!puntData.finalYardLine) {
          newErrors.finalYardLine = 'Final yard line is required';
        }
        break;
      case 'returned-out-of-bounds-details':
      case 'returned-end-of-play-details':
        if (!puntData.finalYardLine) {
          newErrors.finalYardLine = 'Final yard line is required';
        }
        break;
      case 'returned-fumble-details':
        if (!puntData.recoveringTeam) {
          newErrors.recoveringTeam = 'Recovering team is required';
        }
        if (!puntData.recoveringPlayer) {
          newErrors.recoveringPlayer = 'Recovering player is required';
        }
        if (!puntData.recoverySpot) {
          newErrors.recoverySpot = 'Recovery spot is required';
        }
        break;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (!validatePuntStep(currentStep)) return;
    
    switch (currentStep) {
      case 'punter':
        setCurrentStep('punt-result');
        break;
      case 'punt-result':
        // This is handled by keyboard shortcuts or button clicks
        break;
      case 'returned-details':
        setCurrentStep('returned-global-result');
        break;
      default:
        handlePuntSubmit();
        break;
    }
  };

  const handlePuntSubmit = async () => {
    if (!validatePuntStep(currentStep)) return;

    // Check if penalty is queued
    if (penaltyQueued) {
      setShowPenaltyModal(true);
      return;
    }
    
    // Calculate post-play down and distance using game state
    const currentGameStateForCalc = {
      YardLinePosition: gameState?.live_state?.yard_line_position || gameState?.live_state?.yard_line || 'V28',  // PRE-PLAY position
      CurrentDown: gameState?.live_state?.current_down || gameState?.live_state?.down || 1,              // PRE-PLAY down
      YardsToGo: gameState?.live_state?.yards_to_go || gameState?.live_state?.distance || 10,            // PRE-PLAY distance
      LineToGain: gameState?.live_state?.line_to_gain,
      Possession: gameState?.live_state?.possession === 'visitor' ? 'V' : 'H'
    };
    
    debug.log('[PUNT CALC DEBUG] Using PRE-PLAY state for calculation:', {
      YardLinePosition: currentGameStateForCalc.YardLinePosition,
      CurrentDown: currentGameStateForCalc.CurrentDown,
      YardsToGo: currentGameStateForCalc.YardsToGo,
      endPosition: puntData.finalYardLine
    });
    
    const playDataForCalc = {
      startPosition: currentGameStateForCalc.YardLinePosition,
      endPosition: puntData.finalYardLine,
      possession: currentGameStateForCalc.Possession,
      isFirstDown: false, // Punts typically don't result in first downs for punting team
      isTouchdown: puntData.globalResult === 'touchdown',
      isTurnover: true, // Punt is change of possession
      isSafety: false,
      is_kickoff: false,
      play_type: 'punt'
    };
    
    const postPlayState = DownDistanceCalculator.calculatePostPlayState(playDataForCalc, currentGameStateForCalc);
    
    // Build play data structure compatible with API (per FLOW_VARIABLE_TO_SQL_MAPPING.md)
    const playData = {
      playType: 'punt',                               // Standard API field
      primaryPlayerID: puntData.punter,             // punter → primaryPlayerID
      resultCode: puntData.puntResult,                     // puntResult → resultCode ('RETURN', 'DOWNED', 'FAIR_CATCH', 'TOUCHBACK', 'MUFFED')
      secondaryPlayerID: puntData.returner || puntData.caughtBy, // returner or fair catch player → secondaryPlayerID
      endYardLine: puntData.finalYardLine,            // For frontend consistency
      end_yard_line: puntData.finalYardLine,          // finalYardLine → end_yard_line
      
      // Post-play state for backend game_state updates
      post_down: postPlayState.postDown,
      post_distance: postPlayState.postDistance,
      has_fumble: puntData.miscFumble || false,       // miscFumble → has_fumble
      penaltyQueued: penaltyQueued,                    // Add penalty status to play data
      
      // Additional punt-specific data (stored in RawData)
      globalResult: puntData.globalResult,            // For returns: end result
      kickedToYardLine: puntData.puntYardLine,        // Where punt landed
      downedSpot: puntData.downedSpot,
      fairCatchSpot: puntData.fairCatchSpot,
      
      // Participant data (will be processed separately by API)
      downedBy: puntData.downedBy,                     // → play_participants table
      muffedBy: puntData.muffedBy,                     // → play_participants table
      tackler1: puntData.tackler1,                     // → play_participants table
      tackler2: puntData.tackler2,                     // → play_participants table
      forcedBy: puntData.forcedBy,                     // → play_participants table
      
      // Fumble recovery data (calculated by API)
      recoveringTeam: puntData.recoveringTeam,         // → Fumble1RecoveredBy
      recoveringPlayer: puntData.recoveringPlayer,     // → Fumble1RecoveredByPlayerID
      recoverySpot: puntData.recoverySpot              // → Fumble1YardLine
    };

    try {
      await submitEvent(playData);
      onComplete(playData);
    } catch (error) {
      console.error('Error submitting punt play:', error);
      setErrors({ submit: 'Error submitting play. Please try again.' });
    }
  };

  const handlePenaltySubmit = (penaltyData) => {
    submitPlayWithPenalties(penaltyData);
    setShowPenaltyModal(false);
    setPenaltyQueued(false);
  };

  const submitPlayWithPenalties = async (penaltyData) => {
    // Build play data structure compatible with API
    const playData = {
      playType: 'punt',
      punter: puntData.punter,
      puntResult: puntData.puntResult,
      returner: puntData.returner,
      downedBy: puntData.downedBy,
      caughtBy: puntData.caughtBy,
      muffedBy: puntData.muffedBy,
      forcedBy: puntData.forcedBy,
      recoveringTeam: puntData.recoveringTeam,
      recoveringPlayer: puntData.recoveringPlayer,
      recoverySpot: puntData.recoverySpot,
      puntYardLine: puntData.puntYardLine,
      downedSpot: puntData.downedSpot,
      fairCatchSpot: puntData.fairCatchSpot,
      penalties: penaltyData
    };

    try {
      await submitEvent(playData);
      onComplete(playData);
    } catch (error) {
      console.error('Error submitting punt play with penalties:', error);
      setErrors({ submit: 'Error submitting play with penalties. Please try again.' });
    }
  };

  const renderPunterStep = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Punt Play - Select Punter</h3>
      
      <PlayerInput
        label="Punter"
        value={puntData.punter}
        onChange={(player) => setPuntData(prev => ({ ...prev, punter: player }))}
        error={errors.punter}
        gameState={gameState}
        required
        autoFocus={true}
      />
      
      <div className="flex space-x-2">
        <button
          onClick={handleNext}
          disabled={!puntData.punter}
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

  const renderPuntResultStep = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Punt Play - Select Result</h3>
      
      <div className="text-sm text-gray-600 mb-4">
        Use keyboard shortcuts or click buttons:
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => {
            setPuntData(prev => ({ ...prev, puntResult: 'returned' }));
            setCurrentStep('returned-details');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">R - Returned</div>
          <div className="text-sm text-gray-600">Punt was returned</div>
        </button>
        
        <button
          onClick={() => {
            setPuntData(prev => ({ ...prev, puntResult: 'downed' }));
            setCurrentStep('downed-details');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">D - Downed</div>
          <div className="text-sm text-gray-600">Punt was downed</div>
        </button>
        
        <button
          onClick={() => {
            setPuntData(prev => ({ ...prev, puntResult: 'caught' }));
            setCurrentStep('caught-details');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">C - Caught (Fair Catch)</div>
          <div className="text-sm text-gray-600">Fair catch signal</div>
        </button>
        
        <button
          onClick={() => {
            setPuntData(prev => ({ ...prev, puntResult: 'touchback' }));
            setCurrentStep('touchback-details');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">T - Touchback</div>
          <div className="text-sm text-gray-600">Punt into end zone</div>
        </button>
        
        <button
          onClick={() => {
            setPuntData(prev => ({ ...prev, puntResult: 'muffed' }));
            setCurrentStep('muffed-details');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">M - Muffed</div>
          <div className="text-sm text-gray-600">Punt was muffed</div>
        </button>
        
        <button
          onClick={() => {
            setPuntData(prev => ({ ...prev, puntResult: 'kicking-error' }));
            setCurrentStep('kicking-error-details');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">K - Kicking Error</div>
          <div className="text-sm text-gray-600">Blocked, bad snap, etc.</div>
        </button>
      </div>
      
      <button
        onClick={() => setCurrentStep('punter')}
        className="px-4 py-2 bg-gray-500 text-white rounded"
      >
        Back
      </button>
    </div>
  );

  const renderReturnedDetails = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Punt Returned - Select Returner</h3>
      
      <PlayerInput
        label="Returner"
        value={puntData.returner}
        onChange={(player) => setPuntData(prev => ({ ...prev, returner: player }))}
        error={errors.returner}
        gameState={gameState}
        required
      />
      
      <div className="flex space-x-2">
        <button
          onClick={handleNext}
          disabled={!puntData.returner}
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-400"
        >
          Next
        </button>
        <button
          onClick={() => setCurrentStep('punt-result')}
          className="px-4 py-2 bg-gray-500 text-white rounded"
        >
          Back
        </button>
      </div>
    </div>
  );

  const renderReturnedGlobalResultStep = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Punt Returned - Select Final Result</h3>
      
      <div className="text-sm text-gray-600 mb-4">
        Use keyboard shortcuts or click buttons:
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => {
            setPuntData(prev => ({ ...prev, globalResult: 'TACKLE' }));
            setCurrentStep('returned-tackle-details');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">T - Tackle</div>
          <div className="text-sm text-gray-600">Returner tackled</div>
        </button>
        
        <button
          onClick={() => {
            setPuntData(prev => ({ ...prev, globalResult: 'OUT_OF_BOUNDS' }));
            setCurrentStep('returned-out-of-bounds-details');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">O - Out of Bounds</div>
          <div className="text-sm text-gray-600">Returner went out of bounds</div>
        </button>
        
        <button
          onClick={() => {
            setPuntData(prev => ({ ...prev, globalResult: 'FUMBLE' }));
            setCurrentStep('returned-fumble-details');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">F - Fumble</div>
          <div className="text-sm text-gray-600">Returner fumbled during return</div>
        </button>
        
        <button
          onClick={() => {
            setPuntData(prev => ({ ...prev, globalResult: 'END_OF_PLAY' }));
            setCurrentStep('returned-end-of-play-details');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">. - End of Play</div>
          <div className="text-sm text-gray-600">Special circumstances</div>
        </button>
      </div>
      
      <button
        onClick={() => setCurrentStep('returned-details')}
        className="px-4 py-2 bg-gray-500 text-white rounded"
      >
        Back
      </button>
    </div>
  );

  const renderDownedDetails = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Punt Downed - Details</h3>
      
      <PlayerInput
        label="Downed By"
        value={puntData.downedBy}
        onChange={(player) => setPuntData(prev => ({ ...prev, downedBy: player }))}
        error={errors.downedBy}
        gameState={gameState}
        required
      />
      
      <YardlineInput
        label="Downed Spot"
        value={puntData.downedSpot}
        onChange={(spot) => setPuntData(prev => ({ ...prev, downedSpot: spot }))}
        error={errors.downedSpot}
        gameState={gameState}
        required
      />
      
      <div className="flex space-x-2">
        <button
          onClick={handlePuntSubmit}
          disabled={!puntData.downedBy || !puntData.downedSpot}
          className="px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-400"
        >
          Submit Play
        </button>
        <button
          onClick={() => setCurrentStep('punt-result')}
          className="px-4 py-2 bg-gray-500 text-white rounded"
        >
          Back
        </button>
      </div>
    </div>
  );

  const renderCaughtDetails = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Punt Fair Catch - Details</h3>
      
      <PlayerInput
        label="Caught By"
        value={puntData.caughtBy}
        onChange={(player) => setPuntData(prev => ({ ...prev, caughtBy: player }))}
        error={errors.caughtBy}
        gameState={gameState}
        required
      />
      
      <YardlineInput
        label="Fair Catch Spot"
        value={puntData.fairCatchSpot}
        onChange={(spot) => setPuntData(prev => ({ ...prev, fairCatchSpot: spot }))}
        error={errors.fairCatchSpot}
        gameState={gameState}
        required
      />
      
      <div className="flex space-x-2">
        <button
          onClick={handlePuntSubmit}
          disabled={!puntData.caughtBy || !puntData.fairCatchSpot}
          className="px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-400"
        >
          Submit Play
        </button>
        <button
          onClick={() => setCurrentStep('punt-result')}
          className="px-4 py-2 bg-gray-500 text-white rounded"
        >
          Back
        </button>
      </div>
    </div>
  );

  const renderTouchbackDetails = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Punt Touchback - Details</h3>
      
      <div className="text-sm text-gray-600 mb-4">
        Punt went into the end zone resulting in a touchback.
        Ball will be placed at the 20-yard line.
      </div>
      
      <div className="flex space-x-2">
        <button
          onClick={handlePuntSubmit}
          className="px-4 py-2 bg-green-600 text-white rounded"
        >
          Submit Play
        </button>
        <button
          onClick={() => setCurrentStep('punt-result')}
          className="px-4 py-2 bg-gray-500 text-white rounded"
        >
          Back
        </button>
      </div>
    </div>
  );

  const renderMuffedDetails = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Punt Muffed - Details</h3>
      
      <PlayerInput
        label="Muffed By"
        value={puntData.muffedBy}
        onChange={(player) => setPuntData(prev => ({ ...prev, muffedBy: player }))}
        error={errors.muffedBy}
        gameState={gameState}
        required
      />
      
      <div className="space-y-2">
        <label className="block font-bold">Recovering Team</label>
        <div className="flex space-x-4">
          <button
            onClick={() => setPuntData(prev => ({ ...prev, recoveringTeam: 'home' }))}
            className={`px-4 py-2 rounded ${puntData.recoveringTeam === 'home' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            Home
          </button>
          <button
            onClick={() => setPuntData(prev => ({ ...prev, recoveringTeam: 'visitor' }))}
            className={`px-4 py-2 rounded ${puntData.recoveringTeam === 'visitor' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            Visitor
          </button>
        </div>
        {errors.recoveringTeam && <div className="text-red-500 text-sm">{errors.recoveringTeam}</div>}
      </div>
      
      <PlayerInput
        label="Recovering Player"
        value={puntData.recoveringPlayer}
        onChange={(player) => setPuntData(prev => ({ ...prev, recoveringPlayer: player }))}
        error={errors.recoveringPlayer}
        gameState={gameState}
        required
      />
      
      <YardlineInput
        label="Recovery Spot"
        value={puntData.recoverySpot}
        onChange={(spot) => setPuntData(prev => ({ ...prev, recoverySpot: spot }))}
        error={errors.recoverySpot}
        gameState={gameState}
        required
      />
      
      <div className="flex space-x-2">
        <button
          onClick={handlePuntSubmit}
          disabled={!puntData.muffedBy || !puntData.recoveringTeam || !puntData.recoveringPlayer || !puntData.recoverySpot}
          className="px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-400"
        >
          Submit Play
        </button>
        <button
          onClick={() => setCurrentStep('punt-result')}
          className="px-4 py-2 bg-gray-500 text-white rounded"
        >
          Back
        </button>
      </div>
    </div>
  );

  const renderKickingErrorDetails = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Kicking Error - Details</h3>
      
      <div className="text-sm text-gray-600 mb-4">
        Blocked punt, bad snap, or other kicking error.
      </div>
      
      <YardlineInput
        label="Punt Yard Line (where error occurred)"
        value={puntData.puntYardLine}
        onChange={(yardLine) => setPuntData(prev => ({ ...prev, puntYardLine: yardLine }))}
        error={errors.puntYardLine}
        gameState={gameState}
        required
      />
      
      <div className="flex space-x-2">
        <button
          onClick={handlePuntSubmit}
          disabled={!puntData.puntYardLine}
          className="px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-400"
        >
          Submit Play
        </button>
        <button
          onClick={() => setCurrentStep('punt-result')}
          className="px-4 py-2 bg-gray-500 text-white rounded"
        >
          Back
        </button>
      </div>
    </div>
  );

  const renderReturnedTackleDetails = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Punt Return - Tackle Details</h3>
      
      <PlayerInput
        label="Primary Tackler"
        value={puntData.tackler1}
        onChange={(player) => setPuntData(prev => ({ ...prev, tackler1: player }))}
        error={errors.tackler1}
        gameState={gameState}
        required
      />
      
      <PlayerInput
        label="Assist Tackler (Optional)"
        value={puntData.tackler2}
        onChange={(player) => setPuntData(prev => ({ ...prev, tackler2: player }))}
        gameState={gameState}
      />
      
      <YardlineInput
        label="Final Yard Line (where tackled)"
        value={puntData.finalYardLine}
        onChange={(yardLine) => setPuntData(prev => ({ ...prev, finalYardLine: yardLine }))}
        error={errors.finalYardLine}
        gameState={gameState}
        required
      />
      
      <div className="flex space-x-2">
        <button
          onClick={handlePuntSubmit}
          disabled={!puntData.tackler1 || !puntData.finalYardLine}
          className="px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-400"
        >
          Submit Play
        </button>
        <button
          onClick={() => setCurrentStep('returned-global-result')}
          className="px-4 py-2 bg-gray-500 text-white rounded"
        >
          Back
        </button>
      </div>
    </div>
  );

  const renderReturnedOutOfBoundsDetails = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Punt Return - Out of Bounds Details</h3>
      
      <PlayerInput
        label="Tackler (Optional - if forced out)"
        value={puntData.tackler1}
        onChange={(player) => setPuntData(prev => ({ ...prev, tackler1: player }))}
        gameState={gameState}
      />
      
      <YardlineInput
        label="Final Yard Line (where went out of bounds)"
        value={puntData.finalYardLine}
        onChange={(yardLine) => setPuntData(prev => ({ ...prev, finalYardLine: yardLine }))}
        error={errors.finalYardLine}
        gameState={gameState}
        required
      />
      
      <div className="flex space-x-2">
        <button
          onClick={handlePuntSubmit}
          disabled={!puntData.finalYardLine}
          className="px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-400"
        >
          Submit Play
        </button>
        <button
          onClick={() => setCurrentStep('returned-global-result')}
          className="px-4 py-2 bg-gray-500 text-white rounded"
        >
          Back
        </button>
      </div>
    </div>
  );

  const renderReturnedFumbleDetails = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Punt Return Fumble - Details</h3>
      
      <PlayerInput
        label="Forced By"
        value={puntData.forcedBy}
        onChange={(player) => setPuntData(prev => ({ ...prev, forcedBy: player }))}
        gameState={gameState}
      />
      
      <div className="space-y-2">
        <label className="block font-bold">Recovering Team</label>
        <div className="flex space-x-4">
          <button
            onClick={() => setPuntData(prev => ({ ...prev, recoveringTeam: 'home' }))}
            className={`px-4 py-2 rounded ${puntData.recoveringTeam === 'home' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            Home
          </button>
          <button
            onClick={() => setPuntData(prev => ({ ...prev, recoveringTeam: 'visitor' }))}
            className={`px-4 py-2 rounded ${puntData.recoveringTeam === 'visitor' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            Visitor
          </button>
        </div>
        {errors.recoveringTeam && <div className="text-red-500 text-sm">{errors.recoveringTeam}</div>}
      </div>
      
      <PlayerInput
        label="Recovering Player"
        value={puntData.recoveringPlayer}
        onChange={(player) => setPuntData(prev => ({ ...prev, recoveringPlayer: player }))}
        error={errors.recoveringPlayer}
        gameState={gameState}
        required
      />
      
      <YardlineInput
        label="Recovery Spot"
        value={puntData.recoverySpot}
        onChange={(spot) => setPuntData(prev => ({ ...prev, recoverySpot: spot }))}
        error={errors.recoverySpot}
        gameState={gameState}
        required
      />
      
      <div className="flex space-x-2">
        <button
          onClick={handlePuntSubmit}
          disabled={!puntData.recoveringTeam || !puntData.recoveringPlayer || !puntData.recoverySpot}
          className="px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-400"
        >
          Submit Play
        </button>
        <button
          onClick={() => setCurrentStep('returned-global-result')}
          className="px-4 py-2 bg-gray-500 text-white rounded"
        >
          Back
        </button>
      </div>
    </div>
  );

  const renderReturnedEndOfPlayDetails = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Punt Return - End of Play</h3>
      
      <YardlineInput
        label="Final Yard Line"
        value={puntData.finalYardLine}
        onChange={(yardLine) => setPuntData(prev => ({ ...prev, finalYardLine: yardLine }))}
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
          onClick={handlePuntSubmit}
          disabled={!puntData.finalYardLine}
          className="px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-400"
        >
          Submit Play
        </button>
        <button
          onClick={() => setCurrentStep('returned-global-result')}
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
      case 'punter':
        return renderPunterStep();
      case 'punt-result':
        return renderPuntResultStep();
      case 'returned-details':
        return renderReturnedDetails();
      case 'returned-global-result':
        return renderReturnedGlobalResultStep();
      case 'downed-details':
        return renderDownedDetails();
      case 'caught-details':
        return renderCaughtDetails();
      case 'touchback-details':
        return renderTouchbackDetails();
      case 'muffed-details':
        return renderMuffedDetails();
      case 'kicking-error-details':
        return renderKickingErrorDetails();
      case 'returned-tackle-details':
        return renderReturnedTackleDetails();
      case 'returned-out-of-bounds-details':
        return renderReturnedOutOfBoundsDetails();
      case 'returned-fumble-details':
        return renderReturnedFumbleDetails();
      case 'returned-end-of-play-details':
        return renderReturnedEndOfPlayDetails();
      default:
        return renderPunterStep();
    }
  };

  return (
    <div className="p-6 bg-white border border-gray-300 rounded-lg shadow-lg max-w-2xl">
      {penaltyQueued && (
        <div className="mb-4 p-3 bg-yellow-100 border border-yellow-400 rounded-lg">
          <div className="flex items-center space-x-2">
            <span className="text-yellow-800 font-semibold">⚠️ Penalty Queued</span>
            <span className="text-sm text-yellow-700">Press 'E' again to clear, or submit to enter penalty details</span>
          </div>
        </div>
      )}
      
      {renderCurrentStep()}
      
      {/* Debug info */}
      <div className="mt-4 text-xs text-gray-500">
        Debug: Penalty Queued = {penaltyQueued ? 'Yes' : 'No'} | Modal Open = {showPenaltyModal ? 'Yes' : 'No'}
      </div>
      
      {/* Penalty Modal */}
      {showPenaltyModal && (
        <PenaltyInputModal
          isOpen={showPenaltyModal}
          onClose={() => {
            setShowPenaltyModal(false);
            setPenaltyQueued(false);
          }}
          onSubmit={handlePenaltySubmit}
          gameState={gameState}
        />
      )}
    </div>
  );
};

export default PuntInputFlow;

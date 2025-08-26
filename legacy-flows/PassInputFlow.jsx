import React, { useState, useEffect, useContext } from 'react';
import { GameStateContext } from './GameStateContext';
import PlayerInput from './PlayerInput';
import YardlineInput from './YardlineInput';
import PenaltyInputModal from './components/PenaltyInputModal';

const PassInputFlow = ({ onComplete, onCancel, gameState }) => {
  const { submitPlay } = useContext(GameStateContext);
  
  const [passData, setPassData] = useState({
    quarterback: null,
    receiver: null,
    passResult: null, // 'complete', 'incomplete', 'sack', 'fumble'
    globalResult: null, // For complete passes: T, O, F, .
    finalYardLine: '',
    tackler1: null,
    tackler2: null,
    forcedBy: null,
    recoveringTeam: null,
    recoveringPlayer: null,
    recoverySpot: '',
    sackYardLine: '',
    incompleteReason: null, // 'dropped', 'defended', 'overthrown', 'underthrown', 'out-of-bounds'
    defender: null
  });

  const [currentStep, setCurrentStep] = useState('quarterback'); // quarterback -> receiver -> pass-result -> result-details
  const [errors, setErrors] = useState({});
  const [penaltyQueued, setPenaltyQueued] = useState(false);
  const [showPenaltyModal, setShowPenaltyModal] = useState(false);

  // Handle keyboard shortcuts for pass results (C, I, S, F), global results (T, O, F, .) and penalty queuing (E)
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Handle penalty queuing with 'E' key - available at any time during play input
      if (e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setPenaltyQueued(prev => !prev);
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
        }
      }
      
      if (currentStep === 'complete-global-result') {
        switch (e.key.toLowerCase()) {
          case 't':
            setPassData(prev => ({ ...prev, globalResult: 'tackle' }));
            setCurrentStep('complete-tackle-details');
            break;
          case 'o':
            setPassData(prev => ({ ...prev, globalResult: 'out-of-bounds' }));
            setCurrentStep('complete-out-of-bounds-details');
            break;
          case 'f':
            setPassData(prev => ({ ...prev, globalResult: 'fumble' }));
            setCurrentStep('complete-fumble-details');
            break;
          case '.':
            setPassData(prev => ({ ...prev, globalResult: 'end-of-play' }));
            setCurrentStep('complete-end-of-play-details');
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
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (!validateStep(currentStep)) return;
    
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
    if (!validateStep(currentStep)) return;
    
    // Build play data structure compatible with API
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
      penaltyQueued: penaltyQueued // Add penalty status to play data
    };

    try {
      // If penalty is queued, hold play data and start penalty flow
      if (penaltyQueued) {
        // Open penalty input modal with play data held in memory
        console.log('Penalty queued - opening penalty input flow with play data:', playData);
        setShowPenaltyModal(true);
        return;
      }

      // Normal play submission if no penalty queued
      await submitPlay(playData);
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
        miscFumble: passData.miscFumble,
        interception: passData.interception,
        globalResult: passData.globalResult,
        tackler1: passData.tackler1,
        tackler2: passData.tackler2,
        finalYardLine: passData.finalYardLine,
        forcedBy: passData.forcedBy,
        recoveringTeam: passData.recoveringTeam,
        recoveringPlayer: passData.recoveringPlayer,
        recoverySpot: passData.recoverySpot,
        interceptingPlayer: passData.interceptingPlayer,
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
        value={passData.quarterback}
        onChange={(player) => setPassData(prev => ({ ...prev, quarterback: player }))}
        error={errors.quarterback}
        gameState={gameState}
        required
      />
      
      <div className="flex space-x-2">
        <button
          onClick={handleNext}
          disabled={!passData.quarterback}
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
        value={passData.receiver}
        onChange={(player) => setPassData(prev => ({ ...prev, receiver: player }))}
        error={errors.receiver}
        gameState={gameState}
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
            setPassData(prev => ({ ...prev, globalResult: 'tackle' }));
            setCurrentStep('complete-tackle-details');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">T - Tackle</div>
          <div className="text-sm text-gray-600">Receiver tackled</div>
        </button>
        
        <button
          onClick={() => {
            setPassData(prev => ({ ...prev, globalResult: 'out-of-bounds' }));
            setCurrentStep('complete-out-of-bounds-details');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">O - Out of Bounds</div>
          <div className="text-sm text-gray-600">Receiver went out of bounds</div>
        </button>
        
        <button
          onClick={() => {
            setPassData(prev => ({ ...prev, globalResult: 'fumble' }));
            setCurrentStep('complete-fumble-details');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">F - Fumble</div>
          <div className="text-sm text-gray-600">Receiver fumbled after catch</div>
        </button>
        
        <button
          onClick={() => {
            setPassData(prev => ({ ...prev, globalResult: 'end-of-play' }));
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
        required
      />
      
      <PlayerInput
        label="Assist Tackler (Optional)"
        value={passData.tackler2}
        onChange={(player) => setPassData(prev => ({ ...prev, tackler2: player }))}
        gameState={gameState}
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

import React, { useState, useEffect, useContext } from 'react';
import { GameStateContext } from './GameStateContext';
import PlayerInput from './PlayerInput';
import YardlineInput from './YardlineInput';
import PenaltyInputModal from './components/PenaltyInputModal';

const RushInputFlow = ({ onComplete, onCancel, gameState }) => {
  const { submitPlay } = useContext(GameStateContext);
  
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

  const [currentStep, setCurrentStep] = useState('rusher'); // rusher -> global-result -> result-details
  const [errors, setErrors] = useState({});
  const [penaltyQueued, setPenaltyQueued] = useState(false);
  const [showPenaltyModal, setShowPenaltyModal] = useState(false);
  const [heldPlayData, setHeldPlayData] = useState(null);

  // Handle keyboard shortcuts for global results (T, O, F, .) and penalty queuing (E)
  useEffect(() => {
    console.log('RushInputFlow: Setting up keyboard event listener');
    
    const handleKeyPress = (e) => {
      console.log('RushInputFlow: Key pressed:', e.key, 'Current step:', currentStep);
      
      // Handle penalty queuing with 'E' key - available at any time during play input
      if (e.key.toLowerCase() === 'e') {
        e.preventDefault();
        console.log('E key pressed - toggling penalty queued');
        setPenaltyQueued(prev => {
          console.log('Previous penalty queued state:', prev);
          return !prev;
        });
        return;
      }

      if (currentStep === 'global-result') {
        switch (e.key.toLowerCase()) {
          case 't':
            setRushData(prev => ({ ...prev, globalResult: 'tackle' }));
            setCurrentStep('tackle-details');
            break;
          case 'o':
            setRushData(prev => ({ ...prev, globalResult: 'out-of-bounds' }));
            setCurrentStep('out-of-bounds-details');
            break;
          case 'f':
            setRushData(prev => ({ ...prev, globalResult: 'fumble' }));
            setCurrentStep('fumble-details');
            break;
          case '.':
            setRushData(prev => ({ ...prev, globalResult: 'end-of-play' }));
            setCurrentStep('end-of-play-details');
            break;
        }
      }
      
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    console.log('RushInputFlow: Adding keydown event listener');
    document.addEventListener('keydown', handleKeyPress);
    return () => {
      console.log('RushInputFlow: Removing keydown event listener');
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [currentStep, onCancel]);

  const validateStep = (step) => {
    const newErrors = {};
    
    switch (step) {
      case 'rusher':
        if (!rushData.rusher) {
          newErrors.rusher = 'Rusher selection is required';
        }
        break;
      case 'global-result':
        if (!rushData.globalResult) {
          newErrors.globalResult = 'Result selection is required';
        }
        break;
      case 'tackle-details':
        if (!rushData.tackler1) {
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
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (!validateStep(currentStep)) return;
    
    switch (currentStep) {
      case 'rusher':
        setCurrentStep('global-result');
        break;
      case 'global-result':
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
      playType: 'rush',
      rusher: rushData.rusher,
      miscFumble: rushData.miscFumble,
      globalResult: rushData.globalResult,
      tackler1: rushData.tackler1,
      tackler2: rushData.tackler2,
      finalYardLine: rushData.finalYardLine,
      forcedBy: rushData.forcedBy,
      recoveringTeam: rushData.recoveringTeam,
      recoveringPlayer: rushData.recoveringPlayer,
      recoverySpot: rushData.recoverySpot,
      penaltyQueued: penaltyQueued // Add penalty status to play data
    };

    try {
      // If penalty is queued, hold play data and start penalty flow
      if (penaltyQueued) {
        setHeldPlayData(playData);
        setShowPenaltyModal(true);
        return;
      }

      // Normal play submission if no penalty queued
      await submitPlay(playData);
      onComplete(playData);
    } catch (error) {
      console.error('Error submitting rush play:', error);
      setErrors({ submit: 'Error submitting play. Please try again.' });
    }
  };

  const handlePenaltySubmit = async (penaltyData) => {
    try {
      // Submit play with penalty data
      const playData = {
        playType: 'rush',
        rusher: rushData.rusher,
        miscFumble: rushData.miscFumble,
        globalResult: rushData.globalResult,
        tackler1: rushData.tackler1,
        tackler2: rushData.tackler2,
        finalYardLine: rushData.finalYardLine,
        forcedBy: rushData.forcedBy,
        recoveringTeam: rushData.recoveringTeam,
        recoveringPlayer: rushData.recoveringPlayer,
        recoverySpot: rushData.recoverySpot,
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

  const renderRusherStep = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Rush Play - Select Rusher</h3>
      
      <PlayerInput
        label="Rusher"
        value={rushData.rusher}
        onChange={(player) => setRushData(prev => ({ ...prev, rusher: player }))}
        error={errors.rusher}
        gameState={gameState}
        required
      />
      
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
          onClick={handleNext}
          disabled={!rushData.rusher}
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

  const renderGlobalResultStep = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Rush Play - Select Result</h3>
      
      <div className="text-sm text-gray-600 mb-4">
        Use keyboard shortcuts or click buttons:
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => {
            setRushData(prev => ({ ...prev, globalResult: 'tackle' }));
            setCurrentStep('tackle-details');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">T - Tackle</div>
          <div className="text-sm text-gray-600">Player tackled at spot</div>
        </button>
        
        <button
          onClick={() => {
            setRushData(prev => ({ ...prev, globalResult: 'out-of-bounds' }));
            setCurrentStep('out-of-bounds-details');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">O - Out of Bounds</div>
          <div className="text-sm text-gray-600">Player went out of bounds</div>
        </button>
        
        <button
          onClick={() => {
            setRushData(prev => ({ ...prev, globalResult: 'fumble' }));
            setCurrentStep('fumble-details');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">F - Fumble</div>
          <div className="text-sm text-gray-600">Ball was fumbled during play</div>
        </button>
        
        <button
          onClick={() => {
            setRushData(prev => ({ ...prev, globalResult: 'end-of-play' }));
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

  const renderTackleDetails = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Rush Play - Tackle Details</h3>
      
      <PlayerInput
        label="Primary Tackler"
        value={rushData.tackler1}
        onChange={(player) => setRushData(prev => ({ ...prev, tackler1: player }))}
        error={errors.tackler1}
        gameState={gameState}
        required
      />
      
      <PlayerInput
        label="Assist Tackler (Optional)"
        value={rushData.tackler2}
        onChange={(player) => setRushData(prev => ({ ...prev, tackler2: player }))}
        gameState={gameState}
      />
      
      <YardlineInput
        label="Final Yard Line (where tackled)"
        value={rushData.finalYardLine}
        onChange={(yardLine) => setRushData(prev => ({ ...prev, finalYardLine: yardLine }))}
        error={errors.finalYardLine}
        gameState={gameState}
        required
      />
      
      <div className="flex space-x-2">
        <button
          onClick={handleSubmit}
          disabled={!rushData.tackler1 || !rushData.finalYardLine}
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

  const renderOutOfBoundsDetails = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Rush Play - Out of Bounds Details</h3>
      
      <PlayerInput
        label="Tackler (Optional - if forced out)"
        value={rushData.tackler1}
        onChange={(player) => setRushData(prev => ({ ...prev, tackler1: player }))}
        gameState={gameState}
      />
      
      <YardlineInput
        label="Final Yard Line (where went out of bounds)"
        value={rushData.finalYardLine}
        onChange={(yardLine) => setRushData(prev => ({ ...prev, finalYardLine: yardLine }))}
        error={errors.finalYardLine}
        gameState={gameState}
        required
      />
      
      <div className="flex space-x-2">
        <button
          onClick={handleSubmit}
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
          onClick={handleSubmit}
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
          onClick={handleSubmit}
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

export default RushInputFlow;

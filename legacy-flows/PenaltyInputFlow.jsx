import React, { useState, useEffect, useContext } from 'react';
import { GameStateContext } from './GameStateContext';
import PlayerInput from './PlayerInput';
import YardlineInput from './YardlineInput';

const PenaltyInputFlow = ({ onComplete, onCancel, gameState }) => {
  const { submitPlay } = useContext(GameStateContext);
  
  const [penaltyData, setPenaltyData] = useState({
    penaltyType: '',
    penaltyPlayer: null,
    penaltyTeam: null, // 'home', 'visitor'
    penaltyYards: 5,
    enforcement: null, // 'accepted', 'declined', 'offset'
    enforcementSpot: '',
    automaticFirstDown: false,
    lossOfDown: false,
    halfDistance: false,
    safetyEnforcement: false,
    penaltyDescription: '',
    offsettingPenalty: null,
    offsettingPlayer: null,
    offsettingTeam: null
  });

  const [currentStep, setCurrentStep] = useState('penalty-type'); // penalty-type -> penalty-details -> enforcement
  const [errors, setErrors] = useState({});

  // Common penalty types with default yards
  const commonPenalties = [
    { name: 'False Start', yards: 5, lossOfDown: false, autoFirst: false },
    { name: 'Offside', yards: 5, lossOfDown: false, autoFirst: false },
    { name: 'Holding', yards: 10, lossOfDown: false, autoFirst: false },
    { name: 'Pass Interference', yards: 15, lossOfDown: false, autoFirst: true },
    { name: 'Facemask', yards: 15, lossOfDown: false, autoFirst: true },
    { name: 'Unsportsmanlike Conduct', yards: 15, lossOfDown: false, autoFirst: true },
    { name: 'Roughing the Passer', yards: 15, lossOfDown: false, autoFirst: true },
    { name: 'Intentional Grounding', yards: 10, lossOfDown: true, autoFirst: false },
    { name: 'Delay of Game', yards: 5, lossOfDown: false, autoFirst: false },
    { name: 'Illegal Formation', yards: 5, lossOfDown: false, autoFirst: false },
    { name: 'Illegal Procedure', yards: 5, lossOfDown: false, autoFirst: false },
    { name: 'Encroachment', yards: 5, lossOfDown: false, autoFirst: false },
    { name: 'Roughing the Kicker', yards: 15, lossOfDown: false, autoFirst: true },
    { name: 'Clipping', yards: 15, lossOfDown: false, autoFirst: false },
    { name: 'Block in the Back', yards: 10, lossOfDown: false, autoFirst: false },
    { name: 'Illegal Block Above Waist', yards: 15, lossOfDown: false, autoFirst: false },
    { name: 'Targeting', yards: 15, lossOfDown: false, autoFirst: true },
    { name: 'Personal Foul', yards: 15, lossOfDown: false, autoFirst: true }
  ];

  // Handle keyboard shortcuts for enforcement (A, D, O)
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (currentStep === 'enforcement') {
        switch (e.key.toLowerCase()) {
          case 'a':
            setPenaltyData(prev => ({ ...prev, enforcement: 'accepted' }));
            setCurrentStep('enforcement-details');
            break;
          case 'd':
            setPenaltyData(prev => ({ ...prev, enforcement: 'declined' }));
            setCurrentStep('enforcement-details');
            break;
          case 'o':
            setPenaltyData(prev => ({ ...prev, enforcement: 'offset' }));
            setCurrentStep('offsetting-details');
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
      case 'penalty-type':
        if (!penaltyData.penaltyType) {
          newErrors.penaltyType = 'Penalty type is required';
        }
        break;
      case 'penalty-details':
        if (!penaltyData.penaltyPlayer) {
          newErrors.penaltyPlayer = 'Penalty player is required';
        }
        if (!penaltyData.penaltyTeam) {
          newErrors.penaltyTeam = 'Penalty team is required';
        }
        if (!penaltyData.penaltyYards || penaltyData.penaltyYards <= 0) {
          newErrors.penaltyYards = 'Penalty yards must be greater than 0';
        }
        break;
      case 'enforcement':
        if (!penaltyData.enforcement) {
          newErrors.enforcement = 'Enforcement decision is required';
        }
        break;
      case 'enforcement-details':
        if (penaltyData.enforcement === 'accepted' && !penaltyData.enforcementSpot) {
          newErrors.enforcementSpot = 'Enforcement spot is required';
        }
        break;
      case 'offsetting-details':
        if (!penaltyData.offsettingPenalty) {
          newErrors.offsettingPenalty = 'Offsetting penalty type is required';
        }
        if (!penaltyData.offsettingPlayer) {
          newErrors.offsettingPlayer = 'Offsetting penalty player is required';
        }
        if (!penaltyData.offsettingTeam) {
          newErrors.offsettingTeam = 'Offsetting penalty team is required';
        }
        break;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (!validateStep(currentStep)) return;
    
    switch (currentStep) {
      case 'penalty-type':
        setCurrentStep('penalty-details');
        break;
      case 'penalty-details':
        setCurrentStep('enforcement');
        break;
      case 'enforcement':
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
      playType: 'penalty',
      penaltyType: penaltyData.penaltyType,
      penaltyPlayer: penaltyData.penaltyPlayer,
      penaltyTeam: penaltyData.penaltyTeam,
      penaltyYards: penaltyData.penaltyYards,
      enforcement: penaltyData.enforcement,
      enforcementSpot: penaltyData.enforcementSpot,
      automaticFirstDown: penaltyData.automaticFirstDown,
      lossOfDown: penaltyData.lossOfDown,
      halfDistance: penaltyData.halfDistance,
      safetyEnforcement: penaltyData.safetyEnforcement,
      penaltyDescription: penaltyData.penaltyDescription,
      offsettingPenalty: penaltyData.offsettingPenalty,
      offsettingPlayer: penaltyData.offsettingPlayer,
      offsettingTeam: penaltyData.offsettingTeam
    };

    try {
      await submitPlay(playData);
      onComplete(playData);
    } catch (error) {
      console.error('Error submitting penalty:', error);
      setErrors({ submit: 'Error submitting penalty. Please try again.' });
    }
  };

  const handlePenaltySelect = (penalty) => {
    setPenaltyData(prev => ({
      ...prev,
      penaltyType: penalty.name,
      penaltyYards: penalty.yards,
      automaticFirstDown: penalty.autoFirst,
      lossOfDown: penalty.lossOfDown
    }));
  };

  const renderPenaltyTypeStep = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Penalty - Select Type</h3>
      
      <div className="space-y-2">
        <label className="block font-bold">Common Penalties</label>
        <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
          {commonPenalties.map(penalty => (
            <button
              key={penalty.name}
              onClick={() => handlePenaltySelect(penalty)}
              className={`p-2 text-left border rounded hover:border-blue-500 focus:border-blue-500 ${
                penaltyData.penaltyType === penalty.name ? 'bg-blue-100 border-blue-500' : 'border-gray-300'
              }`}
            >
              <div className="font-medium text-sm">{penalty.name}</div>
              <div className="text-xs text-gray-600">{penalty.yards} yards</div>
            </button>
          ))}
        </div>
      </div>
      
      <div className="space-y-2">
        <label className="block font-bold">Custom Penalty</label>
        <input
          type="text"
          placeholder="Enter custom penalty type"
          value={penaltyData.penaltyType}
          onChange={(e) => setPenaltyData(prev => ({ ...prev, penaltyType: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded focus:border-blue-500"
        />
        {errors.penaltyType && <div className="text-red-500 text-sm">{errors.penaltyType}</div>}
      </div>
      
      <div className="flex space-x-2">
        <button
          onClick={handleNext}
          disabled={!penaltyData.penaltyType}
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

  const renderPenaltyDetailsStep = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Penalty Details - {penaltyData.penaltyType}</h3>
      
      <PlayerInput
        label="Player Who Committed Penalty"
        value={penaltyData.penaltyPlayer}
        onChange={(player) => setPenaltyData(prev => ({ ...prev, penaltyPlayer: player }))}
        error={errors.penaltyPlayer}
        gameState={gameState}
        required
      />
      
      <div className="space-y-2">
        <label className="block font-bold">Penalty Team</label>
        <div className="flex space-x-4">
          <button
            onClick={() => setPenaltyData(prev => ({ ...prev, penaltyTeam: 'home' }))}
            className={`px-4 py-2 rounded ${penaltyData.penaltyTeam === 'home' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            Home
          </button>
          <button
            onClick={() => setPenaltyData(prev => ({ ...prev, penaltyTeam: 'visitor' }))}
            className={`px-4 py-2 rounded ${penaltyData.penaltyTeam === 'visitor' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            Visitor
          </button>
        </div>
        {errors.penaltyTeam && <div className="text-red-500 text-sm">{errors.penaltyTeam}</div>}
      </div>
      
      <div className="space-y-2">
        <label className="block font-bold">Penalty Yards</label>
        <input
          type="number"
          min="1"
          max="50"
          value={penaltyData.penaltyYards}
          onChange={(e) => setPenaltyData(prev => ({ ...prev, penaltyYards: parseInt(e.target.value) }))}
          className="w-32 px-3 py-2 border border-gray-300 rounded focus:border-blue-500"
        />
        {errors.penaltyYards && <div className="text-red-500 text-sm">{errors.penaltyYards}</div>}
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="automaticFirstDown"
            checked={penaltyData.automaticFirstDown}
            onChange={(e) => setPenaltyData(prev => ({ ...prev, automaticFirstDown: e.target.checked }))}
            className="h-4 w-4"
          />
          <label htmlFor="automaticFirstDown" className="text-sm">
            Automatic First Down
          </label>
        </div>
        
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="lossOfDown"
            checked={penaltyData.lossOfDown}
            onChange={(e) => setPenaltyData(prev => ({ ...prev, lossOfDown: e.target.checked }))}
            className="h-4 w-4"
          />
          <label htmlFor="lossOfDown" className="text-sm">
            Loss of Down
          </label>
        </div>
      </div>
      
      <div className="space-y-2">
        <label className="block font-bold">Description (Optional)</label>
        <textarea
          placeholder="Additional penalty details"
          value={penaltyData.penaltyDescription}
          onChange={(e) => setPenaltyData(prev => ({ ...prev, penaltyDescription: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded focus:border-blue-500"
          rows="2"
        />
      </div>
      
      <div className="flex space-x-2">
        <button
          onClick={handleNext}
          disabled={!penaltyData.penaltyPlayer || !penaltyData.penaltyTeam}
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-400"
        >
          Next
        </button>
        <button
          onClick={() => setCurrentStep('penalty-type')}
          className="px-4 py-2 bg-gray-500 text-white rounded"
        >
          Back
        </button>
      </div>
    </div>
  );

  const renderEnforcementStep = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Penalty Enforcement</h3>
      
      <div className="text-sm text-gray-600 mb-4">
        Use keyboard shortcuts or click buttons:
      </div>
      
      <div className="grid grid-cols-1 gap-4">
        <button
          onClick={() => {
            setPenaltyData(prev => ({ ...prev, enforcement: 'accepted' }));
            setCurrentStep('enforcement-details');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">A - Accepted</div>
          <div className="text-sm text-gray-600">Penalty is enforced</div>
        </button>
        
        <button
          onClick={() => {
            setPenaltyData(prev => ({ ...prev, enforcement: 'declined' }));
            setCurrentStep('enforcement-details');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">D - Declined</div>
          <div className="text-sm text-gray-600">Penalty is declined, play result stands</div>
        </button>
        
        <button
          onClick={() => {
            setPenaltyData(prev => ({ ...prev, enforcement: 'offset' }));
            setCurrentStep('offsetting-details');
          }}
          className="p-4 border-2 border-gray-300 rounded hover:border-blue-500 focus:border-blue-500"
        >
          <div className="font-bold">O - Offsetting</div>
          <div className="text-sm text-gray-600">Penalties offset each other</div>
        </button>
      </div>
      
      <button
        onClick={() => setCurrentStep('penalty-details')}
        className="px-4 py-2 bg-gray-500 text-white rounded"
      >
        Back
      </button>
    </div>
  );

  const renderEnforcementDetails = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">
        Penalty {penaltyData.enforcement === 'accepted' ? 'Accepted' : 'Declined'}
      </h3>
      
      {penaltyData.enforcement === 'accepted' && (
        <>
          <YardlineInput
            label="Enforcement Spot"
            value={penaltyData.enforcementSpot}
            onChange={(spot) => setPenaltyData(prev => ({ ...prev, enforcementSpot: spot }))}
            error={errors.enforcementSpot}
            gameState={gameState}
            required
          />
          
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="halfDistance"
                checked={penaltyData.halfDistance}
                onChange={(e) => setPenaltyData(prev => ({ ...prev, halfDistance: e.target.checked }))}
                className="h-4 w-4"
              />
              <label htmlFor="halfDistance" className="text-sm">
                Half the Distance to Goal
              </label>
            </div>
            
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="safetyEnforcement"
                checked={penaltyData.safetyEnforcement}
                onChange={(e) => setPenaltyData(prev => ({ ...prev, safetyEnforcement: e.target.checked }))}
                className="h-4 w-4"
              />
              <label htmlFor="safetyEnforcement" className="text-sm">
                Safety Enforcement
              </label>
            </div>
          </div>
          
          <div className="text-sm bg-blue-50 p-3 rounded">
            <div><strong>Penalty Summary:</strong></div>
            <div>{penaltyData.penaltyType} - {penaltyData.penaltyYards} yards</div>
            {penaltyData.automaticFirstDown && <div>Automatic First Down</div>}
            {penaltyData.lossOfDown && <div>Loss of Down</div>}
          </div>
        </>
      )}
      
      {penaltyData.enforcement === 'declined' && (
        <div className="text-sm bg-gray-50 p-3 rounded">
          <div><strong>Penalty Declined:</strong></div>
          <div>{penaltyData.penaltyType} - Play result stands</div>
        </div>
      )}
      
      <div className="flex space-x-2">
        <button
          onClick={handleSubmit}
          disabled={penaltyData.enforcement === 'accepted' && !penaltyData.enforcementSpot}
          className="px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-400"
        >
          Submit Penalty
        </button>
        <button
          onClick={() => setCurrentStep('enforcement')}
          className="px-4 py-2 bg-gray-500 text-white rounded"
        >
          Back
        </button>
      </div>
      
      {errors.submit && <div className="text-red-500 text-sm">{errors.submit}</div>}
    </div>
  );

  const renderOffsettingDetails = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Offsetting Penalties</h3>
      
      <div className="text-sm bg-orange-50 p-3 rounded mb-4">
        <div><strong>First Penalty:</strong></div>
        <div>{penaltyData.penaltyType} - {penaltyData.penaltyTeam === 'home' ? 'Home' : 'Visitor'}</div>
      </div>
      
      <div className="space-y-2">
        <label className="block font-bold">Offsetting Penalty Type</label>
        <input
          type="text"
          placeholder="Enter offsetting penalty type"
          value={penaltyData.offsettingPenalty}
          onChange={(e) => setPenaltyData(prev => ({ ...prev, offsettingPenalty: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded focus:border-blue-500"
        />
        {errors.offsettingPenalty && <div className="text-red-500 text-sm">{errors.offsettingPenalty}</div>}
      </div>
      
      <PlayerInput
        label="Offsetting Penalty Player"
        value={penaltyData.offsettingPlayer}
        onChange={(player) => setPenaltyData(prev => ({ ...prev, offsettingPlayer: player }))}
        error={errors.offsettingPlayer}
        gameState={gameState}
        required
      />
      
      <div className="space-y-2">
        <label className="block font-bold">Offsetting Penalty Team</label>
        <div className="flex space-x-4">
          <button
            onClick={() => setPenaltyData(prev => ({ ...prev, offsettingTeam: 'home' }))}
            className={`px-4 py-2 rounded ${penaltyData.offsettingTeam === 'home' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            Home
          </button>
          <button
            onClick={() => setPenaltyData(prev => ({ ...prev, offsettingTeam: 'visitor' }))}
            className={`px-4 py-2 rounded ${penaltyData.offsettingTeam === 'visitor' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            Visitor
          </button>
        </div>
        {errors.offsettingTeam && <div className="text-red-500 text-sm">{errors.offsettingTeam}</div>}
      </div>
      
      <div className="text-sm bg-gray-50 p-3 rounded">
        <div><strong>Offsetting Penalties:</strong></div>
        <div>Penalties cancel out - replay the down</div>
      </div>
      
      <div className="flex space-x-2">
        <button
          onClick={handleSubmit}
          disabled={!penaltyData.offsettingPenalty || !penaltyData.offsettingPlayer || !penaltyData.offsettingTeam}
          className="px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-400"
        >
          Submit Offsetting Penalties
        </button>
        <button
          onClick={() => setCurrentStep('enforcement')}
          className="px-4 py-2 bg-gray-500 text-white rounded"
        >
          Back
        </button>
      </div>
    </div>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'penalty-type':
        return renderPenaltyTypeStep();
      case 'penalty-details':
        return renderPenaltyDetailsStep();
      case 'enforcement':
        return renderEnforcementStep();
      case 'enforcement-details':
        return renderEnforcementDetails();
      case 'offsetting-details':
        return renderOffsettingDetails();
      default:
        return renderPenaltyTypeStep();
    }
  };

  return (
    <div className="p-6 bg-white border border-gray-300 rounded-lg shadow-lg max-w-2xl">
      {renderCurrentStep()}
    </div>
  );
};

export default PenaltyInputFlow;

import React, { useState, useEffect } from 'react';
import debug from '../utils/debug';

export default function PenaltyModal({ isOpen, onClose, onSubmit, gameState }) {
  const [step, setStep] = useState('select'); // 'select', 'team', 'result', 'enforcement', 'summary'
  const [penalties, setPenalties] = useState([]);
  const [selectedPenalty, setSelectedPenalty] = useState(null);
  const [penaltyTeam, setPenaltyTeam] = useState('');
  const [playerNumber, setPlayerNumber] = useState('');
  const [penaltyResult, setPenaltyResult] = useState(''); // A, D, O
  const [enforcementData, setEnforcementData] = useState({});
  const [additionalPenalties, setAdditionalPenalties] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Load penalty chart when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchPenalties();
      resetModal();
    }
  }, [isOpen]);

  const fetchPenalties = async () => {
    try {
      const response = await fetch('/strata_football/api/get_penalty_chart.php');
      const data = await response.json();
      if (data.success) {
        setPenalties(data.penalties);
      }
    } catch (error) {
      console.error('Error loading penalties:', error);
    }
  };

  const resetModal = () => {
    setStep('select');
    setSelectedPenalty(null);
    setPenaltyTeam('');
    setPlayerNumber('');
    setPenaltyResult('');
    setEnforcementData({});
    setAdditionalPenalties([]);
    setSearchTerm('');
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const handlePenaltySelect = (penalty) => {
    setSelectedPenalty(penalty);
    setStep('team');
  };

  const handleTeamAndNumber = () => {
    if (!penaltyTeam || !playerNumber) {
      alert('Please select team and enter player number');
      return;
    }
    setStep('result');
  };

  const handleResultSelect = (result) => {
    setPenaltyResult(result);
    if (result === 'A') {
      setStep('enforcement');
    } else if (result === 'D') {
      setStep('summary');
    } else if (result === 'O') {
      // Offsetting - would need another penalty
      setStep('summary');
    }
  };

  const handleEnforcementSubmit = (enforcement) => {
    setEnforcementData(enforcement);
    setStep('summary');
  };

  const handleFinalSubmit = () => {
    const penaltyData = {
      penalty: selectedPenalty,
      team: penaltyTeam,
      playerNumber,
      result: penaltyResult,
      enforcement: enforcementData,
      additionalPenalties
    };
    
    onSubmit(penaltyData);
    handleClose();
  };

  // Filter penalties based on search term
  const filteredPenalties = penalties.filter(penalty => 
    penalty.PenaltyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    penalty.PenaltyCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">
            {step === 'select' && 'Select Penalty'}
            {step === 'team' && 'Team & Player'}
            {step === 'result' && 'Penalty Result'}
            {step === 'enforcement' && 'Penalty Enforcement'}
            {step === 'summary' && 'Penalty Summary'}
          </h2>
          <button onClick={handleClose} className="text-gray-500 hover:text-gray-700 text-2xl">
            ×
          </button>
        </div>

        {step === 'select' && (
          <PenaltySelectStep
            penalties={filteredPenalties}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            onSelect={handlePenaltySelect}
          />
        )}

        {step === 'team' && (
          <TeamNumberStep
            penaltyTeam={penaltyTeam}
            playerNumber={playerNumber}
            onTeamChange={setPenaltyTeam}
            onNumberChange={setPlayerNumber}
            onNext={handleTeamAndNumber}
            onBack={() => setStep('select')}
            gameState={gameState}
            selectedPenalty={selectedPenalty}
          />
        )}

        {step === 'result' && (
          <ResultStep
            selectedPenalty={selectedPenalty}
            onResultSelect={handleResultSelect}
            onBack={() => setStep('team')}
          />
        )}

        {step === 'enforcement' && (
          <EnforcementStep
            penalty={selectedPenalty}
            onSubmit={handleEnforcementSubmit}
            onBack={() => setStep('result')}
            gameState={gameState}
          />
        )}

        {step === 'summary' && (
          <SummaryStep
            penalty={selectedPenalty}
            team={penaltyTeam}
            playerNumber={playerNumber}
            result={penaltyResult}
            enforcement={enforcementData}
            onSubmit={handleFinalSubmit}
            onAddAnother={() => setStep('select')}
            onBack={() => setStep(penaltyResult === 'A' ? 'enforcement' : 'result')}
          />
        )}
      </div>
    </div>
  );
}

// Step 1: Select Penalty
function PenaltySelectStep({ penalties, searchTerm, onSearchChange, onSelect }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">
          Search Penalties (by name or code):
        </label>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Enter penalty name or code (e.g., 'FS' for False Start)"
          className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
          autoFocus
        />
      </div>

      <div className="max-h-96 overflow-y-auto border border-gray-300 rounded">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left">Code</th>
              <th className="px-3 py-2 text-left">Penalty</th>
              <th className="px-3 py-2 text-center">NCAA Yards</th>
              <th className="px-3 py-2 text-center">NCAA Down</th>
              <th className="px-3 py-2 text-center">HS Yards</th>
              <th className="px-3 py-2 text-center">HS Down</th>
            </tr>
          </thead>
          <tbody>
            {penalties.map((penalty, index) => (
              <tr
                key={index}
                onClick={() => onSelect(penalty)}
                className="hover:bg-yellow-100 cursor-pointer border-b"
              >
                <td className="px-3 py-2 font-mono font-bold text-blue-600">
                  {penalty.PenaltyCode}
                </td>
                <td className="px-3 py-2">{penalty.PenaltyName}</td>
                <td className="px-3 py-2 text-center">{penalty.YardsNCAA}</td>
                <td className="px-3 py-2 text-center">{penalty.DownNCAA}</td>
                <td className="px-3 py-2 text-center">{penalty.YardsHS}</td>
                <td className="px-3 py-2 text-center">{penalty.DownHS}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {penalties.length === 0 && (
        <p className="text-gray-500 text-center py-4">No penalties found matching your search.</p>
      )}
    </div>
  );
}

// Step 2: Team & Player Number
function TeamNumberStep({ penaltyTeam, playerNumber, onTeamChange, onNumberChange, onNext, onBack, gameState, selectedPenalty }) {
  const isUnsportsmanlike = selectedPenalty?.PenaltyName?.includes('Unsportsmanlike Conduct');
  
  const validatePlayerNumber = (value) => {
    // Allow empty
    if (!value) return true;
    
    // Always allow TM (Team)
    if (value.toUpperCase() === 'TM') return true;
    
    // For Unsportsmanlike Conduct, allow HC, AC, BN
    if (isUnsportsmanlike && ['HC', 'AC', 'BN'].includes(value.toUpperCase())) {
      return true;
    }
    
    // Allow integers
    return /^\d+$/.test(value);
  };

  const handleNumberChange = (value) => {
    if (validatePlayerNumber(value)) {
      onNumberChange(value.toUpperCase());
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium mb-2">Penalized Team:</label>
        <div className="flex space-x-4">
          <button
            onClick={() => onTeamChange('HOME')}
            className={`px-4 py-2 rounded font-medium ${
              penaltyTeam === 'HOME'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {gameState?.game_info?.home_team_name || 'Home Team'}
          </button>
          <button
            onClick={() => onTeamChange('VISITOR')}
            className={`px-4 py-2 rounded font-medium ${
              penaltyTeam === 'VISITOR'
                ? 'bg-red-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {gameState?.game_info?.visitor_team_name || 'Visitor Team'}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Player Number:</label>
        <input
          type="text"
          value={playerNumber}
          onChange={(e) => handleNumberChange(e.target.value)}
          placeholder={isUnsportsmanlike ? "Number, TM, HC, AC, or BN" : "Number or TM"}
          className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
        />
        <div className="text-xs text-gray-600 mt-1">
          Valid: Jersey numbers, TM (Team)
          {isUnsportsmanlike && ', HC (Head Coach), AC (Assistant Coach), BN (Bench)'}
        </div>
      </div>

      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Back
        </button>
        <button
          onClick={onNext}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          disabled={!penaltyTeam || !playerNumber}
        >
          Next
        </button>
      </div>
    </div>
  );
}

// Step 3: Penalty Result
function ResultStep({ selectedPenalty, onResultSelect, onBack }) {
  return (
    <div className="space-y-6">
      <div className="bg-gray-100 p-4 rounded">
        <h3 className="font-medium text-lg">
          {selectedPenalty?.PenaltyName} ({selectedPenalty?.PenaltyCode})
        </h3>
        <p className="text-sm text-gray-600">
          NCAA: {selectedPenalty?.YardsNCAA} yards, {selectedPenalty?.DownNCAA} down | 
          HS: {selectedPenalty?.YardsHS} yards, {selectedPenalty?.DownHS} down
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-4">Penalty Result:</label>
        <div className="space-y-3">
          <button
            onClick={() => onResultSelect('A')}
            className="w-full text-left p-4 border-2 border-green-300 rounded hover:bg-green-50 focus:ring-2 focus:ring-green-500"
          >
            <div className="font-medium text-green-700">A - Accepted</div>
            <div className="text-sm text-gray-600">Penalty will be enforced</div>
          </button>
          
          <button
            onClick={() => onResultSelect('D')}
            className="w-full text-left p-4 border-2 border-red-300 rounded hover:bg-red-50 focus:ring-2 focus:ring-red-500"
          >
            <div className="font-medium text-red-700">D - Declined</div>
            <div className="text-sm text-gray-600">Penalty will not be enforced</div>
          </button>
          
          <button
            onClick={() => onResultSelect('O')}
            className="w-full text-left p-4 border-2 border-yellow-300 rounded hover:bg-yellow-50 focus:ring-2 focus:ring-yellow-500"
          >
            <div className="font-medium text-yellow-700">O - Offsetting</div>
            <div className="text-sm text-gray-600">Penalties offset (requires penalty from other team)</div>
          </button>
        </div>
      </div>

      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Back
        </button>
      </div>
    </div>
  );
}

// Step 4: Enforcement (only for accepted penalties)
function EnforcementStep({ penalty, onSubmit, onBack, gameState }) {
  const [enforcementMode, setEnforcementMode] = useState('');
  const [enforcedFrom, setEnforcedFrom] = useState('');
  const [finalSpot, setFinalSpot] = useState('');
  const [firstDownMode, setFirstDownMode] = useState('');
  const [ejected, setEjected] = useState(false);

  // Auto-determine ejection for targeting and set default first down mode
  useEffect(() => {
    if (penalty?.PenaltyName === 'Targeting') {
      setEjected(true);
    }
    
    // Set default first down mode from penalty chart
    if (penalty && !firstDownMode) {
      setFirstDownMode(penalty.DownNCAA || penalty.DownHS || 'NORM');
    }
  }, [penalty, firstDownMode]);

  // Auto-update enforcement spots based on enforcement mode
  useEffect(() => {
    if (enforcementMode && gameState?.live_state) {
      const currentSpot = gameState.live_state.yard_line_position || 'H35';
      const lastPlayEndSpot = gameState.recent_plays?.[0]?.ending_yard_line || currentSpot;
      
      if (enforcementMode === 'previous') {
        setEnforcedFrom(currentSpot);
      } else if (enforcementMode === 'succeeding') {
        setEnforcedFrom(lastPlayEndSpot);
      }
      // For 'foul', leave it empty for manual entry
    }
  }, [enforcementMode, gameState]);

  const handleSubmit = () => {
    if (!enforcementMode || !enforcedFrom || !finalSpot || !firstDownMode) {
      alert('Please fill in all enforcement details');
      return;
    }

    onSubmit({
      enforcementMode,
      enforcedFrom,
      finalSpot,
      firstDownMode,
      ejected
    });
  };

  const isPersonalFoul = penalty?.PenaltyName?.includes('Personal Foul') || 
                        penalty?.PenaltyName?.includes('Unsportsmanlike Conduct');

  return (
    <div className="space-y-6">
      <div className="bg-gray-100 p-4 rounded">
        <h3 className="font-medium text-lg">
          {penalty?.PenaltyName} ({penalty?.PenaltyCode}) - ACCEPTED
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium mb-2">Enforcement Mode:</label>
          <select
            value={enforcementMode}
            onChange={(e) => setEnforcementMode(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select enforcement mode</option>
            <option value="previous">Previous Spot</option>
            <option value="foul">Spot of Foul</option>
            <option value="succeeding">Succeeding Spot</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">First Down Mode:</label>
          <select
            value={firstDownMode}
            onChange={(e) => setFirstDownMode(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
          >
            <option value="NORM">Normal</option>
            <option value="AUTO">Automatic 1st Down</option>
            <option value="LOSS">Loss of Down</option>
          </select>
          <div className="text-xs text-gray-600 mt-1">
            Default from penalty chart: {penalty?.DownNCAA || penalty?.DownHS || 'NORM'}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Enforced From Spot:</label>
          <input
            type="text"
            value={enforcedFrom}
            onChange={(e) => setEnforcedFrom(e.target.value)}
            placeholder="e.g., H35, V22"
            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
          />
          <div className="text-xs text-gray-600 mt-1">
            Auto-filled based on enforcement mode
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Final Spot:</label>
          <input
            type="text"
            value={finalSpot}
            onChange={(e) => setFinalSpot(e.target.value)}
            placeholder="e.g., H25, V35"
            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {(isPersonalFoul || penalty?.PenaltyName === 'Targeting') && (
        <div className="bg-yellow-100 border border-yellow-400 rounded p-4">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={ejected}
              onChange={(e) => setEjected(e.target.checked)}
              disabled={penalty?.PenaltyName === 'Targeting'} // Auto-checked for targeting
              className="rounded"
            />
            <span className="text-sm font-medium">
              {penalty?.PenaltyName === 'Targeting' 
                ? 'Player automatically ejected (Targeting)'
                : 'Player ejected'
              }
            </span>
          </label>
        </div>
      )}

      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Back
        </button>
        <button
          onClick={handleSubmit}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          Apply Penalty
        </button>
      </div>
    </div>
  );
}

// Step 5: Summary
function SummaryStep({ penalty, team, playerNumber, result, enforcement, onSubmit, onAddAnother, onBack }) {
  const resultText = {
    'A': 'Accepted',
    'D': 'Declined', 
    'O': 'Offsetting'
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium">Penalty Summary</h3>

      <div className="bg-gray-100 p-4 rounded space-y-2">
        <div><strong>Penalty:</strong> {penalty?.PenaltyName} ({penalty?.PenaltyCode})</div>
        <div><strong>Team:</strong> {team}</div>
        <div><strong>Player #:</strong> {playerNumber}</div>
        <div><strong>Result:</strong> {resultText[result]}</div>
        
        {result === 'A' && enforcement && (
          <div className="mt-4 border-t pt-2">
            <div><strong>Enforcement Mode:</strong> {enforcement.enforcementMode}</div>
            <div><strong>Enforced From:</strong> {enforcement.enforcedFrom}</div>
            <div><strong>Final Spot:</strong> {enforcement.finalSpot}</div>
            <div><strong>First Down:</strong> {enforcement.firstDownMode}</div>
            {enforcement.ejected && (
              <div className="text-red-600"><strong>Player Ejected</strong></div>
            )}
          </div>
        )}
      </div>

      <div className="border-t pt-4">
        <p className="text-sm text-gray-600 mb-4">
          Are there additional penalties on this play?
        </p>
        
        <div className="flex justify-between">
          <button
            onClick={onBack}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Back
          </button>
          
          <div className="space-x-2">
            <button
              onClick={onAddAnother}
              className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
            >
              Add Another Penalty
            </button>
            <button
              onClick={onSubmit}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Complete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

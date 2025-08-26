import React, { useState, useEffect, useRef } from 'react';
import debug from '../utils/debug';

const PenaltyInputModal = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  heldPlayData, 
  gameState 
}) => {
  const [penalties, setPenalties] = useState([]);
  const [penaltyChart, setPenaltyChart] = useState([]);
  const [showPenaltyChart, setShowPenaltyChart] = useState(false);
  const [currentPenalty, setCurrentPenalty] = useState({
    penaltyName: '',
    penaltyTeam: 'HOME', // HOME or VISITOR
    playerNumber: '',
    enforcementType: 'PREVIOUS_SPOT', // PREVIOUS_SPOT, SPOT_OF_FOUL, SUCCEEDING_SPOT
    spotOfFoul: '',
    isDeclined: false,
    isOffsetting: false,
    customYards: null,
    customDown: null
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Ref for first input field
  const firstInputRef = useRef(null);

  // Load penalty chart data when modal opens
  useEffect(() => {
    debug.log('[PENALTY MODAL] mounted/opened; current finalYardLine =', heldPlayData?.finalYardLine);
    if (isOpen) {
      loadPenaltyChart();
      // Focus on first input field when modal opens
      setTimeout(() => {
        if (firstInputRef.current) {
          firstInputRef.current.focus();
        }
      }, 100);
    }
    return () => debug.log('[PENALTY MODAL] unmounted/closed; finalYardLine =', heldPlayData?.finalYardLine);
  }, [isOpen]);

  // Handle Enter key press
  useEffect(() => {
    const handleKeyPress = (event) => {
      if (event.key === 'Enter' && isOpen) {
        event.preventDefault();
        
        if (showPenaltyChart) {
          // If penalty chart is open, close it
          setShowPenaltyChart(false);
        } else if (penalties.length > 0) {
          // If penalties are added, submit them
          handleSubmit();
        } else {
          // If no penalties added yet, try to add current penalty
          addPenalty();
        }
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyPress);
      return () => document.removeEventListener('keydown', handleKeyPress);
    }
  }, [isOpen, showPenaltyChart, penalties.length, currentPenalty]);

  const loadPenaltyChart = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/strata_football/api/get_penalty_chart.php');
      const data = await response.json();
      
      if (data.success) {
        // Sort alphabetically by PenaltyName
        const sortedPenalties = data.penalties.sort((a, b) => 
          a.PenaltyName.localeCompare(b.PenaltyName)
        );
        setPenaltyChart(sortedPenalties);
      } else {
        console.error('Failed to load penalty chart:', data.error);
        setErrors({ chart: 'Failed to load penalty chart' });
      }
    } catch (error) {
      console.error('Error loading penalty chart:', error);
      setErrors({ chart: 'Error loading penalty chart' });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePenaltySelect = (penalty) => {
    // Determine rule set (assume NCAA for now - could be dynamic based on game settings)
    const ruleSet = 'NCAA';
    const yards = ruleSet === 'NCAA' ? penalty.YardsNCAA : penalty.YardsHS;
    const downEffect = ruleSet === 'NCAA' ? penalty.DownNCAA : penalty.DownHS;

    setCurrentPenalty(prev => ({
      ...prev,
      penaltyName: penalty.PenaltyName,
      customYards: yards,
      customDown: downEffect
    }));
    setShowPenaltyChart(false);
  };

  const addPenalty = () => {
    if (!validateCurrentPenalty()) return;

    setPenalties(prev => [...prev, { ...currentPenalty, id: Date.now() }]);
    
    // Reset current penalty form
    setCurrentPenalty({
      penaltyName: '',
      penaltyTeam: 'HOME',
      playerNumber: '',
      enforcementType: 'PREVIOUS_SPOT',
      spotOfFoul: '',
      isDeclined: false,
      isOffsetting: false,
      customYards: null,
      customDown: null
    });
    setErrors({});
  };

  const removePenalty = (penaltyId) => {
    setPenalties(prev => prev.filter(p => p.id !== penaltyId));
  };

  const validateCurrentPenalty = () => {
    const newErrors = {};
    
    if (!currentPenalty.penaltyName.trim()) {
      newErrors.penaltyName = 'Penalty selection is required';
    }
    
    if (currentPenalty.enforcementType === 'SPOT_OF_FOUL' && !currentPenalty.spotOfFoul.trim()) {
      newErrors.spotOfFoul = 'Spot of foul is required for this enforcement type';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (penalties.length === 0) {
      setErrors({ submit: 'At least one penalty must be added' });
      return;
    }

    // Prepare penalty data for processing
    const penaltyData = {
      heldPlayData,
      penalties,
      gameState
    };

    onSubmit(penaltyData);
  };

  const handleDecline = () => {
    debug.log('[PENALTY MODAL] cancel/no penalty; finalYardLine BEFORE =', heldPlayData?.finalYardLine);
    // Decline all penalties - submit original play without modifications
    // DO NOT touch finalYardLine here
    onSubmit({ heldPlayData, penalties: [], declined: true });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Penalty Input</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Held Play Information */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2">Play Being Modified:</h3>
            <p className="text-blue-800">
              {heldPlayData?.playType?.toUpperCase()} play - {heldPlayData?.globalResult || 'In progress'}
            </p>
          </div>

          {/* Current Penalty Form */}
          <div className="mb-6 p-4 border border-gray-200 rounded-lg">
            <h3 className="font-semibold mb-4">Add Penalty</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Penalty Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Penalty
                </label>
                <div className="flex space-x-2">
                  <input
                    ref={firstInputRef}
                    type="text"
                    value={currentPenalty.penaltyName}
                    onChange={(e) => setCurrentPenalty(prev => ({ ...prev, penaltyName: e.target.value }))}
                    placeholder="Type penalty name or use chart"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={() => setShowPenaltyChart(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Chart
                  </button>
                </div>
                {errors.penaltyName && <p className="text-red-500 text-sm mt-1">{errors.penaltyName}</p>}
              </div>

              {/* Team */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Team
                </label>
                <select
                  value={currentPenalty.penaltyTeam}
                  onChange={(e) => setCurrentPenalty(prev => ({ ...prev, penaltyTeam: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="HOME">Home</option>
                  <option value="VISITOR">Visitor</option>
                </select>
              </div>

              {/* Player Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Player Number (Optional)
                </label>
                <input
                  type="number"
                  value={currentPenalty.playerNumber}
                  onChange={(e) => setCurrentPenalty(prev => ({ ...prev, playerNumber: e.target.value }))}
                  placeholder="Enter player number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Enforcement Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enforcement
                </label>
                <select
                  value={currentPenalty.enforcementType}
                  onChange={(e) => setCurrentPenalty(prev => ({ ...prev, enforcementType: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="PREVIOUS_SPOT">Previous Spot (Negates Play)</option>
                  <option value="SPOT_OF_FOUL">Spot of Foul (Modifies Stats)</option>
                  <option value="SUCCEEDING_SPOT">Succeeding Spot (Play + Penalty)</option>
                </select>
              </div>

              {/* Spot of Foul (if needed) */}
              {currentPenalty.enforcementType === 'SPOT_OF_FOUL' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Spot of Foul
                  </label>
                  <input
                    type="text"
                    value={currentPenalty.spotOfFoul}
                    onChange={(e) => setCurrentPenalty(prev => ({ ...prev, spotOfFoul: e.target.value }))}
                    placeholder="e.g., H25, V30"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.spotOfFoul && <p className="text-red-500 text-sm mt-1">{errors.spotOfFoul}</p>}
                </div>
              )}

              {/* Custom Yards */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Penalty Yards
                </label>
                <input
                  type="number"
                  value={currentPenalty.customYards || ''}
                  onChange={(e) => setCurrentPenalty(prev => ({ ...prev, customYards: parseInt(e.target.value) || null }))}
                  placeholder="Auto-filled from chart"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Down Effect */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Down Effect
                </label>
                <select
                  value={currentPenalty.customDown || ''}
                  onChange={(e) => setCurrentPenalty(prev => ({ ...prev, customDown: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Auto-filled from chart</option>
                  <option value="NORM">Normal (repeat down)</option>
                  <option value="AUTO">Automatic First Down</option>
                  <option value="LOSS">Loss of Down</option>
                </select>
              </div>
            </div>

            {/* Options */}
            <div className="mt-4 flex space-x-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={currentPenalty.isOffsetting}
                  onChange={(e) => setCurrentPenalty(prev => ({ ...prev, isOffsetting: e.target.checked }))}
                  className="mr-2"
                />
                Offsetting Penalty
              </label>
            </div>

            {/* Add Penalty Button */}
            <div className="mt-4">
              <button
                onClick={addPenalty}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Add Penalty
              </button>
            </div>
          </div>

          {/* Added Penalties List */}
          {penalties.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold mb-3">Added Penalties</h3>
              <div className="space-y-2">
                {penalties.map((penalty) => (
                  <div key={penalty.id} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <div>
                      <span className="font-medium">{penalty.penaltyName}</span>
                      <span className="ml-2 text-gray-600">
                        ({penalty.penaltyTeam}, {penalty.customYards || 0} yards, {penalty.enforcementType})
                      </span>
                      {penalty.isOffsetting && <span className="ml-2 text-orange-600 font-medium">OFFSETTING</span>}
                    </div>
                    <button
                      onClick={() => removePenalty(penalty.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Submit Buttons */}
          <div className="flex space-x-3">
            <button
              onClick={handleSubmit}
              disabled={penalties.length === 0}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
            >
              Apply Penalties
            </button>
            <button
              onClick={handleDecline}
              className="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              Decline All Penalties
            </button>
            <button
              onClick={() => {
                debug.log('[PENALTY MODAL] cancel/no penalty; finalYardLine BEFORE =', heldPlayData?.finalYardLine);
                // DO NOT touch finalYardLine here
                onClose();
              }}
              className="px-6 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>

          {errors.submit && <p className="text-red-500 text-sm mt-2">{errors.submit}</p>}
        </div>

        {/* Penalty Chart Modal */}
        {showPenaltyChart && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
            <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full mx-4 max-h-[80vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold">Penalty Chart</h3>
                  <button
                    onClick={() => setShowPenaltyChart(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                {isLoading ? (
                  <div className="text-center py-4">Loading penalty chart...</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full bg-white border border-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-900 border-b">Penalty Name</th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-900 border-b">NCAA Yards</th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-900 border-b">NCAA Down</th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-900 border-b">HS Yards</th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-900 border-b">HS Down</th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-900 border-b">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {penaltyChart.map((penalty, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-2 text-sm text-gray-900 border-b">{penalty.PenaltyName}</td>
                            <td className="px-4 py-2 text-sm text-gray-900 border-b">{penalty.YardsNCAA}</td>
                            <td className="px-4 py-2 text-sm text-gray-900 border-b">{penalty.DownNCAA}</td>
                            <td className="px-4 py-2 text-sm text-gray-900 border-b">{penalty.YardsHS}</td>
                            <td className="px-4 py-2 text-sm text-gray-900 border-b">{penalty.DownHS}</td>
                            <td className="px-4 py-2 text-sm border-b">
                              <button
                                onClick={() => handlePenaltySelect(penalty)}
                                className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                              >
                                Select
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {errors.chart && <p className="text-red-500 text-sm mt-2">{errors.chart}</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PenaltyInputModal;

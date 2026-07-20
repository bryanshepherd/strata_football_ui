import React, { useState, useEffect } from 'react';
import type { Penalty, PenaltyDef, PenaltyResolutionMeta } from '../types/penalties';
import { 
  getAllPenalties, 
  getPenaltyDef, 
  isPenaltyTableLoaded,
  initPenaltyTable 
} from '../utils/penaltyTable';
import { SCORING_STRICTNESS } from '../config/ScoringPolicy';

interface PenaltiesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (penalties: Penalty[], resolution: PenaltyResolutionMeta) => void;
  initialPenalties?: Penalty[];
  playEndYardLine?: string;
  gameState?: any;
}

export default function PenaltiesModal({
  isOpen,
  onClose,
  onSave,
  initialPenalties = [],
  playEndYardLine = '',
  gameState
}: PenaltiesModalProps) {
  const [penalties, setPenalties] = useState<Penalty[]>(initialPenalties);
  const [penaltyTable, setPenaltyTable] = useState<PenaltyDef[]>([]);
  const [tableLoaded, setTableLoaded] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [suggestions, setSuggestions] = useState<any>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [showOverrideDialog, setShowOverrideDialog] = useState(false);
  
  useEffect(() => {
    // Initialize penalty table on mount
    initPenaltyTable();
    const loaded = isPenaltyTableLoaded();
    setTableLoaded(loaded);
    if (loaded) {
      setPenaltyTable(getAllPenalties());
    }
  }, []);
  
  useEffect(() => {
    // Initialize with at least one empty penalty row if none exist
    if (isOpen && penalties.length === 0) {
      addPenalty();
    }
  }, [isOpen]);
  
  const addPenalty = () => {
    const newPenalty: Penalty = {
      id: `penalty_${Date.now()}_${Math.random()}`,
      team: 'H',
      code: '',
      enforcedFrom: 'PREVIOUS',
      accepted: true,
      liveBall: true,
      automaticFirstDown: false,
      lossOfDown: false,
      notes: ''
    };
    setPenalties([...penalties, newPenalty]);
  };
  
  const removePenalty = (id: string) => {
    setPenalties(penalties.filter(p => p.id !== id));
  };
  
  const updatePenalty = (id: string, field: keyof Penalty, value: any) => {
    setPenalties(penalties.map(p => {
      if (p.id !== id) return p;
      
      const updated = { ...p, [field]: value };
      
      // Auto-fill from penalty table when code changes
      if (field === 'code' && value) {
        const def = getPenaltyDef(value);
        if (def) {
          updated.yards = def.yards;
          updated.liveBall = def.liveBall;
          updated.automaticFirstDown = def.automaticFirstDown;
          updated.lossOfDown = def.lossOfDown;
          updated.enforcedFrom = def.defaultEnforcement;
        }
      }
      
      return updated;
    }));
    
    // Clear error for this field
    setErrors({ ...errors, [`${id}_${field}`]: '' });
  };
  
  const validatePenalties = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    // TECHNICAL REQUIREMENT: Penalty table must be loaded
    if (!tableLoaded) {
      newErrors.general = 'TECHNICAL ERROR: Penalty table not loaded; cannot save penalties.';
      setErrors(newErrors);
      return false;
    }
    
    // TECHNICAL REQUIREMENT: Play end yard line must be in valid format and range
    if (!playEndYardLine || playEndYardLine.trim() === '') {
      newErrors.endYardLine = 'TECHNICAL REQUIREMENT: Play end yard line is required';
    } else if (!/^(H|V)\d{2}$|^50$/.test(playEndYardLine.trim())) {
      newErrors.endYardLine = 'TECHNICAL REQUIREMENT: Yard line must be in format H##, V##, or 50';
    } else if (playEndYardLine !== '50') {
      // Validate range: H00-H50, V00-V50
      const yardNum = parseInt(playEndYardLine.substring(1));
      if (yardNum > 50) {
        newErrors.endYardLine = 'TECHNICAL REQUIREMENT: Yard line cannot exceed 50 (use H00-H50, V00-V50, or 50)';
      }
    }
    
    // TECHNICAL REQUIREMENTS for each penalty - these are mandatory for system to process
    penalties.forEach((penalty, index) => {
      // Team is required - system needs to know which team committed penalty
      if (!penalty.team || !['H', 'V'].includes(penalty.team)) {
        newErrors[`${penalty.id}_team`] = 'TECHNICAL REQUIREMENT: Valid team (H or V) is required';
      }
      
      // Code is required - system needs to know what penalty was committed
      if (!penalty.code || penalty.code.trim() === '') {
        newErrors[`${penalty.id}_code`] = 'TECHNICAL REQUIREMENT: Penalty code is required';
      }
      
      // Enforcement point is required - system needs to know where to enforce
      if (!penalty.enforcedFrom) {
        newErrors[`${penalty.id}_enforcedFrom`] = 'TECHNICAL REQUIREMENT: Enforcement point is required';
      }
      
      // Accepted/Declined is required - system needs to know if penalty should be enforced
      if (penalty.accepted === undefined || penalty.accepted === null) {
        newErrors[`${penalty.id}_accepted`] = 'TECHNICAL REQUIREMENT: Must specify Accepted or Declined';
      }
      
      // Code-specific technical requirements
      const def = getPenaltyDef(penalty.code);
      if (def && penalty.code) {
        if (def.requiresYards && (!penalty.yards || penalty.yards <= 0)) {
          newErrors[`${penalty.id}_yards`] = `TECHNICAL REQUIREMENT: ${penalty.code} requires yardage`;
        }
        if (def.requiresSpot && (!penalty.spot || penalty.spot.trim() === '')) {
          newErrors[`${penalty.id}_spot`] = `TECHNICAL REQUIREMENT: ${penalty.code} requires spot (H##/V##/50 format)`;
        }
        // Validate spot format and range if provided
        if (penalty.spot) {
          if (!/^(H|V)\d{2}$|^50$/.test(penalty.spot.trim())) {
            newErrors[`${penalty.id}_spot`] = 'TECHNICAL REQUIREMENT: Spot must be H##, V##, or 50 format';
          } else if (penalty.spot.trim() !== '50') {
            // Validate range: H00-H50, V00-V50
            const yardNum = parseInt(penalty.spot.substring(1));
            if (yardNum > 50) {
              newErrors[`${penalty.id}_spot`] = 'TECHNICAL REQUIREMENT: Spot cannot exceed 50 (use H00-H50, V00-V50, or 50)';
            }
          }
        }
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSave = (applyingSuggestions: boolean = false) => {
    // ALWAYS require technical validation - cannot save without required fields
    if (!validatePenalties()) {
      return;
    }
    
    const resolution: PenaltyResolutionMeta = {
      mode: SCORING_STRICTNESS,
      analysis: suggestions,
      userOverride: applyingSuggestions ? undefined : {
        applied: true,
        reason: overrideReason || 'User chose to save as-is'
      }
    };
    
    onSave(penalties, resolution);
    onClose();
  };
  
  const handleSaveAsIs = () => {
    // Technical validation is ALWAYS required, even for Save As-Is
    if (!validatePenalties()) {
      return;
    }
    
    if (SCORING_STRICTNESS === 'assisted' && suggestions && !overrideReason) {
      setShowOverrideDialog(true);
      return;
    }
    handleSave(false);
  };
  
  const handleApplySuggestions = () => {
    // TODO: Apply suggestions to penalties and game state
    // For now, just save with flag indicating suggestions were applied
    handleSave(true);
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-6xl w-full max-h-[90vh] flex">
        {/* Main content area */}
        <div className="flex-1 p-6 overflow-y-auto">
          <h2 className="text-xl font-bold mb-4">Penalties Entry</h2>
          
          {/* Error banner if penalty table not loaded */}
          {!tableLoaded && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              <strong>Warning:</strong> Penalty table not loaded; cannot save penalties yet.
            </div>
          )}
          
          {/* General errors */}
          {errors.general && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {errors.general}
            </div>
          )}
          
          {/* End yard line input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">
              Play End Yard Line <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={playEndYardLine}
              readOnly
              className={`mt-1 block w-32 px-3 py-2 border rounded-md ${
                errors.endYardLine ? 'border-red-500' : 'border-gray-300'
              } bg-gray-100`}
              placeholder="H35"
            />
            {errors.endYardLine && (
              <p className="text-red-500 text-sm mt-1">{errors.endYardLine}</p>
            )}
          </div>
          
          {/* Penalties table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase">Team</th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase">Accept</th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase">Enforce</th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase">Yards</th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase">Spot</th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase">Live</th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase">AFD</th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase">LOD</th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                  <th className="px-2 py-3"></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {penalties.map((penalty) => {
                  const def = getPenaltyDef(penalty.code);
                  return (
                    <tr key={penalty.id}>
                      {/* Team */}
                      <td className="px-2 py-2">
                        <select
                          value={penalty.team}
                          onChange={(e) => updatePenalty(penalty.id!, 'team', e.target.value as 'H' | 'V')}
                          className={`block w-16 px-2 py-1 border rounded ${
                            errors[`${penalty.id}_team`] ? 'border-red-500' : 'border-gray-300'
                          }`}
                        >
                          <option value="H">H</option>
                          <option value="V">V</option>
                        </select>
                      </td>
                      
                      {/* Code */}
                      <td className="px-2 py-2">
                        <select
                          value={penalty.code}
                          onChange={(e) => updatePenalty(penalty.id!, 'code', e.target.value)}
                          className={`block w-24 px-2 py-1 border rounded ${
                            errors[`${penalty.id}_code`] ? 'border-red-500' : 'border-gray-300'
                          }`}
                        >
                          <option value="">--</option>
                          {penaltyTable.map(p => (
                            <option key={p.code} value={p.code}>
                              {p.code} - {p.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      
                      {/* Accepted/Declined */}
                      <td className="px-2 py-2">
                        <select
                          value={penalty.accepted ? 'accepted' : 'declined'}
                          onChange={(e) => updatePenalty(penalty.id!, 'accepted', e.target.value === 'accepted')}
                          className={`block w-24 px-2 py-1 border rounded ${
                            errors[`${penalty.id}_accepted`] ? 'border-red-500' : 'border-gray-300'
                          }`}
                        >
                          <option value="accepted">Accept</option>
                          <option value="declined">Decline</option>
                        </select>
                      </td>
                      
                      {/* Enforcement Point */}
                      <td className="px-2 py-2">
                        <select
                          value={penalty.enforcedFrom}
                          onChange={(e) => updatePenalty(penalty.id!, 'enforcedFrom', e.target.value)}
                          className={`block w-28 px-2 py-1 border rounded ${
                            errors[`${penalty.id}_enforcedFrom`] ? 'border-red-500' : 'border-gray-300'
                          }`}
                        >
                          <option value="PREVIOUS">Previous</option>
                          <option value="SPOT">Spot</option>
                          <option value="END">End</option>
                          <option value="TRY">Try</option>
                          <option value="FREE_KICK">Free Kick</option>
                          <option value="SUCCESSFUL_TD">Success TD</option>
                        </select>
                      </td>
                      
                      {/* Yards */}
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          value={penalty.yards || ''}
                          onChange={(e) => updatePenalty(penalty.id!, 'yards', parseInt(e.target.value) || 0)}
                          className={`block w-16 px-2 py-1 border rounded ${
                            errors[`${penalty.id}_yards`] ? 'border-red-500' : 'border-gray-300'
                          } ${def?.requiresYards ? '' : 'bg-gray-100'}`}
                          disabled={!def?.requiresYards}
                        />
                      </td>
                      
                      {/* Spot */}
                      <td className="px-2 py-2">
                        <input
                          type="text"
                          value={penalty.spot || ''}
                          onChange={(e) => updatePenalty(penalty.id!, 'spot', e.target.value)}
                          className={`block w-20 px-2 py-1 border rounded ${
                            errors[`${penalty.id}_spot`] ? 'border-red-500' : 'border-gray-300'
                          } ${def?.requiresSpot ? '' : 'bg-gray-100'}`}
                          placeholder="H35"
                          disabled={!def?.requiresSpot}
                        />
                      </td>
                      
                      {/* Live Ball */}
                      <td className="px-2 py-2">
                        <input
                          type="checkbox"
                          checked={penalty.liveBall || false}
                          onChange={(e) => updatePenalty(penalty.id!, 'liveBall', e.target.checked)}
                          className="h-4 w-4"
                        />
                      </td>
                      
                      {/* Automatic First Down */}
                      <td className="px-2 py-2">
                        <input
                          type="checkbox"
                          checked={penalty.automaticFirstDown || false}
                          onChange={(e) => updatePenalty(penalty.id!, 'automaticFirstDown', e.target.checked)}
                          className="h-4 w-4"
                        />
                      </td>
                      
                      {/* Loss of Down */}
                      <td className="px-2 py-2">
                        <input
                          type="checkbox"
                          checked={penalty.lossOfDown || false}
                          onChange={(e) => updatePenalty(penalty.id!, 'lossOfDown', e.target.checked)}
                          className="h-4 w-4"
                        />
                      </td>
                      
                      {/* Notes */}
                      <td className="px-2 py-2">
                        <input
                          type="text"
                          value={penalty.notes || ''}
                          onChange={(e) => updatePenalty(penalty.id!, 'notes', e.target.value)}
                          className="block w-32 px-2 py-1 border border-gray-300 rounded"
                          placeholder="Notes..."
                        />
                      </td>
                      
                      {/* Remove button */}
                      <td className="px-2 py-2">
                        <button
                          onClick={() => removePenalty(penalty.id!)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          <button
            onClick={addPenalty}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Add Penalty
          </button>
        </div>
        
        {/* Right rail - Suggestions */}
        <div className="w-80 bg-gray-50 p-6 border-l">
          <h3 className="text-lg font-semibold mb-4">Suggestions</h3>
          
          {suggestions ? (
            <div className="space-y-3">
              <div className="bg-white p-3 rounded border">
                <p className="font-medium text-sm">Analysis: {suggestions.kind}</p>
                {suggestions.messages.map((msg: string, idx: number) => (
                  <p key={idx} className="text-sm mt-1">{msg}</p>
                ))}
              </div>
              
              {suggestions.suggested && (
                <div className="bg-blue-50 p-3 rounded border border-blue-200">
                  <p className="font-medium text-sm mb-2">Suggested Result:</p>
                  {suggestions.suggested.yardLine && (
                    <p className="text-sm">Yard Line: {suggestions.suggested.yardLine}</p>
                  )}
                  {suggestions.suggested.down && (
                    <p className="text-sm">Down: {suggestions.suggested.down}</p>
                  )}
                  {suggestions.suggested.distance && (
                    <p className="text-sm">Distance: {suggestions.suggested.distance}</p>
                  )}
                  {suggestions.suggested.resultTag && (
                    <p className="text-sm font-medium mt-1">{suggestions.suggested.resultTag}</p>
                  )}
                </div>
              )}
              
              {SCORING_STRICTNESS === 'assisted' && (
                <button
                  onClick={handleApplySuggestions}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Apply Suggestions
                </button>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              {SCORING_STRICTNESS === 'advisory' 
                ? 'Suggestions will appear here to help guide your decisions.'
                : 'Suggestions will be auto-applied when you save (you can override).'}
            </p>
          )}
          
          {/* Action buttons */}
          <div className="mt-6 space-y-2">
            <button
              onClick={() => handleSave(SCORING_STRICTNESS === 'assisted')}
              disabled={!tableLoaded}
              className={`w-full px-4 py-2 rounded ${
                tableLoaded 
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {SCORING_STRICTNESS === 'assisted' ? 'Save & Apply Suggestions' : 'Save with Suggestions'}
            </button>
            
            <button
              onClick={handleSaveAsIs}
              disabled={!tableLoaded}
              className={`w-full px-4 py-2 rounded ${
                tableLoaded
                  ? 'bg-gray-600 text-white hover:bg-gray-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              Save As-Is (Override Rules)
            </button>
            
            <div className="text-xs text-gray-600 mt-2 px-1">
              <strong>Note:</strong> Technical requirements (team, code, enforcement, accepted/declined) 
              are always enforced. Rule suggestions can be overridden.
            </div>
            
            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
      
      {/* Override reason dialog */}
      {showOverrideDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-60">
          <div className="bg-white rounded-lg p-6 max-w-md">
            <h3 className="text-lg font-semibold mb-3">Override Reason Required</h3>
            <p className="text-sm text-gray-600 mb-4">
              You're choosing to save without applying suggestions. Please provide a brief reason:
            </p>
            <input
              type="text"
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded mb-4"
              placeholder="Reason for override..."
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (overrideReason) {
                    setShowOverrideDialog(false);
                    handleSave(false);
                  }
                }}
                disabled={!overrideReason}
                className={`flex-1 px-4 py-2 rounded ${
                  overrideReason
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                Continue
              </button>
              <button
                onClick={() => setShowOverrideDialog(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
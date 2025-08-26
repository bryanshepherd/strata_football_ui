import React, { useState, useEffect, useRef } from 'react';
import { useGameState } from '../contexts/FootballGameContext';

const PlayEditModal = ({ playId, isOpen, onClose }) => {
  const { submitEvent, fetchGameState, currentGameId } = useGameState();
  const [playData, setPlayData] = useState(null);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Simple edit play function
  const editPlay = async (playId, updates) => {
    const response = await fetch(`/strata_football/api/update_play.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        play_id: playId,
        updates: updates
      })
    });

    if (!response.ok) {
      throw new Error('Failed to update play');
    }

    return await response.json();
  };

  // Ref for first input field
  const firstInputRef = useRef(null);

  // Field definitions for different play types
  const fieldDefinitions = {
    RUSH: [
      { key: 'PlayerNumber', label: 'Rusher Jersey #', type: 'number', min: 0, max: 99, section: 'play' },
      { key: 'PlayResult', label: 'Result', type: 'select', 
        options: ['COMPLETE', 'FUMBLE', 'OUT_OF_BOUNDS', 'TOUCHDOWN'], section: 'play' },
      { key: 'YardsGained', label: 'Yards Gained', type: 'number', min: -99, max: 99, section: 'play' },
      { key: 'PrimaryTackler', label: 'Primary Tackler #', type: 'number', min: 0, max: 99, section: 'defense' },
      { key: 'AssistTackler', label: 'Assist Tackler #', type: 'number', min: 0, max: 99, section: 'defense' },
      { key: 'YardLine', label: 'End Yard Line', type: 'text', 
        placeholder: 'H25, V33, or 50', pattern: '^(H|V)\\d{1,2}|50$', section: 'position' }
    ],
    
    PASS: [
      { key: 'PlayerNumber', label: 'QB Jersey #', type: 'number', min: 0, max: 99, section: 'play' },
      { key: 'ReceiverNumber', label: 'Receiver Jersey #', type: 'number', min: 0, max: 99, section: 'play' },
      { key: 'PlayResult', label: 'Result', type: 'select', 
        options: ['COMPLETE', 'INCOMPLETE', 'INTERCEPTION', 'SACK', 'TOUCHDOWN'], section: 'play' },
      { key: 'YardsGained', label: 'Yards Gained', type: 'number', min: -99, max: 99, section: 'play' },
      { key: 'DefendingPlayer', label: 'Defending Player #', type: 'number', min: 0, max: 99, section: 'defense' },
      { key: 'YardLine', label: 'End Yard Line', type: 'text', 
        placeholder: 'H25, V33, or 50', pattern: '^(H|V)\\d{1,2}|50$', section: 'position' }
    ],
    
    KICK: [
      { key: 'PlayerNumber', label: 'Kicker Jersey #', type: 'number', min: 0, max: 99, section: 'play' },
      { key: 'KickType', label: 'Kick Type', type: 'select', 
        options: ['FIELD_GOAL', 'EXTRA_POINT', 'PUNT', 'KICKOFF'], section: 'play' },
      { key: 'PlayResult', label: 'Result', type: 'select', 
        options: ['GOOD', 'NO_GOOD', 'BLOCKED', 'TOUCHBACK'], section: 'play' },
      { key: 'KickDistance', label: 'Distance (yards)', type: 'number', min: 1, max: 80, section: 'play' }
    ],
    
    PENALTY: [
      { key: 'PenaltyType', label: 'Penalty Type', type: 'select', 
        options: ['FALSE_START', 'HOLDING', 'PASS_INTERFERENCE', 'OFFSIDES', 'ROUGHING'], section: 'play' },
      { key: 'PlayerNumber', label: 'Player Jersey #', type: 'number', min: 0, max: 99, section: 'play' },
      { key: 'YardsGained', label: 'Penalty Yards', type: 'number', min: 5, max: 50, section: 'play' },
      { key: 'PenaltyAccepted', label: 'Accepted', type: 'checkbox', section: 'play' }
    ]
  };

  // Fetch play data when modal opens
  useEffect(() => {
    if (isOpen && playId) {
      fetchPlayData();
      // Focus on first input field when modal opens
      setTimeout(() => {
        if (firstInputRef.current) {
          firstInputRef.current.focus();
        }
      }, 100);
    }
  }, [isOpen, playId]);

  // Handle Enter key press
  useEffect(() => {
    const handleKeyPress = (event) => {
      if (event.key === 'Enter' && isOpen && !loading) {
        event.preventDefault();
        handleSave();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyPress);
      return () => document.removeEventListener('keydown', handleKeyPress);
    }
  }, [isOpen, loading]);

  const fetchPlayData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/strata_football/api/get_plays.php?gameId=999&playId=${playId}`);
      if (!response.ok) throw new Error('Failed to fetch play data');
      
      const result = await response.json();
      const play = result.plays?.[0];
      
      if (!play) throw new Error('Play not found');
      
      setPlayData(play);
      setFormData({
        PlayerNumber: play.PlayerNumber || '',
        ReceiverNumber: play.ReceiverNumber || '',
        PlayResult: play.PlayResult || '',
        YardsGained: play.YardsGained || 0,
        YardLine: play.YardLine || '',
        PrimaryTackler: play.PrimaryTackler || '',
        AssistTackler: play.AssistTackler || '',
        DefendingPlayer: play.DefendingPlayer || '',
        KickType: play.KickType || '',
        KickDistance: play.KickDistance || '',
        PenaltyType: play.PenaltyType || '',
        PenaltyAccepted: play.PenaltyAccepted || false
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateField = (key, value) => {
    setFormData(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    try {
      // Filter out empty values
      const updates = Object.entries(formData)
        .filter(([key, value]) => value !== '' && value !== null && value !== undefined)
        .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});

      await editPlay(playId, updates);
      
      // Refresh game state after successful edit
      if (currentGameId) {
        await fetchGameState(currentGameId);
      }
      
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderField = (field, isFirst = false) => {
    const value = formData[field.key] || '';
    
    switch (field.type) {
      case 'select':
        return (
          <select 
            ref={isFirst ? firstInputRef : null}
            value={value} 
            onChange={(e) => updateField(field.key, e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Select...</option>
            {field.options.map(opt => (
              <option key={opt} value={opt}>
                {opt.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
              </option>
            ))}
          </select>
        );
        
      case 'number':
        return (
          <input 
            ref={isFirst ? firstInputRef : null}
            type="number" 
            min={field.min} 
            max={field.max}
            value={value} 
            onChange={(e) => updateField(field.key, parseInt(e.target.value) || '')}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        );
        
      case 'checkbox':
        return (
          <input 
            ref={isFirst ? firstInputRef : null}
            type="checkbox" 
            checked={value || false}
            onChange={(e) => updateField(field.key, e.target.checked)}
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
          />
        );
        
      default:
        return (
          <input 
            ref={isFirst ? firstInputRef : null}
            type="text" 
            value={value}
            placeholder={field.placeholder}
            pattern={field.pattern}
            onChange={(e) => updateField(field.key, e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        );
    }
  };

  const groupFieldsBySection = (fields) => {
    const sections = {
      play: { title: 'Play Details', fields: [] },
      defense: { title: 'Tackles/Defense', fields: [] },
      position: { title: 'Field Position', fields: [] }
    };

    fields.forEach(field => {
      if (sections[field.section]) {
        sections[field.section].fields.push(field);
      }
    });

    return Object.entries(sections).filter(([key, section]) => section.fields.length > 0);
  };

  if (!isOpen) return null;

  const playType = playData?.PlayType || 'RUSH';
  const fields = fieldDefinitions[playType] || fieldDefinitions.RUSH;
  const sections = groupFieldsBySection(fields);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">
            🏈 Edit Play #{playData?.PlayNumber} - {playType}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl font-bold"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {loading && (
            <div className="text-center py-4">
              <div className="text-gray-600">Loading play data...</div>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          {!loading && !error && playData && (
            <div className="space-y-6">
              {sections.map(([sectionKey, section], sectionIndex) => (
                <div key={sectionKey}>
                  <h3 className="text-md font-semibold text-gray-700 mb-3">
                    {section.title}
                  </h3>
                  <div className="grid grid-cols-1 gap-3">
                    {section.fields.map((field, fieldIndex) => {
                      const isFirstField = sectionIndex === 0 && fieldIndex === 0;
                      return (
                        <div key={field.key} className="space-y-1">
                          <label className="block text-sm font-medium text-gray-700">
                            {field.label}
                          </label>
                          {renderField(field, isFirstField)}
                          {field.placeholder && (
                            <div className="text-xs text-gray-500">
                              Format: {field.placeholder}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 p-4 border-t border-gray-200">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading || !playData}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlayEditModal;

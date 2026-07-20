import React, { useState } from 'react';
import debug from '../../utils/debug';
import { useGameState } from '../../contexts/FootballGameContext';
import PenaltyModal from '../PenaltyModal';
import { usePlayInputFlow } from '../../hooks/usePlayInputFlow.jsx';

const PenaltyInputFlow = ({ onComplete, onCancel, gameState }) => {
  const { submitEvent } = useGameState();
  
  // Use shared play input flow hook for keyboard navigation
  const {
    setupKeyboardHandler,
    debugLog
  } = usePlayInputFlow({
    initialStep: 'penalty-input',
    onComplete,
    onCancel,
    gameState,
    submitEvent,
    playType: 'penalty'
  });
  
  const [showPenaltyModal, setShowPenaltyModal] = useState(true);
  
  // Setup keyboard handler for Escape key
  setupKeyboardHandler({
    handleEnterKeyPress: () => {
      debugLog('Enter key pressed - reopening modal if closed');
      if (!showPenaltyModal) {
        setShowPenaltyModal(true);
      }
    },
    handleCustomKeys: (e) => {
      // Custom penalty flow shortcuts can be added here
      debugLog('Custom key pressed', { key: e.key });
    }
  });

  const handlePenaltySubmit = async (penaltyData) => {
    try {
      debugLog('Submitting penalty', { penaltyData });
      
      // Convert penalty data to event format for submission
      const eventData = {
        event_type: 'penalty',
        play_type: 'penalty',
        penalty_type: penaltyData.penalty?.PenaltyName || '',
        penalty_code: penaltyData.penalty?.PenaltyCode || '',
        penalty_team: penaltyData.team,
        penalty_player: penaltyData.playerNumber,
        penalty_result: penaltyData.result,
        enforcement: penaltyData.enforcement
      };

      debug.log('Submitting penalty event:', eventData);

      const result = await submitEvent(eventData);
      
      if (result) {
        onComplete(result);
      } else {
        throw new Error('Failed to submit penalty');
      }
    } catch (error) {
      console.error('Error submitting penalty:', error);
      alert(`Error submitting penalty: ${error.message}`);
    }
  };

  const handleModalClose = () => {
    setShowPenaltyModal(false);
    onCancel();
  };

  return (
    <div className="p-4">
      <PenaltyModal
        isOpen={showPenaltyModal}
        onClose={handleModalClose}
        onSubmit={handlePenaltySubmit}
        gameState={gameState}
      />
      
      {!showPenaltyModal && (
        <div className="text-center">
          <p className="text-gray-600 mb-4">Penalty input cancelled</p>
          <button
            onClick={() => setShowPenaltyModal(true)}
            className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
          >
            Reopen Penalty Input
          </button>
        </div>
      )}
    </div>
  );
};

export default PenaltyInputFlow;

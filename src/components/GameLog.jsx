import React, { useState, useMemo } from 'react';
import { playerManager } from '../utils/playerManager';
import { useGameState } from '../contexts/FootballGameContext';
import PlayEditModal from './PlayEditModal';
import PlayRow from './PlayRow';

const PLAYS_PER_PAGE = 25; // Load 25 plays at a time
const PERFORMANCE_THRESHOLD = 75; // Start pagination when > 75 plays

export default function GameLog({ gameState, gameId }) {
  const { deletePlay, editPlay, insertPlayAfter, replacePlay } = useGameState();
  const [editingPlay, setEditingPlay] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [visiblePlayCount, setVisiblePlayCount] = useState(PLAYS_PER_PAGE);

  if (!gameState || !gameState.game_info) {
    return (
      <div className="bg-white p-4">
        <div className="text-gray-500">Loading game log...</div>
      </div>
    );
  }

  const { recent_plays = [], live_state } = gameState;
  
  // Performance optimization: memoize expensive calculations
  const playMetrics = useMemo(() => {
    // Preserve server order, but fallback sort by PlayID DESC if needed
    const base = gameState?.plays ?? gameState?.recent_plays ?? [];
    const rows = [...base].sort((a, b) => {
      const A = a.playId ?? a.PlayID ?? 0;
      const B = b.playId ?? b.PlayID ?? 0;
      return B - A; // DESC order (newest first)
    });
    
    return {
      totalPlays: recent_plays.length,
      shouldPaginate: recent_plays.length > PERFORMANCE_THRESHOLD,
      visiblePlays: rows.slice(0, Math.min(visiblePlayCount, recent_plays.length)),
      hasMorePlays: visiblePlayCount < recent_plays.length
    };
  }, [recent_plays.length, visiblePlayCount]);
  
  const handleLoadMore = () => {
    setVisiblePlayCount(prev => prev + PLAYS_PER_PAGE);
  };
  
  const handleShowAll = () => {
    setVisiblePlayCount(recent_plays.length);
  };

  // Action button handlers
  const handleEdit = (play) => {
    setEditingPlay(play);
    setShowEditModal(true);
  };

  const handleDelete = async (play) => {
    const playType = play.PlayType || play.play_type || 'play';
    if (window.confirm(`Are you sure you want to delete this ${playType} play? This will renumber later plays. Proceed?`)) {
      try {
        const playId = play.PlayID || play.playId || play.id;
        await deletePlay(playId);
      } catch (error) {
        alert('Failed to delete play: ' + error.message);
      }
    }
  };

  const handleReplace = async (play) => {
    // For now, show a simple prompt - can be enhanced with a modal later
    const newDescription = prompt('Enter new play description:', play.description || '');
    if (newDescription !== null) {
      try {
        const playId = play.PlayID || play.playId || play.id;
        const payload = {
          PlayDescription: newDescription,
          PlayType: play.playType || play.PlayType || 'RUSH',
          PossessionTeam: play.possession || 'HOME',
          YardsGained: 0,
          NetYards: 0
        };
        await replacePlay(playId, payload);
      } catch (error) {
        alert('Failed to replace play: ' + error.message);
      }
    }
  };

  const handleInsertBefore = async (play) => {
    // For now, show a simple prompt - can be enhanced with a modal later
    const newDescription = prompt('Enter new play description:', 'New play');
    if (newDescription !== null) {
      try {
        const playId = play.PlayID || play.playId || play.id;
        const payload = {
          PlayDescription: newDescription,
          PlayType: 'RUSH',
          PossessionTeam: play.possession || 'HOME',
          Period: play.period || play.Period || 1,
          TimeRemaining: play.timeRemaining || 900,
          YardsGained: 0,
          NetYards: 0,
          YardLinePosition: play.yardLine || play.spot || 'H35'
        };
        await insertPlayAfter(playId, payload);
      } catch (error) {
        alert('Failed to insert play: ' + error.message);
      }
    }
  };

  const handleEditComplete = () => {
    setShowEditModal(false);
    setEditingPlay(null);
  };

  return (
    <div className="bg-white h-full flex flex-col">
      {/* Header with pagination info */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">Game Log</h3>
            <div className="text-sm text-gray-600">
              {playMetrics.shouldPaginate 
                ? `Showing ${playMetrics.visiblePlays.length} of ${playMetrics.totalPlays} plays`
                : `${playMetrics.totalPlays} plays recorded`
              }
            </div>
          </div>
          {playMetrics.shouldPaginate && (
            <div className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">
              📊 Large game - pagination active
            </div>
          )}
        </div>
      </div>

      {/* Main play list */}
      <div className="flex-1 overflow-y-auto">
        {recent_plays.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <div className="text-4xl mb-2">🏈</div>
            <div>No plays recorded yet</div>
            <div className="text-sm mt-1">Use the controls to start recording plays</div>
          </div>
        ) : (
          <>
            <div className="space-y-1">
              {playMetrics.visiblePlays.map((play, index) => (
                <PlayRow
                  key={play.id || index}
                  play={play}
                  index={index}
                  isLatest={index === 0}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onReplace={handleReplace}
                  onInsertBefore={handleInsertBefore}
                />
              ))}
            </div>
            
            {/* Pagination Controls */}
            {playMetrics.shouldPaginate && playMetrics.hasMorePlays && (
              <div className="p-4 border-t border-gray-200 bg-gray-50">
                <div className="flex items-center justify-center space-x-3">
                  <button
                    onClick={handleLoadMore}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                  >
                    📄 Load {Math.min(PLAYS_PER_PAGE, recent_plays.length - visiblePlayCount)} More Plays
                  </button>
                  <button
                    onClick={handleShowAll}
                    className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
                  >
                    📋 Show All {recent_plays.length} Plays
                  </button>
                </div>
                <div className="text-xs text-gray-500 text-center mt-2">
                  Showing {playMetrics.visiblePlays.length} of {playMetrics.totalPlays} plays
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Quick Stats Footer */}
      <div className="p-3 border-t border-gray-200 bg-gray-50">
        <div className="grid grid-cols-3 gap-4 text-xs">
          <div className="text-center">
            <div className="font-bold text-green-600">
              {recent_plays.filter(p => (p.play_type || p.PlayType) === 'RUSH').length}
            </div>
            <div className="text-gray-600">Rushes</div>
          </div>
          <div className="text-center">
            <div className="font-bold text-blue-600">
              {recent_plays.filter(p => (p.play_type || p.PlayType) === 'PASS').length}
            </div>
            <div className="text-gray-600">Passes</div>
          </div>
          <div className="text-center">
            <div className="font-bold text-red-600">
              {recent_plays.filter(p => (p.play_type || p.PlayType) === 'PENALTY').length}
            </div>
            <div className="text-gray-600">Penalties</div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <PlayEditModal
          isOpen={showEditModal}
          onClose={handleEditComplete}
          play={editingPlay}
          gameId={gameId}
          onEdit={onPlayEdit}
        />
      )}
    </div>
  );
}
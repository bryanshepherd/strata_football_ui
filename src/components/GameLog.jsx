import React, { useState } from 'react';
import { playerManager } from '../utils/playerManager';
import PlayEditModal from './PlayEditModal';
import PlayDescription from './PlayDescription';

export default function GameLog({ gameState, gameId, onPlayEdit, onPlayDelete, onPlayInsert, onPlayReplace }) {
  const [editingPlay, setEditingPlay] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  if (!gameState || !gameState.game_info) {
    return (
      <div className="bg-white p-4">
        <div className="text-gray-500">Loading game log...</div>
      </div>
    );
  }

  const { recent_plays = [], live_state } = gameState;

  const formatTime = (timeRemaining) => {
    if (timeRemaining === undefined || timeRemaining === null || isNaN(timeRemaining)) return '00:00';
    const total = Math.max(0, parseInt(timeRemaining, 10));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const getPlayIcon = (play) => {
    if (play.has_penalty || play.HasPenalty || play.play_type === 'PENALTY' || play.PlayType === 'PENALTY') {
      return '⚠️';
    }
    if (
      play.play_type === 'TIMEOUT' || play.PlayType === 'TIMEOUT' ||
      play.play_type === 'GAME_CONTROL' || play.PlayType === 'GAME_CONTROL'
    ) {
      return '🛠️';
    }
    if (
      (typeof play.play_type === 'string' && play.play_type.includes('CLOCK')) ||
      (typeof play.PlayType === 'string' && play.PlayType.includes('CLOCK')) ||
      play.play_type === 'DELAY' || play.PlayType === 'DELAY'
    ) {
      return '⏱️';
    }

    const playType = play.play_type || play.PlayType;
    const icons = {
      RUSH: '🏃',
      PASS: '🎯',
      PUNT: '🦵',
      KICK: '🏈',
      KICKOFF: '🏈',
      FIELD_GOAL: '🏈',
      EXTRA_POINT: '⭐',
      SAFETY: '🛡️',
      TOUCHDOWN: '🏆',
      INTERCEPTION: '✋',
      FUMBLE: '💥',
      INCOMPLETE: '❌',
      COMPLETE: '✅',
      SACK: '🚫',
    };
    return icons[playType] || '🏈';
  };

  const getPlayTypeColor = (playType) => {
    const colors = {
      RUSH: 'text-green-600',
      PASS: 'text-blue-600',
      PUNT: 'text-purple-600',
      KICK: 'text-orange-600',
      PENALTY: 'text-red-600',
      TIMEOUT: 'text-gray-600',
      KICKOFF: 'text-indigo-600',
      FIELD_GOAL: 'text-yellow-600',
      EXTRA_POINT: 'text-yellow-500',
      SAFETY: 'text-red-500',
      TOUCHDOWN: 'text-green-500',
      INTERCEPTION: 'text-red-500',
      FUMBLE: 'text-orange-500',
    };
    return colors[playType] || 'text-gray-600';
  };

  // ---- helpers used by getPlayDescription ----
  const getPlayerName = (playerId, teamCode) => {
    try {
      if (!playerId) return null;
      return playerManager?.getPlayerName?.(teamCode, playerId) || null;
    } catch {
      return null;
    }
  };

  const getPlayerNumber = (playerId, teamCode) => {
    try {
      if (!playerId) return null;
      return playerManager?.getPlayerNumber?.(teamCode, playerId) || null;
    } catch {
      return null;
    }
  };
  // -------------------------------------------

  const getPlayDescription = (play) => {
    let description = '';

    if (
      play.PlayDescription &&
      !play.PlayDescription.includes('Unknown Player') &&
      !play.PlayDescription.includes('Unknown QB') &&
      !play.PlayDescription.includes('Unknown Receiver')
    ) {
      return play.PlayDescription;
    }

    const playType = play.PlayType || play.play_type;
    const possession = play.PossessionTeam || play.possession;

    if (playType) description = playType.toLowerCase();

    const primaryPlayerId = play.PrimaryPlayerID || play.primary_player_id;
    const secondaryPlayerId = play.SecondaryPlayerID || play.secondary_player_id;

    const primaryPlayerName = getPlayerName(primaryPlayerId, possession);
    const primaryPlayerNumber = getPlayerNumber(primaryPlayerId, possession);
    const secondaryPlayerName = getPlayerName(secondaryPlayerId, possession);
    const secondaryPlayerNumber = getPlayerNumber(secondaryPlayerId, possession);

    if (primaryPlayerName) {
      if (playType === 'PASS') {
        description = `${primaryPlayerName}${primaryPlayerNumber ? ` (#${primaryPlayerNumber})` : ''} pass`;
        if (secondaryPlayerName) {
          description += ` to ${secondaryPlayerName}${secondaryPlayerNumber ? ` (#${secondaryPlayerNumber})` : ''}`;
        }
      } else if (playType === 'RUSH') {
        description = `${primaryPlayerName}${primaryPlayerNumber ? ` (#${primaryPlayerNumber})` : ''} rush`;
      } else {
        description += ` by ${primaryPlayerName}${primaryPlayerNumber ? ` (#${primaryPlayerNumber})` : ''}`;
      }
    } else if (primaryPlayerNumber) {
      description += ` by #${primaryPlayerNumber}`;
    } else if (primaryPlayerId) {
      description += ` by Player #${primaryPlayerId}`;
    }

    const yards = play.yards_gained !== undefined ? play.yards_gained : play.YardsGained;
    if (yards !== undefined && yards !== null) {
      if (yards > 0) description += ` for ${yards} yards`;
      else if (yards < 0) description += ` for ${Math.abs(yards)} yard loss`;
      else description += ` for no gain`;
    }

    const result = play.end_of_play || play.result || play.PlayResult;
    if (result && result !== 'TACKLE') {
      description += ` (${String(result).toLowerCase()})`;
    }

    if (play.result && play.result !== result) {
      description += ` - ${play.result}`;
    }

    const penaltyType = play.penalty_type || play.PenaltyType;
    const penaltyYards = play.penalty_yards || play.PenaltyYards;
    const hasPenalty = play.has_penalty || play.HasPenalty;

    if (hasPenalty || penaltyType) {
      if (penaltyType) description += ` - ${penaltyType}`;
      if (penaltyYards) description += ` (${penaltyYards} yards)`;
    }

    return description || 'Play details unavailable';
  };

  const formatDownDistance = (play) => {
    const down = play.down ?? play.Down;
    const distance = play.distance ?? play.YardsToGo ?? play.yards_to_go;
    if (down && distance !== undefined && distance !== null) return `${down} & ${distance}`;
    return 'Down & Distance not set';
  };

  const formatFieldPosition = (play) => {
    // Try a few common fields safely
    const spot =
      play.ball_on || play.ball_spot || play.BallOn || play.final_spot || play.FinalSpot || play.spot;
    if (!spot) return '';
    return typeof spot === 'string' ? spot : String(spot);
  };

  // Action button handlers
  const handleEdit = (play) => {
    setEditingPlay(play);
    setShowEditModal(true);
  };

  const handleDelete = async (play) => {
    const playType = play.PlayType || play.play_type || 'play';
    if (window.confirm(`Are you sure you want to delete this ${playType} play?`)) {
      if (onPlayDelete) {
        const playId = play.PlayID || play.id;
        await onPlayDelete(playId);
      }
    }
  };

  const handleReplace = (play) => {
    if (onPlayReplace) {
      const playId = play.PlayID || play.id;
      onPlayReplace(playId);
    }
  };

  const handleInsertBefore = (play) => {
    if (onPlayInsert) {
      const playId = play.PlayID || play.id;
      onPlayInsert(playId);
    }
  };

  const handleEditComplete = () => {
    setShowEditModal(false);
    setEditingPlay(null);
  };

  return (
    <div className="bg-white h-full flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-lg font-bold">Game Log</h3>
        <div className="text-sm text-gray-600">
          {recent_plays.length} plays recorded
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {recent_plays.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <div className="text-4xl mb-2">🏈</div>
            <div>No plays recorded yet</div>
            <div className="text-sm mt-1">Use the controls to start recording plays</div>
          </div>
        ) : (
          <div className="space-y-1">
            {recent_plays.map((play, index) => (
              <div
                key={play.id || index}
                className={`p-3 border-b border-gray-100 hover:bg-gray-50 ${index === 0 ? 'bg-blue-50' : ''}`}
              >
                {/* First Line: Icon + Play Type + [Latest] + Action Buttons */}
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{getPlayIcon(play)}</span>
                    <span className={`font-bold text-sm ${getPlayTypeColor(play.PlayType || play.play_type)}`}>
                      {play.PlayType || play.play_type || 'UNKNOWN'}
                    </span>
                    {(play.has_penalty || play.HasPenalty) && (
                      <span className="px-1 py-0.5 bg-red-100 text-red-700 text-xs rounded">⚠️</span>
                    )}
                    {index === 0 && (
                      <span className="px-1 py-0.5 bg-blue-100 text-blue-800 text-xs rounded font-medium">
                        LATEST
                      </span>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleInsertBefore(play)}
                      className="p-1 hover:bg-green-100 rounded text-green-600 text-sm"
                      title="Insert play before this one"
                    >
                      ＋
                    </button>
                    <button
                      onClick={() => handleEdit(play)}
                      className="p-1 hover:bg-blue-100 rounded text-blue-600 text-sm"
                      title="Edit this play"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleReplace(play)}
                      className="p-1 hover:bg-orange-100 rounded text-orange-600 text-sm"
                      title="Replace this play"
                    >
                      🔄
                    </button>
                    <button
                      onClick={() => handleDelete(play)}
                      className="p-1 hover:bg-red-100 rounded text-red-600 text-sm"
                      title="Delete this play"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {/* Second Line: Quarter Time - Down & Distance on left, Field Position on right */}
                <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                  <div className="flex items-center space-x-2">
                    <span>Q{play.quarter || play.Period || live_state?.quarter || 1}</span>
                    <span>{formatTime(play.time_remaining ?? play.TimeRemaining)}</span>
                    <span>-</span>
                    <span>{formatDownDistance(play)}</span>
                  </div>
                  <div>{formatFieldPosition(play)}</div>
                </div>

                {/* Play Description */}
                <div className="text-sm text-gray-800 mb-1">
                  <PlayDescription play={play} gameId={gameId} gameState={gameState} />
                </div>

                {/* Result Line */}
                <div className="text-xs text-gray-600">
                  Result:{' '}
                  {(() => {
                    const yards = play.yards_gained !== undefined ? play.yards_gained : play.YardsGained;
                    if (yards === undefined || yards === null) return 'No gain';
                    if (yards > 0) return `+${yards} yards`;
                    if (yards < 0) return `${yards} yard loss`;
                    return 'No gain';
                  })()}
                </div>

                {/* Special Indicators */}
                <div className="flex items-center space-x-2 mt-1">
                  {play.is_touchdown && <span className="text-xs bg-green-100 text-green-700 px-1 rounded">🏆 TD</span>}
                  {play.is_turnover && <span className="text-xs bg-red-100 text-red-700 px-1 rounded">🔄 TO</span>}
                  {play.has_fumble && <span className="text-xs bg-orange-100 text-orange-700 px-1 rounded">💥 FUM</span>}
                </div>

                {/* Drive Information */}
                {play.drive_number && (
                  <div className="text-xs text-blue-600 mt-1">
                    Drive #{play.drive_number}
                  </div>
                )}
              </div>
            ))}
          </div>
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
      {showEditModal && editingPlay && (
        <PlayEditModal
          playId={editingPlay.id || editingPlay.PlayID}
          isOpen={showEditModal}
          onClose={handleEditComplete}
        />
      )}
    </div>
  );
}
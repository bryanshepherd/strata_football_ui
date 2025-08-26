import React, { useEffect, useState } from 'react';
import debug from '../utils/debug';
import { useGameState } from '../contexts/FootballGameContext';

export default function DebugPanel({ enabled }) {
  const [isVisible, setIsVisible] = useState(false);
  const [localGameId, setLocalGameId] = useState('');
  // TEMP: Force show reset button for debugging
  const currentUserRole = 'super'; // Add this near the top of your component
  
  const { 
    debugGameId, 
    setDebugGameId, 
    loadDebugGame,
    isConnected,
    error,
    gameData,
    fetchGameState 
  } = useGameState();

//  const [currentUserRole, setCurrentUserRole] = useState(null);

  // Try to fetch current user role for admin actions
  useEffect(() => {
    let mounted = true;
    const fetchUser = async () => {
      try {
        const res = await fetch('/strata_football/api/get_current_user.php');
        if (!res.ok) return;
        const json = await res.json();
        if (mounted && json?.role) setCurrentUserRole(json.role);
      } catch (e) {
        // ignore - optional endpoint
      }
    };
    fetchUser();
    return () => { mounted = false; };
  }, []);

  const handleLoadGame = async () => {
    if (localGameId.trim()) {
      setDebugGameId(localGameId);
      try {
        await fetchGameState(localGameId);
      } catch (error) {
        console.error('Failed to load game:', error);
      }
    }
  };

  if (!enabled) return null;

  return (
    <>
      {/* Debug toggle button */}
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="fixed bottom-4 right-4 bg-gray-800 text-white p-2 rounded-full shadow-lg z-50"
        title="Toggle Debug Panel"
      >
        🐛
      </button>

      {/* Debug panel */}
      {isVisible && (
        <div className="fixed bottom-16 right-4 bg-gray-900 text-white p-4 rounded-lg shadow-xl z-50 max-w-md max-h-96 overflow-auto">
          <h3 className="text-lg font-bold mb-3">Debug Panel</h3>
          
          {/* Game ID Input Section */}
          <div className="mb-4 p-3 bg-gray-800 rounded">
            <label className="block text-sm font-medium mb-2">Load Game by ID:</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={localGameId}
                onChange={(e) => setLocalGameId(e.target.value)}
                placeholder="Enter Game ID (e.g., 999)"
                className="flex-1 px-2 py-1 bg-gray-700 text-white rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleLoadGame}
                disabled={!localGameId.trim()}
                className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 disabled:bg-gray-600"
              >
                Load
              </button>
            </div>
            
            {/* Quick Game ID buttons */}
            <div className="flex gap-1 mt-2">
              <button
                onClick={() => setLocalGameId('999')}
                className="bg-green-600 text-white px-2 py-1 rounded text-xs hover:bg-green-700"
              >
                Test Game (999)
              </button>
              <button
                onClick={() => {
                  setLocalGameId('');
                  setDebugGameId('');
                }}
                className="bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Connection Status */}
          <div className="mb-3 flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm">
              {isConnected ? 'Connected to Backend' : 'Disconnected'}
            </span>
          </div>

          {/* Current Game Info */}
          {gameData?.game_info && (
            <div className="mb-3 p-2 bg-gray-800 rounded text-xs">
              <div className="font-medium text-green-400">Active Game:</div>
              <div>ID: {gameData.game_info.game_id}</div>
              <div>
                {gameData.game_info.home_team_name} vs {gameData.game_info.visitor_team_name}
              </div>
              {gameData.live_state && (
                <div className="mt-1 text-yellow-400">
                  Q{gameData.live_state.quarter} | {Math.floor(gameData.live_state.time_remaining / 60)}:{(gameData.live_state.time_remaining % 60).toString().padStart(2, '0')}
                </div>
              )}
            </div>
          )}

          {/* Admin Reset Button - only show to super/admin */}
          {(currentUserRole === 'super' || currentUserRole === 'admin') && (
            <div className="mt-3">
              <button
                onClick={async () => {
                  if (!gameData?.game_info?.game_id) return alert('No active game selected');
                  if (!window.confirm('Are you sure you want to reset this game to pregame? This will erase all plays, drives, penalties, and stats.')) return;

                  try {
                    const resp = await fetch('/php/reset_game.php', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                      body: new URLSearchParams({ game_id: gameData.game_info.game_id })
                    });
                    const data = await resp.json();
                    if (data.success) {
                      alert('Game has been reset.');
                      window.location.reload();
                    } else {
                      alert('Reset failed: ' + (data.error || 'Unknown error'));
                    }
                  } catch (err) {
                    alert('Request failed: ' + err);
                  }
                }}
                className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
              >
                Reset Game to Pregame
              </button>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="mb-3 p-2 bg-red-900 border border-red-600 rounded text-xs">
              <div className="font-medium text-red-400">Error:</div>
              <div>{error}</div>
            </div>
          )}
          
          <div className="text-xs space-y-2 border-t border-gray-700 pt-3">
            <div>
              <strong>Environment:</strong> {process.env.NODE_ENV}
            </div>
            <div>
              <strong>API Base:</strong> /strata_football/api
            </div>
            <div>
              <strong>Build:</strong> Football UI v0.1.0 (Normalized DB)
            </div>
            <div>
              <strong>Components:</strong> All football input flows loaded
            </div>
          </div>
        </div>
      )}
    </>
  );
}

import React, { useState } from 'react';
import { FootballGameProvider, useGameState } from './contexts/FootballGameContext';
import { FootballFlowProvider, useFootballFlow } from './contexts/FootballFlowContext';
import { GameClockProvider } from './contexts/GameClockContext';
import { useRosters, rosterManager } from './utils/rosterManager';
import Scoreboard from './components/Scoreboard';
import DriveSummaryChips from './components/DriveSummaryChips';
import { useSimpleDriveModel } from './hooks/useSimpleDriveModel';
import TeamPlayerStats from './components/TeamPlayerStats';
import EventControls from './components/EventControls';
import GameLog from './components/GameLog';
import InputAssistant from './components/InputAssistant';
import APIStatus from './components/APIStatus';
import DebugPanel from './components/DebugPanel';
import FootballFlowModal from './components/FootballFlowModal';
import FootballHotkeyHandler from './components/FootballHotkeyHandler';
import debug from './utils/debug';
import ReportsButton from './components/ReportsButton';
import RosterManagement from './components/RosterManagement';
import LockStatus from './components/LockStatus';

export default function App() {
  debug.log('🏈 Strata Football React app initializing...');
  
  const [showDebugPanel, setShowDebugPanel] = useState(
    window.STRATA_CONFIG?.debug === true || process.env.NODE_ENV === 'development'
  );
  const [showRosterModal, setShowRosterModal] = useState(false);

  return (
    <FootballGameProvider>
      <GameClockProvider>
        <FootballFlowProvider>
          <div className="min-h-screen bg-gray-100">
            <NavigationBar 
              onShowRoster={() => setShowRosterModal(true)}
            />
            <FootballGame 
              showRosterModal={showRosterModal}
              setShowRosterModal={setShowRosterModal}
            />
            <FootballFlowModal />
            <FootballHotkeyHandler />
            <DebugPanel enabled={showDebugPanel} />
          </div>
        </FootballFlowProvider>
      </GameClockProvider>
    </FootballGameProvider>
  );
}

const NavigationBar = ({ onShowRoster }) => {
  const { apiStatus, currentGameId, gameState, loadGameState } = useGameState();

  return (
    <nav className="bg-football-primary text-white p-4 shadow-lg">
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <img 
            src="/Strata_Football.png" 
            alt="Strata Football" 
            className="h-8 w-auto"
            onError={(e) => {
              // Fallback if logo doesn't load
              e.target.style.display = 'none';
            }}
          />
          <h1 className="text-2xl font-anton">🏈 Strata Football</h1>
          {currentGameId && gameState && (
            <span className="text-football-accent">
              {gameState.game_info?.home_team_name || 'Home'} vs {gameState.game_info?.visitor_team_name || 'Visitor'}
            </span>
          )}
        </div>
        
        <div className="flex items-center space-x-4">
          {currentGameId && (
            <span className="text-sm">Game #{currentGameId}</span>
          )}
          <APIStatus status={apiStatus} />
          <LockStatus />
          {currentGameId && gameState && (
            <>
              <ReportsButton className="football-btn-secondary text-sm" />
              <button 
                onClick={onShowRoster}
                className="football-btn-secondary text-sm hover:bg-football-accent transition-colors"
                title="Manage game rosters and jersey numbers"
              >
                👥 Rosters
              </button>
            </>
          )}
          <button 
            onClick={() => window.location.href = '/strata_football/admin.php'}
            className="football-btn-secondary text-sm"
          >
            Admin Dashboard
          </button>
        </div>
      </div>
    </nav>
  );
};

// Roster Modal Component with separate roster loading
const RosterModal = ({ isOpen, onClose, gameId, onRosterUpdate }) => {
  const { rosters, loading, error } = useRosters(gameId);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex justify-between items-center">
          <h2 className="text-xl font-bold">Roster Management</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>
        <div className="p-6">
          {loading && <div className="text-center py-4">Loading rosters...</div>}
          {error && <div className="text-center py-4 text-red-600">Error: {error}</div>}
          {rosters && (
            <RosterManagement 
              rosters={rosters}
              gameId={gameId}
              onRosterUpdate={onRosterUpdate}
            />
          )}
        </div>
      </div>
    </div>
  );
};

const FootballGame = ({ showRosterModal, setShowRosterModal }) => {
  const { gameState: gameData, currentGameId, isLoading, refetchGameState, fetchGameState } = useGameState();
  const { startFlow } = useFootballFlow();
  const { driveModel } = useSimpleDriveModel(gameData);

  const handleRosterUpdate = async (updatedRosters) => {
    // Invalidate roster cache to force reload
    rosterManager.invalidateCache(currentGameId);
    setShowRosterModal(false);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-xl">Loading football game...</div>
      </div>
    );
  }

  if (!gameData) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-xl text-red-600">No game state available</div>
      </div>
    );
  }

  // Game Log action handlers
  const handlePlayDelete = async (playId) => {
    try {
      const response = await fetch('/strata_football/api/delete_play.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          game_id: currentGameId, 
          overall_play_num: playId 
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        debug.log('Play deleted:', result);
        // Refresh game state
        if (refetchGameState) refetchGameState();
      }
    } catch (error) {
      console.error('Error deleting play:', error);
    }
  };

  const handlePlayInsert = async (playNumber) => {
    try {
      const response = await fetch('/strata_football/api/insert_play.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          gameId: currentGameId, 
          playNumber: playNumber 
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        debug.log('Play inserted:', result);
        // Refresh game state
        if (refetchGameState) refetchGameState();
      }
    } catch (error) {
      console.error('Error inserting play:', error);
    }
  };

  const handlePlayReplace = async (playNumber) => {
    // Minimal viable implementation of play replacement
    debug.log('Replace play:', playNumber);
    
    try {
      // First, find the existing play data
      const existingPlay = gameData?.recent_plays?.find(play => 
        play.overall_play_num === playNumber || play.play_number === playNumber
      );
      
      if (!existingPlay) {
        debug.warn('Cannot find play to replace:', playNumber);
        return;
      }
      
      // Store the play data for the replacement flow
      const playToReplace = {
        playNumber: playNumber,
        existingData: existingPlay,
        isReplacement: true
      };
      
      // Set replacement context in flow state
      if (setReplacementContext) {
        setReplacementContext(playToReplace);
      }
      
      // Determine appropriate flow type from existing play
      let flowType = 'rush'; // default
      if (existingPlay.play_type || existingPlay.playType) {
        const playType = existingPlay.play_type || existingPlay.playType;
        switch (playType.toLowerCase()) {
          case 'pass':
            flowType = 'pass';
            break;
          case 'punt':
            flowType = 'punt';
            break;
          case 'kick':
            flowType = 'kick';
            break;
          case 'penalty':
            flowType = 'penalty';
            break;
          default:
            flowType = 'rush';
        }
      }
      
      debug.log(`Starting ${flowType} flow to replace play ${playNumber}`, existingPlay);
      
      // Open appropriate flow with existing data pre-populated
      startFlow(flowType, { 
        isReplacement: true, 
        playNumber: playNumber,
        existingData: existingPlay 
      });
      
    } catch (error) {
      console.error('Error initiating play replacement:', error);
      debug.error('Play replacement failed', error);
    }
  };

  const handlePlayEdit = (playId) => {
    // This is handled by the PlayEditModal in GameLog
    debug.log('Edit play:', playId);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Main content - Three column layout */}
      <div className="flex flex-1">
        {/* Left Sidebar - Team/Player Stats (20%) - Full height */}
        <div className="w-1/5 bg-white border-r border-black">
          <TeamPlayerStats 
            gameState={gameData} 
            gameId={currentGameId}
            refreshKey={gameData?.playLog?.length || 0}
          />
        </div>
        
        {/* Middle Section - Scoreboard + Drive Status + Play Input Controls (65%) */}
        <div className="w-main-content bg-white flex flex-col">
          {/* Scoreboard - matches input container width */}
          <Scoreboard gameState={gameData} />
          
          {/* Drive Summary Chips - matches input container width */}
          <DriveSummaryChips model={driveModel} />
          
          {/* Play Input Controls */}
          <div className="flex-1">
            <EventControls gameState={gameData} />
          </div>
          
          {/* Input Assistant - anchored to bottom of middle section, matches input container width */}
          <InputAssistant gameState={gameData} />
        </div>
        
        {/* Right Sidebar - Play Log (15%) - Full height */}
        <div className="w-sidebar-right">
          <GameLog 
            gameState={gameData} 
            gameId={currentGameId}
          />
        </div>
      </div>

      {/* Roster Management Modal */}
      <RosterModal
        isOpen={showRosterModal}
        onClose={() => setShowRosterModal(false)}
        gameId={currentGameId}
        onRosterUpdate={handleRosterUpdate}
      />
    </div>
  );
};

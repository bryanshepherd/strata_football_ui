import React, { useState } from 'react';
import { useGameState } from '../contexts/FootballGameContext';

export default function ReportsButton({ className = '' }) {
  const [showDropdown, setShowDropdown] = useState(false);
  const { gameData } = useGameState();

  const handleReportsClick = () => {
    // Open reports in new window/tab
    window.open('/strata_football/reports.php', '_blank');
  };

  const handleQuickieReport = () => {
    const gameId = gameData?.gameId || 1000; // fallback to test game
    window.open(`/quickie?game_id=${gameId}`, '_blank');
    setShowDropdown(false);
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setShowDropdown(!showDropdown)}
        className={`football-btn-secondary ${className} flex items-center gap-1`}
        title="Open game reports and statistics"
      >
        📊 Reports
        <span className="text-xs">▼</span>
      </button>
      
      {showDropdown && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[150px]">
          <div className="py-1">
            <button
              onClick={handleReportsClick}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
            >
              📋 Full Reports
            </button>
            <button
              onClick={handleQuickieReport}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
            >
              ⚡ Quickie Report
            </button>
          </div>
        </div>
      )}
      
      {/* Click outside to close */}
      {showDropdown && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowDropdown(false)}
        />
      )}
    </div>
  );
}

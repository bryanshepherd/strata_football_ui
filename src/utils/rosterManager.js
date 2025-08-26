// Roster utility for caching and loading roster data
class RosterManager {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    this.loadingPromises = new Map();
  }

  // Get cache key for game rosters
  getCacheKey(gameId) {
    return `rosters_${gameId}`;
  }

  // Check if cached data is still valid
  isCacheValid(cacheEntry) {
    return cacheEntry && (Date.now() - cacheEntry.timestamp) < this.cacheTimeout;
  }

  // Get rosters with caching
  async getRosters(gameId) {
    const cacheKey = this.getCacheKey(gameId);
    const cached = this.cache.get(cacheKey);

    // Return cached data if valid
    if (this.isCacheValid(cached)) {
      return cached.data;
    }

    // Return existing promise if already loading
    if (this.loadingPromises.has(cacheKey)) {
      return this.loadingPromises.get(cacheKey);
    }

    // Create new loading promise
    const loadingPromise = this.loadRostersFromAPI(gameId)
      .then(data => {
        // Cache the result
        this.cache.set(cacheKey, {
          data,
          timestamp: Date.now()
        });
        
        // Clean up loading promise
        this.loadingPromises.delete(cacheKey);
        
        return data;
      })
      .catch(error => {
        // Clean up loading promise on error
        this.loadingPromises.delete(cacheKey);
        throw error;
      });

    // Store loading promise
    this.loadingPromises.set(cacheKey, loadingPromise);
    
    return loadingPromise;
  }

  // Load rosters from API
  async loadRostersFromAPI(gameId) {
    try {
      const response = await fetch(`/strata_football/api/get_rosters.php?gameId=${gameId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to load rosters');
      }
      
      return result.rosters;
    } catch (error) {
      console.error('Error loading rosters:', error);
      throw error;
    }
  }

  // Invalidate cache for a specific game
  invalidateCache(gameId) {
    const cacheKey = this.getCacheKey(gameId);
    this.cache.delete(cacheKey);
    this.loadingPromises.delete(cacheKey);
  }

  // Clear all cache
  clearCache() {
    this.cache.clear();
    this.loadingPromises.clear();
  }

  // Get cache statistics
  getCacheStats() {
    return {
      cacheSize: this.cache.size,
      loadingPromises: this.loadingPromises.size,
      cacheEntries: Array.from(this.cache.keys())
    };
  }
}

// Create singleton instance
export const rosterManager = new RosterManager();

// React hook for using rosters
import { useState, useEffect } from 'react';
import debug from '../utils/debug';

export function useRosters(gameId) {
  const [rosters, setRosters] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!gameId) {
      setLoading(false);
      return;
    }

    let mounted = true;

    const loadRosters = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const rosterData = await rosterManager.getRosters(gameId);
        
        if (mounted) {
          setRosters(rosterData);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError(err.message);
          setLoading(false);
        }
      }
    };

    loadRosters();

    return () => {
      mounted = false;
    };
  }, [gameId]);

  return { rosters, loading, error };
}

// Utility functions for roster data
export const rosterUtils = {
  // Get player by ID from rosters
  getPlayer: (rosters, playerId) => {
    if (!rosters || !playerId) return null;
    
    // Search in home team
    const homePlayer = rosters.home?.find(p => p.player_id === playerId);
    if (homePlayer) return { ...homePlayer, team: 'home' };
    
    // Search in visitor team
    const visitorPlayer = rosters.visitor?.find(p => p.player_id === playerId);
    if (visitorPlayer) return { ...visitorPlayer, team: 'visitor' };
    
    return null;
  },

  // Get player name by ID
  getPlayerName: (rosters, playerId) => {
    const player = rosterUtils.getPlayer(rosters, playerId);
    return player ? `${player.first_name} ${player.last_name}` : 'Unknown Player';
  },

  // Get player number by ID
  getPlayerNumber: (rosters, playerId) => {
    const player = rosterUtils.getPlayer(rosters, playerId);
    return player ? player.jersey_number : '?';
  },

  // Get players by team
  getTeamRoster: (rosters, team) => {
    if (!rosters) return [];
    return rosters[team] || [];
  },

  // Filter players by position
  getPlayersByPosition: (rosters, team, position) => {
    const teamRoster = rosterUtils.getTeamRoster(rosters, team);
    return teamRoster.filter(player => player.position === position);
  },

  // Get roster statistics
  getRosterStats: (rosters) => {
    if (!rosters) return { home: 0, visitor: 0, total: 0 };
    
    const homeCount = rosters.home?.length || 0;
    const visitorCount = rosters.visitor?.length || 0;
    
    return {
      home: homeCount,
      visitor: visitorCount,
      total: homeCount + visitorCount
    };
  }
};

export default rosterManager;

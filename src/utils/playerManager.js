// Player utility for efficient player data management
class PlayerManager {
  constructor() {
    this.playerCache = new Map(); // Cache player details by PlayerID
    this.jerseyCache = new Map(); // Cache jersey → PlayerID mappings by game
    this.cacheTimeout = 60 * 60 * 1000; // 1 hour for player details
    this.jerseyCacheTimeout = 30 * 60 * 1000; // 30 minutes for jersey mappings
    this.loadingPromises = new Map();
  }

  // Get cache key for jersey lookups
  getJerseyCacheKey(gameId, team, jerseyNumber) {
    return `jersey_${gameId}_${team}_${jerseyNumber}`;
  }

  // Get cache key for player details
  getPlayerCacheKey(playerId) {
    return `player_${playerId}`;
  }

  // Check if cached data is still valid
  isCacheValid(cacheEntry, timeout = this.cacheTimeout) {
    return cacheEntry && (Date.now() - cacheEntry.timestamp) < timeout;
  }

  // Get PlayerID by jersey number with caching
  async getPlayerIdByJersey(gameId, team, jerseyNumber) {
    const cacheKey = this.getJerseyCacheKey(gameId, team, jerseyNumber);
    const cached = this.jerseyCache.get(cacheKey);

    // Return cached data if valid
    if (this.isCacheValid(cached, this.jerseyCacheTimeout)) {
      return cached.data;
    }

    // Return existing promise if already loading
    if (this.loadingPromises.has(cacheKey)) {
      return this.loadingPromises.get(cacheKey);
    }

    // Create new loading promise
    const loadingPromise = this.loadPlayerIdFromAPI(gameId, team, jerseyNumber)
      .then(data => {
        // Cache the result
        this.jerseyCache.set(cacheKey, {
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

  // Load PlayerID from API
  async loadPlayerIdFromAPI(gameId, team, jerseyNumber) {
    try {
      const response = await fetch(
        `/strata_football/api/get_player_by_jersey.php?gameId=${gameId}&team=${team}&jerseyNumber=${jerseyNumber}`
      );
      
      if (!response.ok) {
        if (response.status === 404) {
          return null; // Player not found
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to load player ID');
      }
      
      return result.player_id;
    } catch (error) {
      console.error('Error loading player ID by jersey:', error);
      throw error;
    }
  }

  // Get player details by PlayerID with caching
  async getPlayerDetails(playerId) {
    if (!playerId) return null;

    const cacheKey = this.getPlayerCacheKey(playerId);
    const cached = this.playerCache.get(cacheKey);

    // Return cached data if valid
    if (this.isCacheValid(cached)) {
      return cached.data;
    }

    // Return existing promise if already loading
    if (this.loadingPromises.has(cacheKey)) {
      return this.loadingPromises.get(cacheKey);
    }

    // Create new loading promise
    const loadingPromise = this.loadPlayerDetailsFromAPI(playerId)
      .then(data => {
        // Cache the result
        this.playerCache.set(cacheKey, {
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

  // Load player details from API
  async loadPlayerDetailsFromAPI(playerId) {
    try {
      const response = await fetch(
        `/strata_football/api/get_player_details.php?playerId=${playerId}`
      );
      
      if (!response.ok) {
        if (response.status === 404) {
          return null; // Player not found
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to load player details');
      }
      
      return result.player;
    } catch (error) {
      console.error('Error loading player details:', error);
      throw error;
    }
  }

  // Bulk load player details
  async bulkLoadPlayerDetails(playerIds) {
    if (!playerIds || !playerIds.length) return {};

    // Filter out already cached players
    const uncachedIds = playerIds.filter(id => {
      const cached = this.playerCache.get(this.getPlayerCacheKey(id));
      return !this.isCacheValid(cached);
    });

    // If all players are cached, return cached data
    if (uncachedIds.length === 0) {
      const result = {};
      playerIds.forEach(id => {
        const cached = this.playerCache.get(this.getPlayerCacheKey(id));
        if (cached) {
          result[id] = cached.data;
        }
      });
      return result;
    }

    try {
      // Load uncached players in bulk
      const response = await fetch('/strata_football/api/get_player_details.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ playerIds: uncachedIds })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to bulk load player details');
      }

      // Cache the loaded players
      Object.entries(result.players).forEach(([playerId, playerData]) => {
        this.playerCache.set(this.getPlayerCacheKey(playerId), {
          data: playerData,
          timestamp: Date.now()
        });
      });

      // Return combined cached + newly loaded data
      const combined = {};
      playerIds.forEach(id => {
        const cached = this.playerCache.get(this.getPlayerCacheKey(id));
        if (cached) {
          combined[id] = cached.data;
        }
      });

      return combined;
    } catch (error) {
      console.error('Error bulk loading player details:', error);
      throw error;
    }
  }

  // Get player name by ID (convenience method)
  async getPlayerName(playerId) {
    const details = await this.getPlayerDetails(playerId);
    return details ? details.full_name : 'Unknown Player';
  }

  // Get player by jersey number (combines both API calls)
  async getPlayerByJersey(gameId, team, jerseyNumber) {
    try {
      const playerId = await this.getPlayerIdByJersey(gameId, team, jerseyNumber);
      if (!playerId) return null;

      const details = await this.getPlayerDetails(playerId);
      return details;
    } catch (error) {
      console.error('Error getting player by jersey:', error);
      return null;
    }
  }

  // Invalidate caches
  invalidateJerseyCache(gameId) {
    const keysToDelete = [];
    for (const key of this.jerseyCache.keys()) {
      if (key.startsWith(`jersey_${gameId}_`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.jerseyCache.delete(key));
  }

  invalidatePlayerCache(playerId) {
    const key = this.getPlayerCacheKey(playerId);
    this.playerCache.delete(key);
  }

  // Clear all caches
  clearAllCaches() {
    this.playerCache.clear();
    this.jerseyCache.clear();
    this.loadingPromises.clear();
  }

  // Get cache statistics
  getCacheStats() {
    return {
      playerCacheSize: this.playerCache.size,
      jerseyCacheSize: this.jerseyCache.size,
      loadingPromises: this.loadingPromises.size
    };
  }
}

// Create singleton instance
export const playerManager = new PlayerManager();

// React hook for using player data
import { useState, useEffect } from 'react';
import debug from '../utils/debug';

export function usePlayer(playerId) {
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!playerId) {
      setPlayer(null);
      setLoading(false);
      return;
    }

    let mounted = true;

    const loadPlayer = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const playerData = await playerManager.getPlayerDetails(playerId);
        
        if (mounted) {
          setPlayer(playerData);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError(err.message);
          setLoading(false);
        }
      }
    };

    loadPlayer();

    return () => {
      mounted = false;
    };
  }, [playerId]);

  return { player, loading, error };
}

export function usePlayerByJersey(gameId, team, jerseyNumber) {
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!gameId || !team || !jerseyNumber) {
      setPlayer(null);
      setLoading(false);
      return;
    }

    let mounted = true;

    const loadPlayer = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const playerData = await playerManager.getPlayerByJersey(gameId, team, jerseyNumber);
        
        if (mounted) {
          setPlayer(playerData);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError(err.message);
          setLoading(false);
        }
      }
    };

    loadPlayer();

    return () => {
      mounted = false;
    };
  }, [gameId, team, jerseyNumber]);

  return { player, loading, error };
}

// Utility functions
export const playerUtils = {
  // Extract player IDs from minimal roster data
  extractPlayerIds: (minimalRosters) => {
    const ids = [];
    if (minimalRosters?.home) {
      ids.push(...minimalRosters.home.map(p => p.player_id).filter(id => id));
    }
    if (minimalRosters?.visitor) {
      ids.push(...minimalRosters.visitor.map(p => p.player_id).filter(id => id));
    }
    return [...new Set(ids)]; // Remove duplicates
  },

  // Get jersey number by player ID from minimal roster
  getJerseyByPlayerId: (minimalRosters, playerId) => {
    const allPlayers = [
      ...(minimalRosters?.home || []),
      ...(minimalRosters?.visitor || [])
    ];
    
    const player = allPlayers.find(p => p.player_id === playerId);
    return player?.jersey_number || null;
  }
};

export default playerManager;

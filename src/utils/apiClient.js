/**
 * Standardized API client for Strata Football UI
 * 
 * Provides consistent error handling, response normalization, and 
 * debugging capabilities for all API calls.
 */

import debug from './debug.js';

/**
 * API Base URL - points to XAMPP backend through Vite proxy
 */
const API_BASE = '/strata_football/api/';

/**
 * Normalize URL to ensure it uses the correct base path
 * @param {string} url - Raw URL or endpoint
 * @returns {string} - Normalized URL
 */
export function normalizeUrl(url) {
  // If URL already starts with /strata_football or is absolute, use as-is
  if (url.startsWith('/strata_football') || url.startsWith('http')) {
    return url;
  }
  
  // If URL starts with 'api/', strip it since we're adding the base
  if (url.startsWith('api/')) {
    return API_BASE + url.substring(4);
  }
  
  // Otherwise, prepend the base
  return API_BASE + url;
}

/**
 * Standardized fetch wrapper with consistent response handling
 * @param {string} url - API endpoint URL
 * @param {object} options - Fetch options
 * @returns {Promise} - Normalized response data
 */
export async function apiFetch(url, options = {}) {
  const normalizedUrl = normalizeUrl(url);
  debug.log('[API] Request:', { originalUrl: url, normalizedUrl, options });
  
  try {
    const res = await fetch(normalizedUrl, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    
    const contentType = res.headers.get('content-type') || '';
    const body = contentType.includes('application/json') 
      ? await res.json() 
      : await res.text();
    
    debug.log('[API] Response:', { originalUrl: url, normalizedUrl, status: res.status, body });
    
    // Normalize to a common shape
    if (typeof body === 'object' && body && 'success' in body) {
      if (!body.success) {
        const error = new Error(body.error || 'Unknown API error');
        error.apiResponse = body;
        throw error;
      }
      // Return the full body for successful responses, not just body.data
      // Many endpoints return data directly in the response body
      return body.data ?? body;
    }
    
    // Fallback: wrap raw responses
    if (res.ok && typeof body === 'object') return body;
    
    if (!res.ok) {
      const error = new Error(`HTTP ${res.status}: ${res.statusText}`);
      error.status = res.status;
      error.response = body;
      throw error;
    }
    
    return body;
    
  } catch (error) {
    debug.error('[API] Error:', { url, error: error.message });
    throw error;
  }
}

/**
 * GET request wrapper
 * @param {string} url - API endpoint
 * @returns {Promise} - Response data
 */
export async function apiGet(url) {
  return apiFetch(url, { method: 'GET' });
}

/**
 * POST request wrapper  
 * @param {string} url - API endpoint
 * @param {object} data - Request payload
 * @returns {Promise} - Response data
 */
export async function apiPost(url, data = {}) {
  return apiFetch(url, {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

/**
 * PUT request wrapper
 * @param {string} url - API endpoint  
 * @param {object} data - Request payload
 * @returns {Promise} - Response data
 */
export async function apiPut(url, data = {}) {
  return apiFetch(url, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

/**
 * DELETE request wrapper
 * @param {string} url - API endpoint
 * @returns {Promise} - Response data
 */
export async function apiDelete(url) {
  return apiFetch(url, { method: 'DELETE' });
}

/**
 * Football-specific API endpoints
 */
export const footballAPI = {
  /**
   * Load game state
   * @param {string|number} gameId - Game identifier
   * @returns {Promise} - Game state data
   */
  async loadGameState(gameId) {
    return apiGet(`api/load_game_state.php?game_id=${gameId}`);
  },

  /**
   * Submit a play
   * @param {object} playData - Play data to submit
   * @returns {Promise} - Submission response
   */
  async submitPlay(playData) {
    return apiPost('api/submit_play.php', playData);
  },

  /**
   * Start scoring for a game
   * @param {string|number} gameId - Game identifier
   * @returns {Promise} - Start scoring response
   */
  async startScoring(gameId) {
    return apiPost('api/start_scoring.php', { game_id: gameId });
  },

  /**
   * End scoring for a game  
   * @param {string|number} gameId - Game identifier
   * @returns {Promise} - End scoring response
   */
  async endScoring(gameId) {
    return apiPost('api/end_scoring.php', { game_id: gameId });
  },

  /**
   * Get available games
   * @returns {Promise} - Games list
   */
  async getGames() {
    return apiGet('api/get_games.php');
  }
};

/**
 * Stats API helpers
 */
export async function getTeamTotals(gameId){
  const r = await fetch(`/strata_football/api/stats/get_team_totals.php?game_id=${gameId}`);
  const j = await r.json();
  if (!j.success) throw new Error(j.error||'team totals failed');
  return j.teams || [];
}

export async function getPlayerTotals(gameId){
  const r = await fetch(`/strata_football/api/stats/get_player_totals.php?game_id=${gameId}`);
  const j = await r.json();
  if (!j.success) throw new Error(j.error||'player totals failed');
  return j;
}

/**
 * Error handler for API calls with user-friendly messages
 * @param {Error} error - API error
 * @returns {string} - User-friendly error message
 */
export function getApiErrorMessage(error) {
  if (error.status === 404) {
    return 'The requested resource was not found.';
  }
  
  if (error.status === 500) {
    return 'Server error. Please try again later.';
  }
  
  if (error.status >= 400 && error.status < 500) {
    return 'Invalid request. Please check your input.';
  }
  
  if (error.message && error.message.includes('fetch')) {
    return 'Network error. Please check your connection.';
  }
  
  return error.message || 'An unexpected error occurred.';
}
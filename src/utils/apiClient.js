/**
 * Standardized API client for Strata Football UI
 * 
 * Provides consistent error handling, response normalization, and 
 * debugging capabilities for all API calls.
 */

import { debug } from './debug.js';

/**
 * Standardized fetch wrapper with consistent response handling
 * @param {string} url - API endpoint URL
 * @param {object} options - Fetch options
 * @returns {Promise} - Normalized response data
 */
export async function apiFetch(url, options = {}) {
  debug.api('API Request:', { url, options });
  
  try {
    const res = await fetch(url, {
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
    
    debug.api('API Response:', { url, status: res.status, body });
    
    // Normalize to a common shape
    if (typeof body === 'object' && body && 'success' in body) {
      if (!body.success) {
        const error = new Error(body.error || 'Unknown API error');
        error.apiResponse = body;
        throw error;
      }
      return body.data ?? null;
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
    debug.api('API Error:', { url, error: error.message });
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
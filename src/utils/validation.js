/**
 * Centralized validation utilities for Strata Football UI
 * 
 * This module provides consistent validation and normalization functions
 * to be used throughout the application for data integrity.
 */

/**
 * Validates yard line format
 * Accepts: H25, V03, 50 (enforces 2-digit padding for team sides)
 * @param {string} value - Yard line value to validate
 * @returns {boolean} - True if valid format
 */
export const validateYardLine = (value) => {
  if (!value) return false;
  const normalized = String(value).toUpperCase().trim();
  return /^(H|V)\d{2}$|^50$/.test(normalized);
};

/**
 * Normalizes yard line to consistent format
 * Converts h5 -> H05, V7 -> V07, etc.
 * @param {string} value - Raw yard line input
 * @returns {string} - Normalized yard line (H05, V07, 50)
 */
export const normalizeYardLine = (value) => {
  if (!value) return '';
  
  const trimmed = String(value).trim();
  if (trimmed === '50') return '50';
  
  const team = trimmed[0]?.toUpperCase();
  const numPart = trimmed.slice(1);
  const num = parseInt(numPart, 10);
  
  if ((team === 'H' || team === 'V') && !isNaN(num) && num >= 0 && num <= 50) {
    return `${team}${String(num).padStart(2, '0')}`;
  }
  
  // Return original if can't normalize
  return trimmed;
};

/**
 * Validates jersey number format
 * Accepts: 0-99 (string or number)
 * @param {string|number} num - Jersey number to validate
 * @returns {boolean} - True if valid jersey number
 */
export const validateJerseyNumber = (num) => {
  if (num === null || num === undefined) return false;
  const str = String(num).trim();
  return /^\d{1,2}$/.test(str) && parseInt(str, 10) >= 0 && parseInt(str, 10) <= 99;
};

/**
 * Validates clock format (MM:SS)
 * Accepts: 15:00, 0:30, etc.
 * @param {string} str - Clock string to validate
 * @returns {boolean} - True if valid clock format
 */
export const validateClock = (str) => {
  if (!str) return false;
  const trimmed = String(str).trim();
  if (!/^\d{1,2}:\d{2}$/.test(trimmed)) return false;
  
  const [mins, secs] = trimmed.split(':').map(Number);
  return mins >= 0 && mins <= 15 && secs >= 0 && secs <= 59;
};

/**
 * Validates down number (1-4)
 * @param {number|string} down - Down number to validate
 * @returns {boolean} - True if valid down
 */
export const validateDown = (down) => {
  const num = parseInt(down, 10);
  return !isNaN(num) && num >= 1 && num <= 4;
};

/**
 * Validates distance to go (1-99)
 * @param {number|string} distance - Distance to validate
 * @returns {boolean} - True if valid distance
 */
export const validateDistance = (distance) => {
  const num = parseInt(distance, 10);
  return !isNaN(num) && num >= 0 && num <= 99;
};

/**
 * Validates possession value
 * @param {string} possession - Possession to validate
 * @returns {boolean} - True if valid possession
 */
export const validatePossession = (possession) => {
  if (!possession) return false;
  const normalized = String(possession).toLowerCase().trim();
  return ['home', 'visitor', 'h', 'v'].includes(normalized);
};

/**
 * Normalizes possession to consistent format
 * @param {string} possession - Raw possession value
 * @returns {string} - Normalized possession ('home' or 'visitor')
 */
export const normalizePossession = (possession) => {
  if (!possession) return 'home';
  
  const normalized = String(possession).toLowerCase().trim();
  switch (normalized) {
    case 'h':
    case 'home':
    case '1':
      return 'home';
    case 'v':
    case 'visitor':
    case 'away':
    case '2':
      return 'visitor';
    default:
      return 'home'; // Default fallback
  }
};

/**
 * Validates play type
 * @param {string} playType - Play type to validate
 * @returns {boolean} - True if valid play type
 */
export const validatePlayType = (playType) => {
  const validTypes = ['rush', 'pass', 'punt', 'kick', 'penalty', 'timeout', 'gamecontrol'];
  return validTypes.includes(String(playType).toLowerCase());
};

/**
 * Validation result object structure
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether validation passed
 * @property {string} [error] - Error message if validation failed
 */

/**
 * Comprehensive field validation with error messages
 * @param {string} field - Field name
 * @param {any} value - Value to validate
 * @returns {ValidationResult} - Validation result with error message
 */
export const validateField = (field, value) => {
  switch (field) {
    case 'yardLine':
    case 'startYardLine':
    case 'endYardLine':
    case 'finalYardLine':
      return validateYardLine(value) 
        ? { valid: true }
        : { valid: false, error: 'Invalid format. Use H25, V03, or 50' };
        
    case 'jerseyNumber':
      return validateJerseyNumber(value)
        ? { valid: true }
        : { valid: false, error: 'Jersey number must be 0-99' };
        
    case 'clock':
    case 'timeRemaining':
      return validateClock(value)
        ? { valid: true }
        : { valid: false, error: 'Invalid time format. Use MM:SS' };
        
    case 'down':
      return validateDown(value)
        ? { valid: true }
        : { valid: false, error: 'Down must be 1-4' };
        
    case 'distance':
    case 'yardsToGo':
      return validateDistance(value)
        ? { valid: true }
        : { valid: false, error: 'Distance must be 0-99 yards' };
        
    case 'possession':
      return validatePossession(value)
        ? { valid: true }
        : { valid: false, error: 'Possession must be home, visitor, H, or V' };
        
    case 'playType':
      return validatePlayType(value)
        ? { valid: true }
        : { valid: false, error: 'Invalid play type' };
        
    default:
      return { valid: true }; // Unknown fields pass by default
  }
};
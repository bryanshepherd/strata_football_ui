import React, { useState, useEffect } from 'react';
import { validateYardLine, normalizeYardLine, validateField } from '../utils/validation';

const YardlineInput = ({ 
  label, 
  value, 
  onChange, 
  required = false, 
  placeholder = "Enter yard line (V25, H30, etc.)",
  className = "",
  disabled = false,
  includeEndZones = false,
  autoFocus = false
}) => {
  const [inputValue, setInputValue] = useState(value || '');
  const [error, setError] = useState('');

  useEffect(() => {
    if (value && value !== inputValue) {
      setInputValue(value);
    }
  }, [value]);

  const validateYardlineFormat = (input) => {
    if (!input) return { isValid: true, error: '' };
    
    // Use centralized validation with normalization
    const normalized = normalizeYardLine(input);
    const validation = validateField('yardLine', normalized);
    
    if (!validation.valid) {
      return { isValid: false, error: validation.error };
    }
    
    // Additional range validation for end zones
    const cleanInput = normalized.toUpperCase();
    if (cleanInput === '50') {
      return { isValid: true, error: '', num: 50, side: null };
    }
    
    const side = cleanInput[0];
    const num = parseInt(cleanInput.slice(1), 10);
    
    if (includeEndZones) {
      if (num < 0 || num > 50) {
        return { 
          isValid: false, 
          error: 'Yard line must be between 0-50 (0 = goal line)' 
        };
      }
    } else {
      if (num < 1 || num > 50) {
        return { 
          isValid: false, 
          error: 'Yard line must be between 1-50' 
        };
      }
    }
    
    return { isValid: true, error: '', num, side };
  };

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    
    const validation = validateYardlineFormat(newValue);
    
    if (validation.isValid) {
      setError('');
      // Use normalized format
      const normalized = normalizeYardLine(newValue);
      onChange(normalized);
    } else {
      setError(validation.error);
      onChange(newValue); // Still pass the raw value for intermediate states
    }
  };

  const getYardlineDisplay = () => {
    const validation = validateYardlineFormat(inputValue);
    if (!validation.isValid || !inputValue) return '';
    
    const { num, side } = validation;
    const sideName = side === 'V' ? 'VISITOR' : 'HOME';
    
    if (num === 50) {
      return '50 Yard Line';
    } else if (num === 0 && includeEndZones) {
      return `${sideName} Goal Line`;
    } else {
      return `${sideName} ${num}`;
    }
  };

  return (
    <div className={`${className}`}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      
      {/* Single Yard Line Input with Side */}
      <div className="flex-1">
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          className={`
            w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm 
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
            ${error ? 'border-red-300' : ''}
            ${required && !inputValue ? 'border-red-300' : ''}
          `}
        />
      </div>

      {/* Display formatted yard line */}
      {inputValue && !error && (
        <div className="mt-1 text-sm text-gray-600">
          Position: {getYardlineDisplay()}
        </div>
      )}

      {/* Error message */}
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}

      {/* Required field error */}
      {required && !inputValue && (
        <p className="mt-1 text-sm text-red-600">This field is required</p>
      )}

      {/* Help text */}
      <div className="mt-1 text-xs text-gray-500">
        {includeEndZones 
          ? "Format: V0 or H0 for goal line, V1-V50 or H1-H50 for field positions" 
          : "Format: V1-V50 or H1-H50 (V = Visitor, H = Home, 50 = midfield)"
        }
      </div>
    </div>
  );
};

export default YardlineInput;

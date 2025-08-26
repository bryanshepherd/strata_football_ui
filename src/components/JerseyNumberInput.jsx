import React, { useState, useEffect, useRef } from 'react';
import { validateJerseyNumber } from '../utils/validation';

export default function JerseyNumberInput({ label = 'Jersey #', value, onChange, autoFocus=true, onEnter }) {
  const [local, setLocal] = useState(value ?? '');
  const [error, setError] = useState('');
  const ref = useRef(null);

  useEffect(() => { if (autoFocus && ref.current) ref.current.focus(); }, [autoFocus]);

  useEffect(() => { setLocal(value ?? ''); }, [value]);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        className={`w-full border rounded px-3 py-2 ${error ? 'border-red-500' : ''}`}
        placeholder="Enter jersey number"
        value={local}
        onChange={(e) => {
          const v = e.target.value.replace(/[^0-9]/g,'');
          setLocal(v);
          
          // Validate jersey number
          if (v && !validateJerseyNumber(v)) {
            setError('Jersey number must be 0-99');
          } else {
            setError('');
          }
          
          onChange?.(v);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onEnter?.(local);
          if (e.key === 'Escape') ref.current?.blur();
        }}
      />
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}

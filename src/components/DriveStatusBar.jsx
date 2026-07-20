// src/components/DriveStatusBar.jsx
import React from 'react';
import PropTypes from 'prop-types';
import { toPossessionRelative } from '../utils/DownDistanceCalculator';

export default function DriveStatusBar({ model }) {
  if (!model) return null;
  
  const pct = (pos) => Math.max(0, Math.min(100, toPossessionRelative(pos, model.offense)));

  const startPct = pct(model.start);
  const currPct  = pct(model.current);
  const left     = Math.min(startPct, currPct);
  const width    = Math.abs(currPct - startPct);

  const formatBreakdown = (breakdown) => {
    if (!breakdown) return '';
    const { rush, pass, pen, fdRush, fdPass, fdPen } = breakdown;
    const parts = [];
    if (rush !== 0 || fdRush > 0) parts.push(`R:${rush >= 0 ? '+' : ''}${rush} (${fdRush})`);
    if (pass !== 0 || fdPass > 0) parts.push(`P:${pass >= 0 ? '+' : ''}${pass} (${fdPass})`);
    if (pen !== 0 || fdPen > 0) parts.push(`⚑:${pen >= 0 ? '+' : ''}${pen} (${fdPen})`);
    return parts.join(' · ');
  };

  return (
    <div className="bg-slate-800 rounded-lg p-3 my-2 font-sans">
      <div className="flex gap-2 mb-2 flex-wrap">
        <span className="bg-slate-700 text-slate-200 px-2 py-1 rounded text-xs font-medium whitespace-nowrap">
          {model.offense === 'H' ? 'Home' : 'Visitor'}
        </span>
        {model.number != null && (
          <span className="bg-slate-700 text-slate-200 px-2 py-1 rounded text-xs font-medium whitespace-nowrap">
            Drive {model.number}
          </span>
        )}
        {(model.down && model.distance) ? (
          <span className="bg-slate-700 text-slate-200 px-2 py-1 rounded text-xs font-medium whitespace-nowrap">
            {model.down}&{model.distance}
          </span>
        ) : (
          <span className="bg-amber-500 text-slate-900 px-2 py-1 rounded text-xs font-medium whitespace-nowrap">
            D&D n/a
          </span>
        )}
        <span className="bg-slate-700 text-slate-200 px-2 py-1 rounded text-xs font-medium whitespace-nowrap">
          {model.start} → {model.current}
        </span>
        <span className="bg-emerald-600 text-white px-2 py-1 rounded text-xs font-medium whitespace-nowrap">
          {model.yardsSoFar >= 0 ? '+' : ''}{model.yardsSoFar} yds
        </span>
        {model.breakdown && (
          <span 
            className="bg-indigo-600 text-white px-2 py-1 rounded text-xs font-mono whitespace-nowrap"
            title="Rush:yards(1stDowns) · Pass:yards(1stDowns) · Penalty:yards(1stDowns)"
          >
            {formatBreakdown(model.breakdown)}
          </span>
        )}
      </div>

      <div 
        className="relative h-5 bg-gradient-to-r from-red-600 via-green-600 to-red-600 rounded-full border border-slate-600"
        role="progressbar" 
        aria-valuemin={0} 
        aria-valuemax={100} 
        aria-valuenow={currPct}
      >
        {/* Start marker */}
        <div 
          className="absolute -top-0.5 w-0.5 h-6 bg-amber-400 rounded-sm"
          style={{ left: `${startPct}%`, transform: 'translateX(-1px)' }}
          title={`Start ${model.start}`}
        />
        
        {/* Progress fill */}
        <div 
          className="absolute top-0 h-full bg-blue-500 bg-opacity-60 rounded-full border border-blue-500"
          style={{ left: `${left}%`, width: `${width}%` }}
        />
        
        {/* Midfield marker */}
        <div 
          className="absolute top-0 w-0.5 h-full bg-slate-100"
          style={{ left: '50%', transform: 'translateX(-1px)' }}
          title="Midfield"
        />
        
        {/* Event markers */}
        {model.events.map((e, i) => (
          <div
            key={i}
            className={`absolute top-0.5 w-1.5 h-4 rounded-sm ${
              e.t === 'fd' ? 'bg-green-500' :
              e.t === 'flag' ? 'bg-amber-500' :
              'bg-red-500 border border-white'
            }`}
            style={{ left: `${e.atPct}%`, transform: 'translateX(-3px)' }}
            title={`${e.t} at ${e.atPct.toFixed(0)}%`}
          />
        ))}
        
        {/* Ball position */}
        <div 
          className="absolute -top-0.5 w-3 h-3 bg-slate-100 border-2 border-slate-900 rounded-full z-10"
          style={{ left: `${currPct}%`, transform: 'translateX(-6px)' }}
          title={`Ball on ${model.current}`}
        />
      </div>
    </div>
  );
}

DriveStatusBar.propTypes = {
  model: PropTypes.shape({
    offense: PropTypes.oneOf(['H', 'V']).isRequired,
    number: PropTypes.number,
    start: PropTypes.string.isRequired,
    current: PropTypes.string.isRequired,
    down: PropTypes.number,
    distance: PropTypes.number,
    yardsSoFar: PropTypes.number.isRequired,
    events: PropTypes.arrayOf(PropTypes.shape({
      t: PropTypes.oneOf(['fd', 'flag', 'score']).isRequired,
      atPct: PropTypes.number.isRequired
    })).isRequired,
    breakdown: PropTypes.shape({
      rush: PropTypes.number,
      pass: PropTypes.number,
      pen: PropTypes.number,
      fdRush: PropTypes.number,
      fdPass: PropTypes.number,
      fdPen: PropTypes.number
    })
  })
};
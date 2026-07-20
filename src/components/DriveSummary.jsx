// src/components/DriveSummary.jsx
import React from 'react';
import PropTypes from 'prop-types';
import { fmtMMSS } from '../utils/simpleDriveModel';

export default function DriveSummary({ model }) {
  if (!model) return null;

  return (
    <div className="bg-slate-100 border border-slate-300 rounded-lg p-3 space-y-2 text-sm">
      <div className="flex justify-between items-center">
        <span className="font-medium text-slate-600">Start:</span>
        <span className="font-mono text-slate-900">{model.start}</span>
      </div>

      <div className="flex justify-between items-center">
        <span className="font-medium text-slate-600">Time Gained:</span>
        <span className="font-mono text-slate-900">{fmtMMSS(model.timeGainedSec)}</span>
      </div>

      <div className="flex justify-between items-center">
        <span className="font-medium text-slate-600">How Gained:</span>
        <span className="text-slate-900">{model.howGained ?? '—'}</span>
      </div>

      <div className="flex justify-between items-center">
        <span className="font-medium text-slate-600">Plays:</span>
        <span className="text-slate-900">Rush – {model.playsRush} | Pass – {model.playsPass}</span>
      </div>

      <div className="flex justify-between items-center">
        <span className="font-medium text-slate-600">Penalties:</span>
        <span className="text-slate-900">{model.penCount} for {model.penYards >= 0 ? '+' : ''}{model.penYards} yards</span>
      </div>
    </div>
  );
}

DriveSummary.propTypes = {
  model: PropTypes.shape({
    start: PropTypes.string.isRequired,
    timeGainedSec: PropTypes.number.isRequired,
    howGained: PropTypes.string,
    playsRush: PropTypes.number.isRequired,
    playsPass: PropTypes.number.isRequired,
    penCount: PropTypes.number.isRequired,
    penYards: PropTypes.number.isRequired,
  })
};
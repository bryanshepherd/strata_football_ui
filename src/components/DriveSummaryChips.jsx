import React from 'react';
import PropTypes from 'prop-types';

export default function DriveSummaryChips({ model, loading }) {
  // Debug logging
  React.useEffect(() => {
    console.log('[DriveSummaryChips] model=', model);
  }, [model]);

  if (loading || !model) return null;

  return (
    <div className="chips-row text-base md:text-lg">
      <span className="chip">
        Possession: {model.possessionLabel} • Drive {model.driveNumber ?? '-'}
      </span>

      <span className="chip">
        Start: {model.startSpot || '-'}
      </span>

      <span className="chip">
        Yards: {typeof model.yardsGained === 'number' ? model.yardsGained : 0}
      </span>

      <span className="chip">
        Start Time: {model.startTimeText ?? '15:00'}
      </span>

      <span className="chip">
        TOP: {model.topElapsedText ?? '0:00'}
      </span>

      <span className="chip">
        How Gained: {model.howGained || '-'}
      </span>

      <span className="chip">
        Plays: Rush - {model.playsRush ?? 0} | Pass - {model.playsPass ?? 0} | Total - {model.totalPlays ?? 0}
      </span>

      <span className="chip">
        Penalties: {model.penCount ?? 0} for {model.penYards ?? 0} yards
      </span>
    </div>
  );
}

DriveSummaryChips.propTypes = {
  model: PropTypes.shape({
    possessionLabel: PropTypes.string,
    driveNumber: PropTypes.number,
    startSpot: PropTypes.string,
    yardsGained: PropTypes.number,
    startTimeText: PropTypes.string,
    topElapsedText: PropTypes.string,
    howGained: PropTypes.string,
    playsRush: PropTypes.number,
    playsPass: PropTypes.number,
    totalPlays: PropTypes.number,
    penCount: PropTypes.number,
    penYards: PropTypes.number,
  }),
  loading: PropTypes.bool
};
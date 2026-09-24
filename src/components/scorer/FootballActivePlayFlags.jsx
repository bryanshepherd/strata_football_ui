import React, { useMemo } from 'react';
import { footballContextEventKey, reviewFootballPlayContexts } from '../../play-editor/footballPlayContext';
import { footballChallengeTarget, isOverturnedFootballChallenge } from '../../utils/footballChallengeRescore';
import { formatFootballClockDisplay } from '../../utils/footballClock';

const fieldLabels = {
  possession: 'possession', down: 'down', distance: 'distance', yardLine: 'ball spot',
  lineToGain: 'line to gain', goalToGo: 'goal to go',
};

export default function FootballActivePlayFlags({ envelope, onEditPlay, onChallengeRescore, disabled = false }) {
  const flags = useMemo(() => {
    const reviews = reviewFootballPlayContexts(envelope).reviews;
    return (envelope.events || []).flatMap(event => {
      if (event.status && event.status !== 'accepted') return [];
      const review = reviews.get(footballContextEventKey(event));
      if (review?.fields.length) return [{
        key: footballContextEventKey(event), play: event,
        label: `Context mismatch: ${review.fields.map(field => fieldLabels[field] || field).join(', ')}`,
      }];
      if (isOverturnedFootballChallenge(event) && event.result.gameControl.rescore?.status !== 'complete') return [{
        key: footballContextEventKey(event), play: footballChallengeTarget(envelope, event) || event,
        challenge: event, label: 'Overturned challenge needs rescoring',
      }];
      return [];
    });
  }, [envelope]);

  return (
    <section aria-label="Active play flags" className={`border-t px-4 py-2 ${flags.length ? 'border-amber-300 bg-amber-50 text-amber-950' : 'border-zinc-200 bg-zinc-50 text-zinc-600'}`}>
      <div className="mx-auto max-w-[1500px]">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <h2 className="text-xs font-bold uppercase tracking-wide">Active Play Flags</h2>
          <span aria-live="polite" className="font-semibold">{flags.length ? `${flags.length} ${flags.length === 1 ? 'flag' : 'flags'} need${flags.length === 1 ? 's' : ''} review` : 'No active play flags'}</span>
        </div>
        {flags.length > 0 && <ul className="mt-2 flex max-h-28 flex-wrap gap-2 overflow-y-auto overscroll-contain">
          {flags.map(flag => <li key={flag.key} className="min-w-0 max-w-full">
            <button
              type="button"
              aria-label={`Review ${flag.challenge ? 'challenge' : 'context mismatch'} for play ${flag.play.sequence}`}
              disabled={disabled}
              onClick={() => flag.challenge ? onChallengeRescore(flag.challenge) : onEditPlay(flag.play)}
              className="flex max-w-full flex-wrap items-center gap-x-3 gap-y-1 rounded border border-amber-400 bg-white px-3 py-2 text-left text-sm hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <strong>Play #{flag.play.sequence}</strong>
              <span className="text-xs">Q{flag.play.period} · {formatFootballClockDisplay(flag.play.clock, '--:--')}</span>
              <span className="break-words">{flag.label}</span>
              <span className="text-xs font-bold underline">Review</span>
            </button>
          </li>)}
        </ul>}
      </div>
    </section>
  );
}

import React from 'react';

const contextLabel = {
  offense: 'offensive',
  defense: 'defensive',
  specialTeams: 'special teams',
};

export default function FootballDuplicatePlayerModal({ duplicate, onCancel, onSelect }) {
  if (!duplicate) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/55 p-4" role="presentation">
      <section
        aria-label="Duplicate jersey selection"
        aria-modal="true"
        className="w-full max-w-lg rounded border border-zinc-300 bg-white shadow-xl"
        role="dialog"
      >
        <div className="border-b border-zinc-200 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            Multiple players found
          </p>
          <h2 className="mt-1 text-lg font-semibold text-zinc-950">
            Confirm #{duplicate.jerseyToken}
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            The {contextLabel[duplicate.actionContext] || 'current'} default is preselected by recommendation.
          </p>
        </div>

        <div className="space-y-2 p-5">
          {duplicate.candidates.map((candidate) => {
            const recommended = candidate.playerId === duplicate.recommendedPlayerId;
            return (
              <button
                key={candidate.playerId}
                className={`flex w-full items-center justify-between gap-3 rounded border px-4 py-3 text-left transition ${
                  recommended
                    ? 'border-emerald-600 bg-emerald-50'
                    : 'border-zinc-300 bg-white hover:bg-zinc-50'
                }`}
                onClick={() => onSelect(candidate.playerId)}
                type="button"
              >
                <span className="min-w-0">
                  <span className="block font-semibold text-zinc-950">
                    {candidate.displayName}
                  </span>
                  <span className="mt-0.5 block text-sm text-zinc-600">
                    #{candidate.jersey} · {candidate.position || 'No position'}
                  </span>
                </span>
                {recommended && (
                  <span className="shrink-0 rounded border border-emerald-700 bg-white px-2 py-1 text-xs font-semibold text-emerald-800">
                    Default
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex justify-end border-t border-zinc-200 px-5 py-4">
          <button
            className="rounded border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
            onClick={onCancel}
            type="button"
          >
            Back
          </button>
        </div>
      </section>
    </div>
  );
}

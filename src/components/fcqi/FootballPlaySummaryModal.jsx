import React from 'react';
import FootballFlowProgress from './FootballFlowProgress';

export default function FootballPlaySummaryModal({
  isSubmitting = false,
  onCancel,
  onConfirm,
  onEdit,
  onEnterPenalty,
  onStepClick,
  penaltyMessage = '',
  progressSteps = [],
  submitError = '',
  summary,
  unresolvedQueuedPenalty = false,
}) {
  if (!summary) return null;

  const submitDisabled = isSubmitting || unresolvedQueuedPenalty;
  const submitTitle = unresolvedQueuedPenalty
    ? 'Resolve queued penalty before submitting'
    : undefined;

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-zinc-950/55 p-4" role="presentation">
      <section
        aria-label="Play summary review"
        aria-modal="true"
        className="w-full max-w-xl rounded border border-zinc-300 bg-white shadow-xl"
        role="dialog"
      >
        <div className="border-b border-zinc-200 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Review before build
          </p>
          <h2 className="mt-1 text-lg font-semibold text-zinc-950">Play Summary</h2>
        </div>

        <div className="space-y-4 p-5">
          <FootballFlowProgress onStepClick={onStepClick} steps={progressSteps} />
          <p className="rounded border border-zinc-200 bg-zinc-50 p-4 text-base font-semibold text-zinc-950">
            {summary.summaryText}
          </p>
          {summary.warnings.length > 0 && (
            <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {summary.warnings.map((warning) => (
                <div key={`${warning.code}-${warning.field || 'general'}`}>
                  {warning.message}
                </div>
              ))}
            </div>
          )}
          {penaltyMessage && (
            <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
              {penaltyMessage}
            </div>
          )}
          {unresolvedQueuedPenalty && (
            <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-950">
              Penalty queued — resolve before submitting
            </div>
          )}
          {submitError && (
            <div className="rounded border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-800">
              {submitError}
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-zinc-200 px-5 py-4">
          <button
            className={`rounded border px-3 py-2 text-sm font-semibold ${
              unresolvedQueuedPenalty
                ? 'border-amber-400 bg-amber-100 text-amber-950 hover:bg-amber-200'
                : 'border-zinc-300 text-zinc-800 hover:bg-zinc-50'
            }`}
            disabled={isSubmitting}
            onClick={onEnterPenalty}
            type="button"
          >
            Enter Penalty
          </button>
          <button
            className="rounded border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
            disabled={isSubmitting}
            onClick={onCancel}
            type="button"
          >
            Cancel Play
          </button>
          <button
            className="rounded border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
            disabled={isSubmitting}
            onClick={onEdit}
            type="button"
          >
            Edit Play
          </button>
          <button
            aria-disabled={submitDisabled}
            className={`rounded border px-3 py-2 text-sm font-semibold ${
              unresolvedQueuedPenalty
                ? 'cursor-not-allowed border-zinc-300 bg-zinc-200 text-zinc-500 opacity-75 hover:bg-zinc-200 focus:bg-zinc-200'
                : 'border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:border-zinc-300 disabled:bg-zinc-200 disabled:text-zinc-500 disabled:opacity-75'
            }`}
            disabled={submitDisabled}
            onClick={onConfirm}
            title={submitTitle}
            type="button"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Play'}
          </button>
        </div>
      </section>
    </div>
  );
}

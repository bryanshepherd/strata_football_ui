import React, { useEffect, useMemo, useState } from 'react';
import {
  calculateFootballGameDurationMinutes,
  createFootballGameWrapUpDraft,
  footballDateTimeLocalToIso,
  formatFootballGameDuration,
  isoToFootballDateTimeLocal,
} from '../../scoring/footballGameWrapUp';

const inputClass = 'mt-1 w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-200';
const sectionClass = 'rounded-lg border border-zinc-200 bg-zinc-50 p-4';

const formStateForEnvelope = (envelope) => {
  const draft = createFootballGameWrapUpDraft(envelope);
  return {
    ...draft,
    startedAt: isoToFootballDateTimeLocal(draft.startedAt),
    endedAt: isoToFootballDateTimeLocal(draft.endedAt),
    attendance: draft.attendance === null ? '' : String(draft.attendance),
    weather: {
      ...draft.weather,
      temperatureF: draft.weather.temperatureF === null ? '' : String(draft.weather.temperatureF),
    },
  };
};

export default function FootballGameWrapUpModal({
  envelope,
  onClose,
  onSave,
  open,
  saveError = '',
  saving = false,
}) {
  const [form, setForm] = useState(() => formStateForEnvelope(envelope));
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!open) return;
    setForm(formStateForEnvelope(envelope));
    setFormError('');
  }, [envelope?.gameId, envelope?.game?.wrapUp?.updatedAt, open]);

  const startedAt = footballDateTimeLocalToIso(form.startedAt);
  const endedAt = footballDateTimeLocalToIso(form.endedAt);
  const durationMinutes = useMemo(
    () => calculateFootballGameDurationMinutes(startedAt, endedAt),
    [endedAt, startedAt],
  );

  if (!open) return null;

  const updateRecord = (team, field, value) => {
    setForm((current) => ({
      ...current,
      previousRecords: {
        ...current.previousRecords,
        [team]: { ...current.previousRecords[team], [field]: value },
      },
    }));
  };

  const updateOfficial = (index, name) => {
    setForm((current) => ({
      ...current,
      officials: current.officials.map((official, officialIndex) => (
        officialIndex === index ? { ...official, name } : official
      )),
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!startedAt || !endedAt || durationMinutes === null) {
      setFormError('Enter a valid start and end time. The end time cannot be before the start time.');
      return;
    }
    setFormError('');
    await onSave({
      ...form,
      startedAt,
      endedAt,
      durationMinutes,
    });
  };

  const teams = envelope.game.teams;
  const displayedError = formError || saveError;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-zinc-950/70 p-3 sm:p-6" role="presentation">
      <section
        aria-label="Game Wrap-Up"
        aria-modal="true"
        className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-emerald-600 bg-white shadow-2xl"
        role="dialog"
      >
        <header className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-800 px-6 py-5 text-white">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">Final Game Information</p>
            <h2 className="mt-1 text-2xl font-black">Game Wrap-Up</h2>
            <p className="mt-1 text-sm font-semibold text-emerald-100">
              {teams.V.name} {teams.V.score} · {teams.H.name} {teams.H.score}
            </p>
          </div>
        </header>

        <form className="min-h-0 flex-1 overflow-y-auto" onSubmit={submit}>
          <div className="grid gap-4 p-5 lg:grid-cols-2">
            <section className={sectionClass}>
              <h3 className="text-sm font-black uppercase tracking-wide text-emerald-900">Previous Records</h3>
              <div className="mt-3 space-y-4">
                {['V', 'H'].map((team) => (
                  <fieldset className="rounded border border-zinc-200 bg-white p-3" key={team}>
                    <legend className="px-1 text-sm font-bold text-zinc-950">{teams[team].name}</legend>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-xs font-bold uppercase tracking-wide text-zinc-600">
                        Previous Overall Record
                        <input
                          aria-label={`${teams[team].name} previous overall record`}
                          className={inputClass}
                          onChange={(event) => updateRecord(team, 'overall', event.target.value)}
                          placeholder="0-0"
                          value={form.previousRecords[team].overall}
                        />
                      </label>
                      <label className="text-xs font-bold uppercase tracking-wide text-zinc-600">
                        Previous Conference Record
                        <input
                          aria-label={`${teams[team].name} previous conference record`}
                          className={inputClass}
                          onChange={(event) => updateRecord(team, 'conference', event.target.value)}
                          placeholder="0-0"
                          value={form.previousRecords[team].conference}
                        />
                      </label>
                    </div>
                  </fieldset>
                ))}
              </div>
            </section>

            <section className={sectionClass}>
              <h3 className="text-sm font-black uppercase tracking-wide text-emerald-900">Game Timing</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-bold uppercase tracking-wide text-zinc-600">
                  Actual Start Time
                  <input
                    className={inputClass}
                    onChange={(event) => setForm((current) => ({ ...current, startedAt: event.target.value }))}
                    required
                    type="datetime-local"
                    value={form.startedAt}
                  />
                </label>
                <label className="text-xs font-bold uppercase tracking-wide text-zinc-600">
                  Actual End Time
                  <input
                    className={inputClass}
                    onChange={(event) => setForm((current) => ({ ...current, endedAt: event.target.value }))}
                    required
                    type="datetime-local"
                    value={form.endedAt}
                  />
                </label>
              </div>
              <div className="mt-4 rounded border border-emerald-200 bg-emerald-50 px-4 py-3">
                <p className="text-xs font-black uppercase tracking-wide text-emerald-800">Duration</p>
                <p className="mt-1 text-2xl font-black tabular-nums text-emerald-950">
                  {formatFootballGameDuration(durationMinutes)}
                </p>
                <p className="text-xs font-semibold text-emerald-800">hours:minutes · calculated automatically</p>
              </div>

              <h3 className="mt-5 text-sm font-black uppercase tracking-wide text-emerald-900">Game Conditions</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-bold uppercase tracking-wide text-zinc-600">
                  Attendance
                  <input
                    className={inputClass}
                    min="0"
                    onChange={(event) => setForm((current) => ({ ...current, attendance: event.target.value }))}
                    step="1"
                    type="number"
                    value={form.attendance}
                  />
                </label>
                <label className="text-xs font-bold uppercase tracking-wide text-zinc-600">
                  Temperature (°F)
                  <input
                    className={inputClass}
                    onChange={(event) => setForm((current) => ({
                      ...current,
                      weather: { ...current.weather, temperatureF: event.target.value },
                    }))}
                    type="number"
                    value={form.weather.temperatureF}
                  />
                </label>
                <label className="text-xs font-bold uppercase tracking-wide text-zinc-600">
                  Wind
                  <input
                    className={inputClass}
                    onChange={(event) => setForm((current) => ({
                      ...current,
                      weather: { ...current.weather, wind: event.target.value },
                    }))}
                    placeholder="NW 8 mph"
                    value={form.weather.wind}
                  />
                </label>
                <label className="text-xs font-bold uppercase tracking-wide text-zinc-600">
                  Weather Conditions
                  <input
                    className={inputClass}
                    onChange={(event) => setForm((current) => ({
                      ...current,
                      weather: { ...current.weather, conditions: event.target.value },
                    }))}
                    placeholder="Clear"
                    value={form.weather.conditions}
                  />
                </label>
              </div>
            </section>

            <section className={`${sectionClass} lg:col-span-2`}>
              <h3 className="text-sm font-black uppercase tracking-wide text-emerald-900">Officials</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {form.officials.map((official, index) => (
                  <label className="text-xs font-bold uppercase tracking-wide text-zinc-600" key={`${official.role}-${index}`}>
                    {official.role || `Official ${index + 1}`}
                    <input
                      aria-label={official.role || `Official ${index + 1}`}
                      className={inputClass}
                      onChange={(event) => updateOfficial(index, event.target.value)}
                      value={official.name}
                    />
                  </label>
                ))}
              </div>
            </section>

            <section className={`${sectionClass} lg:col-span-2`}>
              <label className="text-sm font-black uppercase tracking-wide text-emerald-900">
                Game Notes
                <textarea
                  className={`${inputClass} min-h-28 resize-y font-normal normal-case tracking-normal`}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                  placeholder="Add any notes that should remain with the official game record."
                  value={form.notes}
                />
              </label>
            </section>
          </div>

          <footer className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-300 bg-white px-5 py-4 shadow-[0_-8px_20px_rgba(0,0,0,0.06)]">
            <div aria-live="polite" className="min-h-5 text-sm font-semibold text-red-700">
              {displayedError}
            </div>
            <div className="ml-auto flex gap-2">
              <button
                className="rounded border border-zinc-300 bg-white px-4 py-2.5 text-sm font-bold text-zinc-800 hover:bg-zinc-50"
                disabled={saving}
                onClick={onClose}
                type="button"
              >
                Finish Later
              </button>
              <button
                className="rounded bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
                disabled={saving}
                type="submit"
              >
                {saving ? 'Saving…' : 'Save Game Wrap-Up'}
              </button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  );
}

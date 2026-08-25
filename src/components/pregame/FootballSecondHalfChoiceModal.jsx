import React, { useEffect, useMemo, useState } from 'react';
import {
  otherTeam,
  resolveSecondHalfInitialization,
} from '../../pregame/footballPregame';

const CHOICES = ['kick', 'receive', 'side'];
const OTHER_TEAM_CHOICES = ['kick', 'receive'];
const DIRECTIONS = ['north', 'south', 'east', 'west'];
const CHOICE_LABELS = { kick: 'Kick', receive: 'Receive', side: 'Choose Direction' };
const DIRECTION_LABELS = { north: 'North', south: 'South', east: 'East', west: 'West' };
const CHOICE_HOTKEYS = { kick: 'K', receive: 'R', side: 'C' };
const DIRECTION_HOTKEYS = { north: 'N', south: 'S', east: 'E', west: 'W' };

export default function FootballSecondHalfChoiceModal({
  coinToss,
  onCancel,
  onConfirm,
  open,
  teams,
}) {
  const [screen, setScreen] = useState('choice');
  const [choice, setChoice] = useState(null);
  const [otherTeamChoice, setOtherTeamChoice] = useState(null);
  const [direction, setDirection] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setScreen('choice');
    setChoice(null);
    setOtherTeamChoice(null);
    setDirection(null);
    setSaving(false);
    setError('');
  }, [open]);

  const initialization = useMemo(() => (
    coinToss && choice && direction
      ? resolveSecondHalfInitialization(coinToss, { choice, otherTeamChoice, direction })
      : null
  ), [choice, coinToss, direction, otherTeamChoice]);

  if (!open) return null;

  const choiceTeam = coinToss?.secondHalfChoiceTeam;
  const opposingTeam = choiceTeam ? otherTeam(choiceTeam) : null;
  const teamName = (team) => teams?.[team]?.name || (team === 'H' ? 'Home' : 'Visitor');

  const chooseInitial = (value) => {
    setChoice(value);
    setOtherTeamChoice(null);
    setDirection(null);
    setScreen(value === 'side' ? 'otherTeamChoice' : 'direction');
    setError('');
  };

  const chooseOtherTeam = (value) => {
    setOtherTeamChoice(value);
    setDirection(null);
    setScreen('direction');
    setError('');
  };

  const chooseDirection = (value) => {
    setDirection(value);
    setScreen('summary');
    setError('');
  };

  const goBack = () => {
    if (screen === 'summary') setScreen('direction');
    else if (screen === 'direction') setScreen(choice === 'side' ? 'otherTeamChoice' : 'choice');
    else setScreen('choice');
    setError('');
  };

  const confirm = async () => {
    if (!initialization) {
      setError('Complete the second-half choice before starting the third quarter.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onConfirm(initialization);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'The third quarter was not started.');
    } finally {
      setSaving(false);
    }
  };

  const directionChoiceTeam = choice === 'side' ? choiceTeam : opposingTeam;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Second-Half Choice">
      <section className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Third Quarter Setup</p>
            <h2 className="text-xl font-semibold text-zinc-950">Second-Half Choice</h2>
            <p className="mt-1 text-sm text-zinc-600">Initialize the second-half kickoff before the quarter-start event is accepted.</p>
          </div>
          <button className="rounded border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50" onClick={onCancel} type="button">Close Modal</button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {error && <p className="mb-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800" role="alert">{error}</p>}
          {!choiceTeam && <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">The completed coin toss does not identify a second-half choice team.</p>}
          {screen === 'choice' && choiceTeam && (
            <ChoiceStep
              choices={CHOICES}
              format={(value) => CHOICE_LABELS[value]}
              helper="Select the choice awarded by the completed coin toss."
              hotkeys={CHOICE_HOTKEYS}
              onChoose={chooseInitial}
              selected={choice}
              title={`${teamName(choiceTeam)}'s Second-Half Choice`}
            />
          )}
          {screen === 'otherTeamChoice' && (
            <ChoiceStep
              choices={OTHER_TEAM_CHOICES}
              format={(value) => CHOICE_LABELS[value]}
              helper={`${teamName(choiceTeam)} chose direction. Select the other team's kickoff choice.`}
              hotkeys={CHOICE_HOTKEYS}
              onChoose={chooseOtherTeam}
              selected={otherTeamChoice}
              title={`${teamName(opposingTeam)}'s Choice`}
            />
          )}
          {screen === 'direction' && (
            <ChoiceStep
              choices={DIRECTIONS}
              format={(value) => DIRECTION_LABELS[value]}
              helper="Select the direction this team will defend to begin the second half."
              hotkeys={DIRECTION_HOTKEYS}
              onChoose={chooseDirection}
              selected={direction}
              title={`${teamName(directionChoiceTeam)} Chooses Direction`}
            />
          )}
          {screen === 'summary' && initialization && (
            <SecondHalfSummary initialization={initialization} teamName={teamName} />
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 bg-zinc-50 px-5 py-4">
          <div>
            {screen !== 'choice' && <button className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100" onClick={goBack} type="button">Back</button>}
          </div>
          <div className="flex gap-2">
            <button className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100" onClick={onCancel} type="button">Cancel</button>
            {screen === 'summary' && (
              <button className="rounded bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-400" disabled={saving || !initialization} onClick={confirm} type="button">{saving ? 'Starting…' : 'Start Third Quarter'}</button>
            )}
          </div>
        </footer>
      </section>
    </div>
  );
}

function ChoiceStep({ choices, format, helper, hotkeys, onChoose, selected, title }) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.target?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      const choice = choices.find((candidate) => hotkeys[candidate] === event.key.toUpperCase());
      if (!choice) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onChoose(choice);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [choices, hotkeys, onChoose]);

  return (
    <section>
      <h3 className="text-lg font-semibold text-zinc-950">{title}</h3>
      <p className="mt-1 text-sm text-zinc-600">{helper}</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {choices.map((choice) => (
          <button className={`rounded border px-4 py-4 text-left text-base font-semibold ${selected === choice ? 'border-emerald-700 bg-emerald-50 text-emerald-900' : 'border-zinc-300 bg-white text-zinc-900 hover:border-emerald-700 hover:bg-emerald-50'}`} key={choice} onClick={() => onChoose(choice)} type="button">
            <span>{format(choice)}</span>
            <span aria-hidden="true" className="float-right rounded border border-zinc-300 bg-zinc-50 px-2 py-0.5 text-xs font-black">{hotkeys[choice]}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function SecondHalfSummary({ initialization, teamName }) {
  const rows = [
    ['Choice Team', teamName(initialization.choiceTeam)],
    ['Choice', CHOICE_LABELS[initialization.choice]],
    ['Kicking Team', teamName(initialization.kickingTeam)],
    ['Receiving Team', teamName(initialization.receivingTeam)],
    ['Direction Choice Team', teamName(initialization.directionChoiceTeam)],
    ['Direction', DIRECTION_LABELS[initialization.direction]],
  ];
  return (
    <section aria-label="Second-Half Initialization Summary">
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Final Review</p>
      <h3 className="mt-1 text-lg font-semibold text-zinc-950">Second-Half Kickoff</h3>
      <dl className="mt-5 grid gap-x-6 gap-y-3 rounded border border-zinc-200 bg-zinc-50 p-4 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</dt>
            <dd className="mt-1 font-semibold text-zinc-950">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

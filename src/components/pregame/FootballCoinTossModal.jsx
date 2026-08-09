import React, { useEffect, useMemo, useRef, useState } from 'react';
import { resolvePlayerByJersey } from '../../quick-input/playerResolution';
import { otherTeam, resolveToss } from '../../pregame/footballPregame';

const TEAM_LABEL = { H: 'Home', V: 'Away' };
const CHOICE_LABEL = {
  defer: 'Defer',
  kick: 'Kick',
  receive: 'Receive',
  side: 'Choose Direction',
};
const DIRECTION_LABEL = {
  east: 'East',
  north: 'North',
  south: 'South',
  west: 'West',
};
const DIRECTION_OPTIONS = ['north', 'south', 'east', 'west'];
const CHOICE_HOTKEYS = { defer: 'D', kick: 'K', receive: 'R', side: 'C' };
const DIRECTION_HOTKEYS = { east: 'E', north: 'N', south: 'S', west: 'W' };
const DERIVED_TOSS_RESET = {
  directionChoiceTeam: null,
  firstHalfKickingTeam: null,
  firstHalfReceivingTeam: null,
  secondHalfChoiceTeam: null,
};

export default function FootballCoinTossModal({
  kickoffAccepted,
  onClose,
  onFinalize,
  onTeamAliasesChange,
  open,
  pregame,
  roster,
  teamAliases,
  teams,
}) {
  const [draftToss, setDraftToss] = useState(pregame.coinToss);
  const [screen, setScreen] = useState(initialScreenFor(pregame.coinToss));
  const [history, setHistory] = useState([]);
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [captainTeam, setCaptainTeam] = useState(null);
  const [captainIndex, setCaptainIndex] = useState(0);
  const [captainToken, setCaptainToken] = useState('');
  const [duplicate, setDuplicate] = useState(null);
  const [draftAliases, setDraftAliases] = useState(() => initialTeamAliases(teamAliases, teams));
  const captainInputRef = useRef(null);
  const enterActionRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setDraftToss(pregame.coinToss);
    setScreen(initialScreenFor(pregame.coinToss));
    setHistory([]);
    setNotice('');
    setSaving(false);
    setCaptainTeam(null);
    setCaptainIndex(0);
    setCaptainToken('');
    setDuplicate(null);
    setDraftAliases(initialTeamAliases(teamAliases, teams));
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const handleEnter = (event) => {
      if (event.key !== 'Enter' || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (duplicate || saving) return;
      const target = event.target;
      if (target?.closest?.('button, [role="button"]')) return;
      if (screen === 'captains' && target?.closest?.('form')) return;
      if (!enterActionRef.current) return;
      event.preventDefault();
      enterActionRef.current();
    };
    window.addEventListener('keydown', handleEnter);
    return () => window.removeEventListener('keydown', handleEnter);
  }, [duplicate, open, saving, screen]);

  const summaryToss = useMemo(() => {
    const resolved = resolveToss(draftToss);
    return resolved ? { ...draftToss, ...resolved } : draftToss;
  }, [draftToss]);

  if (!open) return null;

  const advance = (nextScreen, patch = {}) => {
    setDraftToss((current) => ({
      ...current,
      ...patch,
      status: 'inProgress',
      completedAt: null,
    }));
    setHistory((current) => [...current, screen]);
    setScreen(nextScreen);
    setNotice('');
  };

  const goBack = () => {
    const previous = history.at(-1);
    if (!previous) return;
    setHistory((current) => current.slice(0, -1));
    setScreen(previous);
    setNotice('');
  };

  const chooseWinner = (winnerTeam) => {
    advance('initialChoice', {
      ...DERIVED_TOSS_RESET,
      direction: null,
      loserChoice: null,
      loserTeam: otherTeam(winnerTeam),
      winnerInitialChoice: null,
      winnerSecondaryChoice: null,
      winnerTeam,
    });
  };

  const continueFromAliases = () => {
    const validation = validateTeamAliases(draftAliases);
    if (!validation.ok) {
      setNotice(validation.message);
      return;
    }
    const aliases = normalizeTeamAliases(draftAliases);
    setDraftAliases(aliases);
    onTeamAliasesChange?.(aliases);
    advance('captains');
  };

  const chooseInitialOption = (winnerInitialChoice) => {
    const nextScreen = winnerInitialChoice === 'kick' || winnerInitialChoice === 'receive'
      ? 'direction'
      : 'loserChoice';
    advance(nextScreen, {
      ...DERIVED_TOSS_RESET,
      direction: null,
      loserChoice: null,
      winnerInitialChoice,
      winnerSecondaryChoice: null,
    });
  };

  const chooseLoserOption = (loserChoice) => {
    if (draftToss.winnerInitialChoice === 'side') {
      advance('direction', { ...DERIVED_TOSS_RESET, direction: null, loserChoice });
      return;
    }
    if (loserChoice === 'side') {
      advance('winnerSecondaryChoice', {
        ...DERIVED_TOSS_RESET,
        direction: null,
        loserChoice,
        winnerSecondaryChoice: null,
      });
      return;
    }
    advance('direction', {
      ...DERIVED_TOSS_RESET,
      direction: null,
      loserChoice,
      winnerSecondaryChoice: 'side',
    });
  };

  const chooseWinnerSecondaryOption = (winnerSecondaryChoice) => {
    advance('direction', {
      ...DERIVED_TOSS_RESET,
      direction: null,
      winnerSecondaryChoice,
    });
  };

  const chooseDirection = (direction) => {
    const nextToss = { ...draftToss, direction };
    const resolved = resolveToss(nextToss);
    if (!resolved) {
      setNotice('Complete the preceding coin toss choices before choosing a direction.');
      return;
    }
    advance('summary', { ...resolved, direction });
  };

  const beginCaptainEntry = (team) => {
    setCaptainTeam(team);
    setCaptainIndex(0);
    setCaptainToken(draftToss.captains[team]?.[0]?.jerseyNumber || '');
    setNotice('Captain entry is optional. Enter a jersey number, or press Enter on a blank field to finish this team.');
    requestAnimationFrame(() => captainInputRef.current?.focus());
  };

  const updateCaptains = (team, captains) => {
    setDraftToss((current) => ({
      ...current,
      captains: { ...current.captains, [team]: captains },
      completedAt: null,
      status: 'inProgress',
    }));
  };

  const commitCaptain = () => {
    if (!captainTeam) return;
    const captains = [...(draftToss.captains[captainTeam] || [])];
    const existing = captainIndex < captains.length ? captains[captainIndex] : null;
    if (!captainToken.trim()) {
      if (existing) captains.splice(captainIndex, 1);
      updateCaptains(captainTeam, captains);
      setCaptainToken('');
      setCaptainTeam(null);
      setNotice('Captain entry finished.');
      return;
    }
    const resolution = resolvePlayerByJersey({
      actionContext: 'gameControl',
      jerseyToken: captainToken,
      roster,
      teamScope: captainTeam,
    });
    if (resolution.kind === 'error') {
      setNotice(resolution.error.message);
      return;
    }
    if (resolution.kind === 'duplicate') {
      setDuplicate({ resolution });
      return;
    }
    applyCaptain(resolution.player);
  };

  const applyCaptain = (player) => {
    const captains = [...(draftToss.captains[captainTeam] || [])];
    if (captains.some((captain, index) => captain.playerId === player.playerId && index !== captainIndex)) {
      setNotice('That player is already listed as a captain for this team.');
      return;
    }
    const selection = { playerId: player.playerId, jerseyNumber: player.jersey };
    if (captainIndex < captains.length) captains[captainIndex] = selection;
    else captains.push(selection);
    const nextIndex = captainIndex + 1;
    updateCaptains(captainTeam, captains);
    setCaptainIndex(nextIndex);
    setCaptainToken(captains[nextIndex]?.jerseyNumber || '');
    setDuplicate(null);
    setNotice('Captain recorded. Enter another jersey number, or press Enter on a blank field to finish this team.');
    requestAnimationFrame(() => captainInputRef.current?.focus());
  };

  const finalize = async () => {
    setSaving(true);
    setNotice('');
    try {
      await onFinalize(summaryToss);
      onClose();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'The coin toss was not saved.');
    } finally {
      setSaving(false);
    }
  };

  const restart = () => {
    setDraftToss((current) => ({ ...current, completedAt: null, status: 'inProgress' }));
    setScreen('aliases');
    setHistory([]);
    setNotice('');
  };

  const loserTeam = draftToss.loserTeam || (draftToss.winnerTeam ? otherTeam(draftToss.winnerTeam) : null);
  const directionTeam = directionChoiceTeam(draftToss);

  if (screen === 'aliases') enterActionRef.current = continueFromAliases;
  else if (screen === 'captains') enterActionRef.current = () => advance('winner');
  else if (screen === 'summary' && draftToss.status === 'complete' && history.length === 0) {
    enterActionRef.current = onClose;
  } else if (screen === 'summary') enterActionRef.current = finalize;
  else enterActionRef.current = null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Coin Toss">
      <section className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Pregame</p>
            <h2 className="text-xl font-semibold text-zinc-950">Coin Toss</h2>
            <p className="mt-1 text-sm text-zinc-600">{screenLabel(screen)}</p>
          </div>
          <button className="rounded border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50" onClick={onClose} type="button">Close Modal</button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {notice && <p className="mb-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950" role="status">{notice}</p>}

          {screen === 'aliases' && (
            <TeamAliasesScreen
              aliases={draftAliases}
              onChange={(team, value) => setDraftAliases((current) => ({
                ...current,
                [team]: normalizeTeamAlias(value),
              }))}
              teams={teams}
            />
          )}
          {screen === 'captains' && (
            <CaptainsScreen
              captainInputRef={captainInputRef}
              captainTeam={captainTeam}
              captainToken={captainToken}
              captains={draftToss.captains}
              onBegin={beginCaptainEntry}
              onChange={setCaptainToken}
              onCommit={commitCaptain}
            />
          )}
          {screen === 'winner' && (
            <ChoiceScreen
              choices={['H', 'V']}
              helper="Select the team that won the coin toss."
              onChoose={chooseWinner}
              selected={draftToss.winnerTeam}
              title="Who Won the Coin Toss?"
              format={(team) => teams?.[team]?.name || TEAM_LABEL[team]}
              hotkeys={draftAliases}
            />
          )}
          {screen === 'initialChoice' && (
            <ChoiceScreen
              choices={['kick', 'receive', 'side', 'defer']}
              helper="Select the winning team's initial choice."
              onChoose={chooseInitialOption}
              selected={draftToss.winnerInitialChoice}
              title={`${TEAM_LABEL[draftToss.winnerTeam]}'s Initial Choice`}
              hotkeys={CHOICE_HOTKEYS}
            />
          )}
          {screen === 'loserChoice' && (
            <ChoiceScreen
              choices={draftToss.winnerInitialChoice === 'side' ? ['kick', 'receive'] : ['kick', 'receive', 'side']}
              helper={draftToss.winnerInitialChoice === 'side'
                ? 'The coin toss winner chose direction. Select the other team’s choice.'
                : 'The coin toss winner deferred. Select the other team’s choice.'}
              onChoose={chooseLoserOption}
              selected={draftToss.loserChoice}
              title={`${TEAM_LABEL[loserTeam]}'s Choice`}
              hotkeys={CHOICE_HOTKEYS}
            />
          )}
          {screen === 'winnerSecondaryChoice' && (
            <ChoiceScreen
              choices={['kick', 'receive']}
              helper={`${TEAM_LABEL[loserTeam]} chose direction. Select the deferred winner's choice.`}
              onChoose={chooseWinnerSecondaryOption}
              selected={draftToss.winnerSecondaryChoice}
              title={`${TEAM_LABEL[draftToss.winnerTeam]}'s Choice`}
              hotkeys={CHOICE_HOTKEYS}
            />
          )}
          {screen === 'direction' && (
            <ChoiceScreen
              choices={DIRECTION_OPTIONS}
              helper="Select the direction the team will defend to begin the game."
              onChoose={chooseDirection}
              selected={draftToss.direction}
              title={`${TEAM_LABEL[directionTeam]} Chooses Direction`}
              format={(direction) => DIRECTION_LABEL[direction]}
              hotkeys={DIRECTION_HOTKEYS}
            />
          )}
          {screen === 'summary' && <TossSummary teams={teams} toss={summaryToss} />}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 bg-zinc-50 px-5 py-4">
          <div>
            {history.length > 0 && (
              <button className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100" onClick={goBack} type="button">Back</button>
            )}
          </div>
          <div className="flex gap-2">
            {screen === 'aliases' && (
              <button className="rounded bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800" onClick={continueFromAliases} type="button">Continue</button>
            )}
            {screen === 'captains' && (
              <button className="rounded bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800" onClick={() => advance('winner')} type="button">Continue</button>
            )}
            {screen === 'summary' && draftToss.status === 'complete' && !kickoffAccepted && history.length === 0 && (
              <button className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100" onClick={restart} type="button">Edit Coin Toss</button>
            )}
            {screen === 'summary' && (history.length > 0 || draftToss.status !== 'complete') && (
              <button className="rounded bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-400" disabled={saving} onClick={finalize} type="button">{saving ? 'Saving…' : 'Finalize Coin Toss'}</button>
            )}
            {screen === 'summary' && draftToss.status === 'complete' && history.length === 0 && (
              <button className="rounded bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800" onClick={onClose} type="button">Close</button>
            )}
          </div>
        </footer>
      </section>

      {duplicate && (
        <DuplicateCaptainChooser
          duplicate={duplicate}
          onCancel={() => setDuplicate(null)}
          onChoose={applyCaptain}
        />
      )}
    </div>
  );
}

function TeamAliasesScreen({ aliases, onChange, teams }) {
  return (
    <section>
      <h3 className="text-lg font-semibold text-zinc-950">Team Abbreviations</h3>
      <p className="mt-1 text-sm text-zinc-600">Choose one unique letter for each team.</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {(['H', 'V']).map((team) => (
          <label className="rounded border border-zinc-200 p-4" key={team}>
            <span className="block text-sm font-semibold text-zinc-950">{teams?.[team]?.name || TEAM_LABEL[team]}</span>
            <span className="mt-1 block text-xs text-zinc-500">Internal team: {TEAM_LABEL[team]}</span>
            <input
              aria-label={`${teams?.[team]?.name || TEAM_LABEL[team]} abbreviation`}
              autoCapitalize="characters"
              className="mt-3 w-full rounded border border-zinc-300 px-3 py-2 text-center text-xl font-black uppercase outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              maxLength={1}
              onChange={(event) => onChange(team, event.target.value)}
              value={aliases[team]}
            />
          </label>
        ))}
      </div>
    </section>
  );
}

function CaptainsScreen({ captainInputRef, captainTeam, captainToken, captains, onBegin, onChange, onCommit }) {
  return (
    <section>
      <h3 className="text-lg font-semibold text-zinc-950">Team Captains</h3>
      <p className="mt-1 text-sm text-zinc-600">Captains are optional. Add jersey numbers for either team, or continue without entering any players.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {(['H', 'V']).map((team) => (
          <CaptainTeam
            active={captainTeam === team}
            captains={captains[team] || []}
            inputRef={captainTeam === team ? captainInputRef : null}
            key={team}
            onBegin={() => onBegin(team)}
            onChange={onChange}
            onCommit={onCommit}
            team={team}
            token={captainTeam === team ? captainToken : ''}
          />
        ))}
      </div>
    </section>
  );
}

function CaptainTeam({ active, captains, inputRef, onBegin, onChange, onCommit, team, token }) {
  return (
    <section className="rounded border border-zinc-200 p-3">
      <div className="flex items-center justify-between gap-3">
        <h4 className="font-semibold">{TEAM_LABEL[team]} Captains <span className="font-normal text-zinc-500">(Optional)</span></h4>
        <button className="rounded border border-zinc-300 px-2 py-1 text-xs font-semibold" onClick={onBegin} type="button">{active ? 'Editing' : 'Review / Edit'}</button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {captains.length
          ? captains.map((captain) => <span className="rounded bg-zinc-100 px-2 py-1 text-xs" key={captain.playerId}>#{captain.jerseyNumber}</span>)
          : <span className="text-xs text-zinc-500">No Captains Recorded</span>}
      </div>
      {active && (
        <form className="mt-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); onCommit(); }}>
          <input ref={inputRef} aria-label={`${TEAM_LABEL[team]} captain jersey`} className="min-w-0 flex-1 rounded border border-emerald-500 px-2 py-1 text-sm outline-none ring-2 ring-emerald-100" inputMode="numeric" onChange={(event) => onChange(event.target.value)} placeholder="Jersey #" value={token} />
          <button className="rounded bg-emerald-700 px-3 py-1 text-sm font-semibold text-white" type="submit">Enter</button>
        </form>
      )}
    </section>
  );
}

function ChoiceScreen({ choices, format = (choice) => CHOICE_LABEL[choice], helper, hotkeys, onChoose, selected, title }) {
  useEffect(() => {
    if (!hotkeys) return undefined;
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
          <button
            className={`rounded border px-4 py-4 text-left text-base font-semibold ${selected === choice ? 'border-emerald-700 bg-emerald-50 text-emerald-900' : 'border-zinc-300 bg-white text-zinc-900 hover:border-emerald-700 hover:bg-emerald-50'}`}
            key={choice}
            onClick={() => onChoose(choice)}
            type="button"
          >
            <span>{format(choice)}</span>
            {hotkeys?.[choice] && <span aria-hidden="true" className="float-right rounded border border-zinc-300 bg-zinc-50 px-2 py-0.5 text-xs font-black">{hotkeys[choice]}</span>}
          </button>
        ))}
      </div>
    </section>
  );
}

function TossSummary({ teams, toss }) {
  const teamName = (team) => team && (teams?.[team]?.name || TEAM_LABEL[team]);
  const rows = [
    ['Winner', teamName(toss.winnerTeam)],
    ['Initial Choice', formatChoice(toss.winnerInitialChoice)],
    ['Other Team’s Choice', formatChoice(toss.loserChoice)],
    ['Winner’s Secondary Choice', formatChoice(toss.winnerSecondaryChoice)],
    ['Direction', toss.direction && DIRECTION_LABEL[toss.direction]],
    ['Direction Choice Team', teamName(toss.directionChoiceTeam)],
    ['First-Half Kicking Team', teamName(toss.firstHalfKickingTeam)],
    ['First-Half Receiving Team', teamName(toss.firstHalfReceivingTeam)],
    ['Second-Half Choice Team', teamName(toss.secondHalfChoiceTeam)],
  ];
  return (
    <section aria-label="Coin Toss Summary">
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Final Review</p>
      <h3 className="mt-1 text-lg font-semibold text-zinc-950">Coin Toss Summary</h3>
      <p className="mt-1 text-sm text-zinc-600">Review the completed choices before finalizing the coin toss.</p>
      <dl className="mt-5 grid gap-x-6 gap-y-3 rounded border border-zinc-200 bg-zinc-50 p-4 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</dt>
            <dd className="mt-1 font-semibold text-zinc-950">{value || '—'}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function DuplicateCaptainChooser({ duplicate, onChoose, onCancel }) {
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Choose Duplicate Captain">
      <section className="w-full max-w-md rounded bg-white p-4 shadow-xl">
        <h2 className="text-lg font-semibold">Choose Player for #{duplicate.resolution.jerseyToken}</h2>
        <p className="mt-1 text-sm text-zinc-600">Duplicate jersey numbers require an explicit selection.</p>
        <div className="mt-3 space-y-2">
          {duplicate.resolution.candidates.map((candidate) => (
            <button className="block w-full rounded border border-zinc-300 px-3 py-2 text-left hover:border-emerald-600" key={candidate.playerId} onClick={() => onChoose(candidate)} type="button">
              #{candidate.jersey} {candidate.displayName} · {candidate.position || 'No Position'}
            </button>
          ))}
        </div>
        <button className="mt-3 rounded border border-zinc-300 px-3 py-2 text-sm font-semibold" onClick={onCancel} type="button">Cancel</button>
      </section>
    </div>
  );
}

function initialScreenFor(coinToss) {
  return coinToss.status === 'complete' ? 'summary' : 'aliases';
}

function normalizeTeamAlias(value) {
  return String(value || '').replace(/[^a-z]/gi, '').slice(0, 1).toUpperCase();
}

function normalizeTeamAliases(aliases) {
  return { H: normalizeTeamAlias(aliases?.H), V: normalizeTeamAlias(aliases?.V) };
}

function suggestedTeamAlias(team, teams) {
  return normalizeTeamAlias(teams?.[team]?.name) || team;
}

function initialTeamAliases(aliases, teams) {
  const configured = normalizeTeamAliases(aliases);
  const initial = {
    H: configured.H || suggestedTeamAlias('H', teams),
    V: configured.V || suggestedTeamAlias('V', teams),
  };
  return initial.H === initial.V ? { H: 'H', V: 'V' } : initial;
}

function validateTeamAliases(aliases) {
  const normalized = normalizeTeamAliases(aliases);
  if (!normalized.H || !normalized.V) return { ok: false, message: 'Enter one letter for each team.' };
  if (normalized.H === normalized.V) return { ok: false, message: 'Team abbreviations must be different.' };
  if (normalized.H === 'V' || normalized.V === 'H') return { ok: false, message: 'H and V remain reserved for their canonical Home and Visitor teams.' };
  return { ok: true };
}

function directionChoiceTeam(toss) {
  if (toss.winnerInitialChoice === 'side') return toss.winnerTeam;
  if (toss.loserChoice === 'side') return toss.loserTeam;
  if (toss.winnerInitialChoice === 'defer') return toss.winnerTeam;
  return toss.loserTeam;
}

function formatChoice(choice) {
  return choice ? CHOICE_LABEL[choice] : null;
}

function screenLabel(screen) {
  if (screen === 'captains') return 'Optional captain entry';
  if (screen === 'summary') return 'Final review';
  return 'Coin toss choices';
}

export { CHOICE_LABEL, DIRECTION_LABEL, directionChoiceTeam, formatChoice, initialTeamAliases, validateTeamAliases };

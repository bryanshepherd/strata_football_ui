import React, { useMemo, useRef, useState } from 'react';
import { resolvePlayerByJersey } from '../../quick-input/playerResolution';
import {
  STARTER_GROUPS,
  awaitingKickoffState,
  createCoinTossRecord,
  isConsequentialTossEdit,
  isSideImplicit,
  nextTossChoices,
  otherTeam,
  pregameForEnvelope,
  resolveCompleteToss,
  validateCoinToss,
} from '../../pregame/footballPregame';

const TEAM_LABEL = { H: 'Home', V: 'Away' };
const DIRECTION_OPTIONS = ['north', 'south', 'east', 'west'];

export default function FootballPregameWorkspace({ envelope, onEnvelopeChange }) {
  const pregame = pregameForEnvelope(envelope);
  const roster = useMemo(() => flattenRoster(envelope), [envelope]);
  const [section, setSection] = useState('rosters');
  const [notice, setNotice] = useState('');
  const [captainTeam, setCaptainTeam] = useState(null);
  const [captainIndex, setCaptainIndex] = useState(0);
  const [captainToken, setCaptainToken] = useState('');
  const [duplicate, setDuplicate] = useState(null);
  const captainInputRef = useRef(null);
  const kickoffAccepted = envelope.events?.some((event) => event.type === 'kickoff' && event.status === 'accepted');

  const update = (nextPregame, patch = {}) => {
    const result = onEnvelopeChange({ ...envelope, ...patch, pregame: nextPregame });
    if (result?.catch) result.catch((error) => setNotice(error instanceof Error ? `Not saved: ${error.message}` : 'Not saved. Retry the change after restoring the canonical backend connection.'));
  };

  const updateCoinToss = (patch) => {
    const coinToss = { ...pregame.coinToss, ...patch, status: 'inProgress' };
    const next = { ...pregame, coinToss };
    if (kickoffAccepted && isConsequentialTossEdit(pregame.coinToss, coinToss, true)) {
      setNotice('Kickoff has been accepted. Changes that would alter kickoff context are blocked; review the record instead.');
      return;
    }
    update(next);
  };

  const completeToss = () => {
    try {
      const coinToss = resolveCompleteToss(pregame.coinToss);
      const validation = validateCoinToss(coinToss, roster);
      if (!validation.ok) {
        setNotice(validation.errors.join(' '));
        return;
      }
      const kickoff = awaitingKickoffState(envelope.game.rules, coinToss);
      update({ ...pregame, gamePhase: 'awaitingKickoff', coinToss }, {
        game: { ...envelope.game, ...kickoff.game },
        clock: { ...envelope.clock, ...kickoff.clock },
        liveState: { ...envelope.liveState, ...kickoff.liveState },
      });
      setNotice('Coin toss complete. Awaiting Kickoff — kickoff and dead-ball penalty input are available.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Coin toss is incomplete.');
    }
  };

  const selectCaptainTeam = (team) => {
    setCaptainTeam(team);
    setCaptainIndex(0);
    setCaptainToken(pregame.coinToss.captains[team]?.[0]?.jerseyNumber || '');
    setNotice('Captain entry is optional. Enter a jersey, or press Enter on a blank field to finish this team.');
    requestAnimationFrame(() => captainInputRef.current?.focus());
  };

  const commitCaptain = () => {
    if (!captainTeam) return;
    const captains = [...(pregame.coinToss.captains[captainTeam] || [])];
    const existing = captainIndex < captains.length ? captains[captainIndex] : null;
    if (!captainToken.trim()) {
      if (existing) captains.splice(captainIndex, 1);
      if (captainIndex < captains.length) setCaptainToken(captains[captainIndex].jerseyNumber);
      else setCaptainToken('');
      updateCoinToss({ captains: { ...pregame.coinToss.captains, [captainTeam]: captains } });
      if (!existing || captainIndex >= captains.length) setCaptainTeam(null);
      return;
    }
    const resolution = resolvePlayerByJersey({ jerseyToken: captainToken, teamScope: captainTeam, actionContext: 'gameControl', roster });
    if (resolution.kind === 'error') {
      setNotice(resolution.error.message);
      return;
    }
    if (resolution.kind === 'duplicate') {
      setDuplicate({ resolution, captains, existing });
      return;
    }
    applyCaptain(resolution.player);
  };

  const applyCaptain = (player) => {
    const captains = [...(pregame.coinToss.captains[captainTeam] || [])];
    if (captains.some((captain, index) => captain.playerId === player.playerId && index !== captainIndex)) {
      setNotice('That player is already listed as a captain for this team.');
      return;
    }
    const selection = { playerId: player.playerId, jerseyNumber: player.jersey };
    if (captainIndex < captains.length) captains[captainIndex] = selection;
    else captains.push(selection);
    const nextIndex = captainIndex + 1;
    updateCoinToss({ captains: { ...pregame.coinToss.captains, [captainTeam]: captains } });
    setCaptainIndex(nextIndex);
    setCaptainToken(captains[nextIndex]?.jerseyNumber || '');
    setDuplicate(null);
    requestAnimationFrame(() => captainInputRef.current?.focus());
  };

  const updatePlayer = (team, playerId, patch) => {
    const players = envelope.rosters.teams[team].players;
    const nextPlayers = { ...players, [playerId]: { ...players[playerId], ...patch } };
    update(pregame, { rosters: { ...envelope.rosters, updatedAt: new Date().toISOString(), teams: { ...envelope.rosters.teams, [team]: { ...envelope.rosters.teams[team], players: nextPlayers } } } });
  };

  const addPlayer = (team) => {
    const id = `${team}-local-${Date.now()}`;
    const players = envelope.rosters.teams[team].players;
    update(pregame, { rosters: { ...envelope.rosters, updatedAt: new Date().toISOString(), teams: { ...envelope.rosters.teams, [team]: { ...envelope.rosters.teams[team], players: { ...players, [id]: { playerId: id, team, jersey: '', displayName: 'New player', position: '', active: true } } } } } });
  };

  const toggleStarter = (group, team, playerId) => {
    const player = roster.find((candidate) => candidate.playerId === playerId);
    if (!player || player.active === false) return setNotice('Inactive players cannot be starters.');
    const selected = pregame.starters[group][team] || [];
    const nextIds = selected.includes(playerId) ? selected.filter((id) => id !== playerId) : [...selected, playerId];
    update({ ...pregame, starters: { ...pregame.starters, [group]: { ...pregame.starters[group], [team]: nextIds } } });
  };

  const toss = pregame.coinToss;
  const legalChoices = nextTossChoices(toss);
  const waiting = pregame.gamePhase === 'awaitingKickoff';
  return (
    <section className="rounded border border-emerald-200 bg-white shadow-sm" aria-label="Pregame workspace">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-100 px-4 py-3">
        <div><h2 className="text-base font-semibold">Pregame workspace</h2><p className="text-xs text-zinc-600">{waiting ? 'Awaiting Kickoff' : 'Pregame'} · Rosters, starters, and coin toss remain available.</p></div>
        <div className="flex gap-1" role="tablist">{[['rosters', 'Rosters'], ['starters', 'Starters'], ['toss', 'Coin Toss']].map(([key, label]) => <button key={key} className={`rounded px-3 py-2 text-sm font-semibold ${section === key ? 'bg-emerald-700 text-white' : 'text-zinc-700 hover:bg-zinc-100'}`} onClick={() => setSection(key)} role="tab" type="button">{label}</button>)}</div>
      </div>
      {notice && <div className="mx-4 mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950" role="status">{notice}</div>}
      {section === 'rosters' && <RosterPanel envelope={envelope} onAdd={addPlayer} onUpdate={updatePlayer} />}
      {section === 'starters' && <StarterPanel pregame={pregame} roster={roster} onToggle={toggleStarter} />}
      {section === 'toss' && <div className="space-y-5 p-4">
        <div className="grid gap-3 lg:grid-cols-2">{(['H', 'V']).map((team) => <CaptainTeam key={team} team={team} captains={toss.captains[team]} active={captainTeam === team} token={captainTeam === team ? captainToken : ''} inputRef={captainTeam === team ? captainInputRef : null} onSelect={() => selectCaptainTeam(team)} onChange={setCaptainToken} onCommit={commitCaptain} />)}</div>
        <div className="grid gap-4 rounded border border-zinc-200 p-4 lg:grid-cols-2">
          <ChoiceRow label="Toss winner" choices={['H', 'V']} selected={toss.winnerTeam} disabled={kickoffAccepted} format={(value) => TEAM_LABEL[value]} onChoose={(winnerTeam) => updateCoinToss({ winnerTeam, loserTeam: otherTeam(winnerTeam), winnerInitialChoice: null, loserChoice: null, winnerSecondaryChoice: null, direction: null })} />
          {toss.winnerTeam && !toss.winnerInitialChoice && <ChoiceRow label="Winner's initial option" choices={['kick', 'receive', 'side', 'defer']} selected={null} disabled={kickoffAccepted} onChoose={(winnerInitialChoice) => updateCoinToss({ winnerInitialChoice })} />}
          {toss.winnerInitialChoice === 'side' && <ChoiceRow label={`${TEAM_LABEL[toss.loserTeam]} chooses`} choices={['kick', 'receive']} selected={toss.loserChoice} disabled={kickoffAccepted} onChoose={(loserChoice) => updateCoinToss({ loserChoice })} />}
          {toss.winnerInitialChoice === 'defer' && !toss.loserChoice && <ChoiceRow label={`${TEAM_LABEL[toss.loserTeam]} chooses`} choices={['kick', 'receive', 'side']} selected={null} disabled={kickoffAccepted} onChoose={(loserChoice) => updateCoinToss({ loserChoice, winnerSecondaryChoice: loserChoice === 'kick' || loserChoice === 'receive' ? 'side' : null })} />}
          {toss.winnerInitialChoice === 'defer' && toss.loserChoice === 'side' && <ChoiceRow label={`${TEAM_LABEL[toss.winnerTeam]} chooses`} choices={['kick', 'receive']} selected={toss.winnerSecondaryChoice} disabled={kickoffAccepted} onChoose={(winnerSecondaryChoice) => updateCoinToss({ winnerSecondaryChoice })} />}
          {(toss.winnerInitialChoice === 'side' || toss.winnerInitialChoice === 'kick' || toss.winnerInitialChoice === 'receive' || isSideImplicit(toss) || toss.loserChoice === 'side') && <ChoiceRow label={`${TEAM_LABEL[toss.directionChoiceTeam || (toss.winnerInitialChoice === 'side' ? toss.winnerTeam : toss.loserChoice === 'side' ? toss.loserTeam : toss.winnerInitialChoice === 'defer' ? toss.winnerTeam : toss.loserTeam)]} chooses direction`} choices={DIRECTION_OPTIONS} selected={toss.direction} disabled={kickoffAccepted} onChoose={(direction) => updateCoinToss({ direction })} />}
        </div>
        <TossSummary toss={toss} />
        {!kickoffAccepted && <button className="rounded bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-400" disabled={!resolveReady(toss)} onClick={completeToss} type="button">Complete Coin Toss</button>}
      </div>}
      {duplicate && <DuplicateCaptainChooser duplicate={duplicate} onChoose={applyCaptain} onCancel={() => setDuplicate(null)} />}
    </section>
  );
}

function RosterPanel({ envelope, onAdd, onUpdate }) { return <div className="grid gap-4 p-4 lg:grid-cols-2">{(['H', 'V']).map((team) => <section key={team}><div className="mb-2 flex items-center justify-between"><h3 className="font-semibold">{TEAM_LABEL[team]} roster</h3><button className="rounded border border-zinc-300 px-2 py-1 text-xs font-semibold" onClick={() => onAdd(team)} type="button">Add player</button></div><div className="space-y-2">{Object.values(envelope.rosters.teams[team].players).map((player) => <div key={player.playerId} className={`grid grid-cols-[64px_1fr_80px_auto] items-center gap-2 rounded border p-2 text-sm ${player.active === false ? 'border-amber-300 bg-amber-50 opacity-80' : 'border-zinc-200'}`}><input aria-label={`${TEAM_LABEL[team]} ${player.playerId} jersey`} className="w-full rounded border border-zinc-300 px-2 py-1" value={player.jersey} onChange={(event) => onUpdate(team, player.playerId, { jersey: event.target.value })}/><input aria-label={`${TEAM_LABEL[team]} ${player.playerId} name`} className="min-w-0 rounded border border-zinc-300 px-2 py-1" value={player.displayName} onChange={(event) => onUpdate(team, player.playerId, { displayName: event.target.value })}/><input aria-label={`${TEAM_LABEL[team]} ${player.playerId} position`} className="rounded border border-zinc-300 px-2 py-1" value={player.position || ''} onChange={(event) => onUpdate(team, player.playerId, { position: event.target.value })}/><label className="flex items-center gap-1 text-xs font-semibold"><input checked={player.active !== false} onChange={(event) => onUpdate(team, player.playerId, { active: event.target.checked })} type="checkbox"/> Active</label></div>)}</div></section>)}</div> }
function StarterPanel({ pregame, roster, onToggle }) { return <div className="space-y-4 p-4">{STARTER_GROUPS.map((group) => <section key={group} className="rounded border border-zinc-200 p-3"><h3 className="mb-2 text-sm font-semibold capitalize">{group === 'specialTeams' ? 'Special teams' : group} starters <span className="font-normal text-zinc-500">(optional)</span></h3><div className="grid gap-3 lg:grid-cols-2">{(['H', 'V']).map((team) => <div key={team}><p className="mb-1 text-xs font-semibold text-zinc-600">{TEAM_LABEL[team]}</p><div className="flex flex-wrap gap-2">{roster.filter((player) => player.team === team).map((player) => <label key={player.playerId} className={`rounded border px-2 py-1 text-xs ${player.active === false ? 'cursor-not-allowed border-zinc-200 text-zinc-400' : 'border-zinc-300'}`}><input className="mr-1" checked={pregame.starters[group][team].includes(player.playerId)} disabled={player.active === false} onChange={() => onToggle(group, team, player.playerId)} type="checkbox"/>#{player.jersey} {player.displayName}</label>)}</div></div>)}</div></section>)}</div> }
function CaptainTeam({ team, captains, active, token, inputRef, onSelect, onChange, onCommit }) { return <section className="rounded border border-zinc-200 p-3"><div className="flex items-center justify-between"><h3 className="font-semibold">{TEAM_LABEL[team]} captains <span className="font-normal text-zinc-500">(optional)</span></h3><button className="rounded border border-zinc-300 px-2 py-1 text-xs font-semibold" onClick={onSelect} type="button">{active ? 'Editing' : 'Review / edit'}</button></div><div className="mt-2 flex flex-wrap gap-1">{captains.length ? captains.map((captain) => <span key={captain.playerId} className="rounded bg-zinc-100 px-2 py-1 text-xs">#{captain.jerseyNumber}</span>) : <span className="text-xs text-zinc-500">No captains recorded</span>}</div>{active && <form className="mt-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); onCommit(); }}><input ref={inputRef} aria-label={`${TEAM_LABEL[team]} captain jersey`} className="min-w-0 flex-1 rounded border border-emerald-500 px-2 py-1 text-sm outline-none ring-2 ring-emerald-100" value={token} onChange={(event) => onChange(event.target.value)} placeholder="Jersey #" inputMode="numeric"/><button className="rounded bg-emerald-700 px-3 py-1 text-sm font-semibold text-white" type="submit">Enter</button></form>}</section> }
function ChoiceRow({ label, choices, selected, disabled, format = (value) => value, onChoose }) { return <div><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</p><div className="flex flex-wrap gap-2">{choices.map((choice) => <button key={choice} className={`rounded border px-3 py-2 text-sm font-semibold ${selected === choice ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-zinc-300 text-zinc-800'} disabled:cursor-not-allowed disabled:opacity-60`} disabled={disabled} onClick={() => onChoose(choice)} type="button">{format(choice)}</button>)}</div></div> }
function TossSummary({ toss }) { return <section className="rounded border border-zinc-200 bg-zinc-50 p-3 text-sm"><h3 className="font-semibold">Toss summary</h3><dl className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2">{[['Winner', toss.winnerTeam && TEAM_LABEL[toss.winnerTeam]], ['Initial option', toss.winnerInitialChoice], ['Loser choice', toss.loserChoice], ['Winner secondary choice', toss.winnerSecondaryChoice], ['Direction', toss.direction], ['Direction choosing team', toss.directionChoiceTeam && TEAM_LABEL[toss.directionChoiceTeam]], ['First-half kicking team', toss.firstHalfKickingTeam && TEAM_LABEL[toss.firstHalfKickingTeam]], ['First-half receiving team', toss.firstHalfReceivingTeam && TEAM_LABEL[toss.firstHalfReceivingTeam]], ['Second-half choice team', toss.secondHalfChoiceTeam && TEAM_LABEL[toss.secondHalfChoiceTeam]]].map(([label, value]) => <React.Fragment key={label}><dt className="text-zinc-500">{label}</dt><dd className="font-medium">{value || '—'}</dd></React.Fragment>)}</dl></section> }
function DuplicateCaptainChooser({ duplicate, onChoose, onCancel }) { return <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Choose duplicate captain"><section className="w-full max-w-md rounded bg-white p-4 shadow-xl"><h2 className="text-lg font-semibold">Choose player for #{duplicate.resolution.jerseyToken}</h2><p className="mt-1 text-sm text-zinc-600">Duplicate jersey numbers require an explicit selection.</p><div className="mt-3 space-y-2">{duplicate.resolution.candidates.map((candidate) => <button key={candidate.playerId} className="block w-full rounded border border-zinc-300 px-3 py-2 text-left hover:border-emerald-600" onClick={() => onChoose(candidate)} type="button">#{candidate.jersey} {candidate.displayName} · {candidate.position || 'No position'}</button>)}</div><button className="mt-3 rounded border border-zinc-300 px-3 py-2 text-sm font-semibold" onClick={onCancel} type="button">Cancel</button></section></div> }
function flattenRoster(envelope) { return Object.values(envelope.rosters?.teams || {}).flatMap((team) => Object.values(team.players || {})); }
function resolveReady(toss) { try { resolveCompleteToss({ ...toss, completedAt: null }); return true; } catch { return false; } }

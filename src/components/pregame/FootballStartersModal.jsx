import React, { useEffect, useState } from 'react';
import { resolvePlayerByJersey } from '../../quick-input/playerResolution';

const SLOT_COUNT = 11;
const TEAM_LABEL = { H: 'Home', V: 'Away' };
const GROUP_LABEL = { offense: 'Offense', defense: 'Defense' };

export default function FootballStartersModal({ onChooseTeam, onClose, onSave, open, pregame, roster, saveError = '', team }) {
  const [rows, setRows] = useState(() => buildStarterRows(pregame, roster, team));
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!open || !team) return;
    setRows(buildStarterRows(pregame, roster, team));
    setNotice('');
  }, [open, pregame, roster, team]);

  if (!open) return null;

  if (!team) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Choose starters team">
        <section className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-5 shadow-2xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Game Control · Starters</p>
          <h2 className="mt-1 text-xl font-semibold text-zinc-950">Choose a team</h2>
          <p className="mt-1 text-sm text-zinc-600">Open the optional 11-player offense and defense starter workspace.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {(['V', 'H']).map((teamCode) => (
              <button className="rounded border border-zinc-300 bg-white px-4 py-4 text-left font-semibold text-zinc-900 hover:border-emerald-700 hover:bg-emerald-50" key={teamCode} onClick={() => onChooseTeam(teamCode)} type="button">
                {TEAM_LABEL[teamCode]} starters
              </button>
            ))}
          </div>
          <div className="mt-5 flex justify-end">
            <button className="rounded border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50" onClick={onClose} type="button">Cancel</button>
          </div>
        </section>
      </div>
    );
  }

  const updateRow = (group, index, patch) => {
    setRows((current) => ({
      ...current,
      [group]: current[group].map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row),
    }));
    setNotice('');
  };

  const changeJersey = (group, index, jersey) => {
    updateRow(group, index, {
      candidates: [],
      error: '',
      jersey,
      name: '',
      playerId: '',
      position: '',
    });
  };

  const resolveSlot = (group, index) => {
    const current = rows[group][index];
    const resolved = resolveStarterSlot(current, group, roster, team);
    updateRow(group, index, resolved);
    return resolved;
  };

  const selectCandidate = (group, index, playerId) => {
    const row = rows[group][index];
    const candidate = row.candidates.find((item) => item.playerId === playerId);
    if (!candidate) return;
    updateRow(group, index, applyCandidate(row, candidate, group));
  };

  const clearSlot = (group, index) => updateRow(group, index, emptyStarterRow());

  const save = () => {
    const nextRows = {
      offense: rows.offense.map((row) => row.jersey && !row.playerId ? resolveStarterSlot(row, 'offense', roster, team) : row),
      defense: rows.defense.map((row) => row.jersey && !row.playerId ? resolveStarterSlot(row, 'defense', roster, team) : row),
    };
    setRows(nextRows);

    const invalid = ['offense', 'defense'].flatMap((group) => nextRows[group].filter((row) => row.error || (row.jersey && !row.playerId)));
    if (invalid.length) {
      setNotice('Resolve or clear every jersey number before saving starters.');
      return;
    }

    for (const group of ['offense', 'defense']) {
      const ids = nextRows[group].map((row) => row.playerId).filter(Boolean);
      if (new Set(ids).size !== ids.length) {
        setNotice(`A player can only occupy one ${group} starter slot.`);
        return;
      }
    }

    onSave({
      positionUpdates: ['offense', 'defense'].flatMap((group) => nextRows[group]
        .filter((row) => row.playerId && row.position.trim())
        .map((row) => ({ group, playerId: row.playerId, position: row.position.trim().toUpperCase() }))),
      starters: {
        offense: nextRows.offense.map((row) => row.playerId).filter(Boolean),
        defense: nextRows.defense.map((row) => row.playerId).filter(Boolean),
      },
      team,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label={`${TEAM_LABEL[team]} starters editor`}>
      <section className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-2xl">
        <header className="sticky top-0 z-10 flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 bg-white px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Starting units · optional</p>
            <h2 className="text-xl font-semibold text-zinc-950">{TEAM_LABEL[team]} starters</h2>
            <p className="mt-1 text-sm text-zinc-600">Enter a jersey number to fill the player name. Every one of the 22 slots may remain blank.</p>
          </div>
          <div className="flex gap-2">
            <button className="rounded border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50" onClick={onClose} type="button">Cancel</button>
            <button className="rounded bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800" onClick={save} type="button">Save starters</button>
          </div>
        </header>

        {(notice || saveError) && <p className="mx-5 mt-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950" role="status">{notice || saveError}</p>}

        <div className="grid gap-5 p-5 lg:grid-cols-2">
          {(['offense', 'defense']).map((group) => (
            <StarterUnit
              group={group}
              key={group}
              onChangeJersey={changeJersey}
              onClear={clearSlot}
              onResolve={resolveSlot}
              onSelectCandidate={selectCandidate}
              onUpdate={updateRow}
              rows={rows[group]}
              team={team}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function StarterUnit({ group, onChangeJersey, onClear, onResolve, onSelectCandidate, onUpdate, rows, team }) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="font-semibold text-zinc-950">{GROUP_LABEL[group]}</h3>
        <span className="text-xs text-zinc-500">11 optional slots</span>
      </div>
      <div className="grid grid-cols-[32px_74px_minmax(150px,1fr)_86px_50px] gap-2 border-b border-zinc-200 px-1 pb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        <span>Slot</span><span>Jersey</span><span>Player</span><span>Position</span><span />
      </div>
      <div className="divide-y divide-zinc-200">
        {rows.map((row, index) => {
          const prefix = `${TEAM_LABEL[team]} ${group} starter ${index + 1}`;
          return (
            <div className="grid grid-cols-[32px_74px_minmax(150px,1fr)_86px_50px] items-start gap-2 px-1 py-2" key={`${group}-${index}`}>
              <span className="pt-2 text-xs font-semibold text-zinc-500">{index + 1}</span>
              <div>
                <input
                  aria-label={`${prefix} jersey`}
                  className={`w-full rounded border px-2 py-1.5 text-sm ${row.error ? 'border-red-400 bg-red-50' : 'border-zinc-300 bg-white'}`}
                  inputMode="numeric"
                  onBlur={() => onResolve(group, index)}
                  onChange={(event) => onChangeJersey(group, index, event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      onResolve(group, index);
                    }
                  }}
                  placeholder="##"
                  value={row.jersey}
                />
                {row.error && <span className="mt-1 block text-[10px] leading-tight text-red-700">Not found</span>}
              </div>
              {row.candidates.length > 1 ? (
                <select aria-label={`${prefix} player`} className="w-full rounded border border-emerald-500 bg-white px-2 py-1.5 text-sm" onChange={(event) => onSelectCandidate(group, index, event.target.value)} value={row.playerId}>
                  {row.candidates.map((candidate) => <option key={candidate.playerId} value={candidate.playerId}>{candidate.displayName} · {positionForGroup(candidate.player, group) || 'No position'}</option>)}
                </select>
              ) : (
                <input aria-label={`${prefix} player`} className="w-full rounded border border-zinc-200 bg-zinc-100 px-2 py-1.5 text-sm text-zinc-700" readOnly value={row.name} />
              )}
              <input aria-label={`${prefix} position`} className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm uppercase disabled:bg-zinc-100" disabled={!row.playerId} onChange={(event) => onUpdate(group, index, { position: event.target.value.toUpperCase() })} placeholder="POS" value={row.position} />
              <button aria-label={`Clear ${prefix}`} className="rounded border border-zinc-300 px-2 py-1.5 text-xs font-semibold text-zinc-600 disabled:opacity-40" disabled={!row.jersey && !row.playerId} onClick={() => onClear(group, index)} type="button">Clear</button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function buildStarterRows(pregame, roster, team) {
  const byId = new Map(roster.map((player) => [playerIdFor(player), player]));
  return ['offense', 'defense'].reduce((groups, group) => {
    const selected = pregame.starters?.[group]?.[team] || [];
    const filled = selected.slice(0, SLOT_COUNT).map((playerId) => {
      const player = byId.get(String(playerId));
      if (!player) return emptyStarterRow();
      return applyCandidate(emptyStarterRow(), candidateForPlayer(player), group);
    });
    groups[group] = [...filled, ...Array.from({ length: SLOT_COUNT - filled.length }, emptyStarterRow)];
    return groups;
  }, {});
}

function resolveStarterSlot(row, group, roster, team) {
  if (!String(row.jersey || '').trim()) return emptyStarterRow();
  const resolution = resolvePlayerByJersey({
    actionContext: group,
    jerseyToken: row.jersey,
    roster,
    teamScope: team,
  });
  if (resolution.kind === 'error') {
    return { ...row, candidates: [], error: resolution.error.message, name: '', playerId: '', position: '' };
  }
  if (resolution.kind === 'duplicate') {
    return applyCandidate({ ...row, candidates: resolution.candidates }, resolution.recommended, group, resolution.candidates);
  }
  return applyCandidate(row, resolution.player, group);
}

function applyCandidate(row, candidate, group, candidates = row.candidates || []) {
  return {
    ...row,
    candidates,
    error: '',
    jersey: candidate.jersey,
    name: candidate.displayName,
    playerId: candidate.playerId,
    position: positionForGroup(candidate.player, group),
  };
}

function candidateForPlayer(player) {
  const playerId = playerIdFor(player);
  return {
    displayName: String(player.displayName || player.name || playerId),
    jersey: String(player.jersey ?? player.jerseyNumber ?? player.number ?? ''),
    player,
    playerId,
  };
}

function positionForGroup(player, group) {
  const value = group === 'offense'
    ? player.off_position || player.position || player.pos
    : player.def_position || player.position || player.pos;
  return String(value || '').trim().toUpperCase();
}

function playerIdFor(player) {
  return String(player.playerId ?? player.id ?? player.PlayerID ?? player.player_id ?? '');
}

function emptyStarterRow() {
  return { candidates: [], error: '', jersey: '', name: '', playerId: '', position: '' };
}

export { SLOT_COUNT, buildStarterRows, positionForGroup, resolveStarterSlot };

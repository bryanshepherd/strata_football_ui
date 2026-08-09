import React, { useEffect, useMemo, useState } from 'react';

const TEAM_LABEL = { H: 'Home', V: 'Away' };

export default function FootballRosterEditorModal({ envelope, onClose, onSave, open, saveError = '' }) {
  const [draftTeams, setDraftTeams] = useState(() => createDraftTeams(envelope));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setDraftTeams(createDraftTeams(envelope));
    setError('');
  }, [envelope, open]);

  const matchup = useMemo(() => {
    const away = envelope.game?.teams?.V?.name || envelope.rosters?.teams?.V?.name || 'Away';
    const home = envelope.game?.teams?.H?.name || envelope.rosters?.teams?.H?.name || 'Home';
    return `${away} at ${home}`;
  }, [envelope]);

  if (!open) return null;

  const updatePlayer = (team, playerId, patch) => {
    setDraftTeams((current) => ({
      ...current,
      [team]: current[team].map((player) => (
        player.playerId === playerId ? { ...player, ...patch } : player
      )),
    }));
    setError('');
  };

  const addPlayer = (team) => {
    const playerId = createPlayerId(team);
    setDraftTeams((current) => ({
      ...current,
      [team]: [
        ...current[team],
        { playerId, team, jersey: '', displayName: '', position: '', active: true },
      ],
    }));
    setError('');
  };

  const save = () => {
    const validationError = validateDraft(draftTeams);
    if (validationError) {
      setError(validationError);
      return;
    }
    onSave(buildRosterEnvelope(envelope.rosters, draftTeams));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Football roster editor">
      <section className="max-h-[92vh] w-full max-w-[1200px] overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-2xl">
        <header className="sticky top-0 z-10 flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 bg-white px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Football roster editor</p>
            <h2 className="text-xl font-semibold text-zinc-950">{matchup}</h2>
            <p className="mt-1 text-sm text-zinc-600">Edit the game roster used by pregame setup and scorer jersey lookup.</p>
          </div>
          <div className="flex gap-2">
            <button className="rounded border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50" onClick={onClose} type="button">Cancel</button>
            <button className="rounded bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800" onClick={save} type="button">Save rosters</button>
          </div>
        </header>

        {(error || saveError) && <p className="mx-5 mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{error || saveError}</p>}

        <div className="space-y-5 p-5">
          {(['V', 'H']).map((team) => (
            <RosterTeamTable
              key={team}
              onAdd={() => addPlayer(team)}
              onUpdate={(playerId, patch) => updatePlayer(team, playerId, patch)}
              players={draftTeams[team]}
              team={team}
              teamName={envelope.game?.teams?.[team]?.name || envelope.rosters?.teams?.[team]?.name}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function RosterTeamTable({ onAdd, onUpdate, players, team, teamName }) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold text-zinc-950">{teamName || TEAM_LABEL[team]}</h3>
          <p className="text-xs text-zinc-500">{TEAM_LABEL[team]} roster · {players.length} players</p>
        </div>
        <button className="rounded border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:border-emerald-600 hover:text-emerald-800" onClick={onAdd} type="button">Add player</button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <th className="px-2 py-2">Jersey</th>
              <th className="px-2 py-2">Player name</th>
              <th className="px-2 py-2">Position</th>
              <th className="px-2 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr className={`border-b border-zinc-100 ${player.active === false ? 'bg-amber-50' : ''}`} key={player.playerId}>
                <td className="px-2 py-2">
                  <input aria-label={`${TEAM_LABEL[team]} ${player.playerId} jersey`} className="w-24 rounded border border-zinc-300 px-2 py-1.5" inputMode="numeric" value={player.jersey || ''} onChange={(event) => onUpdate(player.playerId, { jersey: event.target.value })} />
                </td>
                <td className="px-2 py-2">
                  <input aria-label={`${TEAM_LABEL[team]} ${player.playerId} name`} className="w-full min-w-[220px] rounded border border-zinc-300 px-2 py-1.5" value={player.displayName || ''} onChange={(event) => onUpdate(player.playerId, { displayName: event.target.value })} />
                </td>
                <td className="px-2 py-2">
                  <input aria-label={`${TEAM_LABEL[team]} ${player.playerId} position`} className="w-28 rounded border border-zinc-300 px-2 py-1.5 uppercase" value={player.position || ''} onChange={(event) => onUpdate(player.playerId, { position: event.target.value.toUpperCase() })} />
                </td>
                <td className="px-2 py-2">
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-700">
                    <input checked={player.active !== false} onChange={(event) => onUpdate(player.playerId, { active: event.target.checked })} type="checkbox" />
                    {player.active === false ? 'Inactive' : 'Active'}
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function createDraftTeams(envelope) {
  return ['H', 'V'].reduce((teams, team) => {
    teams[team] = Object.values(envelope.rosters?.teams?.[team]?.players || {}).map((player) => ({ ...player }));
    return teams;
  }, {});
}

function createPlayerId(team) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${team}-local-${crypto.randomUUID()}`;
  }
  return `${team}-local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function validateDraft(teams) {
  for (const team of ['V', 'H']) {
    for (const [index, player] of teams[team].entries()) {
      const jersey = String(player.jersey || '').trim();
      const name = String(player.displayName || '').trim();
      if (!jersey && !name && !String(player.position || '').trim()) continue;
      if (!/^\d+$/.test(jersey)) return `${TEAM_LABEL[team]} roster row ${index + 1} needs a numeric jersey number.`;
      if (!name) return `${TEAM_LABEL[team]} roster row ${index + 1} needs a player name.`;
    }
  }
  return '';
}

function buildRosterEnvelope(rosters, teams) {
  const nextTeams = { ...rosters.teams };
  for (const team of ['H', 'V']) {
    const players = teams[team].reduce((result, player) => {
      const jersey = String(player.jersey || '').trim();
      const displayName = String(player.displayName || '').trim();
      const position = String(player.position || '').trim().toUpperCase();
      if (!jersey && !displayName && !position) return result;
      result[player.playerId] = {
        ...player,
        active: player.active !== false,
        displayName,
        jersey,
        playerId: player.playerId,
        position,
        team,
      };
      return result;
    }, {});
    nextTeams[team] = {
      ...rosters.teams[team],
      jerseyIndex: buildJerseyIndex(players),
      players,
    };
  }
  return { ...rosters, teams: nextTeams, updatedAt: new Date().toISOString() };
}

function buildJerseyIndex(players) {
  return Object.values(players).reduce((index, player) => {
    if (player.active === false) return index;
    const jersey = String(player.jersey || '').trim();
    if (!jersey) return index;
    index[jersey] = [...(index[jersey] || []), player.playerId];
    return index;
  }, {});
}

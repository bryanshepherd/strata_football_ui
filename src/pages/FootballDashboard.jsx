import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  createFootballDashboardGame,
  footballTeamOptions,
  listFootballDashboardGames,
} from '../services/footballDashboardService';

const today = () => new Date().toISOString().slice(0, 10);

const defaultDraft = () => ({
  gameDate: today(),
  startTime: '19:00',
  venue: 'Dickerson Stadium',
  visitorTeamId: footballTeamOptions[1]?.teamId || '',
  homeTeamId: footballTeamOptions[0]?.teamId || '',
});

export default function FootballDashboard() {
  const [games, setGames] = useState(() => listFootballDashboardGames());
  const [draft, setDraft] = useState(() => defaultDraft());
  const [error, setError] = useState('');
  const selectedHome = useMemo(
    () => footballTeamOptions.find((team) => team.teamId === draft.homeTeamId),
    [draft.homeTeamId],
  );
  const selectedVisitor = useMemo(
    () => footballTeamOptions.find((team) => team.teamId === draft.visitorTeamId),
    [draft.visitorTeamId],
  );

  const updateDraft = (field) => (event) => {
    setDraft((current) => ({ ...current, [field]: event.target.value }));
  };

  const createGame = (event) => {
    event.preventDefault();
    if (!draft.homeTeamId || !draft.visitorTeamId) {
      setError('Select home and visitor teams.');
      return;
    }
    if (draft.homeTeamId === draft.visitorTeamId) {
      setError('Home and visitor teams must be different.');
      return;
    }

    const record = createFootballDashboardGame(draft);
    setGames(listFootballDashboardGames());
    setDraft((current) => ({
      ...defaultDraft(),
      venue: current.venue,
      homeTeamId: current.homeTeamId,
      visitorTeamId: current.visitorTeamId,
    }));
    setError('');
    window.requestAnimationFrame?.(() => {
      document.querySelector(`[data-game-row="${record.gameId}"]`)?.scrollIntoView?.({ block: 'nearest' });
    });
  };

  return (
    <main className="min-h-screen bg-zinc-100 text-zinc-950">
      <header className="border-b border-zinc-300 bg-white">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded bg-emerald-800 text-sm font-black text-white">
              SF
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Strata Football
              </p>
              <h1 className="text-xl font-semibold">Football Dashboard</h1>
            </div>
          </div>
          <Link
            className="rounded border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
            to="/scorer"
          >
            Open Fixture Scorer
          </Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] gap-4 px-4 py-4 lg:grid-cols-[380px_1fr]">
        <section className="rounded border border-zinc-300 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Create Football Game</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Select teams, attach fixture rosters, and seed a game envelope.
              </p>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">
              {error}
            </div>
          )}

          <form className="mt-4 space-y-4" onSubmit={createGame}>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-medium text-zinc-700">
                Date
                <input
                  className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                  onChange={updateDraft('gameDate')}
                  type="date"
                  value={draft.gameDate}
                />
              </label>
              <label className="text-sm font-medium text-zinc-700">
                Time
                <input
                  className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                  onChange={updateDraft('startTime')}
                  type="time"
                  value={draft.startTime}
                />
              </label>
            </div>

            <label className="block text-sm font-medium text-zinc-700">
              Venue
              <input
                className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                onChange={updateDraft('venue')}
                placeholder="Stadium"
                type="text"
                value={draft.venue}
              />
            </label>

            <label className="block text-sm font-medium text-zinc-700">
              Visitor Team
              <select
                className="mt-1 w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm"
                onChange={updateDraft('visitorTeamId')}
                value={draft.visitorTeamId}
              >
                {footballTeamOptions.map((team) => (
                  <option key={team.teamId} value={team.teamId}>
                    {team.name} ({team.abbr})
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-zinc-700">
              Home Team
              <select
                className="mt-1 w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm"
                onChange={updateDraft('homeTeamId')}
                value={draft.homeTeamId}
              >
                {footballTeamOptions.map((team) => (
                  <option key={team.teamId} value={team.teamId}>
                    {team.name} ({team.abbr})
                  </option>
                ))}
              </select>
            </label>

            <div className="rounded border border-zinc-200 bg-zinc-50 p-3">
              <h3 className="text-sm font-semibold text-zinc-900">Roster Attachment</h3>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <RosterAttachment label="Visitor" team={selectedVisitor} />
                <RosterAttachment label="Home" team={selectedHome} />
              </div>
              <button
                className="mt-3 rounded border border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-500"
                disabled
                type="button"
              >
                Manage Rosters
              </button>
            </div>

            <button
              className="w-full rounded bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
              type="submit"
            >
              Create Game
            </button>
          </form>
        </section>

        <section className="min-w-0 rounded border border-zinc-300 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Football Games</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Launch a scorer from a seeded game envelope.
              </p>
            </div>
            <span className="rounded border border-zinc-300 px-2 py-1 text-xs font-semibold text-zinc-600">
              {games.length} games
            </span>
          </div>

          <div className="mt-4 overflow-hidden rounded border border-zinc-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Game</th>
                  <th className="px-3 py-2">Teams</th>
                  <th className="px-3 py-2">Rosters</th>
                  <th className="px-3 py-2">Envelope</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {games.length === 0 ? (
                  <tr>
                    <td className="px-3 py-6 text-center text-zinc-500" colSpan={5}>
                      No football games yet.
                    </td>
                  </tr>
                ) : games.map((game) => (
                  <tr data-game-row={game.gameId} key={game.gameId}>
                    <td className="px-3 py-3">
                      <div className="font-semibold">{game.gameId}</div>
                      <div className="text-xs text-zinc-500">
                        {game.gameDate} · {game.startTime} · {game.venue}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div>{game.visitorTeam.abbr} at {game.homeTeam.abbr}</div>
                      <div className="text-xs text-zinc-500">
                        {game.visitorTeam.name} at {game.homeTeam.name}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="rounded bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700">
                        V {game.rosterStatus.V} · H {game.rosterStatus.H}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="rounded bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">
                        Seeded
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Link
                        className="rounded bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
                        to={`/scorer?gameId=${encodeURIComponent(game.gameId)}`}
                      >
                        Launch Scorer
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

const RosterAttachment = ({ label, team }) => (
  <div className="rounded border border-zinc-200 bg-white px-3 py-2">
    <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</div>
    <div className="mt-1 font-semibold">{team?.abbr || '-'}</div>
    <div className="text-xs text-zinc-500">Roster attached</div>
  </div>
);

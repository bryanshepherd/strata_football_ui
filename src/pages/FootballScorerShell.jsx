import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  defaultFixtureKey,
  fixtureOptions,
  getGameEnvelopeFixture,
} from '../data/footballGameEnvelopeFixtures';

const formatStatus = (status) =>
  String(status || 'unknown').replace(/([a-z])([A-Z])/g, '$1 $2');

const getTeam = (envelope, code) => envelope.game.teams[code];

const getPossessionTeam = (envelope) => {
  const possession = envelope.liveState.possession;
  return possession ? getTeam(envelope, possession) : null;
};

const formatDownDistance = (liveState) => {
  if (!liveState.down || !liveState.distance) {
    return 'Not set';
  }

  if (liveState.goalToGo) {
    return `${liveState.down} and goal`;
  }

  return `${liveState.down} and ${liveState.distance}`;
};

const formatSpot = (liveState) => liveState.yardLine || 'Not set';

const formatDriveResult = (drive) => drive?.result || 'Active';

export default function FootballScorerShell() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedFixture = searchParams.get('fixture') || defaultFixtureKey;
  const envelope = getGameEnvelopeFixture(requestedFixture);

  if (!envelope) {
    return (
      <ShellRouteState
        title="Fixture not found"
        message={`No fixture envelope exists for "${requestedFixture}".`}
      />
    );
  }

  const onFixtureChange = (event) => {
    setSearchParams({ fixture: event.target.value });
  };

  return (
    <main className="min-h-screen bg-zinc-100 text-zinc-950">
      <ScorerHeader
        envelope={envelope}
        fixtureKey={requestedFixture}
        onFixtureChange={onFixtureChange}
      />

      <div className="mx-auto grid max-w-[1500px] gap-4 px-4 py-4 xl:grid-cols-[280px_minmax(0,1fr)_340px]">
        <RosterLookup envelope={envelope} />

        <section className="min-w-0 space-y-4">
          <Scorebug envelope={envelope} />
          <ClockDownDistanceStrip envelope={envelope} />
          <DriveStatusBand envelope={envelope} />
          <PlayEntryWorkspace envelope={envelope} />
        </section>

        <GameLogColumn envelope={envelope} />
      </div>
    </main>
  );
}

export function FootballShellLoadingState() {
  return (
    <ShellRouteState title="Loading scorer" message="Reading fixture envelope." />
  );
}

const ShellRouteState = ({ title, message }) => (
  <main className="flex min-h-screen items-center justify-center bg-zinc-100 p-6">
    <section className="w-full max-w-md rounded border border-zinc-300 bg-white p-6 text-center shadow-sm">
      <h1 className="text-xl font-semibold text-zinc-950">{title}</h1>
      <p className="mt-2 text-sm text-zinc-600">{message}</p>
      <Link
        className="mt-4 inline-flex rounded bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
        to={`/?fixture=${defaultFixtureKey}`}
      >
        Open scorer
      </Link>
    </section>
  </main>
);

const ScorerHeader = ({ envelope, fixtureKey, onFixtureChange }) => {
  const teams = envelope.game.teams;

  return (
    <header className="border-b border-zinc-300 bg-white">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded bg-emerald-800 text-sm font-black text-white">
            SF
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Strata Football
            </p>
            <h1 className="truncate text-xl font-semibold">
              {teams.V.name} at {teams.H.name}
            </h1>
          </div>
        </div>

        <nav className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
            Dev fixture
            <select
              className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm"
              value={fixtureKey}
              onChange={onFixtureChange}
            >
              {fixtureOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <Link
            className="rounded border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
            to={`/reports?fixture=${fixtureKey}`}
          >
            Reports
          </Link>
        </nav>
      </div>
    </header>
  );
};

const Scorebug = ({ envelope }) => {
  const teams = envelope.game.teams;
  const possession = envelope.liveState.possession;

  return (
    <section className="grid overflow-hidden rounded border border-zinc-300 bg-white md:grid-cols-[1fr_auto_1fr]">
      <TeamScoreCard team={teams.V} hasBall={possession === 'V'} align="left" />
      <div className="flex flex-col items-center justify-center border-y border-zinc-200 bg-zinc-950 px-8 py-4 text-white md:border-x md:border-y-0">
        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          {formatStatus(envelope.game.status)}
        </div>
        <div className="mt-1 text-4xl font-black tabular-nums">
          {envelope.clock.clock}
        </div>
        <div className="mt-1 text-sm text-zinc-300">
          Q{envelope.clock.period || '-'} · Play {envelope.clock.playClock || '--'}
        </div>
      </div>
      <TeamScoreCard team={teams.H} hasBall={possession === 'H'} align="right" />
    </section>
  );
};

const TeamScoreCard = ({ team, hasBall, align }) => (
  <div
    className={`flex items-center justify-between gap-3 p-4 ${
      align === 'right' ? 'md:flex-row-reverse md:text-right' : ''
    }`}
  >
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        {hasBall && (
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" aria-label="Possession" />
        )}
        <div className="truncate text-sm font-semibold uppercase tracking-wide text-zinc-500">
          {team.abbr}
        </div>
      </div>
      <div className="truncate text-lg font-semibold">{team.name}</div>
    </div>
    <div className="text-5xl font-black tabular-nums">{team.score}</div>
  </div>
);

const ClockDownDistanceStrip = ({ envelope }) => {
  const liveState = envelope.liveState;
  const possessionTeam = getPossessionTeam(envelope);

  return (
    <section className="grid gap-px overflow-hidden rounded border border-zinc-300 bg-zinc-300 text-sm md:grid-cols-5">
      <StripCell label="Ball" value={possessionTeam?.abbr || 'None'} />
      <StripCell label="Down/Distance" value={formatDownDistance(liveState)} />
      <StripCell label="Spot" value={formatSpot(liveState)} />
      <StripCell label="Line To Gain" value={liveState.lineToGain || 'None'} />
      <StripCell
        label="Field State"
        value={liveState.goalToGo ? 'Goal to go' : liveState.redZone ? 'Red zone' : 'Open field'}
        tone={liveState.goalToGo || liveState.redZone ? 'warning' : 'default'}
      />
    </section>
  );
};

const StripCell = ({ label, value, tone = 'default' }) => (
  <div className={`bg-white p-3 ${tone === 'warning' ? 'text-amber-800' : 'text-zinc-950'}`}>
    <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
      {label}
    </div>
    <div className="mt-1 text-lg font-semibold">{value}</div>
  </div>
);

const DriveStatusBand = ({ envelope }) => {
  const currentDrive = envelope.drives.current;
  const team = currentDrive?.team ? getTeam(envelope, currentDrive.team) : null;

  return (
    <section className="rounded border border-zinc-300 bg-white">
      <div className="grid gap-px overflow-hidden rounded bg-zinc-200 text-sm md:grid-cols-5">
        <DriveMetric label="Drive" value={currentDrive?.driveId || 'None'} />
        <DriveMetric label="Team" value={team?.abbr || 'None'} />
        <DriveMetric label="Start" value={currentDrive?.startYardLine || 'None'} />
        <DriveMetric label="Plays" value={String(currentDrive?.plays ?? 0)} />
        <DriveMetric label="Yards" value={String(currentDrive?.yards ?? 0)} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200 px-4 py-3 text-sm">
        <span className="font-medium text-zinc-700">
          Drive {envelope.liveState.driveNumber || '-'} · {formatDriveResult(currentDrive)}
        </span>
        <span className="text-zinc-500">{envelope.liveState.nextPlayContext || envelope.gameId}</span>
      </div>
    </section>
  );
};

const DriveMetric = ({ label, value }) => (
  <div className="bg-white p-3">
    <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
      {label}
    </div>
    <div className="mt-1 text-lg font-semibold">{value}</div>
  </div>
);

const PlayEntryWorkspace = ({ envelope }) => {
  const playButtons = ['Rush', 'Pass', 'Punt', 'Kick', 'Penalty', 'Game Control'];
  const liveState = envelope.liveState;

  return (
    <section className="rounded border border-zinc-300 bg-white">
      <div className="border-b border-zinc-200 px-4 py-3">
        <h2 className="text-base font-semibold">Play Entry</h2>
      </div>
      <div className="grid gap-4 p-4 lg:grid-cols-[1fr_240px]">
        <div className="min-h-[240px] rounded border border-zinc-200 bg-zinc-50 p-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {playButtons.map((label) => (
              <button
                key={label}
                className="rounded border border-zinc-300 bg-white px-3 py-3 text-sm font-semibold text-zinc-500"
                disabled
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mt-6 rounded border border-dashed border-zinc-300 bg-white p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Current Context
            </div>
            <div className="mt-2 text-2xl font-semibold">
              {formatDownDistance(liveState)} at {formatSpot(liveState)}
            </div>
            <div className="mt-2 text-sm text-zinc-600">
              {getPossessionTeam(envelope)?.name || 'No possession'} · {formatStatus(envelope.game.status)}
            </div>
          </div>
        </div>

        <div className="rounded border border-zinc-200 bg-white p-4">
          <h3 className="text-sm font-semibold">Accepted Envelope</h3>
          <dl className="mt-3 space-y-3 text-sm">
            <EnvelopeRow label="Game" value={envelope.gameId} />
            <EnvelopeRow label="Version" value={envelope.updatedAt} />
            <EnvelopeRow label="Events" value={String(envelope.events.length)} />
            <EnvelopeRow label="Schema" value={envelope.schemaVersion} />
          </dl>
        </div>
      </div>
    </section>
  );
};

const EnvelopeRow = ({ label, value }) => (
  <div>
    <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
      {label}
    </dt>
    <dd className="mt-0.5 break-words font-medium text-zinc-900">{value}</dd>
  </div>
);

const GameLogColumn = ({ envelope }) => (
  <aside className="rounded border border-zinc-300 bg-white">
    <div className="border-b border-zinc-200 px-4 py-3">
      <h2 className="text-base font-semibold">Game Log</h2>
    </div>
    <div className="max-h-[calc(100vh-170px)] overflow-auto">
      {envelope.events.length === 0 ? (
        <div className="p-4 text-sm text-zinc-600">No accepted events.</div>
      ) : (
        <ol className="divide-y divide-zinc-200">
          {envelope.events
            .slice()
            .reverse()
            .map((event) => (
              <li key={event.eventId} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold capitalize">
                      {event.type}
                      {event.subtype ? ` · ${event.subtype}` : ''}
                    </div>
                    <p className="mt-1 text-sm text-zinc-700">
                      {event.description || event.result?.code || 'Accepted event'}
                    </p>
                  </div>
                  <span className="shrink-0 rounded bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-600">
                    #{event.sequence}
                  </span>
                </div>
                <div className="mt-2 text-xs text-zinc-500">
                  Q{event.period || '-'} {event.clock || '--:--'} · {event.possession || '-'}
                </div>
              </li>
            ))}
        </ol>
      )}
    </div>
  </aside>
);

const RosterLookup = ({ envelope }) => {
  const teams = envelope.rosters.teams;

  return (
    <aside className="rounded border border-zinc-300 bg-white">
      <div className="border-b border-zinc-200 px-4 py-3">
        <h2 className="text-base font-semibold">Roster Lookup</h2>
      </div>
      <div className="space-y-4 p-4">
        <input
          aria-label="Roster search"
          className="w-full rounded border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-600"
          disabled
          placeholder="Search roster"
          type="search"
        />
        {Object.entries(teams).map(([teamCode, team]) => (
          <section key={teamCode}>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">{team.abbr}</h3>
              <span className="text-xs font-medium text-zinc-500">{teamCode}</span>
            </div>
            <div className="space-y-2">
              {Object.values(team.players).map((player) => (
                <div
                  key={player.playerId}
                  className="grid grid-cols-[42px_1fr_auto] items-center gap-2 rounded border border-zinc-200 px-2 py-2 text-sm"
                >
                  <span className="font-semibold tabular-nums">#{player.jersey}</span>
                  <span className="min-w-0 truncate">{player.displayName}</span>
                  <span className="text-xs font-semibold text-zinc-500">{player.position}</span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </aside>
  );
};

import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  defaultFixtureKey,
  fixtureOptions,
  getGameEnvelopeFixture,
} from '../data/footballGameEnvelopeFixtures';

const formatStatus = (status) =>
  String(status || 'unknown').replace(/([a-z])([A-Z])/g, '$1 $2');

export default function FootballReportPlaceholder() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedFixture = searchParams.get('fixture') || defaultFixtureKey;
  const envelope = getGameEnvelopeFixture(requestedFixture);
  const fixtureKey = envelope ? requestedFixture : defaultFixtureKey;
  const gameEnvelope = envelope || getGameEnvelopeFixture(defaultFixtureKey);
  const teams = gameEnvelope.game.teams;

  const onFixtureChange = (event) => {
    setSearchParams({ fixture: event.target.value });
  };

  return (
    <main className="min-h-screen bg-zinc-100 text-zinc-950">
      <header className="border-b border-zinc-300 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Strata Football
            </p>
            <h1 className="text-xl font-semibold">Reports</h1>
          </div>
          <Link
            className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
            to={`/?fixture=${fixtureKey}`}
          >
            Scorer
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">
              {teams.V.name} at {teams.H.name}
            </h2>
            <p className="text-sm text-zinc-600">
              {gameEnvelope.gameId} · {formatStatus(gameEnvelope.game.status)}
            </p>
          </div>
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
        </div>

        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <section className="rounded border border-zinc-300 bg-white p-4">
            <div className="mb-3 flex items-center justify-between border-b border-zinc-200 pb-3">
              <h3 className="text-base font-semibold">Report Workspace</h3>
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                source sequence {gameEnvelope.stats.sourceEventSequence}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <ReportMetric label="Status" value={formatStatus(gameEnvelope.game.status)} />
              <ReportMetric label="Clock" value={gameEnvelope.clock.clock} />
              <ReportMetric label="Period" value={String(gameEnvelope.clock.period)} />
              <ReportMetric label={teams.V.abbr} value={String(teams.V.score)} />
              <ReportMetric label={teams.H.abbr} value={String(teams.H.score)} />
              <ReportMetric label="Events" value={String(gameEnvelope.events.length)} />
            </div>
          </section>

          <aside className="rounded border border-zinc-300 bg-white p-4">
            <h3 className="mb-3 text-base font-semibold">Export Queue</h3>
            <div className="space-y-2 text-sm text-zinc-700">
              <div className="flex justify-between border-b border-zinc-100 pb-2">
                <span>Quickie</span>
                <span className="font-medium text-zinc-500">Pending</span>
              </div>
              <div className="flex justify-between border-b border-zinc-100 pb-2">
                <span>Drive Summary</span>
                <span className="font-medium text-zinc-500">Pending</span>
              </div>
              <div className="flex justify-between">
                <span>Game Book</span>
                <span className="font-medium text-zinc-500">Pending</span>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

const ReportMetric = ({ label, value }) => (
  <div className="rounded border border-zinc-200 bg-zinc-50 p-3">
    <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
      {label}
    </div>
    <div className="mt-1 text-lg font-semibold text-zinc-950">{value}</div>
  </div>
);

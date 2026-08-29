import React, { useMemo } from 'react';
import baselineRecord from '../data/footballCompletedBaselineGameRecord.json';
import {
  FootballReportFooterBrand,
  FootballReportHeader,
} from '../components/reports/FootballReportHeader';
import { getDashboardSeededFootballEnvelopeRecord } from '../services/footballDashboardService';
import { formatFootballReportDate } from '../reports/footballScoringSummary';
import { buildFootballMaxPrepsExports } from '../reports/footballMaxPrepsExport';
import '../reports/footballReports.css';

const reportSearchParams = () => (
  typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search)
);

const resolveReportEnvelope = (explicitEnvelope) => {
  if (explicitEnvelope) return explicitEnvelope;
  const gameId = reportSearchParams().get('gameId');
  return getDashboardSeededFootballEnvelopeRecord(gameId)?.envelope || baselineRecord.envelope;
};

const scorerHref = (gameId) => {
  const params = reportSearchParams();
  const destination = new URLSearchParams({ envelopeGameId: gameId });
  const dashboardGameId = params.get('dashboardGameId');
  if (dashboardGameId) destination.set('dashboardGameId', dashboardGameId);
  return `${import.meta.env.BASE_URL}index.html?${destination.toString()}`;
};

export const downloadMaxPrepsTextFile = ({ content, filename }) => {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const TeamExportCard = ({ teamExport }) => (
  <section className="rounded border border-zinc-300 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-xl font-semibold text-zinc-950">{teamExport.teamName}</h2>
        <p className="mt-1 text-sm text-zinc-600">
          {teamExport.players.length} athletes · {teamExport.fields.length} declared fields
        </p>
        <p className="mt-1 font-mono text-xs text-zinc-600">{teamExport.filename}</p>
      </div>
      <button
        className="rounded bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
        onClick={() => downloadMaxPrepsTextFile(teamExport)}
        type="button"
      >
        Download {teamExport.teamName} .txt
      </button>
    </div>

    {teamExport.omittedPlayers.length > 0 && (
      <div className="mt-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950" role="alert">
        <p className="font-semibold">Not exported because MaxPreps requires a valid jersey number:</p>
        <p className="mt-1">
          {teamExport.omittedPlayers.map((player) => player.name).join(', ')}
        </p>
      </div>
    )}

    <details className="mt-4">
      <summary className="cursor-pointer text-sm font-semibold text-emerald-800">
        Preview export file
      </summary>
      <pre className="mt-2 max-h-96 overflow-auto whitespace-pre rounded bg-zinc-950 p-4 text-xs text-zinc-100">
        {teamExport.content}
      </pre>
    </details>
  </section>
);

export default function FootballMaxPrepsExportReport({ envelope }) {
  const reportEnvelope = useMemo(() => resolveReportEnvelope(envelope), [envelope]);
  const report = useMemo(() => buildFootballMaxPrepsExports(reportEnvelope), [reportEnvelope]);
  const teams = reportEnvelope.game.teams;
  const matchup = `${teams.V.name} vs. ${teams.H.name} (${formatFootballReportDate(reportEnvelope.game.scheduledAt)})`;

  return (
    <main className="min-h-screen bg-zinc-100">
      <nav className="football-report-actions" aria-label="Report actions">
        <a href={scorerHref(report.gameId)}>Back to scorer</a>
      </nav>
      <article className="football-report-page" data-football-report="maxpreps-export">
        <FootballReportHeader matchup={matchup} title="MaxPreps Export" />
        <div className="mx-auto max-w-5xl px-4 pb-8">
          <section className="mb-5 rounded border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
            <p className="font-semibold">One import file is generated for each team.</p>
            <p className="mt-1">
              Each file starts with supplier ID <span className="font-mono">{report.supplierId}</span>, uses exact
              MaxPreps field names and pipe delimiters, preserves jersey formatting, and leaves unrecorded values blank.
            </p>
          </section>
          <div className="grid gap-5">
            <TeamExportCard teamExport={report.exports.V} />
            <TeamExportCard teamExport={report.exports.H} />
          </div>
        </div>
        <FootballReportFooterBrand />
      </article>
    </main>
  );
}

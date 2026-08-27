import React, { useMemo } from 'react';
import baselineRecord from '../data/footballCompletedBaselineGameRecord.json';
import {
  FootballReportFooterBrand,
  FootballReportHeader,
} from '../components/reports/FootballReportHeader';
import { buildFootballTeamStatsReport } from '../reports/footballTeamStats';
import { getDashboardSeededFootballEnvelopeRecord } from '../services/footballDashboardService';
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

export default function FootballTeamStatsReport({ envelope }) {
  const reportEnvelope = useMemo(() => resolveReportEnvelope(envelope), [envelope]);
  const report = useMemo(() => buildFootballTeamStatsReport(reportEnvelope), [reportEnvelope]);

  return (
    <main className="football-report-screen">
      <nav className="football-report-actions" aria-label="Report actions">
        <a href={scorerHref(report.gameId)}>Back to scorer</a>
        <button onClick={() => window.print()} type="button">Print / Save PDF</button>
      </nav>
      <article className="football-report-page football-team-stats-page" data-football-report="team-stats">
        <FootballReportHeader matchup={report.reportMatchup} title={report.reportTitle} />
        <section className="football-report-section">
          <table aria-label="Team stats" className="football-report-table football-team-stats-table">
            <colgroup>
              <col className="football-team-stats-label-column" />
              <col />
              <col />
            </colgroup>
            <thead>
              <tr>
                <th>STAT</th>
                <th>{report.teams.V.name}</th>
                <th>{report.teams.H.name}</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => (
                row.separator ? (
                  <tr className="football-team-stats-separator" key={row.id} aria-hidden="true">
                    <td colSpan="3" />
                  </tr>
                ) : (
                  <tr
                    className={`football-team-stat-${row.level}${row.variant ? ` football-team-stat-${row.variant}` : ''}`}
                    key={row.id}
                  >
                    <th scope="row">{row.label}</th>
                    <td>{row.values.V}</td>
                    <td>{row.values.H}</td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </section>
        <FootballReportFooterBrand />
      </article>
    </main>
  );
}

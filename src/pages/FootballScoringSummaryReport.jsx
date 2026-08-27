import React, { useMemo } from 'react';
import baselineRecord from '../data/footballCompletedBaselineGameRecord.json';
import {
  FootballReportFooterBrand,
  FootballReportHeader,
} from '../components/reports/FootballReportHeader';
import { buildFootballScoringSummary } from '../reports/footballScoringSummary';
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

const ScoreByQuarter = ({ report }) => (
  <ReportSection title="SCORE BY QUARTERS">
    <table aria-label="Score by quarters" className="football-report-table football-score-by-quarter">
      <thead>
        <tr>
          <th>TEAM</th>
          {report.periods.map((period) => <th key={period.period}>{period.label}</th>)}
          <th>TOTAL</th>
        </tr>
      </thead>
      <tbody>
        {['V', 'H'].map((team) => (
          <tr key={team}>
            <th scope="row">{report.teams[team].name}</th>
            {report.periods.map((period) => (
              <td key={period.period}>{report.scoreByQuarter[team].periods[period.period]}</td>
            ))}
            <td className="football-report-total">{report.scoreByQuarter[team].total}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </ReportSection>
);

const ScoringLedger = ({ report }) => (
  <ReportSection title="SCORING SUMMARY">
    <table aria-label="Scoring summary" className="football-report-table football-scoring-ledger">
      <colgroup>
        <col className="football-scoring-quarter-column" />
        <col className="football-scoring-time-column" />
        <col className="football-scoring-team-column" />
        <col />
        <col className="football-scoring-score-column" />
      </colgroup>
      <thead>
        <tr>
          <th>QTR</th>
          <th>TIME</th>
          <th>TEAM</th>
          <th>SCORING PLAY</th>
          <th>SCORE (V-H)</th>
        </tr>
      </thead>
      <tbody>
        {report.scoring.map((play) => (
          <tr key={play.sequence}>
            <td>{play.quarter}</td>
            <td>{play.time}</td>
            <td>{play.team}</td>
            <td className="football-scoring-description">{play.description}</td>
            <td className="football-report-total">{play.score}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </ReportSection>
);

const GameDetails = ({ details }) => {
  const rows = [
    [
      ['DATE', details.date],
      ['SCHEDULED TIME', details.scheduledTime],
      ['KICKOFF TIME', details.kickoffTime],
      ['END OF GAME', details.endOfGame],
      ['DURATION', details.duration],
    ],
    [
      ['SITE', details.site],
      ['VENUE', details.venue],
      ['ATTENDANCE', details.attendance],
      ['WEATHER', details.weather],
      ['WIND', details.wind],
    ],
  ];
  return (
    <ReportSection title="GAME DETAILS">
      <div className="football-game-details">
        {rows.map((row, rowIndex) => (
          <dl className="football-game-detail-row" key={rowIndex}>
            {row.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        ))}
      </div>
    </ReportSection>
  );
};

const Officials = ({ officials }) => (
  <ReportSection title="OFFICIALS">
    <dl className="football-officials-grid">
      {officials.map((official) => (
        <div key={official.role}>
          <dt>{official.role}</dt>
          <dd>{official.name}</dd>
        </div>
      ))}
    </dl>
  </ReportSection>
);

const ReportSection = ({ children, title }) => (
  <section className="football-report-section">
    <h2>{title}</h2>
    {children}
  </section>
);

export default function FootballScoringSummaryReport({ envelope }) {
  const reportEnvelope = useMemo(() => resolveReportEnvelope(envelope), [envelope]);
  const report = useMemo(() => buildFootballScoringSummary(reportEnvelope), [reportEnvelope]);

  return (
    <main className="football-report-screen">
      <nav className="football-report-actions" aria-label="Report actions">
        <a href={scorerHref(report.gameId)}>Back to scorer</a>
        <button onClick={() => window.print()} type="button">Print / Save PDF</button>
      </nav>
      <article className="football-report-page" data-football-report="scoring-summary">
        <FootballReportHeader matchup={report.reportMatchup} title={report.reportTitle} />
        <p className="football-report-matchup-heading">{report.matchup}</p>
        <ScoreByQuarter report={report} />
        <ScoringLedger report={report} />
        <GameDetails details={report.gameDetails} />
        <Officials officials={report.officials} />
        <FootballReportFooterBrand />
      </article>
    </main>
  );
}

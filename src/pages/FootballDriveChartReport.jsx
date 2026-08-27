import React, { useMemo } from 'react';
import baselineRecord from '../data/footballCompletedBaselineGameRecord.json';
import {
  FootballReportFooterBrand,
  FootballReportHeader,
} from '../components/reports/FootballReportHeader';
import { buildFootballDriveChartReport } from '../reports/footballDriveChart';
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

const DriveTable = ({ drives, label }) => (
  <table aria-label={label} className="football-report-table football-drive-chart-table">
    <colgroup>
      <col className="football-drive-team-column" />
      <col className="football-drive-quarter-column" />
      <col className="football-drive-spot-column" />
      <col className="football-drive-time-column" />
      <col className="football-drive-reason-column" />
      <col className="football-drive-spot-column" />
      <col className="football-drive-time-column" />
      <col className="football-drive-reason-column" />
      <col className="football-drive-number-column" />
      <col className="football-drive-number-column" />
      <col className="football-drive-time-column" />
    </colgroup>
    <thead>
      <tr>
        <th>TEAM</th>
        <th>QTR</th>
        <th>START SPOT</th>
        <th>START TIME</th>
        <th>HOW OBTAINED</th>
        <th>END SPOT</th>
        <th>END TIME</th>
        <th>HOW LOST</th>
        <th>PLAYS</th>
        <th>YARDS</th>
        <th>TIME</th>
      </tr>
    </thead>
    <tbody>
      {drives.map((drive) => (
        <tr data-drive-number={drive.driveNumber} key={drive.id}>
          <td className="football-drive-team">{drive.teamLabel}</td>
          <td>{drive.quarter}</td>
          <td>{drive.startSpot}</td>
          <td>{drive.startTime}</td>
          <td>{drive.howObtained}</td>
          <td>{drive.endSpot}</td>
          <td>{drive.endTime}</td>
          <td>{drive.howLost}</td>
          <td>{drive.plays}</td>
          <td>{drive.yards}</td>
          <td>{drive.time}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

const DriveBreakdown = ({ breakdown, label }) => (
  <table aria-label={label} className="football-report-table football-drive-breakdown-table">
    <thead>
      <tr>
        <th aria-label="Statistic" />
        <th>Q1</th>
        <th>Q2</th>
        <th>Q3</th>
        <th>Q4</th>
        <th>TOTAL</th>
      </tr>
    </thead>
    <tbody>
      {breakdown.map((row) => (
        <tr key={row.id}>
          <th scope="row">{row.label}</th>
          <td>{row.values[1]}</td>
          <td>{row.values[2]}</td>
          <td>{row.values[3]}</td>
          <td>{row.values[4]}</td>
          <td className="football-report-total">{row.values.total}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

const TeamDriveSection = ({ team }) => (
  <section className="football-drive-team-section">
    <h2>{team.name} Drive Chart</h2>
    <DriveTable drives={team.drives} label={`${team.name} drive chart`} />
    <h3>{team.name} Breakdown</h3>
    <DriveBreakdown breakdown={team.breakdown} label={`${team.name} drive breakdown`} />
  </section>
);

export default function FootballDriveChartReport({ envelope }) {
  const reportEnvelope = useMemo(() => resolveReportEnvelope(envelope), [envelope]);
  const report = useMemo(() => buildFootballDriveChartReport(reportEnvelope), [reportEnvelope]);

  return (
    <main className="football-report-screen football-drive-chart-screen">
      <nav className="football-report-actions" aria-label="Report actions">
        <a href={scorerHref(report.gameId)}>Back to scorer</a>
        <button onClick={() => window.print()} type="button">Print / Save PDF</button>
      </nav>
      <article className="football-report-page football-drive-chart-page" data-football-report="drive-chart-teams">
        <FootballReportHeader matchup={report.reportMatchup} title={report.reportTitle} />
        <TeamDriveSection team={report.teams.V} />
        <TeamDriveSection team={report.teams.H} />
        <FootballReportFooterBrand />
      </article>
      <article className="football-report-page football-drive-chart-page football-drive-chart-page-break" data-football-report="drive-chart-chronological">
        <FootballReportHeader matchup={report.reportMatchup} title={report.reportTitle} />
        <section className="football-drive-chronological-section">
          <h2>Chronological Drive Chart</h2>
          <DriveTable drives={report.chronological} label="Chronological drive chart" />
        </section>
        <FootballReportFooterBrand />
      </article>
    </main>
  );
}

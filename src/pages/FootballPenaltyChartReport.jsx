import React, { Fragment, useMemo } from 'react';
import baselineRecord from '../data/footballCompletedBaselineGameRecord.json';
import {
  FootballReportFooterBrand,
  FootballReportHeader,
} from '../components/reports/FootballReportHeader';
import { buildFootballPenaltyChartReport } from '../reports/footballPenaltyChart';
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

const PenaltySection = ({ section, team }) => (
  <section className="football-penalty-section">
    <h3>{section.title}</h3>
    <table aria-label={`${team.name} ${section.title}`} className="football-report-table football-penalty-table">
      <colgroup>
        <col className="football-penalty-down-column" />
        <col className="football-penalty-spot-column" />
        <col className="football-penalty-disposition-column" />
        <col />
        <col className="football-penalty-player-column" />
        <col className="football-penalty-yards-column" />
        <col className="football-penalty-spot-column" />
      </colgroup>
      <thead>
        <tr>
          <th>DOWN &amp; DISTANCE</th>
          <th>PRE-FOUL SPOT</th>
          <th>DISPOSITION</th>
          <th>FOUL NAME</th>
          <th>PLAYER</th>
          <th>YARDS</th>
          <th>POST-FOUL SPOT</th>
        </tr>
      </thead>
      {section.penalties.length > 0 ? section.penalties.map((penalty) => (
        <tbody
          className="football-penalty-entry"
          data-disposition={penalty.status}
          key={penalty.id}
        >
          <tr className={penalty.accepted ? 'football-penalty-info-accepted' : 'football-penalty-info-standard'}>
            <td>{penalty.downAndDistance}</td>
            <td>{penalty.preFoulSpot}</td>
            <td>{penalty.disposition}</td>
            <td>{penalty.foulName}</td>
            <td>{penalty.player}</td>
            <td>{penalty.yards}</td>
            <td>{penalty.postFoulSpot}</td>
          </tr>
          <tr className="football-penalty-play-row">
            <td colSpan="7">{penalty.play}</td>
          </tr>
        </tbody>
      )) : (
        <tbody>
          <tr className="football-penalty-empty-row">
            <td colSpan="7">No penalties.</td>
          </tr>
        </tbody>
      )}
    </table>
  </section>
);

export default function FootballPenaltyChartReport({ envelope }) {
  const reportEnvelope = useMemo(() => resolveReportEnvelope(envelope), [envelope]);
  const report = useMemo(() => buildFootballPenaltyChartReport(reportEnvelope), [reportEnvelope]);

  return (
    <main className="football-report-screen football-penalty-chart-screen">
      <nav className="football-report-actions" aria-label="Report actions">
        <a href={scorerHref(report.gameId)}>Back to scorer</a>
        <button onClick={() => window.print()} type="button">Print / Save PDF</button>
      </nav>
      {['V', 'H'].map((teamCode, teamIndex) => {
        const team = report.teams[teamCode];
        return (
          <Fragment key={teamCode}>
            <article
              className={`football-report-page football-penalty-chart-page${teamIndex > 0 ? ' football-penalty-chart-page-break' : ''}`}
              data-football-report="penalty-chart"
              data-team={teamCode}
            >
              <FootballReportHeader matchup={report.reportMatchup} title={report.reportTitle} />
              <h2 className="football-penalty-team-heading">{team.name}</h2>
              {team.sections.map((section) => (
                <PenaltySection key={section.id} section={section} team={team} />
              ))}
              <FootballReportFooterBrand />
            </article>
          </Fragment>
        );
      })}
    </main>
  );
}

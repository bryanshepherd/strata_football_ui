import React, { Fragment, useMemo } from 'react';
import baselineRecord from '../data/footballCompletedBaselineGameRecord.json';
import {
  FootballReportFooterBrand,
  FootballReportHeader,
} from '../components/reports/FootballReportHeader';
import { buildFootballPlayByPlayReport } from '../reports/footballPlayByPlay';
import { getDashboardSeededFootballEnvelopeRecord } from '../services/footballDashboardService';
import { FootballQuickieReportPage } from './FootballQuickieStatsReport';
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

const PlayRow = ({ row }) => {
  if (row.kind === 'play' || row.kind === 'comment') {
    return (
      <tr
        className={row.kind === 'comment' ? 'football-play-by-play-comment' : undefined}
        data-play-sequence={row.kind === 'play' ? row.sequence : undefined}
      >
        <td className="football-play-by-play-down">{row.downAndDistance}</td>
        <td className="football-play-by-play-spot">{row.spot}</td>
        <td className="football-play-by-play-text">{row.text}</td>
      </tr>
    );
  }
  return (
    <tr
      className={`football-play-by-play-${row.kind}`}
      data-score-after-sequence={row.kind === 'score' ? row.sequence : undefined}
    >
      <td colSpan="3">{row.text}</td>
    </tr>
  );
};

const QuarterPage = ({ first, quarter, report }) => (
  <article
    className={`football-report-page football-play-by-play-quarter-page${first ? '' : ' football-play-by-play-page-break'}`}
    data-football-report="play-by-play-quarter"
    data-quarter={quarter.period}
  >
    <FootballReportHeader matchup={report.reportMatchup} title={report.reportTitle} />
    <h2 className="football-play-by-play-quarter-heading">{quarter.label}</h2>
    <table
      aria-label={`${quarter.label} play-by-play`}
      className="football-report-table football-play-by-play-table"
    >
      <colgroup>
        <col className="football-play-by-play-down-column" />
        <col className="football-play-by-play-spot-column" />
        <col />
      </colgroup>
      <tbody>
        {quarter.rows.map((row) => <PlayRow key={row.id} row={row} />)}
      </tbody>
    </table>
    <FootballReportFooterBrand />
  </article>
);

export default function FootballPlayByPlayReport({ envelope }) {
  const reportEnvelope = useMemo(() => resolveReportEnvelope(envelope), [envelope]);
  const report = useMemo(
    () => buildFootballPlayByPlayReport(reportEnvelope, reportSearchParams()),
    [reportEnvelope],
  );

  return (
    <main className="football-report-screen football-play-by-play-screen">
      <nav className="football-report-actions" aria-label="Report actions">
        <a href={scorerHref(report.gameId)}>Back to scorer</a>
        <button onClick={() => window.print()} type="button">Print / Save PDF</button>
      </nav>
      {report.quarters.map((quarter, index) => (
        <Fragment key={quarter.period}>
          <QuarterPage first={index === 0} quarter={quarter} report={report} />
          <FootballQuickieReportPage
            className="football-play-by-play-quickie-page football-play-by-play-page-break"
            dataFootballReport="play-by-play-quarter-quickie"
            report={quarter.quickie}
          />
        </Fragment>
      ))}
    </main>
  );
}

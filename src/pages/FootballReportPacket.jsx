import React, { useMemo } from 'react';
import FootballReportLoader from '../components/reports/FootballReportLoader';
import { FootballReportFooterBrand } from '../components/reports/FootballReportHeader';
import { buildFootballReportPacket } from '../reports/footballReportPacket';
import { FootballScoringSummaryReportPage } from './FootballScoringSummaryReport';
import { FootballTeamStatsReportPage } from './FootballTeamStatsReport';
import { FootballIndividualOffenseReportPage } from './FootballIndividualOffenseReport';
import { FootballDefensiveStatsReportPage } from './FootballDefensiveStatsReport';
import { FootballDriveChartReportPages } from './FootballDriveChartReport';
import { FootballPenaltyChartReportPages } from './FootballPenaltyChartReport';
import { FootballParticipationReportPage } from './FootballParticipationReport';
import { FootballPlayByPlayReportPages } from './FootballPlayByPlayReport';
import '../reports/footballReports.css';

const REPORT_PAGES = {
  'scoring-summary': FootballScoringSummaryReportPage,
  'team-stats': FootballTeamStatsReportPage,
  'individual-offense': FootballIndividualOffenseReportPage,
  'defensive-stats': FootballDefensiveStatsReportPage,
  'drive-chart': FootballDriveChartReportPages,
  'penalty-chart': FootballPenaltyChartReportPages,
  participation: FootballParticipationReportPage,
  'play-by-play': FootballPlayByPlayReportPages,
};

export function FootballReportPacketContent({ envelope }) {
  const packet = useMemo(() => buildFootballReportPacket(envelope), [envelope]);
  const params = new URLSearchParams(window.location.search);
  const destination = new URLSearchParams({ envelopeGameId: packet.gameId });
  if (params.get('dashboardGameId')) destination.set('dashboardGameId', params.get('dashboardGameId'));
  return (
    <main className="football-report-screen football-report-packet" data-football-packet={packet.gameId}>
      <nav className="football-report-actions" aria-label="Report actions">
        <h1>Report Packet</h1>
        <a href={`${import.meta.env.BASE_URL}index.html?${destination}`}>Back to scorer</a>
        <button type="button" onClick={() => window.print()}>Print / Save PDF</button>
      </nav>
      <div className="football-report-packet-layout">
        {packet.sections.map(({ id, label, report }) => {
          const ReportPages = REPORT_PAGES[id];
          return (
            <section className="football-report-packet-section" data-packet-report={id} aria-label={label} key={id}>
              <ReportPages report={report} />
            </section>
          );
        })}
      </div>
      <div className="football-packet-print-brand"><FootballReportFooterBrand /></div>
    </main>
  );
}

export default function FootballReportPacket({ envelope }) {
  return (
    <FootballReportLoader envelope={envelope} reportId="report-packet">
      {(loadedEnvelope) => <FootballReportPacketContent envelope={loadedEnvelope} />}
    </FootballReportLoader>
  );
}

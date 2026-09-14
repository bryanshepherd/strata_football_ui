import React, { useMemo } from 'react';
import FootballReportLoader from '../components/reports/FootballReportLoader';
import { FootballReportFooterBrand, FootballReportHeader } from '../components/reports/FootballReportHeader';
import { buildFootballDefensiveStatsReport, formatDefensiveStat, formatDefensiveStatYards } from '../reports/footballDefensiveStats';
import '../reports/footballReports.css';

const headers = ['#', 'Name', 'Solo', 'Ast', 'Total', 'Sacks-Yds', 'TFL-Yds', 'FF', 'FR-Yds', 'Int-Yds', 'BrUp', 'Blks', 'QBH'];

const StatCells = ({ player }) => <>
  <td>{formatDefensiveStat(player.solo)}</td>
  <td>{formatDefensiveStat(player.assists)}</td>
  <td>{formatDefensiveStat(player.total)}</td>
  <td>{formatDefensiveStatYards(player.sacks, player.sackYards)}</td>
  <td>{formatDefensiveStatYards(player.tfl, player.tflYards)}</td>
  <td>{formatDefensiveStat(player.forcedFumbles)}</td>
  <td>{formatDefensiveStatYards(player.recoveries, player.recoveryYards)}</td>
  <td>{formatDefensiveStatYards(player.interceptions, player.interceptionYards)}</td>
  <td>{formatDefensiveStat(player.breakups)}</td>
  <td>{formatDefensiveStat(player.blocks)}</td>
  <td>{formatDefensiveStat(player.hurries)}</td>
</>;

export const FootballDefensiveStatsReportPage = ({ report }) => (
  <article className="football-report-page football-defensive-stats-page" data-football-report="defensive-stats">
    <FootballReportHeader title={report.reportTitle} matchup={report.reportMatchup} />
    {['V', 'H'].map((team) => (
      <section className="football-defensive-stats-team" data-team={team} key={team}>
        <h2>{report.teams[team].name}</h2>
        <table className="football-report-table football-defensive-stats-table" aria-label={`${report.teams[team].name} defensive stats`}>
          <colgroup>
            <col className="football-defense-number-column" />
            <col className="football-defense-name-column" />
            <col /><col /><col />
            <col className="football-defense-yards-column" />
            <col className="football-defense-yards-column" />
            <col />
            <col className="football-defense-yards-column" />
            <col className="football-defense-yards-column" />
            <col /><col /><col />
          </colgroup>
          <thead><tr>{headers.map((header) => <th scope="col" key={header}>{header}</th>)}</tr></thead>
          <tbody>
            {report.teamReports[team].players.length ? report.teamReports[team].players.map((player) => (
              <tr key={player.playerId}>
                <td>{player.jersey || '—'}</td>
                <th scope="row">{player.name}</th>
                <StatCells player={player} />
              </tr>
            )) : <tr><td colSpan={13} className="football-quickie-empty">No defensive statistics</td></tr>}
            <tr className="football-report-total">
              <th scope="row" colSpan={2}>Totals</th>
              <StatCells player={report.teamReports[team].totals} />
            </tr>
          </tbody>
        </table>
      </section>
    ))}
    <FootballReportFooterBrand />
  </article>
);

function FootballDefensiveStatsReportContent({ envelope }) {
  const report = useMemo(() => buildFootballDefensiveStatsReport(envelope), [envelope]);
  const params = new URLSearchParams(window.location.search);
  const destination = new URLSearchParams({ envelopeGameId: report.gameId });
  if (params.get('dashboardGameId')) destination.set('dashboardGameId', params.get('dashboardGameId'));
  return (
    <main className="football-report-screen">
      <nav className="football-report-actions" aria-label="Report actions">
        <a href={`${import.meta.env.BASE_URL}index.html?${destination}`}>Back to scorer</a>
        <button type="button" onClick={() => window.print()}>Print / Save PDF</button>
      </nav>
      <FootballDefensiveStatsReportPage report={report} />
    </main>
  );
}

export default function FootballDefensiveStatsReport({ envelope }) {
  return (
    <FootballReportLoader envelope={envelope} reportId="defensive-stats">
      {(loadedEnvelope) => <FootballDefensiveStatsReportContent envelope={loadedEnvelope} />}
    </FootballReportLoader>
  );
}

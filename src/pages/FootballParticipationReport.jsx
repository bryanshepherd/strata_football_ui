import React, { useMemo } from 'react';
import FootballReportLoader from '../components/reports/FootballReportLoader';
import { FootballReportFooterBrand, FootballReportHeader } from '../components/reports/FootballReportHeader';
import { buildFootballParticipationReport } from '../reports/footballParticipationReport';
import '../reports/footballReports.css';

const StarterTable = ({ players, teamName, unit }) => (
  <section className="football-participation-starters">
    <h3>{unit === 'offense' ? 'Offensive starters' : 'Defensive starters'}</h3>
    <table className="football-report-table football-participation-starter-table" aria-label={`${teamName} ${unit} starters`}>
      <colgroup><col className="football-participation-position-column" /><col className="football-participation-number-column" /><col /></colgroup>
      <thead><tr><th scope="col">Pos</th><th scope="col">#</th><th scope="col">Name</th></tr></thead>
      <tbody>
        {players.length ? players.map((player) => (
          <tr key={player.playerId}>
            <td>{player.position || '—'}</td>
            <td>{player.jersey || '—'}</td>
            <th scope="row">{player.name}</th>
          </tr>
        )) : <tr><td colSpan={3} className="football-quickie-empty">No starters entered</td></tr>}
      </tbody>
    </table>
  </section>
);

export const FootballParticipationReportPage = ({ report }) => (
  <article className="football-report-page football-participation-page" data-football-report="participation">
    <FootballReportHeader title={report.reportTitle} matchup={report.reportMatchup} />
    <table className="football-participation-grid" role="presentation"><tbody><tr>
      {['V', 'H'].map((team) => (
        <td className="football-participation-team" data-team={team} key={team}>
          <section aria-label={`${report.teams[team].name} participation`}>
          <h2>{report.teams[team].name}</h2>
          {['offense', 'defense'].map((unit) => (
            <StarterTable key={unit} unit={unit} teamName={report.teams[team].name} players={report.teamReports[team].starters[unit]} />
          ))}
          <section className="football-participation-others">
            <h3>Other participants</h3>
            {report.teamReports[team].others.length ? (
              <ul aria-label={`${report.teams[team].name} other participants`}>
                {report.teamReports[team].others.map((player) => (
                  <li key={player.playerId}><span>{player.jersey || '—'}</span> {player.name}</li>
                ))}
              </ul>
            ) : <p className="football-participation-empty">No other participants marked</p>}
          </section>
          <p className="football-participation-total">Total participants: {report.teamReports[team].total}</p>
          </section>
        </td>
      ))}
    </tr></tbody><tfoot className="football-participation-print-clearance" aria-hidden="true"><tr><td colSpan={2} /></tr></tfoot></table>
    <FootballReportFooterBrand />
  </article>
);

function FootballParticipationReportContent({ envelope }) {
  const report = useMemo(() => buildFootballParticipationReport(envelope), [envelope]);
  const params = new URLSearchParams(window.location.search);
  const destination = new URLSearchParams({ envelopeGameId: report.gameId });
  if (params.get('dashboardGameId')) destination.set('dashboardGameId', params.get('dashboardGameId'));
  return (
    <main className="football-report-screen">
      <nav className="football-report-actions" aria-label="Report actions">
        <a href={`${import.meta.env.BASE_URL}index.html?${destination}`}>Back to scorer</a>
        <button type="button" onClick={() => window.print()}>Print / Save PDF</button>
      </nav>
      <FootballParticipationReportPage report={report} />
    </main>
  );
}

export default function FootballParticipationReport({ envelope }) {
  return (
    <FootballReportLoader envelope={envelope}>
      {(loadedEnvelope) => <FootballParticipationReportContent envelope={loadedEnvelope} />}
    </FootballReportLoader>
  );
}

import React, { useMemo } from 'react';
import baselineRecord from '../data/footballCompletedBaselineGameRecord.json';
import {
  FootballReportFooterBrand,
  FootballReportHeader,
} from '../components/reports/FootballReportHeader';
import { buildFootballIndividualOffenseReport } from '../reports/footballIndividualOffense';
import { getDashboardSeededFootballEnvelopeRecord } from '../services/footballDashboardService';
import {
  FootballIndividualStatTable,
  FootballPlayerName,
} from './FootballQuickieStatsReport';
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

const average = (yards, attempts) => (
  Number(attempts) > 0 ? (Number(yards) / Number(attempts)).toFixed(1) : '0.0'
);

const EmptyRow = ({ columns }) => (
  <tr><td className="football-quickie-empty" colSpan={columns}>No statistics</td></tr>
);

const TotalsRow = ({ children }) => (
  <tr className="football-quickie-l3-row football-individual-offense-total">
    <th scope="row">Totals</th>
    {children}
  </tr>
);

const ReturnsTable = ({ section, teamName }) => (
  <section className="football-individual-offense-category football-individual-offense-returns">
    <h4>RETURNS</h4>
    <table aria-label={`${teamName} returns`} className="football-report-table football-individual-offense-table">
      <thead>
        <tr>
          <th aria-label="Name" rowSpan="2" />
          <th colSpan="3" scope="colgroup">PUNT</th>
          <th colSpan="3" scope="colgroup">KICKOFF</th>
          <th colSpan="3" scope="colgroup">INTERCEPTION</th>
        </tr>
        <tr>
          {['NUM', 'YDS', 'LNG', 'NUM', 'YDS', 'LNG', 'NUM', 'YDS', 'LNG'].map((header, index) => (
            <th key={`${header}-${index}`}>{header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {section.players.length > 0 ? section.players.map((player) => (
          <tr key={player.playerId}>
            <td className="football-quickie-player-name"><FootballPlayerName player={player} /></td>
            <td>{player.puntReturns}</td>
            <td>{player.puntReturnYards}</td>
            <td>{player.puntReturnLong}</td>
            <td>{player.kickReturns}</td>
            <td>{player.kickReturnYards}</td>
            <td>{player.kickReturnLong}</td>
            <td>{player.interceptionReturns}</td>
            <td>{player.interceptionReturnYards}</td>
            <td>{player.interceptionReturnLong}</td>
          </tr>
        )) : <EmptyRow columns={10} />}
        <TotalsRow>
          <td>{section.totals.puntReturns}</td>
          <td>{section.totals.puntReturnYards}</td>
          <td>{section.totals.puntReturnLong}</td>
          <td>{section.totals.kickReturns}</td>
          <td>{section.totals.kickReturnYards}</td>
          <td>{section.totals.kickReturnLong}</td>
          <td>{section.totals.interceptionReturns}</td>
          <td>{section.totals.interceptionReturnYards}</td>
          <td>{section.totals.interceptionReturnLong}</td>
        </TotalsRow>
      </tbody>
    </table>
  </section>
);

const FieldGoalsTable = ({ section, teamName }) => (
  <section className="football-individual-offense-category">
    <h4>FIELD GOALS</h4>
    <table aria-label={`${teamName} field goals`} className="football-report-table football-individual-offense-table">
      <thead>
        <tr>
          <th aria-label="Name" />
          <th>QTR</th>
          <th>TIME</th>
          <th>DISTANCE</th>
          <th>RESULT</th>
        </tr>
      </thead>
      <tbody>
        {section.rows.length > 0 ? section.rows.map((row) => (
          <tr key={row.sequence}>
            <td className="football-quickie-player-name"><FootballPlayerName player={row} /></td>
            <td>{row.quarter}</td>
            <td>{row.time}</td>
            <td>{row.distance}</td>
            <td>{row.result}</td>
          </tr>
        )) : <EmptyRow columns={5} />}
        <TotalsRow>
          <td />
          <td />
          <td />
          <td>{`${section.totals.made}-${section.totals.attempts}`}</td>
        </TotalsRow>
      </tbody>
    </table>
  </section>
);

const KickoffsTable = ({ section, teamName }) => (
  <section className="football-individual-offense-category">
    <h4>KICKOFFS</h4>
    <table aria-label={`${teamName} kickoffs`} className="football-report-table football-individual-offense-table">
      <thead>
        <tr>
          <th aria-label="Name" />
          <th>NUM</th>
          <th>YARDS</th>
          <th>AVG</th>
          <th>TB</th>
          <th>OB</th>
        </tr>
      </thead>
      <tbody>
        {section.players.length > 0 ? section.players.map((player) => (
          <tr key={player.playerId}>
            <td className="football-quickie-player-name"><FootballPlayerName player={player} /></td>
            <td>{player.kickoffs}</td>
            <td>{player.kickoffYards}</td>
            <td>{average(player.kickoffYards, player.kickoffs)}</td>
            <td>{player.kickoffTouchbacks}</td>
            <td>{player.kickoffOutOfBounds}</td>
          </tr>
        )) : <EmptyRow columns={6} />}
        <TotalsRow>
          <td>{section.totals.kickoffs}</td>
          <td>{section.totals.kickoffYards}</td>
          <td>{average(section.totals.kickoffYards, section.totals.kickoffs)}</td>
          <td>{section.totals.kickoffTouchbacks}</td>
          <td>{section.totals.kickoffOutOfBounds}</td>
        </TotalsRow>
      </tbody>
    </table>
  </section>
);

const AllPurposeTable = ({ section, teamName }) => (
  <section className="football-individual-offense-category">
    <h4>ALL-PURPOSE</h4>
    <table aria-label={`${teamName} all-purpose yards`} className="football-report-table football-individual-offense-table">
      <thead>
        <tr>
          <th aria-label="Name" />
          <th>RUSH</th>
          <th>REC</th>
          <th>KICK</th>
          <th>PUNT</th>
          <th>INT</th>
          <th>FUMB</th>
          <th>TOTAL</th>
        </tr>
      </thead>
      <tbody>
        {section.players.length > 0 ? section.players.map((player) => (
          <tr key={player.playerId}>
            <td className="football-quickie-player-name"><FootballPlayerName player={player} /></td>
            <td>{player.allPurposeRush}</td>
            <td>{player.allPurposeReceiving}</td>
            <td>{player.allPurposeKick}</td>
            <td>{player.allPurposePunt}</td>
            <td>{player.allPurposeInterception}</td>
            <td>{player.allPurposeFumble}</td>
            <td>{player.allPurposeTotal}</td>
          </tr>
        )) : <EmptyRow columns={8} />}
        <TotalsRow>
          <td>{section.totals.allPurposeRush}</td>
          <td>{section.totals.allPurposeReceiving}</td>
          <td>{section.totals.allPurposeKick}</td>
          <td>{section.totals.allPurposePunt}</td>
          <td>{section.totals.allPurposeInterception}</td>
          <td>{section.totals.allPurposeFumble}</td>
          <td>{section.totals.allPurposeTotal}</td>
        </TotalsRow>
      </tbody>
    </table>
  </section>
);

const FumblesTable = ({ section, teamName }) => (
  <section className="football-individual-offense-category">
    <h4>FUMBLES</h4>
    <table aria-label={`${teamName} fumbles`} className="football-report-table football-individual-offense-table">
      <thead>
        <tr><th aria-label="Name" /><th>NUM</th><th>LOST</th></tr>
      </thead>
      <tbody>
        {section.players.length > 0 ? section.players.map((player) => (
          <tr key={player.playerId}>
            <td className="football-quickie-player-name"><FootballPlayerName player={player} /></td>
            <td>{player.fumbles}</td>
            <td>{player.fumblesLost}</td>
          </tr>
        )) : <EmptyRow columns={3} />}
        <TotalsRow><td>{section.totals.fumbles}</td><td>{section.totals.fumblesLost}</td></TotalsRow>
      </tbody>
    </table>
  </section>
);

const TeamColumn = ({ report, team }) => {
  const teamName = report.teams[team].name;
  const sections = report.teamReports[team];
  return (
    <section className="football-individual-offense-team" data-team={team}>
      <h2>{teamName}</h2>
      {['rushing', 'passing', 'receiving', 'punting'].map((category) => (
        <FootballIndividualStatTable
          ariaLabel={`${teamName} ${category}`}
          category={category}
          className="football-individual-offense-category"
          key={category}
          players={sections[category].players}
          showYac={report.showYac}
          totals={sections[category].totals}
        />
      ))}
      <ReturnsTable section={sections.returns} teamName={teamName} />
      <FieldGoalsTable section={sections.fieldGoals} teamName={teamName} />
      <KickoffsTable section={sections.kickoffs} teamName={teamName} />
      <AllPurposeTable section={sections.allPurpose} teamName={teamName} />
      <FumblesTable section={sections.fumbles} teamName={teamName} />
    </section>
  );
};

export const FootballIndividualOffenseReportPage = ({ report }) => (
  <article className="football-report-page football-individual-offense-page" data-football-report="individual-offense">
    <FootballReportHeader matchup={report.reportMatchup} title={report.reportTitle} />
    <div className="football-individual-offense-grid">
      <TeamColumn report={report} team="V" />
      <TeamColumn report={report} team="H" />
    </div>
    <FootballReportFooterBrand />
  </article>
);

export default function FootballIndividualOffenseReport({ envelope }) {
  const reportEnvelope = useMemo(() => resolveReportEnvelope(envelope), [envelope]);
  const report = useMemo(
    () => buildFootballIndividualOffenseReport(reportEnvelope),
    [reportEnvelope],
  );

  return (
    <main className="football-report-screen">
      <nav className="football-report-actions" aria-label="Report actions">
        <a href={scorerHref(report.gameId)}>Back to scorer</a>
        <button onClick={() => window.print()} type="button">Print / Save PDF</button>
      </nav>
      <FootballIndividualOffenseReportPage report={report} />
    </main>
  );
}

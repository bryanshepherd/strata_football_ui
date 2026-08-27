import React, { useMemo, useState } from 'react';
import baselineRecord from '../data/footballCompletedBaselineGameRecord.json';
import {
  FootballReportFooterBrand,
  FootballReportHeader,
} from '../components/reports/FootballReportHeader';
import {
  buildFootballQuickieStatsReport,
  FOOTBALL_QUICKIE_SCOPE_OPTIONS,
  resolveFootballQuickieScope,
} from '../reports/footballQuickieStats';
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

const scopeFromValue = (value) => {
  const [mode, number] = String(value).split('-');
  if (mode === 'half') return resolveFootballQuickieScope({ mode, half: number });
  return resolveFootballQuickieScope({ mode, quarter: number });
};

const writeScopeToLocation = (scope) => {
  if (typeof window === 'undefined') return;
  const params = reportSearchParams();
  params.set('scope', scope.mode);
  params.delete('half');
  params.delete('quarter');
  if (scope.mode === 'half') params.set('half', String(scope.half));
  else if (!scope.fullGame) params.set('quarter', String(scope.quarter));
  window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
};

const ReportSection = ({ children, title, className = '' }) => (
  <section className={`football-report-section ${className}`.trim()}>
    <h2>{title}</h2>
    {children}
  </section>
);

const TeamStats = ({ report }) => (
  <ReportSection className="football-quickie-team-section" title="TEAM STATS">
    <table aria-label="Quickie team stats" className="football-report-table football-quickie-team-table">
      <colgroup>
        <col className="football-quickie-stat-column" />
        <col />
        <col />
      </colgroup>
      <thead>
        <tr>
          <th aria-label="Statistic" />
          <th>{report.teams.V.name}</th>
          <th>{report.teams.H.name}</th>
        </tr>
      </thead>
      <tbody>
        {report.rows.map((row) => (
          <tr className={row.heading ? 'football-quickie-l3-row' : undefined} key={row.id}>
            <th scope="row">{row.label}</th>
            <td>{row.values.V}</td>
            <td>{row.values.H}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </ReportSection>
);

const formatHalfStat = (value) => (
  Number.isInteger(value) ? String(value) : finiteNumber(value).toFixed(1)
);

const finiteNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const PlayerName = ({ player }) => <>{`#${player.jersey} ${player.name}`}</>;

const IndividualTable = ({ category, players, showYac }) => {
  const definitions = {
    rushing: {
      title: 'RUSHING',
      headers: ['PLAYER', 'NUM', 'GAIN', 'LOSS', 'NET', 'TD', 'LG'],
      values: (player) => [
        <PlayerName key="player" player={player} />,
        player.rushAttempts,
        player.rushGain,
        player.rushLoss,
        player.rushYards,
        player.rushTouchdowns,
        player.rushLong,
      ],
    },
    passing: {
      title: 'PASSING',
      headers: ['PLAYER', 'COMP-ATT-INT', 'YDS', 'TD', 'LONG', 'SACK'],
      values: (player) => [
        <PlayerName key="player" player={player} />,
        `${player.passCompletions}-${player.passAttempts}-${player.passInterceptions}`,
        player.passYards,
        player.passTouchdowns,
        player.passLong,
        player.sacksTaken,
      ],
    },
    receiving: {
      title: 'RECEIVING',
      headers: ['PLAYER', 'NUM', 'TRGT', 'YARDS', ...(showYac ? ['YAC'] : []), 'TD', 'LONG'],
      values: (player) => [
        <PlayerName key="player" player={player} />,
        player.receptions,
        player.targets,
        player.receivingYards,
        ...(showYac ? [player.yacStated ? player.yac : '—'] : []),
        player.receivingTouchdowns,
        player.receivingLong,
      ],
    },
    punting: {
      title: 'PUNTING',
      headers: ['PLAYER', 'NUM', 'YDS', 'AVG', 'LONG', 'IN 20', '50+', 'TB'],
      values: (player) => [
        <PlayerName key="player" player={player} />,
        player.punts,
        player.puntYards,
        player.punts > 0 ? (player.puntYards / player.punts).toFixed(1) : '0.0',
        player.puntLong,
        player.puntInside20,
        player.puntFiftyPlus,
        player.puntTouchbacks,
      ],
    },
    tackles: {
      title: 'TACKLES',
      headers: ['PLAYER', 'UA-A', 'TOTAL', 'SACKS', 'TFL'],
      values: (player) => [
        <PlayerName key="player" player={player} />,
        `${player.soloTackles}-${player.assistedTackles}`,
        player.soloTackles + player.assistedTackles,
        formatHalfStat(player.sacks),
        formatHalfStat(player.tacklesForLoss),
      ],
    },
  };
  const definition = definitions[category];
  return (
    <section className="football-quickie-individual-category">
      <h4>{definition.title}</h4>
      <table aria-label={`${definition.title.toLowerCase()} leaders`} className="football-report-table football-quickie-individual-table">
        <thead>
          <tr>{definition.headers.map((header) => <th key={header}>{header}</th>)}</tr>
        </thead>
        <tbody>
          {players.length > 0 ? players.map((player) => (
            <tr key={player.playerId}>
              {definition.values(player).map((value, index) => (
                <td className={index === 0 ? 'football-quickie-player-name' : undefined} key={index}>{value}</td>
              ))}
            </tr>
          )) : (
            <tr><td className="football-quickie-empty" colSpan={definition.headers.length}>No statistics</td></tr>
          )}
        </tbody>
      </table>
    </section>
  );
};

const IndividualTeam = ({ report, team }) => (
  <section className="football-quickie-individual-team">
    <h3>{report.teams[team].name}</h3>
    {['rushing', 'passing', 'receiving', 'punting', 'tackles'].map((category) => (
      <IndividualTable
        category={category}
        key={category}
        players={report.individual[team][category]}
        showYac={report.individual.showYac}
      />
    ))}
  </section>
);

const IndividualStats = ({ report }) => (
  <ReportSection className="football-quickie-individual-section" title="INDIVIDUAL STATS">
    <div className="football-quickie-individual-grid">
      <IndividualTeam report={report} team="V" />
      <IndividualTeam report={report} team="H" />
    </div>
  </ReportSection>
);

const ScoringSummary = ({ report }) => (
  <ReportSection className="football-quickie-scoring-section" title="SCORING SUMMARY">
    <table aria-label="Quickie scoring summary" className="football-report-table football-scoring-ledger football-quickie-scoring-table">
      <colgroup>
        <col className="football-scoring-quarter-column" />
        <col className="football-scoring-time-column" />
        <col className="football-scoring-team-column" />
        <col />
        <col className="football-scoring-drive-column" />
        <col className="football-scoring-score-column" />
      </colgroup>
      <thead>
        <tr>
          <th>QTR</th>
          <th>TIME</th>
          <th>TEAM</th>
          <th>SCORING PLAY</th>
          <th>DRIVE</th>
          <th>SCORE (V-H)</th>
        </tr>
      </thead>
      <tbody>
        {report.scoring.length > 0 ? report.scoring.map((play) => (
          <tr key={play.sequence}>
            <td>{play.quarter}</td>
            <td>{play.time}</td>
            <td>{play.team}</td>
            <td className="football-scoring-description">{play.description}</td>
            <td>{play.drive}</td>
            <td className="football-report-total">{play.score}</td>
          </tr>
        )) : (
          <tr><td className="football-quickie-empty" colSpan="6">No scoring plays in this scope</td></tr>
        )}
      </tbody>
    </table>
  </ReportSection>
);

export default function FootballQuickieStatsReport({ envelope }) {
  const reportEnvelope = useMemo(() => resolveReportEnvelope(envelope), [envelope]);
  const [scope, setScope] = useState(() => resolveFootballQuickieScope(reportSearchParams()));
  const report = useMemo(
    () => buildFootballQuickieStatsReport(reportEnvelope, scope),
    [reportEnvelope, scope],
  );
  const handleScopeChange = (event) => {
    const next = scopeFromValue(event.target.value);
    setScope(next);
    writeScopeToLocation(next);
  };

  return (
    <main className="football-report-screen football-quickie-screen">
      <nav className="football-report-actions football-quickie-actions" aria-label="Report actions">
        <a href={scorerHref(report.gameId)}>Back to scorer</a>
        <label>
          <span>Scope</span>
          <select aria-label="Quickie report scope" onChange={handleScopeChange} value={report.scope.value}>
            {FOOTBALL_QUICKIE_SCOPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <button onClick={() => window.print()} type="button">Print / Save PDF</button>
      </nav>
      <article className="football-report-page football-quickie-page" data-football-report="quickie-stats">
        <FootballReportHeader matchup={report.reportMatchup} title={report.reportTitle} />
        <p className="football-quickie-scope-label">{report.scope.label}</p>
        <TeamStats report={report} />
        <IndividualStats report={report} />
        <ScoringSummary report={report} />
        <FootballReportFooterBrand />
      </article>
    </main>
  );
}

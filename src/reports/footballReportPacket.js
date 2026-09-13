import { buildFootballScoringSummary } from './footballScoringSummary';
import { buildFootballTeamStatsReport } from './footballTeamStats';
import { buildFootballIndividualOffenseReport } from './footballIndividualOffense';
import { buildFootballDefensiveStatsReport } from './footballDefensiveStats';
import { buildFootballDriveChartReport } from './footballDriveChart';
import { buildFootballPenaltyChartReport } from './footballPenaltyChart';
import { buildFootballParticipationReport } from './footballParticipationReport';
import { buildFootballPlayByPlayReport } from './footballPlayByPlay';

export const FOOTBALL_PACKET_REPORTS = Object.freeze([
  { id: 'scoring-summary', label: 'Scoring Summary', build: buildFootballScoringSummary },
  { id: 'team-stats', label: 'Team Stats', build: buildFootballTeamStatsReport },
  { id: 'individual-offense', label: 'Offensive Individual', build: buildFootballIndividualOffenseReport },
  { id: 'defensive-stats', label: 'Defensive Individual', build: buildFootballDefensiveStatsReport },
  { id: 'drive-chart', label: 'Drive Chart', build: buildFootballDriveChartReport },
  { id: 'penalty-chart', label: 'Penalty Report', build: buildFootballPenaltyChartReport },
  { id: 'participation', label: 'Participation', build: buildFootballParticipationReport },
  { id: 'play-by-play', label: 'Play-By-Play', build: buildFootballPlayByPlayReport },
]);

export const buildFootballReportPacket = (envelope) => ({
  gameId: envelope.gameId,
  // Every builder receives the same loaded game. The packet always includes the
  // complete game, regardless of a quarter/scope parameter left in the URL.
  sections: FOOTBALL_PACKET_REPORTS.map(({ id, label, build }) => ({
    id, label, report: build(envelope),
  })),
});

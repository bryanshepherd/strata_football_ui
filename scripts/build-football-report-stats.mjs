import { build } from 'esbuild';
import { resolve } from 'node:path';

const outfile = process.argv[2];
if (!outfile) throw new Error('Pass the dashboard footballReportStats.mjs output path.');
await build({
  stdin: {
    contents: "export { hasAcceptedDpiSpotPenalty } from './src/utils/footballPenaltyStatistics.js'; export { withFootballReportYardage } from './src/reports/footballReportYardage.js'; export { footballStatisticalRushYards, footballStatisticalPassYards } from './src/utils/footballStatisticalYardage.js'; export { footballFumbleRecords, footballRecoveryRecords, footballOnsideRecovery } from './src/utils/footballOnsideKick.js'; export { projectFootballStatsForEvents } from './src/services/footballDashboardService.js'; export { splitFootballDefensiveYards } from './src/utils/footballDefensiveCredit.js'; export { firstDownBreakdown, redZoneStats, footballKickoffGrossYards } from './src/reports/footballTeamStats.js'; export { footballPointsOffTurnovers } from './src/scoring/footballTurnoverScoring.js';",
    resolveDir: process.cwd(), sourcefile: 'footballReportStats.entry.js',
  },
  outfile: resolve(outfile), bundle: true, format: 'esm', platform: 'neutral', target: 'es2020', mainFields: ['module', 'main'],
  banner: { js: '// Generated from StrataFootball by scripts/build-football-report-stats.mjs. Do not edit by hand.' },
});

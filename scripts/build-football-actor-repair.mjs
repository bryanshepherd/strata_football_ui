import { build } from 'esbuild';
import { resolve } from 'node:path';

const outfile = process.argv[2];
if (!outfile) throw new Error('Pass the dashboard footballEditedActorRepair.mjs output path.');
await build({
  stdin: {
    contents: "export { repairFootballEditedActorsInEnvelope, repairFootballPlayReadoutsInEnvelope } from './src/play-editor/footballPlayEditEnvelope.js'; export { formatFootballChallengeReadout } from './src/utils/footballChallengeReadout.js';",
    resolveDir: process.cwd(),
    sourcefile: 'footballEditedActorRepair.entry.js',
  },
  outfile: resolve(outfile), bundle: true, format: 'esm', platform: 'neutral', target: 'es2020',
  banner: { js: '// Generated from StrataFootball by scripts/build-football-actor-repair.mjs. Do not edit by hand.' },
});

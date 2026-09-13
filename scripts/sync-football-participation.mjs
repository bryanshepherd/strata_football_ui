import { copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const outfile = process.argv[2];
if (!outfile) throw new Error('Pass the dashboard footballParticipation.js output path.');
await copyFile(new URL('../src/utils/footballParticipation.js', import.meta.url), resolve(outfile));

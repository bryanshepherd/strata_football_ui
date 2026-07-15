import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backendRoot = process.env.STRATA_FOOTBALL_BACKEND
  ? path.resolve(process.env.STRATA_FOOTBALL_BACKEND)
  : path.resolve(frontendRoot, '..', 'strata_football');
const backendGenerated = path.join(backendRoot, 'generated', 'typescript');
const frontendContracts = path.join(frontendRoot, 'src', 'contracts', 'football');

const generation = spawnSync('npm', ['run', 'contracts:generate'], {
  cwd: backendRoot,
  encoding: 'utf8',
  stdio: 'inherit',
});

if (generation.error) throw generation.error;
if (generation.status !== 0) process.exit(generation.status ?? 1);

const generatedFiles = (await readdir(backendGenerated)).filter((name) => name.endsWith('.ts'));
if (generatedFiles.length === 0) {
  throw new Error(`No generated TypeScript contracts found in ${backendGenerated}`);
}

await rm(frontendContracts, { recursive: true, force: true });
await mkdir(frontendContracts, { recursive: true });
for (const fileName of generatedFiles) {
  await cp(path.join(backendGenerated, fileName), path.join(frontendContracts, fileName));
}

console.log(`Synchronized ${generatedFiles.length} football contract files into src/contracts/football`);

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { e2eSlot } from './e2e-slot.ts';

const action = process.argv[2];
if (action !== 'up' && action !== 'down') throw new Error('Usage: pnpm e2e:browsers up|down');
const slot = e2eSlot();
const command = action === 'up' ? ['up', '-d', '--wait', 'browsers'] : ['rm', '-s', '-f', 'browsers'];
// down удаляет только браузеры своего проекта; общий Postgres и чужие слоты не затрагиваются.
const run = spawnSync('docker', ['compose', '--env-file', '/dev/null', '-f', fileURLToPath(new URL('../../compose.yaml', import.meta.url)),
  '-p', slot.composeProject, '--profile', 'e2e', ...command], {
  stdio: 'inherit', env: { ...process.env, E2E_BROWSERS_PORT: String(slot.browsersPort) },
});
if (run.error) throw run.error;
process.exitCode = run.status ?? 1;

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const HOOKS = path.dirname(fileURLToPath(import.meta.url));
const temporaryDirs: string[] = [];
const PROCESS_TIMEOUT_MS = 30000;
const TEST_TIMEOUT_MS = PROCESS_TIMEOUT_MS + 5000;

afterEach(() => {
  for (const dir of temporaryDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gp-gate-failure-'));
  temporaryDirs.push(dir);
  const bin = path.join(dir, 'bin');
  const work = path.join(dir, 'work');
  fs.mkdirSync(bin);
  fs.mkdirSync(work);
  fs.mkdirSync(path.join(dir, 'sdk/platforms'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'server'));
  const write = (file: string, body: string) => {
    const destination = path.join(dir, file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, body);
  };
  const executable = (file: string, body: string) => {
    write(file, `#!/bin/sh\nset -eu\n${body}\n`);
    fs.chmodSync(path.join(dir, file), 0o755);
  };
  // Только эти системные команды доступны: сборки и обращения к настоящим устройствам исключены.
  for (const command of ['awk', 'grep', 'head', 'tail', 'perl', 'python3', 'sh']) {
    const real = fs.existsSync(`/bin/${command}`) ? `/bin/${command}` : `/usr/bin/${command}`;
    fs.symlinkSync(real, path.join(bin, command));
  }
  executable('bin/git', `
case "$*" in
  'rev-parse --show-toplevel') echo "$GP_TEST_ROOT" ;;
  'status --porcelain -- core/api/src/main/generated'|'status --porcelain -- Packages/GPAPI') ;;
  *) echo "Неожиданный git: $*" >&2; exit 2 ;;
esac`);
  executable('bin/mktemp', 'echo "$GP_TEST_ROOT/work"');
  executable('bin/rm', '/bin/rm "$@"\nexit "$GP_TEST_CLEANUP_STATUS"');
  const failure = `
echo "failed:$GP_TEST_FAIL_STEP" >>"$GP_TEST_ROOT/calls"
echo "Error: error: подменённый шаг $GP_TEST_FAIL_STEP упал с кодом $GP_TEST_STEP_STATUS" >&2
exit "$GP_TEST_STEP_STATUS"`;
  executable('bin/gradle-step', `
if [ "$2" = "$GP_TEST_FAIL_STEP" ]; then ${failure}; fi`);
  executable('apps/android/gradlew', 'exec gradle-step "$@"');
  write('apps/android/app/build/reports/kover/reportDebug.xml', '<report><counter type="LINE" missed="0" covered="100"/></report>');
  executable('bin/unzip', `
echo 'unzip:release' >>"$GP_TEST_ROOT/calls"
mkdir -p "$7"
echo "$GP_TEST_FORBIDDEN" >"$7/classes.dex"
echo '' >"$7/resources.arsc"`);
  fs.symlinkSync('/bin/mkdir', path.join(bin, 'mkdir'));
  write('scripts/hooks/sim-devices', fs.readFileSync(path.join(HOOKS, 'sim-devices'), 'utf8'));
  executable('apps/apple/scripts/generate-api.sh', ':');
  executable('apps/apple/scripts/generate-project.sh', ':');
  executable('apps/apple/scripts/simulator.sh', 'echo "$1"');
  executable('bin/swift', `if [ "$GP_TEST_FAIL_STEP" = swift ]; then ${failure}; fi`);
  executable('bin/xcodebuild', `
case " $* " in
  *' generic/platform=iOS '*) step=release-ios ;;
  *' generic/platform=macOS '*) step=release-mac ;;
  *' build-for-testing '*) step=build-for-testing ;;
  *' test-without-building '*) step=iphone-tests ;;
  *) echo "Неожиданный xcodebuild: $*" >&2; exit 2 ;;
esac
if [ "$step" = "$GP_TEST_FAIL_STEP" ]; then ${failure}; fi`);
  executable('bin/xcodegen', ':');
  executable('bin/docker', ':');
  executable('bin/lsof', 'exit 1');
  executable('bin/curl', ':');
  // Подменённый сервер обслуживать запросы не должен: проверку health тоже выполняет заглушка.
  executable('bin/go', `
cat >"$3" <<'EOF'
#!/bin/sh
exit 0
EOF
chmod +x "$3"`);
  for (const command of ['cat', 'chmod']) fs.symlinkSync(`/bin/${command}`, path.join(bin, command));
  executable('bin/adb', 'echo "List of devices attached"');
  executable('bin/xcrun', `
echo "xcrun:$*" >>"$GP_TEST_ROOT/calls"
case "$*" in
  'simctl list devices booted') echo '== Devices ==' ;;
  'simctl boot iphone'|'simctl bootstatus iphone -b') ;;
  'simctl shutdown iphone') exit "$GP_TEST_SHUTDOWN_STATUS" ;;
  *) echo "Неожиданный xcrun: $*" >&2; exit 2 ;;
esac`);
  const run = (gate: string, step: string, status: number, { cleanupStatus = 0, shutdownStatus = 0, forbidden = '' } = {}) => {
    const r = spawnSync('/bin/sh', [path.join(HOOKS, gate)], {
      cwd: dir,
      encoding: 'utf8',
      timeout: PROCESS_TIMEOUT_MS,
      env: {
        ...process.env,
        PATH: bin,
        ANDROID_HOME: path.join(dir, 'sdk'),
        GP_TEST_ROOT: dir,
        GP_TEST_FAIL_STEP: step,
        GP_TEST_STEP_STATUS: `${status}`,
        GP_TEST_CLEANUP_STATUS: `${cleanupStatus}`,
        GP_TEST_SHUTDOWN_STATUS: `${shutdownStatus}`,
        GP_TEST_FORBIDDEN: forbidden,
      },
    });
    expect(r.error).toBeUndefined();
    expect(r.signal).toBeNull();
    const calls = fs.readFileSync(path.join(dir, 'calls'), 'utf8').trim().split('\n');
    expect(calls).toContain(forbidden ? 'unzip:release' : `failed:${step}`);
    expect(fs.existsSync(work)).toBe(false);
    return { ...r, calls };
  };
  return { run };
}

describe('гейты — код упавшего шага и cleanup под set -eu', { timeout: TEST_TIMEOUT_MS }, () => {
  it.each([':core:api:generateApi', 'ktlintCheck', 'lintDebug', ':core:api:test', ':app:verifyRoborazziDebug'])(
    'Android: %s — настоящая причина без unbound variable, код шага 7',
    (step) => {
      const r = fixture().run('gate-android', step, 7);
      expect(r.stderr).toContain(`подменённый шаг ${step} упал с кодом 7`);
      expect.soft(r.stderr).not.toContain('unbound variable');
      expect.soft(r.status, r.stderr).toBe(7);
    },
  );

  it('Android: ошибка компиляции тестов релиза — имя шага и его код 7', () => {
    const r = fixture().run('gate-android', 'compileReleaseUnitTestKotlin', 7);
    expect(r.stderr).toContain('подменённый шаг compileReleaseUnitTestKotlin упал с кодом 7');
    expect.soft(r.stderr).toContain('«компиляция тестов релизной сборки» не прошёл');
    expect.soft(r.stderr).not.toContain('unbound variable');
    expect.soft(r.status, r.stderr).toBe(7);
  });

  it.each(['swift', 'release-ios', 'release-mac', 'build-for-testing', 'iphone-tests'])(
    'Apple: %s — настоящая причина без unbound variable, код шага 7',
    (step) => {
      const r = fixture().run('gate-apple', step, 7);
      expect(r.stderr).toContain(`подменённый шаг ${step} упал с кодом 7`);
      expect.soft(r.stderr).not.toContain('unbound variable');
      expect.soft(r.status, r.stderr).toBe(7);
      if (step === 'iphone-tests') expect(r.calls).toContain('xcrun:simctl shutdown iphone');
    },
  );

  it.each([
    ['gate-android', 'ktlintCheck'],
    ['gate-apple', 'swift'],
  ])('%s: ошибка удаления временного не заменяет код упавшего шага 42', (gate, step) => {
    const r = fixture().run(gate, step, 42, { cleanupStatus: 9 });
    expect.soft(r.stderr).not.toContain('unbound variable');
    expect.soft(r.status, r.stderr).toBe(42);
  });

  it.each(['api/auth/dev', '10.0.2.2'])('Android: запрещённое содержимое APK %s — понятная причина без unbound variable', (forbidden) => {
    const r = fixture().run('gate-android', 'release-content', 1, { forbidden });
    expect.soft(r.stderr).not.toContain('unbound variable');
    expect.soft(r.stderr).toContain(`в релизной сборке есть «${forbidden}»`);
    expect.soft(r.status, r.stderr).toBe(1);
  });

  it('Apple: неудачное выключение своего симулятора оставляет гейт красным', () => {
    const r = fixture().run('gate-apple', 'iphone-tests', 7, { shutdownStatus: 9 });
    expect(r.calls).toContain('xcrun:simctl shutdown iphone');
    expect(r.stderr).toContain('Погасить своё вручную: xcrun simctl shutdown iphone');
    expect(r.stderr).not.toContain('unbound variable');
    expect(r.status, r.stderr).toBe(1);
  });
});

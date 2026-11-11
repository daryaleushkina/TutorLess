import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const HOOKS = path.dirname(fileURLToPath(import.meta.url));
const temporaryDirs: string[] = [];

afterEach(() => {
  for (const dir of temporaryDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

function fixture() {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'gp-app-copies-')));
  temporaryDirs.push(dir);
  const build = path.join(dir, 'apps/apple/build');
  const bin = path.join(dir, 'bin');
  const script = path.join(dir, 'scripts/hooks/remove-app-copies');
  fs.mkdirSync(build, { recursive: true });
  fs.mkdirSync(bin);
  fs.mkdirSync(path.dirname(script), { recursive: true });
  fs.copyFileSync(path.join(HOOKS, 'remove-app-copies'), script);
  fs.chmodSync(script, 0o755);
  const callsFile = path.join(dir, 'calls');
  fs.writeFileSync(callsFile, '');
  const executable = (name: string, body: string) => {
    const file = path.join(bin, name);
    fs.writeFileSync(file, `#!/bin/sh\nset -eu\n${body}\n`);
    fs.chmodSync(file, 0o755);
  };
  for (const command of ['dirname', 'find', 'sh']) {
    fs.symlinkSync(fs.existsSync(`/bin/${command}`) ? `/bin/${command}` : `/usr/bin/${command}`, path.join(bin, command));
  }
  executable('lsregister fake', String.raw`
[ "$1" = -u ] && [ -e "$2" ]
printf 'unregister:%s\0' "$2" >>"$GP_TEST_CALLS"
exit "$GP_TEST_UNREGISTER_STATUS"`);
  executable('rm', String.raw`
for file do
  case "$file" in
    *.app) printf 'remove:%s\0' "$file" >>"$GP_TEST_CALLS" ;;
  esac
done
if [ "$GP_TEST_REMOVE_STATUS" -ne 0 ]; then exit "$GP_TEST_REMOVE_STATUS"; fi
exec /bin/rm "$@"`);
  const app = (relative: string) => {
    const file = path.join(build, relative);
    fs.mkdirSync(file, { recursive: true });
    fs.writeFileSync(path.join(file, 'binary'), 'app');
    return file;
  };
  const run = (args: string[] = [], { unregisterStatus = 0, removeStatus = 0 } = {}) => {
    // Запуск из другого cwd: корень берётся по расположению скрипта, а не по текущей папке.
    const r = spawnSync(script, args, {
      cwd: os.tmpdir(),
      encoding: 'utf8',
      timeout: 10000,
      env: {
        ...process.env,
        PATH: bin,
        LSREGISTER: path.join(bin, 'lsregister fake'),
        GP_TEST_CALLS: callsFile,
        GP_TEST_UNREGISTER_STATUS: `${unregisterStatus}`,
        GP_TEST_REMOVE_STATUS: `${removeStatus}`,
      },
    });
    expect(r.error).toBeUndefined();
    expect(r.signal).toBeNull();
    const calls = fs.readFileSync(callsFile, 'utf8').split('\0').filter(Boolean);
    return { ...r, calls };
  };
  return { dir, build, bin, app, run };
}

describe('remove-app-copies', () => {
  it('снимает регистрацию до удаления, включая вложенные .app и пробелы/перенос строки в пути', () => {
    const { build, app, run } = fixture();
    const parent = app('gate/GrePrep Copy.app');
    const nested = app('gate/GrePrep Copy.app/Contents/Helpers/Runner.app');
    const newline = app('dd/GrePrep\nDebug.app');
    const intermediate = path.join(build, 'gate/cache.o');
    fs.writeFileSync(intermediate, 'cache');
    const r = run();
    expect(r.status, r.stderr).toBe(0);
    expect(r.stderr).toBe('');
    for (const file of [parent, nested, newline]) {
      expect(fs.existsSync(file)).toBe(false);
      expect(r.calls).toContain(`unregister:${file}`);
      expect(r.calls.indexOf(`remove:${file}`)).toBeGreaterThan(r.calls.indexOf(`unregister:${file}`));
    }
    expect(r.calls.indexOf(`remove:${nested}`)).toBeLessThan(r.calls.indexOf(`unregister:${parent}`));
    expect(fs.readFileSync(intermediate, 'utf8')).toBe('cache');
    expect(run().status).toBe(0);
  });

  it.each(['', '/', '..', 'missing', 'apps/apple', 'apps/apple/build-sibling'])(
    'неверный корень «%s» — отказ без снятия регистрации и удаления',
    (relative) => {
      const { dir, app, run } = fixture();
      const copy = app('GrePrep.app');
      const invalid = relative && relative !== '/' ? path.join(dir, relative) : relative;
      if (relative === 'apps/apple/build-sibling') fs.mkdirSync(invalid);
      const r = run([invalid]);
      expect(r.status, r.stderr).toBe(1);
      expect(r.stderr).toContain('корень');
      expect(r.calls).toEqual([]);
      expect(fs.existsSync(copy)).toBe(true);
    },
  );

  it('принимает явно указанный корень своего дерева', () => {
    const { build, app, run } = fixture();
    const copy = app('GrePrep.app');
    expect(run([build]).status).toBe(0);
    expect(fs.existsSync(copy)).toBe(false);
  });

  it('несуществующий build — отказ, папка не создаётся', () => {
    const { build, run } = fixture();
    fs.rmdirSync(build);
    const r = run();
    expect(r.status, r.stderr).toBe(1);
    expect(r.stderr).toContain(build);
    expect(r.calls).toEqual([]);
    expect(fs.existsSync(build)).toBe(false);
  });

  it.each(['build', 'apple'])('не следует за символьной ссылкой вместо %s', (component) => {
    const { dir, build, run } = fixture();
    const outside = path.join(dir, 'outside');
    const copy = path.join(outside, 'GrePrep.app');
    fs.mkdirSync(copy, { recursive: true });
    fs.rmdirSync(build);
    const link = component === 'build' ? build : path.dirname(build);
    if (component === 'apple') fs.rmdirSync(link);
    fs.symlinkSync(outside, link);
    const r = run();
    expect(r.status, r.stderr).toBe(1);
    expect(r.calls).toEqual([]);
    expect(fs.existsSync(copy)).toBe(true);
  });

  // lsregister идёт по ссылке: ссылка с именем .app сняла бы регистрацию приложения вне дерева.
  it('ссылку с именем .app не трогает — регистрация цели вне build остаётся', () => {
    const { dir, build, app, run } = fixture();
    const ownCopy = app('gate/Build/Products/Release/GrePrep.app');
    const outsideApp = path.join(dir, 'outside/Real.app');
    fs.mkdirSync(outsideApp, { recursive: true });
    const link = path.join(build, 'gate/Build/Products/Release/Linked.app');
    fs.symlinkSync(outsideApp, link);
    const r = run();
    expect(r.status, r.stderr).toBe(0);
    expect(fs.existsSync(ownCopy)).toBe(false);
    expect(r.calls).not.toContain(`unregister:${link}`);
    expect(fs.lstatSync(link).isSymbolicLink()).toBe(true);
    expect(fs.existsSync(outsideApp)).toBe(true);
  });

  // Исходники пакетов SPM — чужие файлы: удалённый из них .app портит копию пакета для следующей сборки.
  it('не трогает .app в исходниках пакетов SourcePackages', () => {
    const { app, run } = fixture();
    const ownCopy = app('gate/Build/Products/Release/GrePrep.app');
    const packageApp = app('gate/SourcePackages/checkouts/pkg/Fixtures/Sample.app');
    const r = run();
    expect(r.status, r.stderr).toBe(0);
    expect(fs.existsSync(ownCopy)).toBe(false);
    expect(fs.existsSync(packageApp)).toBe(true);
    expect(r.calls).not.toContain(`unregister:${packageApp}`);
  });

  it('не обходит вложенные символьные ссылки за пределы build', () => {
    const { dir, build, app, run } = fixture();
    const ownCopy = app('GrePrep.app');
    const outside = path.join(dir, 'outside');
    const outsideCopy = path.join(outside, 'Other.app');
    fs.mkdirSync(outsideCopy, { recursive: true });
    fs.symlinkSync(outside, path.join(build, 'linked-products'));
    const r = run();
    expect(r.status, r.stderr).toBe(0);
    expect(fs.existsSync(ownCopy)).toBe(false);
    expect(fs.existsSync(outsideCopy)).toBe(true);
    expect(r.calls).not.toContain(`unregister:${outsideCopy}`);
  });

  it.each([{ unregisterStatus: 9 }, { removeStatus: 9 }])('ошибка %j — предупреждение с путём; остальные копии тоже обрабатываются', (options) => {
    const { app, run } = fixture();
    const copies = [app('gate/GrePrep.app'), app('dd/GrePrep Copy.app')];
    const r = run([], options);
    expect(r.status, r.stderr).toBe(1);
    expect(r.stderr).toContain('предупреждение');
    for (const copy of copies) {
      expect(r.stderr).toContain(copy);
      expect(r.calls).toContain(`unregister:${copy}`);
    }
  });

  it('ошибка find — предупреждение с корнем, ничего не удалено', () => {
    const { build, bin, app, run } = fixture();
    const copy = app('GrePrep.app');
    fs.unlinkSync(path.join(bin, 'find'));
    fs.writeFileSync(path.join(bin, 'find'), '#!/bin/sh\nexit 9\n', { mode: 0o755 });
    const r = run();
    expect(r.status, r.stderr).toBe(1);
    expect(r.stderr).toContain('предупреждение');
    expect(r.stderr).toContain(build);
    expect(r.calls).toEqual([]);
    expect(fs.existsSync(copy)).toBe(true);
  });
});

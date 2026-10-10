import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { build } from 'vite';

it('статические зависимости повторяемого пакета разделов загружены вместе с первым экраном', async () => {
  const result = await build({
    root: resolve(import.meta.dirname, '..'),
    configFile: resolve(import.meta.dirname, '../vite.config.ts'),
    logLevel: 'silent',
    build: { write: false, sourcemap: false },
  });
  const outputs = Array.isArray(result) ? result : [result];
  const chunks = new Map(outputs.flatMap((output) => {
    if (!('output' in output)) throw new Error('Ожидалась сборка, а не watch');
    return output.output.filter((file) => file.type === 'chunk').map((file) => [file.fileName, file] as const);
  }));
  const entry = [...chunks.values()].find((chunk) => chunk.isEntry && chunk.facadeModuleId?.endsWith('/index.html'));
  const sections = [...chunks.values()].find((chunk) => chunk.facadeModuleId?.endsWith('/sections.lazy.tsx'));
  if (!entry || !sections) throw new Error('Сборка не содержит приложение и пакет разделов');
  const initial = new Set<string>();
  const visit = (name: string) => {
    if (initial.has(name)) return;
    initial.add(name);
    for (const dependency of chunks.get(name)?.imports ?? []) visit(dependency);
  };
  visit(entry.fileName);
  // Новый URL import() сбрасывает отказ самого пакета, но не отказ его статических зависимостей в WebKit.
  expect(sections.imports.filter((dependency) => !initial.has(dependency)),
    'Зависимости разделов, которые могут попасть в офлайн и отравить повтор import()').toEqual([]);
});

/** Один шаг разводит все четыре порта; нулевой слот совместим с гейтом и прежними командами. */
export function e2eSlot(raw = process.env.E2E_SLOT ?? '0') {
  if (!/^(0|[1-9]\d*)$/.test(raw) || Number(raw) > 2872) throw new Error('E2E_SLOT must be an integer from 0 to 2872');
  const slot = Number(raw); const offset = slot * 20;
  const suffix = slot === 0 ? '' : `-${slot}`;
  return {
    slot, webPort: 5191 + offset, apiPort: 8093 + offset, oidcPort: 8094 + offset, browsersPort: 3556 + offset,
    database: `greprep_web_e2e${slot === 0 ? '' : `_${slot}`}`,
    composeProject: slot === 0 ? 'greprep' : `greprep-e2e-${slot}`,
    buildDir: `dist-e2e${suffix}`,
    outputDir: `test-results${suffix}`, reportDir: `playwright-report${suffix}`,
  };
}


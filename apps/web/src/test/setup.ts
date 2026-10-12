// Компоненты проверяются со стилями приложения: токены, шрифт, основа — как в main.tsx.
import '@greprep/tokens/generated/web/tokens.css';
import '../styles/fonts.css';
import '../styles/base.css';
import { onlineManager } from '@tanstack/react-query';
import { afterEach, beforeEach, vi } from 'vitest';
import { applyTheme, readTheme } from '../styles/theme';
import { setTelegramRuntime } from '../telegram/runtime';
import { trainingRepository } from '../training/repository';
import { resetReauthForTests } from '../session/session';

beforeEach(() => { applyTheme(readTheme()); delete document.documentElement.dataset.textSize; });

afterEach(async () => {
  await trainingRepository.signOut();
  setTelegramRuntime(null);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  sessionStorage.clear();
  localStorage.clear();
  onlineManager.setOnline(true);
  resetReauthForTests();
});

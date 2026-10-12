import { isApiError, setLocale } from '@greprep/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { useEffect, useState, type ReactNode } from 'react';
import { APP_VERSION } from '../../config';
import { AlertIcon, CardIcon, KeyIcon, MailIcon } from '../../components/icons';
import { GRE_DISCLAIMER } from '../../i18n/dict';
import { useI18n } from '../../i18n/i18n';
import type { Locale } from '../../i18n/locale';
import { BackLink } from '../../layout/AppLayout';
import { useTabHistory } from '../../layout/TabsContext';
import { SESSION_KEY, useAccount, useSession, type SessionData } from '../../session/session';
import { useShell } from '../../shellContext';
import { applyTheme, readTheme, saveTheme, type Theme } from '../../styles/theme';
import { useBackButton } from '../../telegram/hooks';
import styles from '../screens.module.css';

export function SettingsScreen(): ReactNode {
  const { t, locale } = useI18n();
  const { shell } = useShell();
  const { signOut } = useSession();
  const account = useAccount();
  const client = useQueryClient();
  const router = useRouter();
  const history = useTabHistory();
  const [busy, setBusy] = useState(false);
  const [localeBusy, setLocaleBusy] = useState(false);
  const [themeBusy, setThemeBusy] = useState(false);
  const [theme, setTheme] = useState(readTheme);
  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);
  const [large, setLarge] = useState(() => document.documentElement.dataset.textSize === 'large');
  const [failed, setFailed] = useState<string | null>(null);
  useBackButton(shell === 'telegram' ? () => void router.navigate({ href: history.profileBack }) : null);
  const onSignOut = async () => {
    setBusy(true); setFailed(null);
    try { await signOut(); }
    catch (error) { setFailed(isApiError(error) && error.kind === 'network' ? t.settings.signOutOffline : t.settings.signOutFailed); setBusy(false); }
  };
  const changeLocale = async (next: Locale) => {
    if (localeBusy || next === locale) return;
    setLocaleBusy(true); setFailed(null);
    await client.cancelQueries({ queryKey: SESSION_KEY });
    client.setQueryData<SessionData>(SESSION_KEY, { user: { ...account, locale: next }, expired: false });
    try {
      const saved = await setLocale({ locale: next });
      client.setQueryData<SessionData>(SESSION_KEY, (current) => current?.user?.id === account.id ? { ...current, user: saved } : current);
    } catch {
      client.setQueryData<SessionData>(SESSION_KEY, (current) => current?.user?.id === account.id ? { ...current, user: { ...current.user, locale } } : current);
      setFailed(t.settings.localeFailed);
    } finally { setLocaleBusy(false); }
  };
  const changeTheme = async (next: Theme) => {
    if (themeBusy || next === theme) return;
    setFailed(null); setThemeBusy(true); setTheme(next); applyTheme(next);
    try { await saveTheme(next, shell === 'telegram' ? (await import('../../telegram/sdk')).telegramThemeStorage() : undefined); }
    catch { setTheme(theme); applyTheme(theme); setFailed(t.settings.saveFailed); }
    finally { setThemeBusy(false); }
  };
  const changeSize = (next: boolean) => {
    try { localStorage.setItem('greprep.textSize', next ? 'large' : 'normal'); document.documentElement.dataset.textSize = next ? 'large' : 'normal'; setLarge(next); setFailed(null); }
    catch { setFailed(t.settings.saveFailed); }
  };
  const identity = shell === 'telegram' ? 'telegram' : account.identities.find((entry) => entry.provider === 'apple' || entry.provider === 'google')?.provider;
  const provider = identity === 'apple' ? t.signIn.apple : identity === 'google' ? t.signIn.google : t.settings.telegram;
  return <section className={styles.profileScreen}>
    {shell === 'site' && <BackLink fallback="/" narrowOnly />}
    <h1 className={styles.profileTitle}>{t.navigation.profile}</h1>
    <div className={styles.me}><span className={styles.avatar} aria-hidden="true">{Array.from(account.name.trim())[0]?.toLocaleUpperCase()}</span><span><b>{account.name}</b><small>{provider}</small></span></div>
    <ul className={styles.profileList}>
      <li className={styles.setting}><span>{t.settings.language}</span><Segment label={t.settings.language} disabled={localeBusy} values={[{ value: 'ru', label: 'Русский' }, { value: 'en', label: 'English' }]} selected={locale} change={(value) => void changeLocale(value)} /></li>
      <li className={styles.setting}><span>{t.settings.theme}</span><Segment label={t.settings.theme} disabled={themeBusy} values={[{ value: 'light', label: t.settings.light }, { value: 'dark', label: t.settings.dark }]} selected={theme} change={(value) => void changeTheme(value)} /></li>
      <li className={styles.setting}><span>{t.settings.textSize}</span><Segment label={t.settings.textSize} values={[{ value: false, label: t.settings.normal }, { value: true, label: t.settings.large }]} selected={large} change={changeSize} /></li>
    </ul>
    <ul className={styles.profileList}>{[{ text: t.settings.subscription, Icon: CardIcon }, { text: t.settings.identities, Icon: KeyIcon }, { text: t.settings.contact, Icon: MailIcon }].map(({ text, Icon }) => <li key={text}><button className={styles.setting} type="button" disabled><span className={styles.rowIcon}><Icon /></span><span>{text}</span></button></li>)}</ul>
    {shell === 'site' && <ul className={styles.profileList}><li><button className={styles.setting} type="button" onClick={() => void onSignOut()} disabled={busy}>{t.settings.signOut}</button></li></ul>}
    {failed && <p className={styles.error} role="alert"><AlertIcon />{failed}</p>}
    <footer className={styles.legal}><p lang="en">{GRE_DISCLAIMER}</p><p>{t.settings.version(APP_VERSION || 'dev')}</p></footer>
  </section>;
}

function Segment<T extends string | boolean>({ label, disabled = false, values, selected, change }: { label: string; disabled?: boolean; values: { value: T; label: string }[]; selected: T; change: (value: T) => void }) {
  return <div className={styles.segment} role="group" aria-label={label}>{values.map((entry) => <button type="button" key={String(entry.value)} disabled={disabled} aria-pressed={entry.value === selected} onClick={() => change(entry.value)}>{entry.label}</button>)}</div>;
}

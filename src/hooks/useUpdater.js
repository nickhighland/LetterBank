import { useCallback, useEffect, useState } from 'react';

/**
 * Update availability, from the desktop app's updater.
 *
 * Returns `update` (null until one is found) plus a manual `check` for the
 * File > Check for Updates… menu item. In the browser build there is nothing
 * to update, so everything stays inert.
 */
export function useUpdater(notify) {
  const [update, setUpdate] = useState(null);

  const check = useCallback(async () => {
    const api = window.electronAPI;
    if (!api?.checkForUpdates) return;

    notify?.('Checking for updates…', 'info');
    const result = await api.checkForUpdates();

    if (!result?.ok) {
      notify?.(`Could not check for updates: ${result?.message ?? 'unknown error'}`, 'error');
      return;
    }
    // An available update arrives via the update:available event, which sets
    // the banner; only the "already current" case needs saying here.
    if (result.latestVersion === result.currentVersion) {
      notify?.(`LetterBank ${result.currentVersion} is up to date`);
    }
  }, [notify]);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onUpdateAvailable) return;

    const offs = [
      api.onUpdateAvailable((info) => setUpdate(info)),
      api.onCheckUpdatesRequested?.(() => check()),
    ].filter((fn) => typeof fn === 'function');

    return () => offs.forEach((fn) => fn());
  }, [check]);

  const openDownload = useCallback(() => {
    window.electronAPI?.openReleasesPage?.();
  }, []);

  const dismiss = useCallback(() => setUpdate(null), []);

  return { update, check, openDownload, dismiss };
}

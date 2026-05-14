import { useEffect, useState } from 'react';

const STORAGE_KEY = 'qtassist-notifications-enabled';

function isSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

function readPreference() {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch (_) {
    return false;
  }
}

function writePreference(enabled) {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
  } catch (_) {
    // ignore
  }
}

/**
 * Browser desktop notification helper that respects:
 *   1. Whether the browser supports the Notification API
 *   2. The OS-level / browser-level permission state
 *   3. The admin's explicit opt-in toggle stored in localStorage
 *
 * Returns { supported, permission, enabled, request, toggle, notify }.
 *
 * notify(title, options) becomes a no-op unless all three conditions are
 * met, which means consumers can safely call it on every realtime event.
 */
export function useDesktopNotifications() {
  const [permission, setPermission] = useState(() =>
    isSupported() ? Notification.permission : 'denied'
  );
  const [enabled, setEnabled] = useState(readPreference);

  useEffect(() => {
    writePreference(enabled);
  }, [enabled]);

  const request = async () => {
    if (!isSupported()) return 'denied';
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === 'granted') {
        setEnabled(true);
      }
      return result;
    } catch (_) {
      return 'denied';
    }
  };

  const toggle = async () => {
    if (!isSupported()) return false;
    if (permission === 'granted') {
      setEnabled((v) => !v);
      return !enabled;
    }
    if (permission === 'default') {
      const result = await request();
      return result === 'granted';
    }
    // permission denied — only the user can re-enable in browser settings
    return false;
  };

  const notify = (title, options = {}) => {
    if (!isSupported() || permission !== 'granted' || !enabled) return null;
    if (typeof document !== 'undefined' && document.visibilityState === 'visible' && !options.alwaysShow) {
      // Don't double-notify when the dashboard is already in the foreground;
      // consumers can override with alwaysShow if needed.
      return null;
    }
    try {
      const notification = new Notification(title, {
        ...options,
        // Group notifications about the same order so we don't spam.
        tag: options.tag || 'qtassist'
      });
      if (options.onClick) {
        notification.onclick = (e) => {
          e.preventDefault();
          window.focus();
          options.onClick(e);
          notification.close();
        };
      }
      return notification;
    } catch (_) {
      return null;
    }
  };

  return {
    supported: isSupported(),
    permission,
    enabled,
    request,
    toggle,
    notify
  };
}

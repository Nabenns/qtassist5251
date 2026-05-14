import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth.jsx';

/**
 * Realtime event subscription via Server-Sent Events.
 *
 * - Opens /api/events when the admin is authenticated; closes when they
 *   sign out or the window unloads.
 * - Auto-reconnects with exponential backoff capped at 30s.
 * - Exposes the latest event so consumers (toasts, page-level
 *   refreshers) can react via React state.
 *
 * Provider must live inside <AuthProvider>.
 */

const RealtimeContext = createContext(null);

const RECONNECT_MIN = 1000;
const RECONNECT_MAX = 30000;

export function RealtimeProvider({ children }) {
  const { status } = useAuth();
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);
  const [eventSeq, setEventSeq] = useState(0);
  const sourceRef = useRef(null);
  const retryRef = useRef(RECONNECT_MIN);
  const handlersRef = useRef(new Set());
  const reconnectTimerRef = useRef(null);

  const dispatch = useCallback((evt) => {
    setLastEvent(evt);
    setEventSeq((s) => s + 1);
    handlersRef.current.forEach((h) => {
      try {
        h(evt);
      } catch (err) {
        console.warn('Realtime handler threw:', err);
      }
    });
  }, []);

  const connect = useCallback(() => {
    if (typeof EventSource === 'undefined') return;
    if (sourceRef.current) return;

    const src = new EventSource('/api/events', { withCredentials: true });
    sourceRef.current = src;

    src.addEventListener('open', () => {
      retryRef.current = RECONNECT_MIN;
      setConnected(true);
    });

    src.addEventListener('hello', () => {
      // Server confirmed auth; nothing else to do.
    });

    src.addEventListener('event', (e) => {
      try {
        const data = JSON.parse(e.data);
        dispatch(data);
      } catch (err) {
        console.warn('Failed to parse SSE event:', err);
      }
    });

    src.addEventListener('error', () => {
      setConnected(false);
      try {
        src.close();
      } catch (_) {
        // ignore
      }
      sourceRef.current = null;

      const delay = Math.min(retryRef.current * 2, RECONNECT_MAX);
      retryRef.current = delay;
      reconnectTimerRef.current = setTimeout(connect, delay);
    });
  }, [dispatch]);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (sourceRef.current) {
      try {
        sourceRef.current.close();
      } catch (_) {
        // ignore
      }
      sourceRef.current = null;
    }
    setConnected(false);
  }, []);

  useEffect(() => {
    if (status === 'authenticated') {
      connect();
    } else {
      disconnect();
    }
    return () => disconnect();
  }, [status, connect, disconnect]);

  const subscribe = useCallback((handler) => {
    handlersRef.current.add(handler);
    return () => {
      handlersRef.current.delete(handler);
    };
  }, []);

  const value = {
    connected,
    lastEvent,
    eventSeq,
    subscribe
  };

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime() {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error('useRealtime must be used inside RealtimeProvider');
  return ctx;
}

/**
 * Subscribe to realtime events of one or more types. Calls `handler`
 * with the event payload whenever any matching event arrives.
 */
export function useRealtimeEvent(types, handler) {
  const { subscribe } = useRealtime();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  const typeList = Array.isArray(types) ? types : [types];
  const key = typeList.join(',');

  useEffect(() => {
    const unsubscribe = subscribe((evt) => {
      if (!evt || !evt.type) return;
      if (typeList.includes(evt.type) || typeList.includes('*')) {
        handlerRef.current?.(evt);
      }
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscribe, key]);
}

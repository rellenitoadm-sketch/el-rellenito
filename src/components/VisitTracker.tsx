'use client';

import { useEffect } from 'react';

/**
 * Fire-and-forget page-visit ping for metrics. One per session (sessionStorage)
 * to avoid inflating counts on re-renders. Never blocks or disrupts the UI.
 */
export default function VisitTracker() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem('rl_visited')) return;
      sessionStorage.setItem('rl_visited', '1');
    } catch { /* private mode — still ping once per load */ }

    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: window.location.pathname, referrer: document.referrer || null }),
      keepalive: true,
    }).catch(() => { /* ignore */ });
  }, []);

  return null;
}

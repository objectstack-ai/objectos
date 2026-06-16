// Native OS notification bridge for ObjectOS One.
//
// Injected into every page of the main webview (alongside update-banner.js).
// Activates only on the Console — where the in-app inbox lives — and only
// inside Tauri. It polls the in-app inbox and, when the window is in the
// background, surfaces each NEW message as a native OS notification (macOS
// Notification Center / Windows toast / Linux libnotify) and badges the dock
// with the count missed while away (cleared on focus).
//
// Source of truth is `sys_inbox_message` (ADR-0030 L5) — the same table the
// Console bell reads. The dedicated `/api/v1/notifications` route isn't mounted
// in this runtime, so we read the canonical inbox object via the data API.
//
// All native work goes through Rust commands (`notify_native`, `set_badge`,
// `notif_request_permission`) via `core.invoke` — matching this app's pattern.
// `withGlobalTauri` only exposes `core`/`event`, NOT the plugin/window JS APIs,
// so we must not call `__TAURI__.notification`/`.window`/`.app` directly.
(function () {
  if (window.__objectosNotifyBridge) return;
  // Only on the Console (its login/app routes live under /_console), and only
  // when the Tauri bridge is present (no-op in a plain browser).
  if (!/\/_console(\/|$)/.test(location.pathname)) return;
  if (!window.__TAURI__ || !window.__TAURI__.core) return;
  window.__objectosNotifyBridge = true;

  var invoke = window.__TAURI__.core.invoke;
  var INBOX_URL = '/api/v1/data/sys_inbox_message?sort=-created_at&limit=25';
  var POLL_MS = 20000;
  var SEEN_KEY = '__objectos_notif_seen_v1';
  var MAX_SEEN = 500;

  var baselined = false; // first successful poll adopts the backlog silently
  var inFlight = false;
  var fatal = false; // inbox object absent → stop
  var unseen = 0; // count surfaced while backgrounded, cleared on focus

  function loadSeen() {
    try {
      return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'));
    } catch (_) {
      return new Set();
    }
  }
  function saveSeen(set) {
    try {
      var arr = Array.from(set);
      if (arr.length > MAX_SEEN) arr = arr.slice(arr.length - MAX_SEEN);
      localStorage.setItem(SEEN_KEY, JSON.stringify(arr));
    } catch (_) {}
  }
  var seen = loadSeen();

  // Surface only when the user isn't actively looking at the window.
  function backgrounded() {
    return document.visibilityState === 'hidden' || !document.hasFocus();
  }

  function notify(title, body) {
    try {
      return invoke('notify_native', { title: title || 'Notification', body: body || '' });
    } catch (_) {}
  }
  function setBadge(count) {
    try {
      return invoke('set_badge', { count: count > 0 ? count : null });
    } catch (_) {}
  }

  // sys_inbox_message → the minimal shape we need for a toast.
  function view(row) {
    return {
      id: row && row.id,
      title: (row && row.title) || (row && row.topic) || 'Notification',
      body: (row && (row.body_md || row.body)) || '',
      createdAt: (row && row.created_at) || '',
    };
  }

  async function poll() {
    if (fatal || inFlight) return;
    inFlight = true;
    try {
      var res = await fetch(INBOX_URL, {
        headers: { accept: 'application/json' },
        credentials: 'same-origin',
      });
      if (res.status === 401) return; // not signed in yet
      if (res.status === 404) { fatal = true; return; } // no inbox object
      if (!res.ok) return;

      var json = await res.json();
      var rows = (json && (json.records || json.items || json.data)) || [];
      // Oldest-first so a burst toasts in chronological order.
      var list = rows
        .map(view)
        .filter(function (v) { return v.id; })
        .sort(function (a, b) {
          return String(a.createdAt).localeCompare(String(b.createdAt));
        });
      var fresh = list.filter(function (v) { return !seen.has(v.id); });
      if (!fresh.length) return;

      if (!baselined) {
        // First poll after a (re)load: adopt existing messages as baseline so
        // we don't replay the backlog as a burst of toasts.
        fresh.forEach(function (v) { seen.add(v.id); });
        baselined = true;
      } else {
        var allowed = backgrounded();
        fresh.forEach(function (v) {
          seen.add(v.id);
          if (allowed) {
            notify(v.title, String(v.body).slice(0, 240));
            unseen += 1;
          }
        });
        if (allowed && unseen > 0) setBadge(unseen);
      }
      saveSeen(seen);
    } catch (_) {
      // transient (offline, mid-navigation) — retry next tick
    } finally {
      inFlight = false;
    }
  }

  function onForeground() {
    // The user is looking now — clear the "missed while away" badge.
    unseen = 0;
    setBadge(0);
    poll();
  }

  // Ask once up front, in the foreground, so the OS prompt isn't sprung from
  // the background.
  try { invoke('notif_request_permission'); } catch (_) {}

  poll();
  setInterval(poll, POLL_MS);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') onForeground();
  });
  window.addEventListener('focus', onForeground);
})();

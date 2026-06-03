// Injected into every page of the main webview. Lets the user see update
// status, progress and prompts even after navigating away from the splash page.
(function () {
  if (window.__objectosUpdateBanner) return;
  window.__objectosUpdateBanner = true;
  if (!window.__TAURI__) return;
  const { event, core } = window.__TAURI__;

  function ensureRoot() {
    let root = document.getElementById('__objectos_update_root');
    if (root) return root;
    root = document.createElement('div');
    root.id = '__objectos_update_root';
    Object.assign(root.style, {
      position: 'fixed',
      right: '16px',
      bottom: '16px',
      maxWidth: '360px',
      zIndex: 2147483647,
      font: '13px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    });
    (document.body || document.documentElement).appendChild(root);
    return root;
  }

  function cardShell() {
    const card = document.createElement('div');
    Object.assign(card.style, {
      background: '#141826',
      color: '#e6e8ee',
      border: '1px solid rgba(110,168,255,0.4)',
      borderRadius: '10px',
      padding: '14px 16px',
      boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
    });
    return card;
  }

  function currentKind() {
    const root = document.getElementById('__objectos_update_root');
    const el = root && root.firstElementChild;
    return el ? el.getAttribute('data-kind') : null;
  }

  function setStatusText(text) {
    const root = document.getElementById('__objectos_update_root');
    if (!root) return;
    const status = root.querySelector('[data-status]');
    if (status) status.textContent = text;
  }

  // Lightweight, non-actionable status toast (e.g. "Checking for updates…").
  // Never overrides the real, actionable update card.
  function showStatus(text) {
    if (currentKind() === 'card') return;
    const root = ensureRoot();
    root.innerHTML = '';
    const card = cardShell();
    card.setAttribute('data-kind', 'status');
    card.innerHTML = `<div data-status style="color:#8b93a7">${text}</div>`;
    root.appendChild(card);
  }

  function clearStatus() {
    if (currentKind() === 'status') {
      const root = document.getElementById('__objectos_update_root');
      if (root) root.remove();
    }
  }

  // The actionable "update available · restart to install" card.
  function render(info) {
    const root = ensureRoot();
    root.innerHTML = '';
    const card = cardShell();
    card.setAttribute('data-kind', 'card');
    card.innerHTML = `
      <div style="font-weight:600;margin-bottom:4px">Update available · v${info.version || '?'}</div>
      <div style="color:#8b93a7;font-size:12px;margin-bottom:10px">
        You're on v${info.current || '?'}. Restart to install.
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button data-act="later" style="background:transparent;color:#8b93a7;border:1px solid #2c3247;border-radius:6px;padding:5px 10px;cursor:pointer">Later</button>
        <button data-act="install" style="background:#6ea8ff;color:#0b0d12;border:0;border-radius:6px;padding:5px 12px;cursor:pointer;font-weight:600">Install &amp; Restart</button>
      </div>
      <div data-status style="color:#8b93a7;font-size:12px;margin-top:8px"></div>
    `;
    root.appendChild(card);
    const status = card.querySelector('[data-status]');
    card.querySelector('[data-act="later"]').onclick = () => {
      root.remove();
    };
    card.querySelector('[data-act="install"]').onclick = async () => {
      status.textContent = 'Starting update…';
      card.querySelectorAll('button').forEach((b) => (b.disabled = true));
      try {
        await core.invoke('install_update');
      } catch (e) {
        status.textContent = 'Failed: ' + e;
        card.querySelectorAll('button').forEach((b) => (b.disabled = false));
      }
    };
  }

  // "Checking for updates…" feedback for the user-initiated menu check.
  event.listen('objectos://update-checking', (e) => {
    if (e.payload) showStatus('Checking for updates…');
    else clearStatus();
  });
  event.listen('objectos://update-available', (e) => render(e.payload || {}));
  event.listen('objectos://update-installing', () => setStatusText('Starting update…'));
  event.listen('objectos://update-progress', (e) => {
    const p = e.payload || {};
    setStatusText(p.pct != null ? `Downloading ${p.pct}%…` : 'Downloading…');
  });
})();

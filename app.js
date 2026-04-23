'use strict';

// ══════════════════════════════════════════════════
//  CONSTANTS
// ══════════════════════════════════════════════════

let pendingEmail = '';

const STATUS_CYCLE = ['To Do', 'In Progress', 'Review', 'Stuck', 'Done'];
const INVOICE_STATUS_CYCLE = ['Pending', 'Paid', 'Overdue'];
const TRACKER_STATUS_CYCLE = ['N/A', 'PASSED', 'FAILED', 'STRUCK', 'IMMUNE', 'RESIGNED', 'DEMOTED'];

const AVATAR_COLORS = [
  '#6366f1','#ec4899','#14b8a6','#f59e0b',
  '#8b5cf6','#0ea5e9','#ef4444','#10b981',
  '#f97316','#3b82f6',
];

const PENCIL_ICON = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ══════════════════════════════════════════════════
//  STATE
// ══════════════════════════════════════════════════

const state = {
  theme: localStorage.getItem('ru_theme') || 'light',
  view: 'overview',

  members: [],

  meetings: [],

  projects: [],

  invoices: [],

  channels: [],
  activeChannel: null,

  trackerMonths: [],
  activeTrackerMonth: null,

  profiles: {},

  // UI flags
  addingTaskTo:  null,
  addingItemTo:  null,
  pendingFiles:  [],
};

// ══════════════════════════════════════════════════
//  UTILITIES
// ══════════════════════════════════════════════════

function getInitials(name) {
  return name.trim().split(/\s+/).map(w => w[0].toUpperCase()).slice(0, 2).join('');
}

function getAvatarColor(name) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h];
}

function daysUntil(dateStr) {
  const today = new Date(); today.setHours(0,0,0,0);
  const target = new Date(dateStr + 'T00:00:00');
  return Math.round((target - today) / 86400000);
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateShort(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatMoney(n) {
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0 });
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function maskEmail(email) {
  const [user, domain] = email.split('@');
  const masked = user.slice(0, 2) + '•••' + (user.length > 3 ? user.slice(-1) : '');
  return masked + '@' + domain;
}

function urgencyClass(deadline) {
  const d = daysUntil(deadline);
  if (d <= 2) return 'urg-urgent';
  if (d <= 7) return 'urg-warning';
  return 'urg-safe';
}

function urgencyLabel(deadline) {
  const d = daysUntil(deadline);
  if (d < 0)  return `${Math.abs(d)}d overdue`;
  if (d === 0) return 'Due today';
  if (d === 1) return 'Tomorrow';
  return `${d} days left`;
}

function statusPillClass(status) {
  const map = {
    'To Do':       'pill-todo',
    'In Progress': 'pill-progress',
    'Review':      'pill-review',
    'Stuck':       'pill-stuck',
    'Done':        'pill-done',
    'Paid':        'pill-paid',
    'Pending':     'pill-pending',
    'Overdue':     'pill-overdue',
  };
  return map[status] || 'pill-todo';
}

function nextStatus(current, cycle) {
  const i = cycle.indexOf(current);
  return cycle[(i + 1) % cycle.length];
}

function trackerStatusPillClass(status) {
  const map = {
    'PASSED':  'pill-tracker-passed',
    'IMMUNE':  'pill-tracker-immune',
    'FAILED':  'pill-tracker-failed',
    'STRUCK':  'pill-tracker-struck',
    'RESIGNED':'pill-tracker-resigned',
    'DEMOTED': 'pill-tracker-demoted',
    'N/A':     'pill-tracker-na',
  };
  return map[status] || 'pill-tracker-na';
}

function trackerRowClass(status) {
  const map = {
    'PASSED':  'tracker-row-passed',
    'IMMUNE':  'tracker-row-immune',
    'FAILED':  'tracker-row-failed',
    'STRUCK':  'tracker-row-struck',
    'RESIGNED':'tracker-row-resigned',
    'DEMOTED': 'tracker-row-demoted',
  };
  return map[status] || '';
}

function trackerStatusSelectClass(status) {
  const map = {
    'PASSED':  'trk-sel-passed',
    'IMMUNE':  'trk-sel-immune',
    'FAILED':  'trk-sel-failed',
    'STRUCK':  'trk-sel-struck',
    'RESIGNED':'trk-sel-resigned',
    'DEMOTED': 'trk-sel-demoted',
    'N/A':     'trk-sel-na',
  };
  return map[status] || 'trk-sel-na';
}

function onTrackerStatusChange(el, entryId, monthId) {
  const status = el.value;
  const allCls = ['trk-sel-passed','trk-sel-immune','trk-sel-failed','trk-sel-struck','trk-sel-resigned','trk-sel-demoted','trk-sel-na'];
  el.classList.remove(...allCls);
  el.classList.add(trackerStatusSelectClass(status));
  const month = state.trackerMonths.find(m => m.id === monthId);
  const entry = month?.entries.find(e => e.id === entryId);
  if (entry) {
    entry.status = status;
    const row = el.closest('tr');
    if (row) {
      row.className = `tracker-entry-row ${trackerRowClass(status)}`;
    }
  }
  api('/api/tracker-entries', 'PATCH', { id: entryId, status }).catch(console.error);
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

// ══════════════════════════════════════════════════
//  THEME
// ══════════════════════════════════════════════════

function applyTheme(theme) {
  state.theme = theme;
  localStorage.setItem('ru_theme', theme);
  document.documentElement.setAttribute('data-theme', theme);
  const btn = document.getElementById('theme-btn');
  if (!btn) return;
  if (theme === 'dark') {
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
  } else {
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
  }
}

function toggleTheme() {
  applyTheme(state.theme === 'light' ? 'dark' : 'light');
}

// ══════════════════════════════════════════════════
//  AUTH
// ══════════════════════════════════════════════════

function getStoredSession() {
  try {
    const raw = localStorage.getItem('ru_session');
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s.access_token || !s.expires_at) return null;
    if (Math.floor(Date.now() / 1000) >= s.expires_at) {
      localStorage.removeItem('ru_session');
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

function initAuth() {
  if (getStoredSession()) {
    enterApp();
    return;
  }

  const continueBtn = document.getElementById('continue-btn');
  const emailInput  = document.getElementById('email-input');
  const backBtn     = document.getElementById('back-btn');

  continueBtn.addEventListener('click', checkEmail);
  emailInput.addEventListener('keydown', e => { if (e.key === 'Enter') checkEmail(); });
  backBtn.addEventListener('click', goBackToEmail);
  initOTP();
}

async function checkEmail() {
  const input = document.getElementById('email-input');
  const error = document.getElementById('email-error');
  const btn   = document.getElementById('continue-btn');
  const val   = input.value.trim().toLowerCase();

  error.classList.remove('show');
  input.style.borderColor = '';
  btn.disabled = true;
  btn.textContent = 'Checking…';

  try {
    const res = await fetch('/api/check-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: val }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      error.textContent = res.status === 403
        ? 'Access denied — email not recognized.'
        : (body.error || 'Something went wrong. Try again.');
      error.classList.add('show');
      input.style.borderColor = 'var(--urgent)';
      input.focus();
      return;
    }

    pendingEmail = val;
    document.getElementById('masked-email').textContent = maskEmail(val);
    document.getElementById('step-email').classList.add('hidden');
    document.getElementById('step-code').classList.remove('hidden');

    setTimeout(() => {
      const boxes = document.querySelectorAll('.otp-box');
      if (boxes[0]) boxes[0].focus();
    }, 50);
  } catch {
    error.textContent = 'Connection error. Please try again.';
    error.classList.add('show');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Continue';
  }
}

function goBackToEmail() {
  document.getElementById('step-code').classList.add('hidden');
  document.getElementById('step-email').classList.remove('hidden');
  document.querySelectorAll('.otp-box').forEach(b => b.value = '');
  document.getElementById('email-input').focus();
}

function initOTP() {
  const row = document.getElementById('otp-row');
  row.addEventListener('input', e => {
    const boxes = [...row.querySelectorAll('.otp-box')];
    const idx = boxes.indexOf(e.target);
    const val = e.target.value;

    // Allow only digits
    e.target.value = val.replace(/\D/g, '').slice(-1);

    if (e.target.value && idx < boxes.length - 1) {
      boxes[idx + 1].focus();
    }

    checkOTPComplete(boxes);
  });

  row.addEventListener('keydown', e => {
    const boxes = [...row.querySelectorAll('.otp-box')];
    const idx = boxes.indexOf(e.target);
    if (e.key === 'Backspace' && !e.target.value && idx > 0) {
      boxes[idx - 1].focus();
    }
    if (e.key === 'ArrowLeft' && idx > 0) boxes[idx - 1].focus();
    if (e.key === 'ArrowRight' && idx < boxes.length - 1) boxes[idx + 1].focus();
  });

  row.addEventListener('paste', e => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g,'').slice(0,8);
    const boxes = [...row.querySelectorAll('.otp-box')];
    text.split('').forEach((ch, i) => { if (boxes[i]) boxes[i].value = ch; });
    const next = boxes[Math.min(text.length, boxes.length - 1)];
    if (next) next.focus();
    checkOTPComplete(boxes);
  });
}

async function checkOTPComplete(boxes) {
  const code = boxes.map(b => b.value).join('');
  if (code.length !== 8 || !/^\d{8}$/.test(code)) return;

  boxes.forEach(b => { b.disabled = true; });
  const hint = document.querySelector('.auth-hint');

  try {
    const res = await fetch('/api/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: pendingEmail, token: code }),
    });

    if (!res.ok) {
      boxes.forEach(b => { b.disabled = false; b.value = ''; });
      boxes[0].focus();
      if (hint) { hint.textContent = 'Incorrect code — try again.'; hint.style.color = 'var(--urgent)'; }
      return;
    }

    const { access_token, expires_at } = await res.json();
    localStorage.setItem('ru_session', JSON.stringify({ access_token, expires_at, email: pendingEmail }));
    enterApp();
  } catch {
    boxes.forEach(b => { b.disabled = false; });
    if (hint) { hint.textContent = 'Connection error — try again.'; hint.style.color = 'var(--urgent)'; }
  }
}

function enterApp() {
  const authScreen = document.getElementById('auth-screen');
  authScreen.classList.add('auth-exit');
  setTimeout(() => {
    authScreen.style.display = 'none';
    initApp();
  }, 280);
}

// ══════════════════════════════════════════════════
//  APP INIT
// ══════════════════════════════════════════════════

async function api(path, method = 'GET', body = null) {
  const session = getStoredSession();
  const headers = { 'Content-Type': 'application/json' };
  if (session) headers['Authorization'] = `Bearer ${session.access_token}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`);
  return res.json();
}

async function initApp() {
  applyTheme(state.theme);
  try {
    const data = await api('/api/data');
    state.projects  = data.projects;
    state.meetings  = data.meetings;
    state.invoices  = data.invoices;
    state.members   = data.members;
    state.channels  = data.channels || [];
    state.activeChannel = state.channels[0]?.id || null;
    state.trackerMonths = data.trackerMonths || [];
    state.activeTrackerMonth = state.trackerMonths[0]?.id || null;
    state.profiles  = data.profiles || {};
  } catch (e) {
    console.error('Failed to load data:', e);
  }
  const app = document.getElementById('app');
  app.classList.remove('app-hidden');
  app.classList.add('app-visible');
  renderTeamList();
  renderSidebarFooter();
  navigate('overview', true);
  bindAppEvents();
}

function bindAppEvents() {
  document.getElementById('theme-btn').addEventListener('click', toggleTheme);

  // Nav clicks
  document.getElementById('sidebar-nav').addEventListener('click', e => {
    const item = e.target.closest('.nav-item');
    if (item) {
      e.preventDefault();
      navigate(item.dataset.view);
    }
  });

  // Modal close on backdrop
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
  });

  // Global delegated events in the main view
  document.getElementById('main').addEventListener('click', handleMainClick);
  document.getElementById('main').addEventListener('change', handleMainChange);

  // Keyboard shortcut: Escape closes modal
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });
}

// ══════════════════════════════════════════════════
//  NAVIGATION
// ══════════════════════════════════════════════════

function navigate(view, skipAnim) {
  state.view = view;
  state.addingTaskTo = null;
  state.addingItemTo = null;

  // Update nav active state
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.view === view);
  });

  const wrap = document.getElementById('view-wrap');
  if (!skipAnim) {
    wrap.style.opacity = '0';
    setTimeout(() => {
      renderView();
      wrap.style.opacity = '1';
      wrap.classList.add('view-enter');
      setTimeout(() => wrap.classList.remove('view-enter'), 300);
    }, 120);
  } else {
    renderView();
    wrap.classList.add('view-enter');
    setTimeout(() => wrap.classList.remove('view-enter'), 300);
  }
}

function renderView() {
  const wrap = document.getElementById('view-wrap');
  const views = {
    overview:   renderOverview,
    projects:   renderProjects,
    meetings:   renderMeetings,
    invoices:   renderInvoices,
    members:    renderMembers,
    statistics: renderStatistics,
    tracker:    renderTracker,
  };
  wrap.innerHTML = (views[state.view] || renderOverview)();
  afterRender();
}

function afterRender() {
  const ti = document.querySelector('.add-task-input');
  if (ti) ti.focus();
  const ii = document.querySelector('.add-item-input');
  if (ii) ii.focus();
  if (state.view === 'statistics') initCharts();
}

// ══════════════════════════════════════════════════
//  SIDEBAR TEAM LIST
// ══════════════════════════════════════════════════

function avatarEl(name, email, size = 28) {
  const url = state.profiles[email];
  if (url) return `<img src="${url}" alt="${name}" class="avatar-img" style="width:${size}px;height:${size}px" />`;
  return `<div class="team-avatar" style="background:${getAvatarColor(name)};width:${size}px;height:${size}px">${getInitials(name)}</div>`;
}

function renderTeamList() {
  const el = document.getElementById('team-list');
  if (!el) return;
  el.innerHTML = state.members.map(m => `
    <div class="team-member-row">
      ${avatarEl(m.name, m.email)}
      <span class="team-member-name">${m.name.split(' ')[0]}</span>
    </div>
  `).join('');
}

function renderSidebarFooter() {
  const el = document.getElementById('sidebar-user-foot');
  if (!el) return;
  const email = getStoredSession()?.email || '';
  const member = state.members.find(m => m.email === email);
  const name = member?.name || email.split('@')[0];
  const url = state.profiles[email];
  const avatar = url
    ? `<img src="${url}" alt="${name}" class="avatar-img" style="width:28px;height:28px" />`
    : `<div class="team-avatar" style="background:${getAvatarColor(name)};width:28px;height:28px;font-size:11px">${getInitials(name)}</div>`;

  el.innerHTML = `
    <div class="sidebar-user">
      ${avatar}
      <span class="sidebar-user-name">${name}</span>
      <button class="sidebar-settings-btn" onclick="openSettingsModal()" title="Settings">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
      </button>
    </div>
  `;
}

// ══════════════════════════════════════════════════
//  STATISTICS PAGE
// ══════════════════════════════════════════════════

function renderStatistics() {
  const channels = state.channels;
  const activeId = state.activeChannel;
  const active = channels.find(c => c.id === activeId) || channels[0] || null;

  return `
    <div class="page-header">
      <div class="page-title-block">
        <h1 class="page-title">Statistics</h1>
      </div>
      <button class="btn-primary btn-sm" data-action="new-channel">+ New Channel</button>
    </div>

    ${channels.length === 0
      ? `<div class="empty-state"><div class="empty-state-icon">📊</div><p class="empty-state-text">No channels yet. Create one to start tracking statistics.</p></div>`
      : `
        <div class="channel-tabs">
          ${channels.map(c => `
            <button class="channel-tab ${c.id === (active?.id) ? 'active' : ''}" data-action="select-channel" data-channel-id="${c.id}">
              ${c.name}
              <span class="channel-tab-close" data-action="delete-channel" data-channel-id="${c.id}">✕</span>
            </button>
          `).join('')}
        </div>
        ${active ? renderChannelContent(active) : ''}
      `
    }
  `;
}

function renderChannelContent(channel) {
  return `
    <div class="channel-content">
      <div class="channel-content-header">
        <span class="channel-content-title">${channel.name}</span>
        <button class="btn-ghost btn-sm" data-action="new-chart" data-channel-id="${channel.id}">+ Add Chart</button>
      </div>
      ${channel.charts.length === 0
        ? `<div class="empty-state"><div class="empty-state-icon">📈</div><p class="empty-state-text">No charts yet. Add one to visualize your data.</p></div>`
        : `<div class="charts-grid">${channel.charts.map(ch => renderChartCard(ch, channel.id)).join('')}</div>`
      }
    </div>
  `;
}

function renderChartCard(chart, channelId) {
  return `
    <div class="chart-card">
      <div class="chart-card-header">
        <span class="chart-card-title">${chart.title}</span>
        <div class="chart-card-actions">
          <button class="icon-btn" data-action="edit-chart" data-channel-id="${channelId}" data-chart-id="${chart.id}" title="Edit">${PENCIL_ICON}</button>
          <button class="icon-btn" data-action="duplicate-chart" data-channel-id="${channelId}" data-chart-id="${chart.id}" title="Duplicate">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>
          <button class="delete-btn" data-action="delete-chart" data-channel-id="${channelId}" data-chart-id="${chart.id}" title="Delete">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
      </div>
      <div class="chart-canvas-wrap">
        <canvas id="chart-${chart.id}" data-chart-id="${chart.id}" data-chart-type="${chart.chartType}"></canvas>
      </div>
    </div>
  `;
}

function initCharts() {
  if (typeof Chart === 'undefined') return;
  const PALETTE = ['#6366f1','#ec4899','#14b8a6','#f59e0b','#8b5cf6','#0ea5e9','#ef4444','#10b981','#f97316','#3b82f6'];

  document.querySelectorAll('canvas[data-chart-id]').forEach(canvas => {
    const chartId = canvas.dataset.chartId;
    let chartData = null;
    for (const ch of state.channels) {
      chartData = ch.charts.find(c => c.id === chartId);
      if (chartData) break;
    }
    if (!chartData || !chartData.data.length) return;

    const isTimeline = chartData.chartType === 'timeline';
    const renderType = isTimeline ? 'line' : (chartData.chartType || 'bar');
    const type = renderType;
    const isRound = type === 'pie' || type === 'doughnut';

    const sorted = isTimeline
      ? [...chartData.data].sort((a, b) => a.label.localeCompare(b.label))
      : chartData.data;

    const labels = sorted.map(d => {
      if (isTimeline) {
        const [yr, mo] = d.label.split('-');
        return (MONTHS_SHORT[parseInt(mo) - 1] || mo) + ' ' + yr;
      }
      return d.label;
    });
    const values = sorted.map(d => d.value);

    new Chart(canvas, {
      type,
      data: {
        labels,
        datasets: [{
          label: chartData.title,
          data: values,
          backgroundColor: isRound
            ? labels.map((_, i) => PALETTE[i % PALETTE.length])
            : type === 'line' ? 'rgba(99,102,241,0.1)' : PALETTE[0],
          borderColor: isRound
            ? labels.map((_, i) => PALETTE[i % PALETTE.length])
            : type === 'line' ? '#6366f1' : PALETTE[0],
          borderWidth: 2,
          tension: 0.4,
          fill: type === 'line',
          hoverOffset: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: isRound, position: 'bottom' } },
        scales: isRound ? {} : {
          y: { beginAtZero: true, grid: { color: 'rgba(128,128,128,0.1)' } },
          x: { grid: { display: false } },
        },
      },
    });
  });
}

// ══════════════════════════════════════════════════
//  TRACKER PAGE
// ══════════════════════════════════════════════════

function renderTracker() {
  const months = state.trackerMonths;
  const activeId = state.activeTrackerMonth;
  const active = months.find(m => m.id === activeId) || months[0] || null;

  return `
    <div class="page-header">
      <div class="page-title-block">
        <h1 class="page-title">Tracker</h1>
      </div>
      <button class="btn-primary btn-sm" data-action="new-tracker-month">+ New Month</button>
    </div>

    ${months.length === 0
      ? `<div class="empty-state"><div class="empty-state-icon">📋</div><p class="empty-state-text">No months yet. Create one to start tracking staff.</p></div>`
      : `
        <div class="channel-tabs">
          ${months.map(m => `
            <button class="channel-tab ${m.id === (active?.id) ? 'active' : ''}" data-action="select-tracker-month" data-month-id="${m.id}">
              ${m.name}
              <span class="channel-tab-close" data-action="delete-tracker-month" data-month-id="${m.id}">✕</span>
            </button>
          `).join('')}
        </div>
        ${active ? renderTrackerMonthContent(active) : ''}
      `
    }
  `;
}

function renderTrackerMonthContent(month) {
  return `
    <div class="channel-content">
      <div class="channel-content-header">
        <span class="channel-content-title">${month.name}</span>
        <button class="btn-ghost btn-sm" data-action="new-tracker-entry" data-month-id="${month.id}">+ Add Entry</button>
      </div>
      ${month.entries.length === 0
        ? `<div class="empty-state"><div class="empty-state-icon">👤</div><p class="empty-state-text">No entries yet. Add staff members to start tracking.</p></div>`
        : `
          <div class="tracker-table-wrap">
            <table class="tracker-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Roblox ID</th>
                  <th>Dept</th>
                  <th title="Observations">Obs</th>
                  <th title="Playtime (hrs)">PT</th>
                  <th title="Applications">Apps</th>
                  <th title="Appeals">Apls</th>
                  <th title="Banishments">Bans</th>
                  <th title="Staff Reports">SR</th>
                  <th title="Staff Meetings">SM</th>
                  <th title="Messages">Msgs</th>
                  <th title="Strikes">Str</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${month.entries.map(e => renderTrackerEntry(e, month.id)).join('')}
              </tbody>
            </table>
          </div>
        `
      }
    </div>
  `;
}

function renderTrackerEntry(entry, monthId) {
  const rowCls = trackerRowClass(entry.status);
  const hasNotes = !!(entry.notes && entry.notes.trim());
  return `
    <tr class="tracker-entry-row ${rowCls}">
      <td class="tracker-username">${entry.username}</td>
      <td class="text-muted text-sm tracker-mono">${entry.robloxId || '—'}</td>
      <td>${entry.department
        ? `<span class="tracker-dept-badge">${entry.department}</span>`
        : `<span class="text-muted">—</span>`}</td>
      <td class="tracker-num">${entry.observations}</td>
      <td class="tracker-num">${entry.playtime}</td>
      <td class="tracker-num">${entry.applications}</td>
      <td class="tracker-num">${entry.appeals}</td>
      <td class="tracker-num">${entry.banishments}</td>
      <td class="tracker-num">${entry.staffReports}</td>
      <td class="tracker-num">${entry.staffMeetings}</td>
      <td class="tracker-num">${entry.messages}</td>
      <td class="tracker-num">${entry.strikes}</td>
      <td>
        <select class="tracker-status-select ${trackerStatusSelectClass(entry.status)}"
                onchange="onTrackerStatusChange(this,'${entry.id}','${monthId}')">
          ${TRACKER_STATUS_CYCLE.map(s => `<option value="${s}" ${entry.status === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </td>
      <td>
        <button class="tracker-notes-btn ${hasNotes ? 'has-notes' : ''}"
                data-action="tracker-notes"
                data-entry-id="${entry.id}"
                data-month-id="${monthId}"
                title="${hasNotes ? 'View notes' : 'Add notes'}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
        </button>
      </td>
      <td style="white-space:nowrap">
        <button class="icon-btn" data-action="edit-tracker-entry" data-entry-id="${entry.id}" data-month-id="${monthId}" title="Edit">${PENCIL_ICON}</button>
        <button class="delete-btn" data-action="delete-tracker-entry" data-entry-id="${entry.id}" data-month-id="${monthId}" title="Remove">×</button>
      </td>
    </tr>
  `;
}

// ══════════════════════════════════════════════════
//  OVERVIEW PAGE
// ══════════════════════════════════════════════════

function renderOverview() {
  const priorities = getPriorityItems();
  const recentTasks = getRecentTasks(6);
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return `
    <div class="page-header">
      <div class="page-title-block">
        <h1 class="page-title">Overview</h1>
        <p class="page-date">${today}</p>
      </div>
    </div>

    <div class="section-gap">
      <div class="section-label">High Priorities</div>
      ${priorities.length === 0
        ? `<div class="empty-state"><div class="empty-state-icon">✓</div><p class="empty-state-text">No high-priority items. You're on track.</p></div>`
        : `<div class="priority-grid">${priorities.map(renderPriorityCard).join('')}</div>`
      }
    </div>

    <div>
      <div class="section-label">Recent Tasks</div>
      ${recentTasks.length === 0
        ? `<div class="empty-state"><div class="empty-state-icon">📋</div><p class="empty-state-text">No tasks yet.</p></div>`
        : `<div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th style="width:32px"></th>
                  <th>Task</th>
                  <th>Project</th>
                  <th>Status</th>
                  <th>Due Date</th>
                </tr>
              </thead>
              <tbody>
                ${recentTasks.map(t => `
                  <tr>
                    <td>
                      <div class="check-box ${t.done ? 'checked' : ''}"
                           data-action="toggle-task-overview"
                           data-project-id="${t.projectId}"
                           data-task-id="${t.id}"></div>
                    </td>
                    <td><span class="task-name-text ${t.done ? 'done' : ''}">${t.name}</span></td>
                    <td class="text-muted">${t.projectName}</td>
                    <td><span class="status-pill ${statusPillClass(t.status)}" data-action="cycle-status-overview" data-project-id="${t.projectId}" data-task-id="${t.id}">${t.status}</span></td>
                    <td class="text-muted text-sm">${formatDateShort(t.dueDate)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>`
      }
    </div>
  `;
}

function getPriorityItems() {
  const items = [];
  for (const m of state.meetings) {
    for (const item of m.items) {
      if (item.hasTimeline && item.deadline) {
        items.push({ ...item, meetingTitle: m.title, meetingId: m.id });
      }
    }
  }
  return items.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
}

function renderPriorityCard(item) {
  const urg = urgencyClass(item.deadline);
  const label = urgencyLabel(item.deadline);
  return `
    <div class="priority-card ${urg}">
      <div class="priority-card-name">${item.name}</div>
      <div class="priority-card-meta">From: ${item.meetingTitle}</div>
      <div class="priority-card-footer">
        <span class="priority-date">${formatDateShort(item.deadline)}</span>
        <span class="urgency-badge ${urg}">${label}</span>
      </div>
    </div>
  `;
}

function getRecentTasks(n) {
  const tasks = [];
  for (const p of state.projects) {
    for (const t of p.tasks) {
      tasks.push({ ...t, projectId: p.id, projectName: p.name });
    }
  }
  return tasks.slice(-n).reverse();
}

// ══════════════════════════════════════════════════
//  PROJECTS PAGE
// ══════════════════════════════════════════════════

function renderProjects() {
  return `
    <div class="page-header">
      <div class="page-title-block">
        <h1 class="page-title">Projects</h1>
      </div>
      <button class="btn-primary" data-action="new-project">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        New Project
      </button>
    </div>
    ${state.projects.length === 0
      ? `<div class="empty-state"><div class="empty-state-icon">📁</div><p class="empty-state-text">No projects yet. Create one to get started.</p></div>`
      : state.projects.map(renderProjectGroup).join('')
    }
  `;
}

function renderProjectGroup(project) {
  const isAdding = state.addingTaskTo === project.id;
  const rows = project.tasks.map(t => `
    <tr>
      <td style="width:32px">
        <div class="check-box ${t.done ? 'checked' : ''}"
             data-action="toggle-task"
             data-project-id="${project.id}"
             data-task-id="${t.id}"></div>
      </td>
      <td>
        <span class="task-name-text ${t.done ? 'done' : ''}">${t.name}</span>
      </td>
      <td>
        <span class="status-pill ${statusPillClass(t.status)}"
              data-action="cycle-status"
              data-project-id="${project.id}"
              data-task-id="${t.id}">${t.status}</span>
      </td>
      <td class="text-muted text-sm">${formatDateShort(t.dueDate)}</td>
      <td style="width:56px;text-align:right">
        <button class="icon-btn" data-action="edit-task" data-project-id="${project.id}" data-task-id="${t.id}" title="Edit task">${PENCIL_ICON}</button>
        <button class="delete-btn" data-action="delete-task" data-project-id="${project.id}" data-task-id="${t.id}" title="Delete task">×</button>
      </td>
    </tr>
  `).join('');

  const addRow = isAdding ? `
    <tr class="add-task-row">
      <td colspan="4">
        <div class="add-task-inline">
          <input class="inline-input add-task-input"
                 type="text"
                 placeholder="Task name…"
                 data-project-id="${project.id}" />
          <input class="inline-date add-task-date"
                 type="date"
                 value="${todayISO()}"
                 data-project-id="${project.id}" />
          <button class="btn-primary btn-sm" data-action="confirm-add-task" data-project-id="${project.id}">Add</button>
          <button class="btn-ghost btn-sm"   data-action="cancel-add-task"  data-project-id="${project.id}">Cancel</button>
        </div>
      </td>
    </tr>
  ` : '';

  const addTrigger = !isAdding ? `
    <button class="add-task-trigger" data-action="start-add-task" data-project-id="${project.id}">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Add task
    </button>
  ` : '';

  return `
    <div class="project-group">
      <div class="project-group-header">
        <span class="project-group-name">${project.name}</span>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="project-count">${project.tasks.length} task${project.tasks.length !== 1 ? 's' : ''}</span>
          <button class="icon-btn" data-action="edit-project" data-project-id="${project.id}" title="Edit project">${PENCIL_ICON}</button>
          <button class="delete-btn" data-action="delete-project" data-project-id="${project.id}" title="Delete project">×</button>
        </div>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width:32px"></th>
              <th>Task</th>
              <th>Status</th>
              <th>Due Date</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
            ${addRow}
          </tbody>
        </table>
        ${addTrigger}
      </div>
    </div>
  `;
}

// ══════════════════════════════════════════════════
//  MEETINGS PAGE
// ══════════════════════════════════════════════════

function renderMeetings() {
  return `
    <div class="page-header">
      <div class="page-title-block">
        <h1 class="page-title">Meetings</h1>
      </div>
    </div>
    ${state.meetings.length === 0
      ? `<div class="empty-state"><div class="empty-state-icon">📅</div><p class="empty-state-text">No meetings yet. Create one using the sidebar button.</p></div>`
      : state.meetings.map(renderMeetingCard).join('')
    }
  `;
}

function renderMeetingCard(meeting) {
  const doneCount = meeting.items.filter(i => i.done).length;
  const isAdding = state.addingItemTo === meeting.id;

  const agendaItems = meeting.items.map(item => {
    const deadlineBadge = item.hasTimeline && item.deadline
      ? `<span class="deadline-badge ${urgencyClass(item.deadline)}"
               data-action="open-timeline"
               data-meeting-id="${meeting.id}"
               data-item-id="${item.id}">
           📅 ${formatDateShort(item.deadline)} · ${urgencyLabel(item.deadline)}
         </span>`
      : '';

    return `
      <div class="agenda-item">
        <div class="check-box ${item.done ? 'checked' : ''}"
             data-action="toggle-meeting-item"
             data-meeting-id="${meeting.id}"
             data-item-id="${item.id}"></div>
        <span class="agenda-item-name ${item.done ? 'done' : ''}">${item.name}</span>
        ${deadlineBadge}
        <button class="icon-btn" data-action="edit-item" data-meeting-id="${meeting.id}" data-item-id="${item.id}" title="Edit item">${PENCIL_ICON}</button>
        <button class="delete-btn" data-action="delete-item" data-meeting-id="${meeting.id}" data-item-id="${item.id}" title="Delete item">×</button>
        <div class="timeline-toggle ${item.hasTimeline ? 'has-timeline' : ''}"
             data-action="toggle-timeline"
             data-meeting-id="${meeting.id}"
             data-item-id="${item.id}">
          <div class="timeline-tick"></div>
          <span>Timeline</span>
        </div>
      </div>
    `;
  }).join('');

  const addItemRow = isAdding ? `
    <div class="add-item-row">
      <input class="inline-input add-item-input"
             type="text"
             placeholder="Agenda item…"
             data-meeting-id="${meeting.id}" />
      <button class="btn-primary btn-sm" data-action="confirm-add-item" data-meeting-id="${meeting.id}">Add</button>
      <button class="btn-ghost btn-sm"   data-action="cancel-add-item"  data-meeting-id="${meeting.id}">Cancel</button>
    </div>
  ` : `
    <div class="meeting-actions">
      <button class="add-item-trigger" data-action="start-add-item" data-meeting-id="${meeting.id}">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add item
      </button>
    </div>
  `;

  return `
    <div class="meeting-card">
      <div class="meeting-header" data-action="toggle-meeting" data-meeting-id="${meeting.id}">
        <div class="meeting-header-left">
          <svg class="meeting-chevron ${meeting.expanded ? 'open' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
          <span class="meeting-title">${meeting.title}</span>
          <span class="meeting-date-chip">${formatDateShort(meeting.date)}</span>
        </div>
        <div style="display:flex;align-items:center;gap:12px">
          <span class="meeting-item-count">${doneCount}/${meeting.items.length} done</span>
          <button class="icon-btn" data-action="edit-meeting" data-meeting-id="${meeting.id}" title="Edit meeting">${PENCIL_ICON}</button>
          <button class="delete-btn" data-action="delete-meeting" data-meeting-id="${meeting.id}" title="Delete meeting">×</button>
        </div>
      </div>
      <div class="meeting-body ${meeting.expanded ? 'open' : ''}">
        ${meeting.items.length === 0 && !isAdding
          ? `<p class="text-muted text-sm" style="padding:8px 0">No agenda items yet.</p>`
          : agendaItems
        }
        ${addItemRow}
      </div>
    </div>
  `;
}

// ══════════════════════════════════════════════════
//  INVOICES PAGE
// ══════════════════════════════════════════════════

function renderInvoices() {
  const total    = state.invoices.length;
  const paid     = state.invoices.filter(i => i.status === 'Paid').length;
  const outstanding = state.invoices.filter(i => i.status !== 'Paid').length;
  const totalVal = state.invoices.reduce((s, i) => s + Number(i.amount), 0);

  const rows = state.invoices.map(inv => {
    const paidByMember = state.members.find(m => m.id === inv.paidBy);
    return `
    <tr>
      <td><strong>${inv.recipient}</strong></td>
      <td class="font-mono">${formatMoney(inv.amount)}</td>
      <td class="text-muted">${inv.reason}</td>
      <td class="text-muted text-sm">${formatDateShort(inv.date)}</td>
      <td class="text-muted">${paidByMember ? paidByMember.name : '—'}</td>
      <td>
        <span class="status-pill ${statusPillClass(inv.status)}"
              data-action="cycle-invoice-status"
              data-invoice-id="${inv.id}">${inv.status}</span>
      </td>
      <td>
        <button class="attach-btn"
                data-action="view-attachments"
                data-invoice-id="${inv.id}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
          ${inv.attachments.length > 0 ? inv.attachments.length : 'Attach'}
        </button>
      </td>
      <td style="width:56px">
        <button class="icon-btn" data-action="edit-invoice" data-invoice-id="${inv.id}" title="Edit invoice">${PENCIL_ICON}</button>
        <button class="delete-btn" data-action="delete-invoice" data-invoice-id="${inv.id}" title="Delete invoice">×</button>
      </td>
    </tr>
  `; }).join('');

  return `
    <div class="page-header">
      <div class="page-title-block">
        <h1 class="page-title">Invoices</h1>
      </div>
      <button class="btn-primary" data-action="new-invoice">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        New Invoice
      </button>
    </div>

    <div class="summary-bar">
      <div class="summary-item">
        <div class="summary-item-label">Total Invoices</div>
        <div class="summary-item-value">${total}</div>
      </div>
      <div class="summary-item">
        <div class="summary-item-label">Paid</div>
        <div class="summary-item-value paid">${paid}</div>
      </div>
      <div class="summary-item">
        <div class="summary-item-label">Outstanding</div>
        <div class="summary-item-value owed">${outstanding}</div>
      </div>
      <div class="summary-item">
        <div class="summary-item-label">Total Value</div>
        <div class="summary-item-value">${formatMoney(totalVal)}</div>
      </div>
    </div>

    ${state.invoices.length === 0
      ? `<div class="empty-state"><div class="empty-state-icon">🧾</div><p class="empty-state-text">No invoices yet.</p></div>`
      : `<div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Recipient</th>
                <th>Amount</th>
                <th>Reason</th>
                <th>Date</th>
                <th>Paid By</th>
                <th>Status</th>
                <th>Attachments</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`
    }
  `;
}

// ══════════════════════════════════════════════════
//  MEMBERS PAGE
// ══════════════════════════════════════════════════

function renderMembers() {
  const cards = state.members.map(m => `
    <div class="member-card">
      <div class="member-card-actions">
        <button class="icon-btn" data-action="edit-member" data-member-id="${m.id}" title="Edit member">${PENCIL_ICON}</button>
        <button class="delete-btn member-delete-btn" data-action="delete-member" data-member-id="${m.id}" title="Remove member">×</button>
      </div>
      ${state.profiles[m.email]
        ? `<img src="${state.profiles[m.email]}" alt="${m.name}" class="member-avatar avatar-img" />`
        : `<div class="member-avatar" style="background:${getAvatarColor(m.name)}">${getInitials(m.name)}</div>`}
      <div class="member-name">${m.name}</div>
      <div class="member-role-pill">${m.role}</div>
      <div class="member-meta">
        <div>${m.email}</div>
        <div>Joined ${formatDateShort(m.joinDate)}</div>
      </div>
    </div>
  `).join('');

  const isAdmin = getStoredSession()?.email === 'alverzalexander0@gmail.com';
  return `
    <div class="page-header">
      <div class="page-title-block">
        <h1 class="page-title">Members</h1>
        <p class="page-date">${state.members.length} member${state.members.length !== 1 ? 's' : ''}</p>
      </div>
      ${isAdmin ? `
      <button class="btn-primary" data-action="invite-member">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Invite Member
      </button>` : ''}
    </div>
    <div class="members-grid">${cards}</div>
  `;
}

// ══════════════════════════════════════════════════
//  EVENT HANDLING
// ══════════════════════════════════════════════════

async function handleMainClick(e) {
  const el = e.target.closest('[data-action]');
  if (!el) return;

  const action = el.dataset.action;
  const pid   = el.dataset.projectId  || null;
  const tid   = el.dataset.taskId     || null;
  const mid   = el.dataset.meetingId  || null;
  const iid    = el.dataset.itemId     || null;
  const invId  = el.dataset.invoiceId  || null;
  const chanId = el.dataset.channelId  || null;
  const chartId = el.dataset.chartId   || null;

  switch (action) {

    case 'toggle-task':
    case 'toggle-task-overview': {
      const proj = state.projects.find(p => p.id === pid);
      const task = proj?.tasks.find(t => t.id === tid);
      if (task) {
        task.done = !task.done;
        if (task.done) task.status = 'Done';
        renderView();
        api('/api/tasks', 'PATCH', { id: tid, done: task.done, status: task.status }).catch(console.error);
      }
      break;
    }

    case 'cycle-status':
    case 'cycle-status-overview': {
      const proj = state.projects.find(p => p.id === pid);
      const task = proj?.tasks.find(t => t.id === tid);
      if (task) {
        task.status = nextStatus(task.status, STATUS_CYCLE);
        task.done = task.status === 'Done';
        renderView();
        api('/api/tasks', 'PATCH', { id: tid, done: task.done, status: task.status }).catch(console.error);
      }
      break;
    }

    case 'start-add-task': {
      state.addingTaskTo = pid;
      renderView();
      break;
    }

    case 'confirm-add-task': {
      const nameEl = document.querySelector(`.add-task-input[data-project-id="${pid}"]`);
      const dateEl = document.querySelector(`.add-task-date[data-project-id="${pid}"]`);
      const name = nameEl?.value.trim();
      if (!name) { if (nameEl) nameEl.focus(); return; }
      const proj = state.projects.find(p => p.id === pid);
      if (proj) {
        try {
          const task = await api('/api/tasks', 'POST', { projectId: pid, name, dueDate: dateEl?.value || null });
          proj.tasks.push(task);
        } catch (e) { console.error(e); }
      }
      state.addingTaskTo = null;
      renderView();
      break;
    }

    case 'cancel-add-task': {
      state.addingTaskTo = null;
      renderView();
      break;
    }

    case 'toggle-meeting': {
      const meeting = state.meetings.find(m => m.id === mid);
      if (meeting) {
        meeting.expanded = !meeting.expanded;
        renderView();
      }
      break;
    }

    case 'toggle-meeting-item': {
      const meeting = state.meetings.find(m => m.id === mid);
      const item = meeting?.items.find(i => i.id === iid);
      if (item) {
        item.done = !item.done;
        renderView();
        api('/api/items', 'PATCH', { id: iid, done: item.done }).catch(console.error);
      }
      break;
    }

    case 'toggle-timeline': {
      const meeting = state.meetings.find(m => m.id === mid);
      const item = meeting?.items.find(i => i.id === iid);
      if (!item) return;
      if (item.hasTimeline) {
        item.hasTimeline = false;
        item.deadline = null;
        renderView();
        api('/api/items', 'PATCH', { id: iid, hasTimeline: false, deadline: null }).catch(console.error);
      } else {
        openTimelineModal(mid, iid);
      }
      break;
    }

    case 'open-timeline': {
      openTimelineModal(mid, iid);
      break;
    }

    case 'start-add-item': {
      const meeting = state.meetings.find(m => m.id === mid);
      if (meeting && !meeting.expanded) { meeting.expanded = true; }
      state.addingItemTo = mid;
      renderView();
      break;
    }

    case 'confirm-add-item': {
      const nameEl = document.querySelector(`.add-item-input[data-meeting-id="${mid}"]`);
      const name = nameEl?.value.trim();
      if (!name) { if (nameEl) nameEl.focus(); return; }
      const meeting = state.meetings.find(m => m.id === mid);
      if (meeting) {
        try {
          const item = await api('/api/items', 'POST', { meetingId: mid, name });
          meeting.items.push(item);
        } catch (e) { console.error(e); }
      }
      state.addingItemTo = null;
      renderView();
      break;
    }

    case 'cancel-add-item': {
      state.addingItemTo = null;
      renderView();
      break;
    }

    case 'cycle-invoice-status': {
      const inv = state.invoices.find(i => i.id === invId);
      if (inv) {
        inv.status = nextStatus(inv.status, INVOICE_STATUS_CYCLE);
        renderView();
        api('/api/invoices', 'PATCH', { id: invId, status: inv.status }).catch(console.error);
      }
      break;
    }

    case 'view-attachments': {
      openAttachmentModal(invId);
      break;
    }

    case 'new-invoice': {
      openNewInvoiceModal();
      break;
    }

    case 'invite-member': {
      openInviteModal();
      break;
    }

    case 'new-project': {
      openNewProjectModal();
      break;
    }

    case 'delete-task': {
      const proj = state.projects.find(p => p.id === pid);
      const task = proj?.tasks.find(t => t.id === tid);
      if (!task) return;
      openDeleteConfirm(`Delete task "${task.name}"?`, async () => {
        proj.tasks = proj.tasks.filter(t => t.id !== tid);
        renderView();
        api('/api/tasks', 'DELETE', { id: tid }).catch(console.error);
      });
      break;
    }

    case 'delete-project': {
      const proj = state.projects.find(p => p.id === pid);
      if (!proj) return;
      openDeleteConfirm(`Delete project "${proj.name}" and all its tasks?`, async () => {
        state.projects = state.projects.filter(p => p.id !== pid);
        renderView();
        api('/api/projects', 'DELETE', { id: pid }).catch(console.error);
      });
      break;
    }

    case 'delete-meeting': {
      const meeting = state.meetings.find(m => m.id === mid);
      if (!meeting) return;
      openDeleteConfirm(`Delete meeting "${meeting.title}"?`, async () => {
        state.meetings = state.meetings.filter(m => m.id !== mid);
        renderView();
        api('/api/meetings', 'DELETE', { id: mid }).catch(console.error);
      });
      break;
    }

    case 'delete-item': {
      const meeting = state.meetings.find(m => m.id === mid);
      const item = meeting?.items.find(i => i.id === iid);
      if (!item) return;
      openDeleteConfirm(`Delete item "${item.name}"?`, async () => {
        meeting.items = meeting.items.filter(i => i.id !== iid);
        renderView();
        api('/api/items', 'DELETE', { id: iid }).catch(console.error);
      });
      break;
    }

    case 'delete-invoice': {
      const inv = state.invoices.find(i => i.id === invId);
      if (!inv) return;
      openDeleteConfirm(`Delete invoice for "${inv.recipient}"?`, async () => {
        state.invoices = state.invoices.filter(i => i.id !== invId);
        renderView();
        api('/api/invoices', 'DELETE', { id: invId }).catch(console.error);
      });
      break;
    }

    case 'delete-member': {
      const memberId = el.dataset.memberId || null;
      const member = state.members.find(m => m.id === memberId);
      if (!member) return;
      openDeleteConfirm(`Remove member "${member.name}"?`, async () => {
        state.members = state.members.filter(m => m.id !== memberId);
        renderTeamList();
        renderView();
        api('/api/members', 'DELETE', { id: memberId }).catch(console.error);
      });
      break;
    }

    case 'edit-project': {
      const proj = state.projects.find(p => p.id === pid);
      if (proj) openEditProjectModal(proj);
      break;
    }

    case 'edit-task': {
      const proj = state.projects.find(p => p.id === pid);
      const task = proj?.tasks.find(t => t.id === tid);
      if (task) openEditTaskModal(proj, task);
      break;
    }

    case 'edit-meeting': {
      const meeting = state.meetings.find(m => m.id === mid);
      if (meeting) openEditMeetingModal(meeting);
      break;
    }

    case 'edit-item': {
      const meeting = state.meetings.find(m => m.id === mid);
      const item = meeting?.items.find(i => i.id === iid);
      if (item) openEditItemModal(meeting, item);
      break;
    }

    case 'edit-invoice': {
      const inv = state.invoices.find(i => i.id === invId);
      if (inv) openEditInvoiceModal(inv);
      break;
    }

    case 'edit-member': {
      const memberId = el.dataset.memberId || null;
      const member = state.members.find(m => m.id === memberId);
      if (member) openEditMemberModal(member);
      break;
    }

    case 'edit-chart': {
      const ch = state.channels.find(c => c.id === chanId);
      const chart = ch?.charts.find(c => c.id === chartId);
      if (chart) openEditChartModal(ch, chart);
      break;
    }

    case 'new-channel': {
      openNewChannelModal();
      break;
    }

    case 'select-channel': {
      state.activeChannel = chanId;
      renderView();
      break;
    }

    case 'delete-channel': {
      const ch = state.channels.find(c => c.id === chanId);
      if (!ch) return;
      openDeleteConfirm(`Delete channel "${ch.name}" and all its charts?`, async () => {
        state.channels = state.channels.filter(c => c.id !== chanId);
        if (state.activeChannel === chanId) state.activeChannel = state.channels[0]?.id || null;
        renderView();
        api('/api/channels', 'DELETE', { id: chanId }).catch(console.error);
      });
      break;
    }

    case 'new-chart': {
      openNewChartModal(chanId);
      break;
    }

    case 'duplicate-chart': {
      const srcChannel = state.channels.find(c => c.id === chanId);
      const srcChart = srcChannel?.charts.find(c => c.id === chartId);
      if (!srcChart) return;
      try {
        const copy = await api('/api/charts', 'POST', {
          channelId: chanId,
          title: srcChart.title + ' (copy)',
          chartType: srcChart.chartType,
          data: srcChart.data,
        });
        srcChannel.charts.push(copy);
      } catch (e) { console.error(e); }
      renderView();
      break;
    }

    case 'delete-chart': {
      const chartChannel = state.channels.find(c => c.id === chanId);
      const chart = chartChannel?.charts.find(c => c.id === chartId);
      if (!chart) return;
      openDeleteConfirm(`Delete chart "${chart.title}"?`, async () => {
        chartChannel.charts = chartChannel.charts.filter(c => c.id !== chartId);
        renderView();
        api('/api/charts', 'DELETE', { id: chartId }).catch(console.error);
      });
      break;
    }

    case 'new-tracker-month': {
      openNewTrackerMonthModal();
      break;
    }

    case 'select-tracker-month': {
      state.activeTrackerMonth = el.dataset.monthId;
      renderView();
      break;
    }

    case 'delete-tracker-month': {
      const trkMonthId = el.dataset.monthId;
      const trkMonth = state.trackerMonths.find(m => m.id === trkMonthId);
      if (!trkMonth) return;
      e.stopPropagation();
      openDeleteConfirm(`Delete "${trkMonth.name}" and all its entries?`, async () => {
        state.trackerMonths = state.trackerMonths.filter(m => m.id !== trkMonthId);
        if (state.activeTrackerMonth === trkMonthId) state.activeTrackerMonth = state.trackerMonths[0]?.id || null;
        renderView();
        api('/api/tracker-months', 'DELETE', { id: trkMonthId }).catch(console.error);
      });
      break;
    }

    case 'new-tracker-entry': {
      openNewTrackerEntryModal(el.dataset.monthId);
      break;
    }

    case 'edit-tracker-entry': {
      const trkMid = el.dataset.monthId;
      const trkEid = el.dataset.entryId;
      const trkMo = state.trackerMonths.find(m => m.id === trkMid);
      const trkEn = trkMo?.entries.find(e => e.id === trkEid);
      if (trkEn && trkMo) openEditTrackerEntryModal(trkEn, trkMo);
      break;
    }

    case 'delete-tracker-entry': {
      const trkMid = el.dataset.monthId;
      const trkEid = el.dataset.entryId;
      const trkMo = state.trackerMonths.find(m => m.id === trkMid);
      const trkEn = trkMo?.entries.find(e => e.id === trkEid);
      if (!trkEn) return;
      openDeleteConfirm(`Remove "${trkEn.username}" from ${trkMo.name}?`, async () => {
        trkMo.entries = trkMo.entries.filter(e => e.id !== trkEid);
        renderView();
        api('/api/tracker-entries', 'DELETE', { id: trkEid }).catch(console.error);
      });
      break;
    }

    case 'tracker-notes': {
      const trkMid = el.dataset.monthId;
      const trkEid = el.dataset.entryId;
      const trkMo = state.trackerMonths.find(m => m.id === trkMid);
      const trkEn = trkMo?.entries.find(e => e.id === trkEid);
      if (trkEn && trkMo) openTrackerNotesModal(trkEn, trkMo);
      break;
    }
  }
}

function handleMainChange(e) {
  // Keyboard support for inline inputs
  if (e.target.classList.contains('add-task-input') || e.target.classList.contains('add-item-input')) {
    // handled inline via keydown
  }
}

// Keyboard enter/escape for inline inputs
document.addEventListener('keydown', e => {
  if (e.target.classList.contains('add-task-input')) {
    const pid = parseInt(e.target.dataset.projectId);
    if (e.key === 'Enter')  simulateAction('confirm-add-task', { projectId: pid });
    if (e.key === 'Escape') simulateAction('cancel-add-task',  { projectId: pid });
  }
  if (e.target.classList.contains('add-item-input')) {
    const mid = parseInt(e.target.dataset.meetingId);
    if (e.key === 'Enter')  simulateAction('confirm-add-item', { meetingId: mid });
    if (e.key === 'Escape') simulateAction('cancel-add-item',  { meetingId: mid });
  }
});

function simulateAction(action, data) {
  const pid = data.projectId || null;
  const mid = data.meetingId || null;

  if (action === 'confirm-add-task') {
    const nameEl = document.querySelector(`.add-task-input[data-project-id="${pid}"]`);
    const dateEl = document.querySelector(`.add-task-date[data-project-id="${pid}"]`);
    const name = nameEl?.value.trim();
    if (!name) { if (nameEl) nameEl.focus(); return; }
    const proj = state.projects.find(p => p.id === pid);
    if (proj) {
      api('/api/tasks', 'POST', { projectId: pid, name, dueDate: dateEl?.value || null })
        .then(task => { proj.tasks.push(task); state.addingTaskTo = null; renderView(); })
        .catch(console.error);
      return;
    }
    state.addingTaskTo = null; renderView();
  }
  if (action === 'cancel-add-task') { state.addingTaskTo = null; renderView(); }
  if (action === 'confirm-add-item') {
    const nameEl = document.querySelector(`.add-item-input[data-meeting-id="${mid}"]`);
    const name = nameEl?.value.trim();
    if (!name) { if (nameEl) nameEl.focus(); return; }
    const meeting = state.meetings.find(m => m.id === mid);
    if (meeting) {
      api('/api/items', 'POST', { meetingId: mid, name })
        .then(item => { meeting.items.push(item); state.addingItemTo = null; renderView(); })
        .catch(console.error);
      return;
    }
    state.addingItemTo = null; renderView();
  }
  if (action === 'cancel-add-item') { state.addingItemTo = null; renderView(); }
}

// ══════════════════════════════════════════════════
//  MODAL SYSTEM
// ══════════════════════════════════════════════════

function openModal(html) {
  const overlay = document.getElementById('modal-overlay');
  const box = document.getElementById('modal-box');
  box.innerHTML = html;
  overlay.classList.add('open');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  state.pendingFiles = [];
}

// ── Delete Confirmation Modal ─────────────────────

let _pendingDelete = null;

function openDeleteConfirm(message, fn) {
  _pendingDelete = fn;
  openModal(`
    <div class="modal-header">
      <span class="modal-title">Confirm Delete</span>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <p style="font-size:14px;color:var(--text-2);margin:0">${message}</p>
    </div>
    <div class="modal-footer">
      <button class="btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn-danger" onclick="executePendingDelete()">Delete</button>
    </div>
  `);
}

function executePendingDelete() {
  if (_pendingDelete) _pendingDelete();
  _pendingDelete = null;
  closeModal();
}

// ── Timeline / Deadline Modal ─────────────────────

function openTimelineModal(meetingId, itemId) {
  const meeting = state.meetings.find(m => m.id === meetingId);
  const item = meeting?.items.find(i => i.id === itemId);
  if (!item) return;

  const currentDeadline = item.deadline || todayISO();

  openModal(`
    <div class="modal-header">
      <span class="modal-title">Set Deadline</span>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <p style="font-size:13px;color:var(--text-2);margin-bottom:20px;">${item.name}</p>
      <div class="form-row">
        <label class="form-label">Deadline Date</label>
        <input type="date" class="form-input" id="deadline-input" value="${currentDeadline}" min="${todayISO()}" />
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" onclick="confirmDeadline('${meetingId}', '${itemId}')">Set Deadline</button>
    </div>
  `);
}

function confirmDeadline(meetingId, itemId) {
  const val = document.getElementById('deadline-input')?.value;
  if (!val) return;
  const meeting = state.meetings.find(m => m.id === meetingId);
  const item = meeting?.items.find(i => i.id === itemId);
  if (item) {
    item.hasTimeline = true;
    item.deadline = val;
    api('/api/items', 'PATCH', { id: itemId, hasTimeline: true, deadline: val }).catch(console.error);
  }
  closeModal();
  renderView();
}

// ── Attachment Modal ──────────────────────────────

function openAttachmentModal(invoiceId) {
  const inv = state.invoices.find(i => i.id === invoiceId);
  if (!inv) return;

  const fileInput = `<input type="file" id="attach-file-input" multiple style="display:none" onchange="handleAttachFiles('${invoiceId}', this)">`;

  let content;
  if (inv.attachments.length === 0) {
    content = `
      <div class="empty-state" style="padding:24px 0">
        <div class="empty-state-icon" style="font-size:24px">📎</div>
        <p class="empty-state-text" style="margin-bottom:16px">No attachments yet.</p>
        <button class="btn-ghost btn-sm" onclick="document.getElementById('attach-file-input').click()">Upload files</button>
      </div>
    `;
  } else {
    const items = inv.attachments.map(f => {
      if (f.type && f.type.startsWith('image/') && f.dataUrl) {
        return `<div class="attachment-image-wrap"><img src="${f.dataUrl}" alt="${f.name}" /></div>`;
      }
      return `
        <div class="attachment-file-card">
          <div class="attachment-file-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </div>
          <div>
            <div class="attachment-file-name">${f.name}</div>
            <div class="attachment-file-size">${formatBytes(f.size)}</div>
          </div>
        </div>
      `;
    }).join('');
    content = `
      <div class="attachment-viewer">${items}</div>
      <div style="margin-top:16px;text-align:right">
        <button class="btn-ghost btn-sm" onclick="document.getElementById('attach-file-input').click()">+ Add more</button>
      </div>
    `;
  }

  openModal(`
    <div class="modal-header">
      <span class="modal-title">Attachments</span>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <p style="font-size:12px;color:var(--text-3);margin-bottom:16px">${inv.recipient} · ${formatDateShort(inv.date)}</p>
      ${content}
      ${fileInput}
    </div>
  `);
}

function handleAttachFiles(invoiceId, input) {
  const inv = state.invoices.find(i => i.id === invoiceId);
  if (!inv) return;
  const files = Array.from(input.files);
  let loaded = 0;

  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      inv.attachments.push({
        name: file.name,
        size: file.size,
        type: file.type,
        dataUrl: file.type.startsWith('image/') ? e.target.result : null,
      });
      loaded++;
      if (loaded === files.length) openAttachmentModal(invoiceId);
    };
    reader.readAsDataURL(file);
  });
}

// ── New Invoice Modal ─────────────────────────────

function openNewInvoiceModal() {
  openModal(`
    <div class="modal-header">
      <span class="modal-title">New Invoice</span>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <label class="form-label">Recipient</label>
        <input type="text" class="form-input" id="inv-recipient" placeholder="Company or person name" />
      </div>
      <div class="form-row-grid">
        <div class="form-row" style="margin-bottom:0">
          <label class="form-label">Amount ($)</label>
          <input type="number" class="form-input" id="inv-amount" placeholder="0" min="0" />
        </div>
        <div class="form-row" style="margin-bottom:0">
          <label class="form-label">Date</label>
          <input type="date" class="form-input" id="inv-date" value="${todayISO()}" />
        </div>
      </div>
      <div class="form-row" style="margin-top:16px">
        <label class="form-label">Reason / Description</label>
        <input type="text" class="form-input" id="inv-reason" placeholder="e.g. Q2 Consulting Services" />
      </div>
      <div class="form-row">
        <label class="form-label">Paid By</label>
        <select class="form-select" id="inv-paid-by">
          <option value="">— None —</option>
          ${state.members.map(m => `<option value="${m.id}">${m.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <label class="form-label">Status</label>
        <select class="form-select" id="inv-status">
          <option value="Pending">Pending</option>
          <option value="Paid">Paid</option>
          <option value="Overdue">Overdue</option>
        </select>
      </div>
      <div class="form-row">
        <label class="form-label">Attachments</label>
        <div class="drop-zone" id="drop-zone" onclick="document.getElementById('inv-file').click()">
          <p class="drop-zone-text">
            <span class="drop-zone-link">Click to upload</span> or drag files here
          </p>
        </div>
        <input type="file" id="inv-file" multiple style="display:none" onchange="handlePendingFiles(this)" />
        <div class="file-preview-list" id="file-preview"></div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" onclick="confirmNewInvoice()">Create Invoice</button>
    </div>
  `);

  // Drag-drop
  const zone = document.getElementById('drop-zone');
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    handlePendingFilesFromList(Array.from(e.dataTransfer.files));
  });
}

function handlePendingFiles(input) {
  handlePendingFilesFromList(Array.from(input.files));
}

function handlePendingFilesFromList(files) {
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      state.pendingFiles.push({
        name: file.name,
        size: file.size,
        type: file.type,
        dataUrl: file.type.startsWith('image/') ? e.target.result : null,
      });
      renderFilePreview();
    };
    reader.readAsDataURL(file);
  });
}

function renderFilePreview() {
  const el = document.getElementById('file-preview');
  if (!el) return;
  el.innerHTML = state.pendingFiles.map(f => `
    <div class="file-preview-item">
      <span>${f.type.startsWith('image/') ? '🖼️' : '📄'}</span>
      <span class="file-preview-name">${f.name}</span>
      <span class="file-preview-size">${formatBytes(f.size)}</span>
    </div>
  `).join('');
}

async function confirmNewInvoice() {
  const recipient = document.getElementById('inv-recipient')?.value.trim();
  const amount    = document.getElementById('inv-amount')?.value;
  const date      = document.getElementById('inv-date')?.value;
  const reason    = document.getElementById('inv-reason')?.value.trim();
  const status    = document.getElementById('inv-status')?.value;
  const paidBy    = document.getElementById('inv-paid-by')?.value || null;

  if (!recipient || !amount) {
    if (!recipient) document.getElementById('inv-recipient').style.borderColor = 'var(--urgent)';
    if (!amount)    document.getElementById('inv-amount').style.borderColor    = 'var(--urgent)';
    return;
  }

  try {
    const inv = await api('/api/invoices', 'POST', {
      recipient,
      amount: parseFloat(amount),
      reason: reason || '—',
      date: date || todayISO(),
      status: status || 'Pending',
      paidBy: paidBy || null,
    });
    inv.attachments = [...state.pendingFiles];
    state.invoices.push(inv);
  } catch (e) { console.error(e); return; }

  closeModal();
  renderView();
}

// ── Invite Member Modal ───────────────────────────

function openInviteModal() {
  openModal(`
    <div class="modal-header">
      <span class="modal-title">Invite Member</span>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <label class="form-label">Full Name</label>
        <input type="text" class="form-input" id="inv-name" placeholder="Jane Smith" />
      </div>
      <div class="form-row">
        <label class="form-label">Email Address</label>
        <input type="email" class="form-input" id="inv-email" placeholder="jane@company.com" />
      </div>
      <div class="form-row">
        <label class="form-label">Role</label>
        <select class="form-select" id="inv-role">
          <option value="Member">Member</option>
          <option value="Editor">Editor</option>
          <option value="Viewer">Viewer</option>
          <option value="Admin">Admin</option>
        </select>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" onclick="confirmInvite()">Send Invite</button>
    </div>
  `);
}

async function confirmInvite() {
  const name  = document.getElementById('inv-name')?.value.trim();
  const email = document.getElementById('inv-email')?.value.trim();
  const role  = document.getElementById('inv-role')?.value;

  if (!name || !email) {
    if (!name)  document.getElementById('inv-name').style.borderColor  = 'var(--urgent)';
    if (!email) document.getElementById('inv-email').style.borderColor = 'var(--urgent)';
    return;
  }

  try {
    const member = await api('/api/members', 'POST', { name, email, role });
    state.members.push(member);
  } catch (e) { console.error(e); return; }

  closeModal();
  renderTeamList();
  renderView();
}

// ── New Project Modal ─────────────────────────────

function openNewProjectModal() {
  openModal(`
    <div class="modal-header">
      <span class="modal-title">New Project</span>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <label class="form-label">Project Name</label>
        <input type="text" class="form-input" id="proj-name" placeholder="e.g. Risk Assessment Platform" />
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" onclick="confirmNewProject()">Create Project</button>
    </div>
  `);
  setTimeout(() => document.getElementById('proj-name')?.focus(), 50);
}

async function confirmNewProject() {
  const name = document.getElementById('proj-name')?.value.trim();
  if (!name) {
    const el = document.getElementById('proj-name');
    if (el) el.style.borderColor = 'var(--urgent)';
    return;
  }
  try {
    const project = await api('/api/projects', 'POST', { name });
    state.projects.push(project);
  } catch (e) { console.error(e); return; }
  closeModal();
  renderView();
}

// ── New Meeting Modal ─────────────────────────────

function openNewMeetingModal() {
  openModal(`
    <div class="modal-header">
      <span class="modal-title">New Meeting</span>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <label class="form-label">Meeting Title</label>
        <input type="text" class="form-input" id="mtg-title" placeholder="e.g. Q3 Planning Session" autofocus />
      </div>
      <div class="form-row">
        <label class="form-label">Date</label>
        <input type="date" class="form-input" id="mtg-date" value="${todayISO()}" />
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" onclick="confirmNewMeeting()">Create Meeting</button>
    </div>
  `);

  setTimeout(() => document.getElementById('mtg-title')?.focus(), 50);
}

async function confirmNewMeeting() {
  const title = document.getElementById('mtg-title')?.value.trim();
  const date  = document.getElementById('mtg-date')?.value;

  if (!title) {
    const el = document.getElementById('mtg-title');
    if (el) el.style.borderColor = 'var(--urgent)';
    return;
  }

  try {
    const meeting = await api('/api/meetings', 'POST', { title, date: date || todayISO() });
    state.meetings.unshift(meeting);
  } catch (e) { console.error(e); return; }

  closeModal();
  navigate('meetings');
}

// ── Edit Modals ───────────────────────────────────

function openEditProjectModal(project) {
  openModal(`
    <div class="modal-header"><span class="modal-title">Edit Project</span><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="form-row">
        <label class="form-label">Project Name</label>
        <input type="text" class="form-input" id="edit-proj-name" value="${project.name}" />
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" onclick="confirmEditProject('${project.id}')">Save</button>
    </div>
  `);
  setTimeout(() => document.getElementById('edit-proj-name')?.focus(), 50);
}

async function confirmEditProject(pid) {
  const name = document.getElementById('edit-proj-name')?.value.trim();
  if (!name) return;
  const proj = state.projects.find(p => p.id === pid);
  if (proj) proj.name = name;
  closeModal(); renderView();
  api('/api/projects', 'PATCH', { id: pid, name }).catch(console.error);
}

function openEditTaskModal(project, task) {
  openModal(`
    <div class="modal-header"><span class="modal-title">Edit Task</span><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="form-row">
        <label class="form-label">Task Name</label>
        <input type="text" class="form-input" id="edit-task-name" value="${task.name}" />
      </div>
      <div class="form-row">
        <label class="form-label">Due Date</label>
        <input type="date" class="form-input" id="edit-task-date" value="${task.dueDate || ''}" />
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" onclick="confirmEditTask('${project.id}', '${task.id}')">Save</button>
    </div>
  `);
  setTimeout(() => document.getElementById('edit-task-name')?.focus(), 50);
}

async function confirmEditTask(pid, tid) {
  const name    = document.getElementById('edit-task-name')?.value.trim();
  const dueDate = document.getElementById('edit-task-date')?.value || null;
  if (!name) return;
  const proj = state.projects.find(p => p.id === pid);
  const task = proj?.tasks.find(t => t.id === tid);
  if (task) { task.name = name; task.dueDate = dueDate; }
  closeModal(); renderView();
  api('/api/tasks', 'PATCH', { id: tid, name, dueDate }).catch(console.error);
}

function openEditMeetingModal(meeting) {
  openModal(`
    <div class="modal-header"><span class="modal-title">Edit Meeting</span><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="form-row">
        <label class="form-label">Title</label>
        <input type="text" class="form-input" id="edit-mtg-title" value="${meeting.title}" />
      </div>
      <div class="form-row">
        <label class="form-label">Date</label>
        <input type="date" class="form-input" id="edit-mtg-date" value="${meeting.date || ''}" />
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" onclick="confirmEditMeeting('${meeting.id}')">Save</button>
    </div>
  `);
  setTimeout(() => document.getElementById('edit-mtg-title')?.focus(), 50);
}

async function confirmEditMeeting(mid) {
  const title = document.getElementById('edit-mtg-title')?.value.trim();
  const date  = document.getElementById('edit-mtg-date')?.value || null;
  if (!title) return;
  const meeting = state.meetings.find(m => m.id === mid);
  if (meeting) { meeting.title = title; if (date) meeting.date = date; }
  closeModal(); renderView();
  api('/api/meetings', 'PATCH', { id: mid, title, date }).catch(console.error);
}

function openEditItemModal(meeting, item) {
  openModal(`
    <div class="modal-header"><span class="modal-title">Edit Agenda Item</span><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="form-row">
        <label class="form-label">Item Name</label>
        <input type="text" class="form-input" id="edit-item-name" value="${item.name}" />
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" onclick="confirmEditItem('${meeting.id}', '${item.id}')">Save</button>
    </div>
  `);
  setTimeout(() => document.getElementById('edit-item-name')?.focus(), 50);
}

async function confirmEditItem(mid, iid) {
  const name = document.getElementById('edit-item-name')?.value.trim();
  if (!name) return;
  const meeting = state.meetings.find(m => m.id === mid);
  const item = meeting?.items.find(i => i.id === iid);
  if (item) item.name = name;
  closeModal(); renderView();
  api('/api/items', 'PATCH', { id: iid, name }).catch(console.error);
}

function openEditInvoiceModal(inv) {
  openModal(`
    <div class="modal-header"><span class="modal-title">Edit Invoice</span><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="form-row">
        <label class="form-label">Recipient</label>
        <input type="text" class="form-input" id="edit-inv-recipient" value="${inv.recipient}" />
      </div>
      <div class="form-row-grid">
        <div class="form-row" style="margin-bottom:0">
          <label class="form-label">Amount ($)</label>
          <input type="number" class="form-input" id="edit-inv-amount" value="${inv.amount}" min="0" />
        </div>
        <div class="form-row" style="margin-bottom:0">
          <label class="form-label">Date</label>
          <input type="date" class="form-input" id="edit-inv-date" value="${inv.date || ''}" />
        </div>
      </div>
      <div class="form-row" style="margin-top:16px">
        <label class="form-label">Reason</label>
        <input type="text" class="form-input" id="edit-inv-reason" value="${inv.reason || ''}" />
      </div>
      <div class="form-row">
        <label class="form-label">Paid By</label>
        <select class="form-select" id="edit-inv-paid-by">
          <option value="">— None —</option>
          ${state.members.map(m => `<option value="${m.id}" ${inv.paidBy === m.id ? 'selected' : ''}>${m.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <label class="form-label">Status</label>
        <select class="form-select" id="edit-inv-status">
          ${['Pending','Paid','Overdue'].map(s => `<option value="${s}" ${inv.status === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" onclick="confirmEditInvoice('${inv.id}')">Save</button>
    </div>
  `);
}

async function confirmEditInvoice(invId) {
  const recipient = document.getElementById('edit-inv-recipient')?.value.trim();
  const amount    = document.getElementById('edit-inv-amount')?.value;
  const date      = document.getElementById('edit-inv-date')?.value || null;
  const reason    = document.getElementById('edit-inv-reason')?.value.trim();
  const paidBy    = document.getElementById('edit-inv-paid-by')?.value || null;
  const status    = document.getElementById('edit-inv-status')?.value;
  if (!recipient || !amount) return;
  const inv = state.invoices.find(i => i.id === invId);
  if (inv) { inv.recipient = recipient; inv.amount = parseFloat(amount); inv.date = date; inv.reason = reason; inv.paidBy = paidBy; inv.status = status; }
  closeModal(); renderView();
  api('/api/invoices', 'PATCH', { id: invId, recipient, amount: parseFloat(amount), date, reason, paidBy, status }).catch(console.error);
}

function openEditMemberModal(member) {
  openModal(`
    <div class="modal-header"><span class="modal-title">Edit Member</span><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="form-row">
        <label class="form-label">Full Name</label>
        <input type="text" class="form-input" id="edit-mem-name" value="${member.name}" />
      </div>
      <div class="form-row">
        <label class="form-label">Role</label>
        <select class="form-select" id="edit-mem-role">
          ${['Member','Editor','Viewer','Admin'].map(r => `<option value="${r}" ${member.role === r ? 'selected' : ''}>${r}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <label class="form-label" style="color:var(--text-3)">Email (cannot be changed)</label>
        <input type="text" class="form-input" value="${member.email}" disabled style="opacity:0.5" />
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" onclick="confirmEditMember('${member.id}')">Save</button>
    </div>
  `);
  setTimeout(() => document.getElementById('edit-mem-name')?.focus(), 50);
}

async function confirmEditMember(memberId) {
  const name = document.getElementById('edit-mem-name')?.value.trim();
  const role = document.getElementById('edit-mem-role')?.value;
  if (!name) return;
  const member = state.members.find(m => m.id === memberId);
  if (member) { member.name = name; member.role = role; }
  closeModal(); renderTeamList(); renderView();
  api('/api/members', 'PATCH', { id: memberId, name, role }).catch(console.error);
}

function openEditChartModal(channel, chart) {
  _pendingChartType = chart.chartType || 'bar';
  const isTimeline = _pendingChartType === 'timeline';
  _pendingChartRows = chart.data.map(d => {
    if (isTimeline) {
      const [year, month] = d.label.split('-');
      return { month: month || '01', year: year || String(new Date().getFullYear()), value: String(d.value) };
    }
    return { label: d.label, value: String(d.value) };
  });
  if (!_pendingChartRows.length) _pendingChartRows = [getEmptyRow(_pendingChartType)];

  openModal(`
    <div class="modal-header"><span class="modal-title">Edit Chart</span><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="form-row">
        <label class="form-label">Chart Title</label>
        <input type="text" class="form-input" id="chart-title" value="${chart.title}" />
      </div>
      <div class="form-row">
        <label class="form-label">Chart Type</label>
        <select class="form-select" id="chart-type" onchange="handleChartTypeChange(this.value, '${channel.id}')">
          ${['bar','line','pie','doughnut','timeline'].map(t => `<option value="${t}" ${_pendingChartType === t ? 'selected' : ''}>${t.charAt(0).toUpperCase() + t.slice(1)}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <label class="form-label">Data</label>
        <div id="chart-rows-header" class="chart-rows-header"></div>
        <div id="chart-rows"></div>
        <button class="btn-ghost btn-sm" style="margin-top:8px" onclick="addChartRow('${channel.id}')">+ Add Row</button>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" onclick="confirmEditChart('${channel.id}', '${chart.id}')">Save</button>
    </div>
  `);
  renderModalChartRows(channel.id);
}

async function confirmEditChart(chanId, chartId) {
  const title     = document.getElementById('chart-title')?.value.trim();
  const chartType = document.getElementById('chart-type')?.value;
  if (!title) return;

  let data;
  if (_pendingChartType === 'timeline') {
    data = _pendingChartRows.filter(r => r.value !== '')
      .map(r => ({ label: `${r.year}-${r.month}`, value: parseFloat(r.value) || 0 }))
      .sort((a, b) => a.label.localeCompare(b.label));
  } else {
    data = _pendingChartRows.filter(r => r.label?.trim() && r.value !== '')
      .map(r => ({ label: r.label.trim(), value: parseFloat(r.value) || 0 }));
  }
  if (!data.length) return;

  const channel = state.channels.find(c => c.id === chanId);
  const chart = channel?.charts.find(c => c.id === chartId);
  if (chart) { chart.title = title; chart.chartType = chartType; chart.data = data; }
  closeModal(); renderView();
  api('/api/charts', 'PATCH', { id: chartId, title, chartType, data }).catch(console.error);
}

// ── Settings Modal ───────────────────────────────

function openSettingsModal() {
  const email = getStoredSession()?.email || '';
  const member = state.members.find(m => m.email === email);
  const name = member?.name || email.split('@')[0];
  const url = state.profiles[email];

  const avatarPreview = url
    ? `<img src="${url}" alt="${name}" class="settings-avatar-img" />`
    : `<div class="team-avatar settings-avatar-placeholder" style="background:${getAvatarColor(name)}">${getInitials(name)}</div>`;

  openModal(`
    <div class="modal-header">
      <span class="modal-title">Settings</span>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="settings-profile-row">
        <div class="settings-avatar-wrap" id="settings-avatar-preview">${avatarPreview}</div>
        <div class="settings-profile-info">
          <p class="settings-profile-name">${name}</p>
          <p class="settings-profile-email">${email}</p>
          <button class="btn-ghost btn-sm" style="margin-top:10px" onclick="document.getElementById('avatar-file-input').click()">Change Photo</button>
          <input type="file" id="avatar-file-input" accept="image/*" style="display:none" onchange="handleAvatarUpload(this)" />
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-danger" onclick="signOut()">Sign Out</button>
      <button class="btn-ghost" onclick="closeModal()">Close</button>
    </div>
  `);
}

async function handleAvatarUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const dataUrl = await resizeImage(file, 200);
  const email = getStoredSession()?.email || '';

  const preview = document.getElementById('settings-avatar-preview');
  if (preview) preview.innerHTML = `<img src="${dataUrl}" alt="Avatar" class="settings-avatar-img" />`;

  state.profiles[email] = dataUrl;
  renderSidebarFooter();
  renderTeamList();
  if (state.view === 'members') renderView();

  api('/api/profile', 'POST', { email, avatarUrl: dataUrl }).catch(console.error);
}

function resizeImage(file, maxSize) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function signOut() {
  localStorage.removeItem('ru_session');
  location.reload();
}

// ── New Channel Modal ─────────────────────────────

function openNewChannelModal() {
  openModal(`
    <div class="modal-header">
      <span class="modal-title">New Channel</span>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <label class="form-label">Channel Name</label>
        <input type="text" class="form-input" id="chan-name" placeholder="e.g. Financial Overview" />
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" onclick="confirmNewChannel()">Create Channel</button>
    </div>
  `);
  setTimeout(() => document.getElementById('chan-name')?.focus(), 50);
}

async function confirmNewChannel() {
  const name = document.getElementById('chan-name')?.value.trim();
  if (!name) {
    const el = document.getElementById('chan-name');
    if (el) el.style.borderColor = 'var(--urgent)';
    return;
  }
  try {
    const channel = await api('/api/channels', 'POST', { name });
    state.channels.push(channel);
    state.activeChannel = channel.id;
  } catch (e) { console.error(e); return; }
  closeModal();
  renderView();
}

// ── New Chart Modal ───────────────────────────────

let _pendingChartRows = [{ label: '', value: '' }];
let _pendingChartType = 'bar';

function getEmptyRow(type) {
  return type === 'timeline'
    ? { month: '01', year: String(new Date().getFullYear()), value: '' }
    : { label: '', value: '' };
}

function openNewChartModal(channelId) {
  _pendingChartType = 'bar';
  _pendingChartRows = [getEmptyRow('bar')];
  openModal(`
    <div class="modal-header">
      <span class="modal-title">Add Chart</span>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <label class="form-label">Chart Title</label>
        <input type="text" class="form-input" id="chart-title" placeholder="e.g. Monthly Revenue" />
      </div>
      <div class="form-row">
        <label class="form-label">Chart Type</label>
        <select class="form-select" id="chart-type" onchange="handleChartTypeChange(this.value, '${channelId}')">
          <option value="bar">Bar</option>
          <option value="line">Line</option>
          <option value="pie">Pie</option>
          <option value="doughnut">Doughnut</option>
          <option value="timeline">Timeline</option>
        </select>
      </div>
      <div class="form-row">
        <label class="form-label">Data</label>
        <div id="chart-rows-header" class="chart-rows-header"></div>
        <div id="chart-rows"></div>
        <button class="btn-ghost btn-sm" style="margin-top:8px" onclick="addChartRow('${channelId}')">+ Add Row</button>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" onclick="confirmNewChart('${channelId}')">Create Chart</button>
    </div>
  `);
  renderModalChartRows(channelId);
  setTimeout(() => document.getElementById('chart-title')?.focus(), 50);
}

function handleChartTypeChange(type, channelId) {
  _pendingChartType = type;
  _pendingChartRows = [getEmptyRow(type)];
  renderModalChartRows(channelId);
}

function renderModalChartRows(channelId) {
  const el = document.getElementById('chart-rows');
  const hdr = document.getElementById('chart-rows-header');
  if (!el) return;

  const isTimeline = _pendingChartType === 'timeline';

  if (hdr) {
    hdr.className = 'chart-rows-header' + (isTimeline ? ' timeline' : '');
    hdr.innerHTML = isTimeline
      ? '<span>Month</span><span>Year</span><span>Value</span><span></span>'
      : '<span>Label</span><span>Value</span><span></span>';
  }

  if (isTimeline) {
    el.innerHTML = _pendingChartRows.map((row, i) => `
      <div class="chart-row-item chart-row-timeline">
        <select class="form-select chart-row-month" onchange="_pendingChartRows[${i}].month = this.value">
          ${MONTHS.map((m, mi) => {
            const val = String(mi + 1).padStart(2, '0');
            return `<option value="${val}" ${row.month === val ? 'selected' : ''}>${m}</option>`;
          }).join('')}
        </select>
        <input type="number" class="form-input chart-row-year" value="${row.year}" min="2000" max="2100"
               oninput="_pendingChartRows[${i}].year = this.value" />
        <input type="number" class="form-input chart-row-value" placeholder="0" value="${row.value}"
               oninput="_pendingChartRows[${i}].value = this.value" />
        ${_pendingChartRows.length > 1
          ? `<button class="btn-ghost btn-icon" onclick="removeChartRow(${i}, '${channelId}')">✕</button>`
          : `<span style="width:32px"></span>`}
      </div>
    `).join('');
  } else {
    el.innerHTML = _pendingChartRows.map((row, i) => `
      <div class="chart-row-item">
        <input type="text" class="form-input chart-row-label" placeholder="Label" value="${row.label}"
               oninput="_pendingChartRows[${i}].label = this.value" />
        <input type="number" class="form-input chart-row-value" placeholder="0" value="${row.value}"
               oninput="_pendingChartRows[${i}].value = this.value" />
        ${_pendingChartRows.length > 1
          ? `<button class="btn-ghost btn-icon" onclick="removeChartRow(${i}, '${channelId}')">✕</button>`
          : `<span style="width:32px"></span>`}
      </div>
    `).join('');
  }
}

function addChartRow(channelId) {
  _pendingChartRows.push(getEmptyRow(_pendingChartType));
  renderModalChartRows(channelId);
}

function removeChartRow(i, channelId) {
  _pendingChartRows.splice(i, 1);
  renderModalChartRows(channelId);
}

async function confirmNewChart(channelId) {
  const title     = document.getElementById('chart-title')?.value.trim();
  const chartType = document.getElementById('chart-type')?.value;

  if (!title) {
    const el = document.getElementById('chart-title');
    if (el) el.style.borderColor = 'var(--urgent)';
    return;
  }

  let data;
  if (_pendingChartType === 'timeline') {
    data = _pendingChartRows
      .filter(r => r.value !== '')
      .map(r => ({ label: `${r.year}-${r.month}`, value: parseFloat(r.value) || 0 }))
      .sort((a, b) => a.label.localeCompare(b.label));
  } else {
    data = _pendingChartRows.filter(r => r.label.trim() && r.value !== '')
      .map(r => ({ label: r.label.trim(), value: parseFloat(r.value) || 0 }));
  }
  if (!data.length) return;

  try {
    const chart = await api('/api/charts', 'POST', { channelId, title, chartType, data });
    const channel = state.channels.find(c => c.id === channelId);
    if (channel) channel.charts.push(chart);
  } catch (e) { console.error(e); return; }

  closeModal();
  renderView();
}

// ── Tracker Modals ────────────────────────────────

function openNewTrackerMonthModal() {
  const now = new Date();
  openModal(`
    <div class="modal-header">
      <span class="modal-title">New Month</span>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-row-grid">
        <div class="form-row" style="margin-bottom:0">
          <label class="form-label">Month</label>
          <select class="form-select" id="tm-month">
            ${MONTHS.map((m, i) => {
              const val = String(i + 1).padStart(2, '0');
              return `<option value="${val}" ${i === now.getMonth() ? 'selected' : ''}>${m}</option>`;
            }).join('')}
          </select>
        </div>
        <div class="form-row" style="margin-bottom:0">
          <label class="form-label">Year</label>
          <input type="number" class="form-input" id="tm-year" value="${now.getFullYear()}" min="2020" max="2100" />
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" onclick="confirmNewTrackerMonth()">Create</button>
    </div>
  `);
}

async function confirmNewTrackerMonth() {
  const monthVal = document.getElementById('tm-month')?.value;
  const yearVal  = document.getElementById('tm-year')?.value;
  if (!monthVal || !yearVal) return;
  const name = MONTHS[parseInt(monthVal) - 1] + ' ' + yearVal;
  try {
    const month = await api('/api/tracker-months', 'POST', { name });
    state.trackerMonths.push(month);
    state.activeTrackerMonth = month.id;
  } catch (err) { console.error(err); return; }
  closeModal();
  renderView();
}

function openNewTrackerEntryModal(monthId) {
  openModal(`
    <div class="modal-header">
      <span class="modal-title">Add Entry</span>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <label class="form-label">Username</label>
        <input type="text" class="form-input" id="tracker-username" placeholder="Roblox username" />
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" onclick="confirmNewTrackerEntry('${monthId}')">Add Entry</button>
    </div>
  `);
  setTimeout(() => document.getElementById('tracker-username')?.focus(), 50);
}

async function confirmNewTrackerEntry(monthId) {
  const username = document.getElementById('tracker-username')?.value.trim();
  if (!username) {
    const el = document.getElementById('tracker-username');
    if (el) el.style.borderColor = 'var(--urgent)';
    return;
  }
  try {
    const entry = await api('/api/tracker-entries', 'POST', { monthId, username });
    const month = state.trackerMonths.find(m => m.id === monthId);
    if (month) month.entries.push(entry);
  } catch (err) { console.error(err); return; }
  closeModal();
  renderView();
}

function openEditTrackerEntryModal(entry, month) {
  openModal(`
    <div class="modal-header">
      <span class="modal-title">Edit — ${entry.username}</span>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-row-grid">
        <div class="form-row" style="margin-bottom:0">
          <label class="form-label">Username</label>
          <input type="text" class="form-input" id="te-username" value="${entry.username}" />
        </div>
        <div class="form-row" style="margin-bottom:0">
          <label class="form-label">Roblox ID</label>
          <input type="text" class="form-input" id="te-robloxid" value="${entry.robloxId || ''}" />
        </div>
      </div>
      <div class="form-row" style="margin-top:14px">
        <label class="form-label">Department</label>
        <input type="text" class="form-input" id="te-dept" value="${entry.department || ''}" placeholder="e.g. HR, Admin, Moderation" list="te-dept-list" />
        <datalist id="te-dept-list">
          <option value="HR"><option value="Admin"><option value="Moderation"><option value="Support"><option value="Development"><option value="Management">
        </datalist>
      </div>
      <div class="form-label" style="margin:14px 0 10px">Statistics</div>
      <div class="tracker-stats-grid">
        ${[
          ['Observations', 'te-obs',     entry.observations],
          ['Playtime',     'te-pt',      entry.playtime],
          ['Applications', 'te-apps',    entry.applications],
          ['Appeals',      'te-apls',    entry.appeals],
          ['Banishments',  'te-bans',    entry.banishments],
          ['Staff Reports','te-sr',      entry.staffReports],
          ['Staff Meetings','te-sm',     entry.staffMeetings],
          ['Messages',     'te-msgs',    entry.messages],
          ['Strikes',      'te-strikes', entry.strikes],
        ].map(([lbl, id, val]) => `
          <div class="tracker-stat-cell">
            <label class="form-label">${lbl}</label>
            <input type="number" class="form-input" id="${id}" value="${val}" min="0" step="any" />
          </div>
        `).join('')}
      </div>
      <div class="form-row" style="margin-top:14px">
        <label class="form-label">Status</label>
        <select class="form-select" id="te-status">
          ${TRACKER_STATUS_CYCLE.map(s => `<option value="${s}" ${entry.status === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="form-row" style="margin-top:14px">
        <label class="form-label">Notes</label>
        <textarea class="form-input" id="te-notes" rows="3" placeholder="Any notes about this staff member…" style="resize:vertical">${entry.notes || ''}</textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" onclick="confirmEditTrackerEntry('${entry.id}','${month.id}')">Save</button>
    </div>
  `);
  setTimeout(() => document.getElementById('te-username')?.focus(), 50);
}

async function confirmEditTrackerEntry(entryId, monthId) {
  const username     = document.getElementById('te-username')?.value.trim();
  if (!username) return;
  const robloxId     = document.getElementById('te-robloxid')?.value.trim() || '';
  const department   = document.getElementById('te-dept')?.value.trim() || '';
  const observations = parseFloat(document.getElementById('te-obs')?.value) || 0;
  const playtime     = parseFloat(document.getElementById('te-pt')?.value)  || 0;
  const applications = parseFloat(document.getElementById('te-apps')?.value)|| 0;
  const appeals      = parseFloat(document.getElementById('te-apls')?.value)|| 0;
  const banishments  = parseFloat(document.getElementById('te-bans')?.value)|| 0;
  const staffReports = parseFloat(document.getElementById('te-sr')?.value)  || 0;
  const staffMeetings= parseFloat(document.getElementById('te-sm')?.value)  || 0;
  const messages     = parseFloat(document.getElementById('te-msgs')?.value)|| 0;
  const strikes      = parseFloat(document.getElementById('te-strikes')?.value)||0;
  const status       = document.getElementById('te-status')?.value || 'N/A';
  const notes        = document.getElementById('te-notes')?.value || '';

  const month = state.trackerMonths.find(m => m.id === monthId);
  const entry = month?.entries.find(e => e.id === entryId);
  if (entry) {
    Object.assign(entry, { username, robloxId, department, observations, playtime, applications, appeals, banishments, staffReports, staffMeetings, messages, strikes, status, notes });
  }
  closeModal();
  renderView();
  api('/api/tracker-entries', 'PATCH', {
    id: entryId,
    username, roblox_id: robloxId, department,
    observations, playtime, applications, appeals, banishments,
    staff_reports: staffReports, staff_meetings: staffMeetings,
    messages, strikes, status, notes,
  }).catch(console.error);
}

function openTrackerNotesModal(entry, month) {
  openModal(`
    <div class="modal-header">
      <span class="modal-title">Notes — ${entry.username}</span>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <p class="text-muted text-sm" style="margin-bottom:12px">${month.name}</p>
      <textarea class="form-input" id="tracker-notes-input" rows="6"
                placeholder="Add notes about this staff member…"
                style="resize:vertical">${entry.notes || ''}</textarea>
    </div>
    <div class="modal-footer">
      <button class="btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" onclick="confirmTrackerNotes('${entry.id}','${month.id}')">Save Notes</button>
    </div>
  `);
  setTimeout(() => document.getElementById('tracker-notes-input')?.focus(), 50);
}

async function confirmTrackerNotes(entryId, monthId) {
  const notes = document.getElementById('tracker-notes-input')?.value || '';
  const month = state.trackerMonths.find(m => m.id === monthId);
  const entry = month?.entries.find(e => e.id === entryId);
  if (entry) entry.notes = notes;
  closeModal();
  renderView();
  api('/api/tracker-entries', 'PATCH', { id: entryId, notes }).catch(console.error);
}

// ══════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  applyTheme(state.theme);
  initAuth();
});

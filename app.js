'use strict';

// ══════════════════════════════════════════════════
//  CONSTANTS
// ══════════════════════════════════════════════════

let pendingEmail = '';

const STATUS_CYCLE = ['To Do', 'In Progress', 'Review', 'Stuck', 'Done'];
const INVOICE_STATUS_CYCLE = ['Pending', 'Paid', 'Overdue'];

const AVATAR_COLORS = [
  '#6366f1','#ec4899','#14b8a6','#f59e0b',
  '#8b5cf6','#0ea5e9','#ef4444','#10b981',
  '#f97316','#3b82f6',
];

// ══════════════════════════════════════════════════
//  STATE
// ══════════════════════════════════════════════════

const state = {
  theme: 'light',
  view: 'overview',

  members: [],

  meetings: [],

  projects: [],

  invoices: [],

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

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

// ══════════════════════════════════════════════════
//  THEME
// ══════════════════════════════════════════════════

function applyTheme(theme) {
  state.theme = theme;
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
      error.textContent = 'Access denied — email not recognized.';
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
  const app = document.getElementById('app');

  authScreen.classList.add('auth-exit');
  setTimeout(() => {
    authScreen.style.display = 'none';
    app.classList.remove('app-hidden');
    app.classList.add('app-visible');
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
    state.projects = data.projects;
    state.meetings = data.meetings;
    state.invoices = data.invoices;
    state.members  = data.members;
  } catch (e) {
    console.error('Failed to load data:', e);
  }
  renderTeamList();
  navigate('overview', true);
  bindAppEvents();
}

function bindAppEvents() {
  document.getElementById('theme-btn').addEventListener('click', toggleTheme);
  document.getElementById('new-meeting-btn').addEventListener('click', openNewMeetingModal);

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
    overview: renderOverview,
    projects: renderProjects,
    meetings: renderMeetings,
    invoices: renderInvoices,
    members:  renderMembers,
  };
  wrap.innerHTML = (views[state.view] || renderOverview)();
  afterRender();
}

function afterRender() {
  // Focus inline inputs if present
  const ti = document.querySelector('.add-task-input');
  if (ti) ti.focus();
  const ii = document.querySelector('.add-item-input');
  if (ii) ii.focus();
}

// ══════════════════════════════════════════════════
//  SIDEBAR TEAM LIST
// ══════════════════════════════════════════════════

function renderTeamList() {
  const el = document.getElementById('team-list');
  if (!el) return;
  el.innerHTML = state.members.map(m => `
    <div class="team-member-row">
      <div class="team-avatar" style="background:${getAvatarColor(m.name)}">${getInitials(m.name)}</div>
      <span class="team-member-name">${m.name.split(' ')[0]}</span>
    </div>
  `).join('');
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
    </div>
    ${state.projects.map(renderProjectGroup).join('')}
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
        <span class="project-count">${project.tasks.length} task${project.tasks.length !== 1 ? 's' : ''}</span>
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
        <span class="meeting-item-count">${doneCount}/${meeting.items.length} done</span>
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

  const rows = state.invoices.map(inv => `
    <tr>
      <td><strong>${inv.recipient}</strong></td>
      <td class="font-mono">${formatMoney(inv.amount)}</td>
      <td class="text-muted">${inv.reason}</td>
      <td class="text-muted text-sm">${formatDateShort(inv.date)}</td>
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
    </tr>
  `).join('');

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
      <div class="member-avatar" style="background:${getAvatarColor(m.name)}">${getInitials(m.name)}</div>
      <div class="member-name">${m.name}</div>
      <div class="member-role-pill">${m.role}</div>
      <div class="member-meta">
        <div>${m.email}</div>
        <div>Joined ${formatDateShort(m.joinDate)}</div>
      </div>
    </div>
  `).join('');

  return `
    <div class="page-header">
      <div class="page-title-block">
        <h1 class="page-title">Members</h1>
        <p class="page-date">${state.members.length} member${state.members.length !== 1 ? 's' : ''}</p>
      </div>
      <button class="btn-primary" data-action="invite-member">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Invite Member
      </button>
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
  const iid   = el.dataset.itemId     || null;
  const invId = el.dataset.invoiceId  || null;

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

// ══════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  initAuth();
});

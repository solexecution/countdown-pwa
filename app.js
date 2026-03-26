/* ===========================
   COUNTDOWN APP — app.js (v2 PWA Multi-Deadline)
=========================== */

// ─── State ─────────────────────────────────────────────────────────────────
const STATE_KEY = 'countdown_v2';
let state = {
  deadlines: [],    // Array of deadline objects
  activeId: null,   // Currently viewed deadline ID
};
let ticker = null;

// ─── DOM refs ────────────────────────────────────────────────────────────────
const hubPanel        = document.getElementById('hubPanel');
const hubGrid         = document.getElementById('hubGrid');
const hubEmpty        = document.getElementById('hubEmpty');

const btnOpenCreateModal = document.getElementById('btnOpenCreateModal');

const countdownPanel  = document.getElementById('countdownPanel');
const expiredPanel    = document.getElementById('expiredPanel');
const btnBack         = document.getElementById('btnBack');
const btnEditDeadline = document.getElementById('btnEditDeadline');
const btnExpiredBack  = document.getElementById('btnExpiredBack');

// Deadline Modal
const deadlineModal   = document.getElementById('deadlineModal');
const btnCloseDeadlineModal = document.getElementById('btnCloseDeadlineModal');
const deadlineModalTitle = document.getElementById('deadlineModalTitle');
const dlName          = document.getElementById('dlName');
const dlDate          = document.getElementById('dlDate');
const dlDayStart      = document.getElementById('dlDayStart');
const dlDayEnd        = document.getElementById('dlDayEnd');
const dlColorRow      = document.getElementById('dlColorRow');
const btnSaveDeadline = document.getElementById('btnSaveDeadline');
let editingDeadlineId = null;

// Countdown View Elements
const deadlineLabel   = document.getElementById('deadlineLabel');
const phaseText       = document.getElementById('phaseText');
const phaseDot        = document.getElementById('phaseDot');

const daysVal         = document.getElementById('daysVal');
const dayHoursVal     = document.getElementById('dayHoursVal');
const nightHoursVal   = document.getElementById('nightHoursVal');
const minsVal         = document.getElementById('minsVal');

const progressFill    = document.getElementById('progressFill');
const progressPct     = document.getElementById('progressPct');
const progressStart   = document.getElementById('progressStart');
const progressEnd     = document.getElementById('progressEnd');
const deadlineExact   = document.getElementById('deadlineExact');
const expiredLabel    = document.getElementById('expiredLabel');
const expiredTitle    = document.getElementById('expiredTitle');

// Timeline
const timelineWrap    = document.getElementById('timelineWrap');
const timelineEmpty   = document.getElementById('timelineEmpty');
const waterfallWrap   = document.getElementById('waterfallWrap');
const btnListView     = document.getElementById('btnListView');
const btnWaterfallView= document.getElementById('btnWaterfallView');
const btnAddMilestone = document.getElementById('btnAddMilestone');
let currentTimelineView = 'list';

// Milestone Modal
const milestoneModal  = document.getElementById('milestoneModal');
const btnModalClose   = document.getElementById('btnModalClose');
const msNameInput     = document.getElementById('msName');
const msDateInput     = document.getElementById('msDate');
const msLocationInput = document.getElementById('msLocation');
const colorRow        = document.getElementById('colorRow');
const btnSaveMilestone= document.getElementById('btnSaveMilestone');
let editingMilestoneId = null;

// ─── Star field ──────────────────────────────────────────────────────────────
function createStars() {
  const bg = document.getElementById('bgLayer');
  for (let i = 0; i < 50; i++) {
    const star = document.createElement('div');
    star.className = 'star';
    const size = Math.random() * 2 + 1;
    star.style.cssText = `
      width:${size}px; height:${size}px;
      left:${Math.random() * 100}%;
      top:${Math.random() * 100}%;
      animation-duration:${6 + Math.random() * 10}s;
      animation-delay:${Math.random() * 8}s;
    `;
    bg.appendChild(star);
  }
}
createStars();

// ─── Utility ────────────────────────────────────────────────────────────
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

function timeToMinutes(str) {
  const [h, m] = str.split(':').map(Number);
  return h * 60 + m;
}

function formatShortDate(date) {
  return date.toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
  });
}

function formatDate(d) {
  return d.toLocaleString(undefined, {
    weekday: 'short', year: 'numeric', month: 'short',
    day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function pad(n) { return String(Math.floor(n)).padStart(2, '0'); }

function isoForInput(d) {
  return d.getFullYear() + '-' +
    pad(d.getMonth()+1) + '-' +
    pad(d.getDate()) + 'T' +
    pad(d.getHours()) + ':' +
    pad(d.getMinutes());
}

function relativeDelta(targetDate, now) {
  const diffMs  = targetDate - now;
  const past    = diffMs < 0;
  const absDiff = Math.abs(diffMs);
  const mins    = Math.floor(absDiff / 60000);
  const hrs     = Math.floor(mins / 60);
  const days    = Math.floor(hrs  / 24);

  let label;
  if (days > 1)      label = `${days} days`;
  else if (days === 1) label = '1 day';
  else if (hrs > 1)  label = `${hrs} hours`;
  else if (hrs === 1)label = '1 hour';
  else if (mins > 1) label = `${mins} minutes`;
  else               label = 'just now';

  return past ? `${label} ago` : `in ${label}`;
}

function esc(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── Core Calculations ───────────────────────────────────────────────
function computeBreakdown(now, deadline, dayStartStr, dayEndStr) {
  const dayStartMins = timeToMinutes(dayStartStr);
  const dayEndMins   = timeToMinutes(dayEndStr);
  const dayLen       = Math.max(0, dayEndMins - dayStartMins);
  const nightLen     = 24 * 60 - dayLen;

  const totalMs      = deadline - now;
  if (totalMs <= 0) return null;

  const totalMinutes  = totalMs / 60000;
  const totalFullDays = Math.floor(totalMinutes / (24 * 60));

  const midnight = new Date(now);
  midnight.setHours(0,0,0,0);
  const minsToday      = (now - midnight) / 60000;
  const minsLeftToday  = 24 * 60 - minsToday;
  const trailingMins   = totalMinutes - totalFullDays * 24 * 60;

  let totalDayMins   = totalFullDays * dayLen;
  let totalNightMins = totalFullDays * nightLen;

  const trailingDay   = overlapWithDay(minsToday, minsToday + trailingMins, dayStartMins, dayEndMins);
  const trailingNight = trailingMins - trailingDay;

  totalDayMins   += trailingDay;
  totalNightMins += trailingNight;

  return {
    totalDays:     totalFullDays,
    dayHours:      Math.floor(totalDayMins  / 60),
    nightHours:    Math.floor(totalNightMins / 60),
    minsLeftToday: Math.floor(minsLeftToday),
    totalMs,
  };
}

function overlapWithDay(startMins, endMins, dayStart, dayEnd) {
  let overlap = 0;
  let cursor  = startMins;
  while (cursor < endMins) {
    const cy   = Math.floor(cursor / (24*60)) * (24*60);
    const oS   = Math.max(cursor,  cy + dayStart);
    const oE   = Math.min(endMins, cy + dayEnd, cy + 24*60);
    if (oE > oS) overlap += (oE - oS);
    cursor = cy + 24*60;
  }
  return Math.max(0, overlap);
}

function isDay(now, dayStartStr, dayEndStr) {
  const minsNow  = now.getHours() * 60 + now.getMinutes();
  const dayStart = timeToMinutes(dayStartStr);
  const dayEnd   = timeToMinutes(dayEndStr);
  return minsNow >= dayStart && minsNow < dayEnd;
}

// ─── UI Helpers ──────────────────────────────────────────────────────────────
function flipAnimate(el) {
  el.classList.remove('flip');
  void el.offsetWidth;
  el.classList.add('flip');
  setTimeout(() => el.classList.remove('flip'), 350);
}

function setTileValue(el, newVal) {
  const display = String(Math.max(0, newVal));
  if (el.textContent !== display) {
    flipAnimate(el);
    el.textContent = display;
  }
}

function getSelectedColor(rowEl, defaultHex = '#00d4b4') {
  const sel = rowEl.querySelector('.color-swatch.selected');
  return sel ? sel.dataset.color : defaultHex;
}

function setSelectedColor(rowEl, hex) {
  rowEl.querySelectorAll('.color-swatch').forEach(s => {
    s.classList.toggle('selected', s.dataset.color === hex);
  });
  // Defaults to first if not found
  if (!rowEl.querySelector('.color-swatch.selected')) {
    rowEl.children[0].classList.add('selected');
  }
}

// ─── Active Deadline Accessor ──────────────────────────────────────────────────
function getActive() {
  if (!state.activeId) return null;
  return state.deadlines.find(d => d.id === state.activeId) || null;
}

// ─── Rendering: HUB ─────────────────────────────────────────────────────────
function renderHub() {
  hubGrid.innerHTML = '';
  const now = new Date();

  if (state.deadlines.length === 0) {
    hubEmpty.classList.remove('hidden');
  } else {
    hubEmpty.classList.add('hidden');
    // Sort array: closest deadline first
    const sorted = [...state.deadlines].sort((a,b) => new Date(a.deadline) - new Date(b.deadline));

    sorted.forEach(dl => {
      const msDt = new Date(dl.deadline);
      const past = msDt <= now;
      let daysText = past ? 'Done' : '0';
      let pct = 100;

      if (!past) {
        const breakdn = computeBreakdown(now, msDt, dl.dayStart, dl.dayEnd);
        daysText = breakdn ? breakdn.totalDays : 0;
        
        const total   = msDt - new Date(dl.createdAt);
        const elapsed = now - new Date(dl.createdAt);
        pct = Math.min(100, Math.max(0, (elapsed / total) * 100));
      }

      // Find next milestone
      const msList = dl.milestones || [];
      const msSorted = [...msList].sort((a,b) => new Date(a.date) - new Date(b.date));
      const nextMs = msSorted.find(m => new Date(m.date) > now);

      const card = document.createElement('div');
      card.className = 'dl-card';
      card.style.setProperty('--color', dl.color);
      card.innerHTML = `
        <div class="dl-card-glow"></div>
        <div class="dl-card-top">
          <div class="dl-card-name" title="${esc(dl.name)}">${esc(dl.name)}</div>
          <div class="dl-card-icon"></div>
        </div>
        <div class="dl-card-main">
          <div class="dl-card-days">${daysText}</div>
          <div class="dl-card-sub">${past ? 'Deadline Reached' : 'Days Remaining'}</div>
        </div>
        <div class="dl-card-mini-track">
          <div class="dl-card-mini-fill" style="width: ${pct}%"></div>
        </div>
        <div class="dl-card-next ${!nextMs || past ? 'empty' : ''}">
          ${nextMs ? `${esc(nextMs.name)} ${relativeDelta(new Date(nextMs.date), now)}` : ''}
        </div>
        <button class="dl-card-del" data-id="${dl.id}" title="Delete deadline">✕</button>
      `;

      // Navigate to countdown
      card.addEventListener('click', (e) => {
        if (e.target.closest('.dl-card-del')) return;
        state.activeId = dl.id;
        saveState();
        showCountdown();
      });

      // Delete
      card.querySelector('.dl-card-del').addEventListener('click', () => {
        if (confirm(`Delete deadline "${dl.name}"?`)) {
          state.deadlines = state.deadlines.filter(old => old.id !== dl.id);
          if (state.activeId === dl.id) state.activeId = null;
          saveState();
          renderHub();
        }
      });

      hubGrid.appendChild(card);
    });
  }
}

// ─── Rendering: TIMELINE ────────────────────────────────────────────────────
function renderTimeline() {
  if (currentTimelineView === 'list') {
    renderListView();
  } else {
    renderWaterfallView();
  }
}

function renderListView() {
  const dl = getActive();
  if (!dl) return;

  const now       = new Date();
  const deadline  = new Date(dl.deadline);
  const createdAt = new Date(dl.createdAt || dl.deadline);
  const sorted    = [...(dl.milestones || [])].sort((a,b) => new Date(a.date) - new Date(b.date));

  // Remove old milestone rows
  const existing = timelineWrap.querySelectorAll('.milestone-row, .timeline-cap');
  existing.forEach(el => el.remove());

  if (sorted.length === 0) {
    timelineEmpty.style.display = '';
    return;
  }
  timelineEmpty.style.display = 'none';

  const nextIdx = sorted.findIndex(m => new Date(m.date) > now);

  // START cap
  const startCap = makeCap('Start — ' + formatDate(createdAt));
  timelineWrap.insertBefore(startCap, timelineEmpty);

  // Milestone rows
  sorted.forEach((ms, i) => {
    const msDt  = new Date(ms.date);
    const past  = msDt <= now;
    const isNext= i === nextIdx;

    const row = document.createElement('div');
    row.className = 'milestone-row' + (past ? ' ms-past' : '') + (isNext ? ' ms-next' : '');
    row.style.setProperty('--ms-color', ms.color);

    const badge = past ? 'done' : (isNext ? 'next' : 'future');
    const badgeLabel = past ? 'Done' : (isNext ? 'Up Next' : 'Upcoming');

    let locHtml = '';
    if (ms.location) {
      const isUrl = ms.location.startsWith('http://') || ms.location.startsWith('https://');
      if (isUrl) {
        locHtml = `<div class="ms-location"><a href="${esc(ms.location)}" target="_blank" rel="noopener noreferrer">View Link</a></div>`;
      } else {
        locHtml = `<div class="ms-location">${esc(ms.location)}</div>`;
      }
    }

    row.innerHTML = `
      <div class="ms-dot-wrap"><div class="ms-dot"></div></div>
      <div class="ms-content">
        <div class="ms-top">
          <span class="ms-name" title="${esc(ms.name)}">${esc(ms.name)}</span>
          <span class="ms-badge ${badge}">${badgeLabel}</span>
        </div>
        <div class="ms-date">${formatDate(msDt)}</div>
        <div class="ms-delta" style="color:${ms.color}">${relativeDelta(msDt, now)}</div>
        ${locHtml}
      </div>
      <button class="ms-edit opacity-0" data-id="${ms.id}" title="Edit milestone">✎</button>
      <button class="ms-delete opacity-0" data-id="${ms.id}" title="Remove milestone">✕</button>
    `;

    timelineWrap.appendChild(row);
  });

  // DEADLINE cap
  const endCap = makeCap(dl.name + ' — ' + formatDate(deadline));
  endCap.classList.add('timeline-cap-end');
  endCap.style.cssText += 'padding-top:16px;padding-bottom:0;';
  timelineWrap.appendChild(endCap);

  // Delete + Edit handlers
  timelineWrap.querySelectorAll('.ms-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      dl.milestones = dl.milestones.filter(m => m.id !== btn.dataset.id);
      saveState();
      renderTimeline();
    });
  });
  
  timelineWrap.querySelectorAll('.ms-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openMilestoneModal(btn.dataset.id);
    });
  });
}

function renderWaterfallView() {
  const dl = getActive();
  if (!dl) return;
  
  const now = new Date();
  const start = new Date(dl.createdAt || dl.deadline);
  const end = new Date(dl.deadline);
  const totalMs = end.getTime() - start.getTime();
  
  waterfallWrap.innerHTML = '';
  
  if (totalMs <= 0 || !dl.milestones || dl.milestones.length === 0) {
    waterfallWrap.innerHTML = '<div class="timeline-empty" style="display:block">No milestones to chart. Add some to build the waterfall.</div>';
    return;
  }
  
  const sorted = [...dl.milestones].sort((a,b) => new Date(a.date) - new Date(b.date));
  
  const elapsed = now.getTime() - start.getTime();
  const nowPct = Math.max(0, Math.min(100, (elapsed / totalMs) * 100));
  
  let html = `
    <div class="wf-today-line" style="left: ${nowPct}%"></div>
    <div class="wf-today-label" style="left: ${nowPct}%">TODAY</div>
  `;
  
  let lastMs = start.getTime();
  const segments = [];
  
  sorted.forEach(ms => {
    const msTime = new Date(ms.date).getTime();
    if (msTime > start.getTime() && msTime <= end.getTime()) {
      segments.push({ name: ms.name, color: ms.color, start: lastMs, end: msTime });
      lastMs = msTime;
    }
  });
  
  if (lastMs < end.getTime()) {
    segments.push({ name: dl.name, color: dl.color, start: lastMs, end: end.getTime() });
  }
  
  // Render grid lines for each segment start, plus the end
  segments.forEach(seg => {
    const pct = ((seg.start - start.getTime()) / totalMs) * 100;
    if (pct >= 0 && pct <= 100) html += `<div class="wf-grid-line" style="left: ${pct}%"></div>`;
  });
  html += `<div class="wf-grid-line" style="left: 100%"></div>`;
  
  segments.forEach((seg, i) => {
    const segStartPct = Math.max(0, ((seg.start - start.getTime()) / totalMs) * 100);
    const segEndPct = Math.min(100, ((seg.end - start.getTime()) / totalMs) * 100);
    const width = Math.max(0.2, segEndPct - segStartPct);
    
    // Prevent right-edge overflow by aligning text to the right if start is near the end
    const contentStyle = segStartPct > 60 
      ? 'right: 0; align-items: flex-end; text-align: right;' 
      : 'left: 0; align-items: flex-start; text-align: left;';
    
    html += `
      <div class="wf-row">
        <div class="wf-bar" style="left: ${segStartPct}%; width: ${width}%; --wf-color: ${seg.color}">
          <div class="wf-bar-content" style="${contentStyle}">
            <span class="wf-label">${esc(seg.name)}</span>
            <span class="wf-date">${formatShortDate(new Date(seg.start))}</span>
          </div>
        </div>
      </div>
    `;
  });
  
  waterfallWrap.innerHTML = html;
}

function makeCap(label) {
  const cap = document.createElement('div');
  cap.className = 'timeline-cap';
  cap.innerHTML = `<div class="cap-dot"><div class="cap-dot-inner"></div></div><span class="cap-label">${label}</span>`;
  return cap;
}

// ─── TICK ────────────────────────────────────────────────────────────────────
function tick() {
  const dl = getActive();
  if (!dl) return;

  const now      = new Date();
  const deadline = new Date(dl.deadline);
  const result   = computeBreakdown(now, deadline, dl.dayStart, dl.dayEnd);

  if (!result || result.totalMs <= 0) {
    showExpired();
    return;
  }

  setTileValue(daysVal,       result.totalDays);
  setTileValue(dayHoursVal,   result.dayHours);
  setTileValue(nightHoursVal, result.nightHours);
  setTileValue(minsVal,       result.minsLeftToday);

  const daytime = isDay(now, dl.dayStart, dl.dayEnd);
  phaseDot.className = 'phase-dot ' + (daytime ? 'day' : 'night');
  phaseText.textContent = daytime
    ? 'Daytime — the clock is ticking'
    : 'Nighttime — rest while you can';

  if (dl.createdAt) {
    const total   = deadline - new Date(dl.createdAt);
    const elapsed = now - new Date(dl.createdAt);
    const pct     = Math.min(100, Math.max(0, (elapsed / total) * 100));
    progressFill.style.width = pct.toFixed(2) + '%';
    progressPct.textContent  = pct.toFixed(1) + '%';
    progressStart.textContent = formatShortDate(new Date(dl.createdAt));
    progressEnd.textContent   = formatShortDate(deadline);
  }
}

// ─── VIEW SWITCHING ────────────────────────────────────────────────────────
function showHub() {
  state.activeId = null;
  saveState();
  clearInterval(ticker);
  
  hubPanel.classList.remove('hidden');
  countdownPanel.classList.add('hidden');
  expiredPanel.classList.add('hidden');
  
  renderHub();
}

function showCountdown() {
  const dl = getActive();
  if (!dl) { showHub(); return; }

  hubPanel.classList.add('hidden');
  expiredPanel.classList.add('hidden');
  countdownPanel.classList.remove('hidden');

  document.documentElement.style.setProperty('--active-color', dl.color);
  deadlineLabel.textContent = dl.name;
  deadlineExact.textContent = 'Deadline: ' + formatDate(new Date(dl.deadline));

  renderTimeline();
  tick();
  clearInterval(ticker);
  ticker = setInterval(tick, 1000);
}

function showExpired() {
  const dl = getActive();
  clearInterval(ticker);
  hubPanel.classList.add('hidden');
  countdownPanel.classList.add('hidden');
  expiredPanel.classList.remove('hidden');
  
  expiredTitle.textContent = 'Deadline Reached!';
  if (dl) {
    expiredLabel.textContent = dl.name + ' has passed.';
  }
}

// ─── MODAL CONTROLS ──────────────────────────────────────────────────────
function openDeadlineModal(editId = null) {
  editingDeadlineId = editId;
  deadlineModalTitle.textContent = editId ? 'Edit Deadline' : 'New Deadline';

  if (editId) {
    const dl = state.deadlines.find(d => d.id === editId);
    if (!dl) return;
    dlName.value     = dl.name;
    dlDate.value     = isoForInput(new Date(dl.deadline));
    dlDayStart.value = dl.dayStart;
    dlDayEnd.value   = dl.dayEnd;
    setSelectedColor(dlColorRow, dl.color);
    btnSaveDeadline.textContent = 'Save Changes';
  } else {
    dlName.value = '';
    const t = new Date(); t.setDate(t.getDate() + 7); t.setHours(17,0,0,0);
    dlDate.value = isoForInput(t);
    dlDayStart.value = '07:00';
    dlDayEnd.value   = '22:00';
    setSelectedColor(dlColorRow, '#6c63ff');
    btnSaveDeadline.textContent = 'Create Deadline';
  }

  deadlineModal.classList.remove('hidden');
  setTimeout(() => dlName.focus(), 50);
}

function closeDeadlineModal() { deadlineModal.classList.add('hidden'); }

function openMilestoneModal(editId = null) {
  const dl = getActive();
  if (!dl) return;
  
  editingMilestoneId = editId;
  const modalTitle = milestoneModal.querySelector('.modal-title');
  modalTitle.textContent = editId ? 'Edit Milestone' : 'Add Milestone';

  if (editId) {
    const ms = dl.milestones.find(m => m.id === editId);
    if (!ms) return;
    msNameInput.value = ms.name;
    msDateInput.value = isoForInput(new Date(ms.date));
    msLocationInput.value = ms.location || '';
    setSelectedColor(colorRow, ms.color);
    btnSaveMilestone.textContent = 'Save Changes';
  } else {
    msNameInput.value = '';
    msLocationInput.value = '';
    const mid = new Date((Date.now() + new Date(dl.deadline).getTime()) / 2);
    msDateInput.value = isoForInput(mid);
    setSelectedColor(colorRow, '#00d4b4');
    btnSaveMilestone.textContent = 'Add to Timeline';
  }
  
  milestoneModal.classList.remove('hidden');
  setTimeout(() => msNameInput.focus(), 50);
}
function closeMilestoneModal() { milestoneModal.classList.add('hidden'); }

// ─── BINDINGS ───────────────────────────────────────────────────────────
btnOpenCreateModal.addEventListener('click', () => openDeadlineModal(null));
btnCloseDeadlineModal.addEventListener('click', closeDeadlineModal);
deadlineModal.addEventListener('click', e => { if (e.target === deadlineModal) closeDeadlineModal(); });

btnAddMilestone.addEventListener('click', () => openMilestoneModal(null));
btnModalClose.addEventListener('click', closeMilestoneModal);
milestoneModal.addEventListener('click', e => { if (e.target === milestoneModal) closeMilestoneModal(); });

// View toggles
btnListView.addEventListener('click', () => {
  currentTimelineView = 'list';
  btnListView.classList.add('active');
  btnWaterfallView.classList.remove('active');
  timelineWrap.classList.remove('hidden');
  waterfallWrap.classList.add('hidden');
  renderTimeline();
});
btnWaterfallView.addEventListener('click', () => {
  currentTimelineView = 'waterfall';
  btnWaterfallView.classList.add('active');
  btnListView.classList.remove('active');
  waterfallWrap.classList.remove('hidden');
  timelineWrap.classList.add('hidden');
  renderTimeline();
});

btnBack.addEventListener('click', showHub);
btnExpiredBack.addEventListener('click', showHub);
btnEditDeadline.addEventListener('click', () => { if (state.activeId) openDeadlineModal(state.activeId); });

// Color swatches shared logic
[dlColorRow, colorRow].forEach(row => {
  row.addEventListener('click', e => {
    const swatch = e.target.closest('.color-swatch');
    if (!swatch) return;
    row.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
    swatch.classList.add('selected');
  });
});

// Save or Create Deadline
btnSaveDeadline.addEventListener('click', () => {
  const name = dlName.value.trim() || 'My Deadline';
  const val  = dlDate.value;
  if (!val) { dlDate.focus(); return; }

  const target = new Date(val);
  if (target <= new Date()) { dlDate.focus(); return; }

  if (editingDeadlineId) {
    const dl = state.deadlines.find(d => d.id === editingDeadlineId);
    if (dl) {
      dl.name = name;
      dl.deadline = target.toISOString();
      dl.dayStart = dlDayStart.value || '07:00';
      dl.dayEnd   = dlDayEnd.value   || '22:00';
      dl.color    = getSelectedColor(dlColorRow);
    }
  } else {
    state.deadlines.push({
      id: uid(),
      name,
      deadline: target.toISOString(),
      dayStart: dlDayStart.value || '07:00',
      dayEnd:   dlDayEnd.value   || '22:00',
      createdAt: new Date().toISOString(),
      color: getSelectedColor(dlColorRow),
      milestones: []
    });
  }

  saveState();
  closeDeadlineModal();
  
  if (editingDeadlineId && state.activeId === editingDeadlineId) showCountdown();
  else showHub();
});

// Save or Edit Milestone
btnSaveMilestone.addEventListener('click', () => {
  const dl = getActive();
  if (!dl) return;

  const name = msNameInput.value.trim();
  const val  = msDateInput.value;
  const loc  = msLocationInput.value.trim();
  if (!name || !val) return;

  dl.milestones = dl.milestones || [];

  if (editingMilestoneId) {
    const ms = dl.milestones.find(m => m.id === editingMilestoneId);
    if (ms) {
      ms.name = name;
      ms.date = new Date(val).toISOString();
      ms.color = getSelectedColor(colorRow);
      ms.location = loc;
    }
  } else {
    dl.milestones.push({
      id: uid(),
      name,
      date: new Date(val).toISOString(),
      color: getSelectedColor(colorRow),
      location: loc
    });
  }

  saveState();
  closeMilestoneModal();
  renderTimeline();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeDeadlineModal();
    closeMilestoneModal();
  }
});

// ─── PERSISTENCE & MIGRATION ──────────────────────────────────────────────
function saveState() {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

function loadState() {
  try {
    const rawV2 = localStorage.getItem(STATE_KEY);
    if (rawV2) {
      state = { ...state, ...JSON.parse(rawV2) };
      return;
    }
    // Migration from v1
    const rawV1 = localStorage.getItem('countdown_state');
    if (rawV1) {
      const v1 = JSON.parse(rawV1);
      if (v1.deadline) {
        const id = uid();
        state.deadlines.push({
          id,
          name: v1.name || 'Legacy Deadline',
          deadline: v1.deadline,
          dayStart: v1.dayStart || '07:00',
          dayEnd: v1.dayEnd || '22:00',
          createdAt: v1.createdAt || new Date().toISOString(),
          color: '#6c63ff',
          milestones: v1.milestones || []
        });
        state.activeId = id;
      }
      localStorage.removeItem('countdown_state');
      saveState();
    }
  } catch { /* ignore */ }
}

// ─── INIT ───────────────────────────────────────────────────────────────
loadState();

if (state.activeId) {
  const dl = getActive();
  if (dl && new Date(dl.deadline) > new Date()) {
    showCountdown();
  } else {
    showHub();
  }
} else {
  showHub();
}

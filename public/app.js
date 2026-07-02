// ============ CONFIG ============
const API = 'http://localhost:4000/api';

// ============ STATE ============
const S = {
  token: localStorage.getItem('ownerToken') || null,
  user: null,
  page: 'dashboard',
  data: {
    dash: {}, complaints: [], alerts: [], bookings: [],
    parking: { slots: [], history: [] }, finance: {},
    workers: [], residents: [], visitors: [], cctv: [], analytics: {}
  },
  activeTicketId: null,
  charts: {},
  refreshTimer: null
};

// ============ INIT ============
window.addEventListener('DOMContentLoaded', () => {
  tickClock();
  setInterval(tickClock, 1000);
  if (S.token) verifyThenLoad();
});

function tickClock() {
  const el = document.getElementById('tbClock');
  if (el) el.textContent = new Date().toLocaleTimeString('en-IN');
}

// ============ AUTH ============
function prefill(u, p) {
  document.getElementById('loginUser').value = u;
  document.getElementById('loginPass').value = p;
}

async function doLogin() {
  const username = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value.trim();
  const btn = document.getElementById('loginBtn');
  const err = document.getElementById('loginErr');
  err.classList.add('hidden');
  btn.textContent = 'Signing in…'; btn.disabled = true;
  try {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    if (data.user.role !== 'owner' && data.user.role !== 'admin')
      throw new Error('Access denied. Owner/Management accounts only.');
    S.token = data.token; S.user = data.user;
    localStorage.setItem('ownerToken', data.token);
    launchApp();
  } catch (e) {
    err.textContent = e.message; err.classList.remove('hidden');
  } finally { btn.textContent = 'Sign In to Portal'; btn.disabled = false; }
}

document.addEventListener('keydown', e => {
  const ls = document.getElementById('loginScreen');
  if (e.key === 'Enter' && ls && !ls.classList.contains('hidden')) doLogin();
});

async function verifyThenLoad() {
  try {
    const res = await fetch(`${API}/auth/me`, { headers: hdrs() });
    if (!res.ok) throw new Error();
    S.user = await res.json();
    if (S.user.role !== 'owner' && S.user.role !== 'admin') throw new Error();
    launchApp();
  } catch { S.token = null; localStorage.removeItem('ownerToken'); }
}

function doLogout() {
  S.token = null; S.user = null;
  localStorage.removeItem('ownerToken');
  if (S.refreshTimer) clearInterval(S.refreshTimer);
  document.getElementById('app').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
  toast('Signed out.', 'info');
}

function hdrs() {
  return { 'Authorization': `Bearer ${S.token}`, 'Content-Type': 'application/json' };
}

// ============ APP LAUNCH ============
function launchApp() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  // Set user info
  if (S.user) {
    document.getElementById('sbAvatar').textContent = S.user.avatar || S.user.name[0];
    document.getElementById('sbUname').textContent = S.user.name;
    document.getElementById('sbUrole').textContent = S.user.role.charAt(0).toUpperCase() + S.user.role.slice(1);
  }
  refreshAll();
  if (S.refreshTimer) clearInterval(S.refreshTimer);
  S.refreshTimer = setInterval(refreshAll, 10000);
}

// ============ REFRESH ============
async function refreshAll() {
  const btn = document.querySelector('.tb-btn');
  if (btn) btn.classList.add('spinning');
  try {
    await Promise.all([
      fetchDash(), fetchComplaints(), fetchAlerts(), fetchBookings(),
      fetchParking(), fetchFinance(), fetchWorkers(),
      fetchResidents(), fetchVisitors(), fetchCctv()
    ]);
    renderPage();
    updateBadges();
    checkAlertBanner();
  } catch (e) { console.warn('Refresh error:', e); }
  finally { if (btn) btn.classList.remove('spinning'); }
}

// ============ API CALLS ============
async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, { headers: hdrs(), ...opts });
  if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || res.statusText); }
  return res.json();
}

async function fetchDash()       { S.data.dash = await api('/owner/dashboard'); }
async function fetchComplaints() { S.data.complaints = await api('/owner/complaints'); }
async function fetchAlerts()     { S.data.alerts = await api('/owner/emergency-alerts'); }
async function fetchBookings()   { S.data.bookings = await api('/owner/bookings'); }
async function fetchParking()    { S.data.parking = await api('/owner/parking'); }
async function fetchFinance()    { S.data.finance = await api('/owner/finance'); }
async function fetchWorkers()    { S.data.workers = await api('/owner/workers'); }
async function fetchResidents()  { S.data.residents = await api('/owner/residents'); }
async function fetchVisitors()   { S.data.visitors = await api('/owner/visitors'); }
async function fetchCctv()       { S.data.cctv = await api('/owner/cctv'); }
async function fetchAnalytics()  { S.data.analytics = await api('/owner/analytics'); }

// ============ NAVIGATION ============
function showPage(page) {
  S.page = page;
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  document.querySelectorAll('.page-wrap').forEach(s => s.classList.add('hidden'));
  const sec = document.getElementById(`page-${page}`);
  if (sec) sec.classList.remove('hidden');
  const titles = {
    dashboard:'Dashboard', complaints:'Complaint Management', emergency:'Emergency Monitoring',
    bookings:'Facility Booking Monitoring', parking:'Parking Management', finance:'Finance Dashboard',
    workers:'Worker Management', cctv:'CCTV Monitoring', residents:'Resident Management',
    visitors:'Visitor & Delivery Log', analytics:'Analytics', ai:'AI Assistant'
  };
  document.getElementById('pageHeading').textContent = titles[page] || page;
  renderPage();
}

function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  sb.style.display = sb.style.display === 'none' ? '' : 'none';
}

function renderPage() {
  switch (S.page) {
    case 'dashboard':  renderDashboard();  break;
    case 'complaints': renderComplaints(); break;
    case 'emergency':  renderEmergency();  break;
    case 'bookings':   renderBookings();   break;
    case 'parking':    renderParking();    break;
    case 'finance':    renderFinance();    break;
    case 'workers':    renderWorkers();    break;
    case 'cctv':       renderCctv();       break;
    case 'residents':  renderResidents();  break;
    case 'visitors':   renderVisitors();   break;
    case 'analytics':  renderAnalytics();  break;
  }
}

// ============ BADGE + BANNER ============
function updateBadges() {
  const openC = S.data.complaints.filter(t => t.status !== 'resolved').length;
  const activeE = S.data.alerts.filter(a => a.status === 'active').length;
  const totalB = S.data.bookings.length;
  document.getElementById('badge-complaints').textContent = openC;
  document.getElementById('badge-emergency').textContent = activeE;
  document.getElementById('badge-bookings').textContent = totalB;
}

function checkAlertBanner() {
  const activeAlerts = S.data.alerts.filter(a => a.status === 'active');
  const banner = document.getElementById('alertBanner');
  if (activeAlerts.length > 0) {
    banner.classList.remove('hidden');
    document.getElementById('alertBannerText').textContent =
      `🚨 ${activeAlerts.length} Active Emergency Alert${activeAlerts.length > 1 ? 's' : ''}! Latest: ${activeAlerts[0].type} at Flat ${activeAlerts[0].flat}`;
  } else {
    banner.classList.add('hidden');
  }
}

// ============ DASHBOARD ============
function renderDashboard() {
  const d = S.data.dash;
  animNum('sc-residents', d.totalResidents || 0);
  animNum('sc-complaints', d.activeComplaints || 0);
  animNum('sc-bookings', d.todayBookings || 0);
  animNum('sc-alerts', d.activeAlerts || 0);
  document.getElementById('sc-revenue').textContent = '₹' + ((d.monthlyRevenue || 0).toLocaleString('en-IN'));
  animNum('sc-parking', d.totalParkingBooked || 0);
  document.getElementById('sc-workers').textContent = `${d.availableWorkers || 0}/${d.totalWorkers || 0}`;
  animNum('sc-pending', d.pendingMaintenance || 0);

  // Activity feed
  const feed = document.getElementById('activityFeed');
  if (d.recentActivity && d.recentActivity.length) {
    feed.innerHTML = d.recentActivity.map(a => `
      <div class="feed-item">
        <div class="feed-icon">${a.icon}</div>
        <div>
          <div class="feed-text">${a.text}</div>
          <div class="feed-time">${fmtDateTime(a.time)}</div>
        </div>
      </div>`).join('');
  } else {
    feed.innerHTML = '<div class="feed-empty">No recent activity yet.</div>';
  }

  // Active alerts summary
  const alertsEl = document.getElementById('dashAlerts');
  const active = S.data.alerts.filter(a => a.status === 'active');
  if (active.length) {
    alertsEl.innerHTML = active.slice(0, 5).map(a => `
      <div class="alert-card">
        <span class="alert-type-badge">🚨 ${a.type}</span>
        <div class="alert-info">
          <strong>Flat ${a.flat}</strong>
          <p>${a.message || ''} · ${fmtDateTime(a.createdAt)}</p>
        </div>
        <button class="btn-sm btn-danger" onclick="showPage('emergency')">View</button>
      </div>`).join('');
  } else {
    alertsEl.innerHTML = '<div class="feed-empty">✅ No active emergency alerts.</div>';
  }
}

// ============ COMPLAINTS ============
function renderComplaints() {
  const q = (document.getElementById('cmSearch')?.value || '').toLowerCase();
  const sf = document.getElementById('cmStatusFilter')?.value || '';
  let list = S.data.complaints;
  if (sf) list = list.filter(t => t.status === sf);
  if (q) list = list.filter(t =>
    (t.ticketNo||'').toLowerCase().includes(q) ||
    (t.userName||'').toLowerCase().includes(q) ||
    (t.flat||'').toLowerCase().includes(q) ||
    (t.categoryName||'').toLowerCase().includes(q) ||
    (t.description||'').toLowerCase().includes(q)
  );
  const tbody = document.getElementById('complaintsTbody');
  const empty = document.getElementById('complaintsEmpty');
  if (!list.length) { tbody.innerHTML = ''; empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');
  tbody.innerHTML = list.map(t => `
    <tr>
      <td><code style="color:var(--violet);font-size:11px">${t.ticketNo||'—'}</code></td>
      <td><strong>${t.userName||'—'}</strong></td>
      <td>Flat ${t.flat||'—'}</td>
      <td>${t.categoryName||'—'}</td>
      <td style="max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${t.description||''}">${t.description||'—'}</td>
      <td><span class="badge badge-${t.priority||'medium'}">${t.priority||'medium'}</span></td>
      <td><span class="badge badge-${(t.status||'open').replace(' ','-')}">${t.status||'open'}</span></td>
      <td style="font-size:12px;color:var(--text-muted)">${t.workerName ? '👷 ' + t.workerName : '<span style="color:var(--text-dim)">Unassigned</span>'}</td>
      <td>
        <button class="btn-sm btn-primary" style="font-size:11px" onclick="openAssignWorker('${t.id}')">Manage</button>
      </td>
    </tr>`).join('');
}

// ============ EMERGENCY ============
function renderEmergency() {
  const container = document.getElementById('emergencyAlertsContainer');
  if (!S.data.alerts.length) {
    container.innerHTML = '<div class="feed-empty">No emergency alerts on record. 🎉</div>'; return;
  }
  container.innerHTML = `<div class="alert-cards">${S.data.alerts.map(a => `
    <div class="alert-card ${a.status === 'closed' ? 'alert-closed status-closed' : ''}">
      <span class="alert-type-badge">${alertEmoji(a.type)} ${a.type}</span>
      <div class="alert-info">
        <strong>Flat ${a.flat} — ${a.userName}</strong>
        <p>${a.message || ''} · ${fmtDateTime(a.createdAt)}${a.closedAt ? ` · Closed by ${a.closedBy}` : ''}</p>
      </div>
      <span class="badge badge-${a.status==='active'?'active':'closed'}">${a.status}</span>
      <div class="alert-actions">
        ${a.status === 'active' ? `
          <button class="btn-sm btn-warning" onclick="callResident('${a.userName}')">📞 Call</button>
          <button class="btn-sm btn-danger"  onclick="notifySecurity()">🛡️ Security</button>
          <button class="btn-sm btn-success" onclick="closeAlert('${a.id}')">✓ Close</button>
        ` : '<span style="font-size:12px;color:var(--text-dim)">Resolved</span>'}
      </div>
    </div>`).join('')}
  </div>`;
}

function alertEmoji(type) {
  const m = { Fire:'🔥', Medical:'🚑', Police:'🚔', Theft:'🔓', 'Gas Leak':'💨', Security:'🛡️' };
  return m[type] || '🚨';
}

async function closeAlert(id) {
  try {
    await api(`/owner/emergency-alert/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'closed' }) });
    toast('Alert closed successfully.', 'success');
    await fetchAlerts();
    renderEmergency(); checkAlertBanner(); updateBadges();
  } catch (e) { toast(e.message, 'error'); }
}

function callResident(name) { toast(`📞 Calling ${name}… (simulated)`, 'info'); }
function notifySecurity()    { toast('🛡️ Security team notified! (simulated)', 'warn'); }

// ============ BOOKINGS ============
function renderBookings() {
  // Populate facility filter
  const ff = document.getElementById('bkFacilityFilter');
  if (ff && ff.options.length === 1) {
    const facs = [...new Set(S.data.bookings.map(b => b.facilityName).filter(Boolean))];
    facs.forEach(f => { const o = document.createElement('option'); o.value = f; o.textContent = f; ff.appendChild(o); });
  }

  const q = (document.getElementById('bkSearch')?.value || '').toLowerCase();
  const fac = document.getElementById('bkFacilityFilter')?.value || '';
  let list = S.data.bookings;
  if (fac) list = list.filter(b => b.facilityName === fac);
  if (q) list = list.filter(b =>
    (b.userName||'').toLowerCase().includes(q) ||
    (b.flat||'').toLowerCase().includes(q) ||
    (b.slot||'').toLowerCase().includes(q)
  );
  const tbody = document.getElementById('bookingsTbody');
  const empty = document.getElementById('bookingsEmpty');
  if (!list.length) { tbody.innerHTML = ''; empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');
  tbody.innerHTML = list.map(b => `
    <tr>
      <td><strong>${b.userName||'—'}</strong></td>
      <td>Flat ${b.flat||'—'}</td>
      <td>${b.facilityName||'—'}</td>
      <td>${b.date ? fmtDate(b.date) : '—'}</td>
      <td style="font-size:12px;color:var(--text-muted)">${b.slot||'—'}</td>
      <td style="color:var(--emerald);font-weight:700">₹${(b.amount||0).toLocaleString('en-IN')}</td>
      <td><span class="badge badge-${(b.status||'confirmed').toLowerCase().replace(' ','-')}">${b.status||'confirmed'}</span></td>
      <td>
        ${b.status !== 'cancelled' && b.status !== 'blocked' ? `
          <button class="btn-sm btn-danger"  style="font-size:11px" onclick="manageBooking('${b.id}','cancel')">Cancel</button>
          <button class="btn-sm btn-warning" style="font-size:11px;margin-left:4px" onclick="manageBooking('${b.id}','block')">Block</button>
        ` : `<button class="btn-sm btn-success" style="font-size:11px" onclick="manageBooking('${b.id}','restore')">Restore</button>`}
      </td>
    </tr>`).join('');
}

async function manageBooking(id, action) {
  try {
    await api(`/owner/booking/${id}`, { method: 'PATCH', body: JSON.stringify({ action }) });
    toast(`Booking ${action}d successfully.`, action === 'restore' ? 'success' : 'warn');
    await fetchBookings(); renderBookings(); updateBadges();
  } catch (e) { toast(e.message, 'error'); }
}

// ============ PARKING ============
function renderParking() {
  const grid = document.getElementById('parkingGrid');
  const slots = S.data.parking.slots || [];
  grid.innerHTML = slots.map(s => `
    <div class="parking-slot ps-${s.status}">
      <div class="ps-id">${s.slot}</div>
      <div class="ps-type">${s.type}</div>
      <div class="ps-info">${s.flat ? `Flat ${s.flat}` : ''}</div>
      <span class="badge badge-${s.status}">${s.status}</span>
      <div style="margin-top:8px;display:flex;gap:4px;justify-content:center;flex-wrap:wrap">
        ${s.status === 'available' ? `<button class="ps-btn" style="background:var(--amber-dim);color:var(--amber)" onclick="setSlotStatus('${s.id}','reserved')">Reserve</button>` : ''}
        ${s.status === 'reserved'  ? `<button class="ps-btn" style="background:var(--emerald-dim);color:var(--emerald)" onclick="setSlotStatus('${s.id}','available')">Free</button>` : ''}
        ${s.status === 'occupied'  ? `<button class="ps-btn" style="background:var(--emerald-dim);color:var(--emerald)" onclick="setSlotStatus('${s.id}','available')">Release</button>` : ''}
        <button class="ps-btn ps-btn-remove" onclick="removeSlot('${s.id}')">✕</button>
      </div>
    </div>`).join('');

  // History
  const history = S.data.parking.history || [];
  const tbody = document.getElementById('parkingHistoryTbody');
  tbody.innerHTML = history.length
    ? history.map(h => `<tr>
        <td><strong>${h.slot}</strong></td>
        <td>${h.flat||'—'}</td>
        <td style="font-size:12px;color:var(--text-muted)">${h.vehicle||'—'}</td>
        <td>${h.action||'—'}</td>
        <td style="font-size:11px;color:var(--text-muted)">${fmtDateTime(h.timestamp)}</td>
      </tr>`).join('')
    : '<tr class="empty-row"><td colspan="5">No parking history yet.</td></tr>';
}

async function setSlotStatus(id, status) {
  try {
    await api(`/owner/parking/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    toast(`Slot ${status}.`, 'success');
    await fetchParking(); renderParking();
  } catch (e) { toast(e.message, 'error'); }
}

async function removeSlot(id) {
  if (!confirm('Remove this parking slot?')) return;
  try {
    await api(`/owner/parking/${id}`, { method: 'DELETE' });
    toast('Parking slot removed.', 'success');
    await fetchParking(); renderParking();
  } catch (e) { toast(e.message, 'error'); }
}

function showAddParkingModal() { document.getElementById('addParkingModal').classList.remove('hidden'); }
async function submitAddParking() {
  const slot = document.getElementById('pkSlot').value.trim();
  const type = document.getElementById('pkType').value;
  if (!slot) { toast('Slot ID is required.', 'error'); return; }
  try {
    await api('/owner/parking', { method: 'POST', body: JSON.stringify({ slot, type }) });
    toast('Parking slot added!', 'success');
    closeModal('addParkingModal');
    document.getElementById('pkSlot').value = '';
    await fetchParking(); renderParking();
  } catch (e) { toast(e.message, 'error'); }
}

// ============ FINANCE ============
function renderFinance() {
  const f = S.data.finance;
  const summaryEl = document.getElementById('financeSummary');
  summaryEl.innerHTML = `
    <div class="fin-card fin-collected">
      <div class="fin-card-label">💰 Total Collected</div>
      <div class="fin-card-val">₹${(f.totalCollected||0).toLocaleString('en-IN')}</div>
    </div>
    <div class="fin-card fin-pending">
      <div class="fin-card-label">⏳ Pending Amount</div>
      <div class="fin-card-val">₹${(f.pendingAmount||0).toLocaleString('en-IN')}</div>
    </div>
    <div class="fin-card fin-total">
      <div class="fin-card-label">📊 Total Bills</div>
      <div class="fin-card-val">${(f.breakdown||[]).length}</div>
    </div>`;

  // Bills table
  const billsTbody = document.getElementById('billsTbody');
  billsTbody.innerHTML = (f.breakdown||[]).map(b => `
    <tr>
      <td><strong>${b.name}</strong></td>
      <td style="color:var(--emerald);font-weight:700">₹${(b.amount||0).toLocaleString('en-IN')}</td>
      <td style="font-size:12px;color:var(--text-muted)">${b.dueDate||'—'}</td>
      <td><span class="badge badge-${b.status}">${b.status}</span></td>
    </tr>`).join('') || '<tr class="empty-row"><td colspan="4">No bills data.</td></tr>';

  // Payments table
  const payTbody = document.getElementById('paymentsTbody');
  payTbody.innerHTML = (f.payments||[]).map(p => `
    <tr>
      <td><strong>${p.userName||'—'}</strong> <span style="font-size:11px;color:var(--text-muted)">Flat ${p.flat||'—'}</span></td>
      <td>${p.billName||'—'}</td>
      <td style="color:var(--emerald);font-weight:700">₹${(p.amount||0).toLocaleString('en-IN')}</td>
      <td><span style="font-size:12px;color:var(--text-muted)">${p.method||'—'}</span></td>
      <td style="font-size:11px;color:var(--text-muted)">${p.paidAt ? fmtDateTime(p.paidAt) : '—'}</td>
    </tr>`).join('') || '<tr class="empty-row"><td colspan="5">No payments yet.</td></tr>';
}

// ============ WORKERS ============
function renderWorkers() {
  const grid = document.getElementById('workersGrid');
  if (!S.data.workers.length) { grid.innerHTML = '<div class="feed-empty" style="grid-column:1/-1">No workers added yet.</div>'; return; }
  const roleEmoji = { 'Electrician':'⚡','Plumber':'🔧','Cleaner':'🧹','Security Guard':'🛡️','Elevator Tech':'🛗','Painter':'🖌️','Carpenter':'🪚' };
  grid.innerHTML = S.data.workers.map((w, i) => `
    <div class="worker-card" style="animation-delay:${i*0.06}s">
      <button class="wc-delete" onclick="deleteWorker('${w.id}')" title="Remove worker">✕</button>
      <div class="wc-avatar">${roleEmoji[w.role] || '👷'}</div>
      <div class="wc-name">${w.name}</div>
      <div class="wc-role">${w.role}</div>
      <div class="wc-phone">📞 ${w.phone||'—'}</div>
      <div class="wc-footer">
        <span class="badge badge-${w.status==='available'?'available':'occupied'}">${w.status}</span>
        <span style="font-size:11px;color:var(--text-dim)">Since ${w.joinedAt||'—'}</span>
      </div>
      <div class="wc-actions">
        ${w.status === 'busy'
          ? `<button class="btn-sm btn-success" style="font-size:11px" onclick="setWorkerStatus('${w.id}','available')">Mark Available</button>`
          : `<button class="btn-sm btn-warning" style="font-size:11px" onclick="setWorkerStatus('${w.id}','busy')">Mark Busy</button>`}
      </div>
    </div>`).join('');
}

function showAddWorkerModal() { document.getElementById('addWorkerModal').classList.remove('hidden'); }
async function submitAddWorker() {
  const name = document.getElementById('wkName').value.trim();
  const role = document.getElementById('wkRole').value;
  const phone = document.getElementById('wkPhone').value.trim();
  if (!name) { toast('Worker name is required.', 'error'); return; }
  try {
    await api('/owner/workers', { method: 'POST', body: JSON.stringify({ name, role, phone }) });
    toast(`Worker ${name} added!`, 'success');
    closeModal('addWorkerModal');
    document.getElementById('wkName').value = '';
    document.getElementById('wkPhone').value = '';
    await fetchWorkers(); renderWorkers();
  } catch (e) { toast(e.message, 'error'); }
}

async function setWorkerStatus(id, status) {
  try {
    await api(`/owner/worker/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    toast(`Worker marked as ${status}.`, 'success');
    await fetchWorkers(); renderWorkers();
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteWorker(id) {
  if (!confirm('Remove this worker?')) return;
  try {
    await api(`/owner/worker/${id}`, { method: 'DELETE' });
    toast('Worker removed.', 'success');
    await fetchWorkers(); renderWorkers();
  } catch (e) { toast(e.message, 'error'); }
}

// ============ CCTV ============
function renderCctv() {
  const floorF = document.getElementById('cctvFloorFilter')?.value || '';
  let cams = S.data.cctv;
  if (floorF) cams = cams.filter(c => c.floor === floorF);
  const grid = document.getElementById('cctvGrid');
  if (!cams.length) { grid.innerHTML = '<div class="feed-empty" style="grid-column:1/-1">No cameras match filter.</div>'; return; }
  const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  grid.innerHTML = cams.map((c, i) => `
    <div class="cctv-card" style="animation-delay:${i*0.05}s">
      <div class="cctv-screen" style="background: ${c.status==='offline' ? '#1a1a1a' : `linear-gradient(135deg,${hexToRgba(c.color||'#6366f1',0.15)},${hexToRgba(c.color||'#3b82f6',0.08)})`}">
        ${c.status === 'online' ? `
          <div class="cctv-scanlines"></div>
          <div class="cctv-glitch">[ LIVE FEED ]</div>
          <div class="cctv-dot online"></div>
          <div class="cctv-label">CAM ${c.id.replace('c','').padStart(2,'0')}</div>
          <div class="cctv-time">${now}</div>
        ` : `
          <div class="cctv-dot offline"></div>
          <div style="color:var(--slate);font-size:12px;font-family:monospace">[ NO SIGNAL ]</div>
        `}
      </div>
      <div class="cctv-info">
        <div class="cctv-name">${c.name}</div>
        <div class="cctv-loc">${c.location} · ${c.floor} &nbsp;<span class="badge badge-${c.status}">${c.status}</span></div>
      </div>
    </div>`).join('');
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ============ RESIDENTS ============
function renderResidents() {
  const q = (document.getElementById('resSearch')?.value || '').toLowerCase();
  let list = S.data.residents;
  if (q) list = list.filter(r => r.name.toLowerCase().includes(q) || r.flat.toLowerCase().includes(q));
  const grid = document.getElementById('residentsGrid');
  if (!list.length) { grid.innerHTML = '<div class="feed-empty" style="grid-column:1/-1">No residents found.</div>'; return; }
  grid.innerHTML = list.map((r, i) => `
    <div class="resident-card" style="animation-delay:${i*0.08}s">
      <div class="res-avatar">${r.avatar||r.name[0]}</div>
      <div>
        <div class="res-name">${r.name}</div>
        <div class="res-flat">Flat ${r.flat} · @${r.username}</div>
        <div class="res-stats">
          <span class="res-stat">📅 ${r.bookingCount} Bookings</span>
          <span class="res-stat">🔧 ${r.ticketCount} Tickets</span>
          <span class="res-stat">💳 ${r.paymentCount} Payments</span>
          <span class="res-stat ${r.pendingBills>0?'':''}">⏳ ${r.pendingBills} Bills Due</span>
        </div>
      </div>
    </div>`).join('');
}

// ============ VISITORS ============
function renderVisitors() {
  const tbody = document.getElementById('visitorsTbody');
  const empty = document.getElementById('visitorsEmpty');
  if (!S.data.visitors.length) { tbody.innerHTML = ''; empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');
  tbody.innerHTML = S.data.visitors.map(v => `
    <tr>
      <td><strong>${v.name||'—'}</strong></td>
      <td><span style="font-size:12px;color:var(--text-muted)">${v.type||'—'}</span></td>
      <td>Flat ${v.flat||'—'}</td>
      <td style="font-size:12px">${v.date||'—'}</td>
      <td style="font-size:12px;color:var(--emerald)">${v.entryTime||'—'}</td>
      <td style="font-size:12px;color:var(--text-muted)">${v.exitTime||'—'}</td>
      <td><span class="badge badge-${(v.status||'Expected').toLowerCase()}">${v.status||'Expected'}</span></td>
    </tr>`).join('');
}

// ============ ANALYTICS ============
async function renderAnalytics() {
  await fetchAnalytics();
  const a = S.data.analytics;
  const chartDefaults = {
    plugins: { legend: { labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 } } } },
    scales: {
      x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8a96aa', font: { family: 'Inter', size: 11 } } },
      y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8a96aa', font: { family: 'Inter', size: 11 } } }
    }
  };

  // Revenue chart
  destroyChart('revenueChart');
  if (a.monthlyRevenue) {
    S.charts.revenue = new Chart(document.getElementById('revenueChart'), {
      type: 'bar',
      data: {
        labels: a.monthlyRevenue.map(m => m.month),
        datasets: [{ label: 'Revenue (₹)', data: a.monthlyRevenue.map(m => m.amount),
          backgroundColor: 'rgba(99,102,241,0.5)', borderColor: '#6366f1', borderWidth: 2, borderRadius: 6 }]
      },
      options: { ...chartDefaults, plugins: { ...chartDefaults.plugins }, responsive: true, maintainAspectRatio: false }
    });
  }

  // Complaints by category
  destroyChart('complaintsChart');
  if (a.complaintsByCategory) {
    const cats = a.complaintsByCategory.filter(c => c.count > 0);
    const colors = ['#6366f1','#3b82f6','#10b981','#f59e0b','#f43f5e','#8b5cf6'];
    S.charts.complaints = new Chart(document.getElementById('complaintsChart'), {
      type: 'doughnut',
      data: {
        labels: cats.map(c => c.name),
        datasets: [{ data: cats.map(c => c.count), backgroundColor: colors.slice(0, cats.length), borderWidth: 0 }]
      },
      options: { responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'right', labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 }, padding: 10 } } }
      }
    });
  }

  // Facility usage
  destroyChart('facilityChart');
  if (a.facilityUsage) {
    S.charts.facility = new Chart(document.getElementById('facilityChart'), {
      type: 'bar',
      data: {
        labels: a.facilityUsage.map(f => f.name.length > 12 ? f.name.slice(0,12)+'…' : f.name),
        datasets: [{ label: 'Bookings', data: a.facilityUsage.map(f => f.count),
          backgroundColor: 'rgba(16,185,129,0.5)', borderColor: '#10b981', borderWidth: 2, borderRadius: 6 }]
      },
      options: { ...chartDefaults, responsive: true, maintainAspectRatio: false }
    });
  }

  // Parking usage
  destroyChart('parkingChart');
  if (a.parkingUsage) {
    S.charts.parking = new Chart(document.getElementById('parkingChart'), {
      type: 'pie',
      data: {
        labels: ['Occupied', 'Available', 'Reserved'],
        datasets: [{ data: [a.parkingUsage.occupied, a.parkingUsage.available, a.parkingUsage.reserved],
          backgroundColor: ['rgba(244,63,94,0.7)','rgba(16,185,129,0.7)','rgba(245,158,11,0.7)'], borderWidth: 0 }]
      },
      options: { responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'right', labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 }, padding: 10 } } }
      }
    });
  }
}

function destroyChart(id) {
  const key = id.replace('Chart','');
  if (S.charts[key]) { S.charts[key].destroy(); delete S.charts[key]; }
}

// ============ ASSIGN WORKER MODAL ============
function openAssignWorker(ticketId) {
  S.activeTicketId = ticketId;
  const ticket = S.data.complaints.find(t => t.id === ticketId);
  if (!ticket) return;
  document.getElementById('awTicketInfo').textContent =
    `${ticket.ticketNo} — ${ticket.categoryName} (Flat ${ticket.flat})`;
  document.getElementById('awStatus').value = '';
  const workerSel = document.getElementById('awWorker');
  workerSel.innerHTML = '<option value="">No change</option>' +
    S.data.workers.filter(w => w.status === 'available' || w.id === ticket.assignedWorker)
      .map(w => `<option value="${w.id}" ${w.id === ticket.assignedWorker ? 'selected' : ''}>${w.name} (${w.role}) – ${w.status}</option>`).join('');
  document.getElementById('assignWorkerModal').classList.remove('hidden');
}

async function submitAssignWorker() {
  const status = document.getElementById('awStatus').value;
  const workerId = document.getElementById('awWorker').value;
  const body = {};
  if (status) body.status = status;
  if (workerId) body.assignedWorkerId = workerId;
  if (!status && !workerId) { toast('Nothing to update.', 'info'); return; }
  try {
    await api(`/maintenance/ticket/${S.activeTicketId}`, { method: 'PATCH', body: JSON.stringify(body) });
    toast('Ticket updated successfully!', 'success');
    closeModal('assignWorkerModal');
    await Promise.all([fetchComplaints(), fetchWorkers()]);
    renderComplaints();
  } catch (e) { toast(e.message, 'error'); }
}

// ============ AI ASSISTANT ============
async function sendQuery(customQuery) {
  const input = document.getElementById('chatInput');
  const query = customQuery || input.value.trim();
  if (!query) return;
  if (input) input.value = '';
  addChatMsg(query, 'user');
  addChatMsg('Thinking…', 'bot', true);
  try {
    const data = await api('/owner/ai-query', { method: 'POST', body: JSON.stringify({ query }) });
    removeThinking();
    addChatMsg(data.answer, 'bot');
  } catch (e) {
    removeThinking();
    addChatMsg('❌ Sorry, I could not process that. Please try again.', 'bot');
  }
}

function addChatMsg(text, role, isThinking = false) {
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = `chat-msg ${role === 'user' ? 'user-msg' : ''} ${isThinking ? 'chat-thinking' : ''}`;
  div.innerHTML = `
    <div class="chat-avatar">${role === 'user' ? (S.user?.avatar || '👤') : '🤖'}</div>
    <div class="chat-bubble">${text}</div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function removeThinking() {
  const el = document.querySelector('.chat-thinking');
  if (el) el.remove();
}

// ============ MODALS ============
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
window.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) e.target.classList.add('hidden');
});

// ============ UTILITIES ============
function animNum(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  const current = parseInt(el.textContent) || 0;
  if (current === target) return;
  const steps = 20, diff = target - current;
  let step = 0;
  const t = setInterval(() => {
    step++;
    el.textContent = Math.round(current + diff * step / steps);
    if (step >= steps) { clearInterval(t); el.textContent = target; }
  }, 18);
}

function fmtDate(s) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDateTime(s) {
  if (!s) return '—';
  return new Date(s).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function toast(msg, type = 'info') {
  const c = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

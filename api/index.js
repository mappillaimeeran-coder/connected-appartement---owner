const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 4001;
const JWT_SECRET = 'connect-apartment-secret-key-2026';

// Middleware
app.use(cors());
app.use(express.json());

// Vercel serverless functions sometimes strip the /api prefix from req.url
// This middleware ensures req.url always has the /api prefix so existing routes match.
app.use((req, res, next) => {
  if (!req.url.startsWith('/api')) {
    req.url = '/api' + req.url;
  }
  next();
});


// ============ IN-MEMORY DATABASE ============

// Only owner-role users for this portal
const users = [
  { id: '4', username: 'owner',       password: bcrypt.hashSync(, 4), name: 'Mr. Kumar',        flat: 'Owner Suite', role: 'owner', avatar: 'O'  },
  { id: '5', username: 'association', password: bcrypt.hashSync(, 4), name: 'Association',      flat: 'Assoc Office', role: 'owner', avatar: 'AS' },
  { id: '6', username: 'facility',    password: bcrypt.hashSync(, 4), name: 'Facility Manager', flat: 'F-Office',     role: 'owner', avatar: 'FM' },
  { id: '7', username: 'security',    password: bcrypt.hashSync(, 4), name: 'Security Head',    flat: 'Gate Office',  role: 'owner', avatar: 'SH' },
  { id: '8', username: 'maintenance', password: bcrypt.hashSync(, 4), name: 'Maintenance Team', flat: 'M-Office',     role: 'owner', avatar: 'MT' }
];

// Resident data (read-only context for owner analytics)
const residentUsers = [
  { id: '1', name: 'Meeran', flat: '105-I', username: 'meeran', avatar: 'M' },
  { id: '2', name: 'Jeeva',  flat: '210-B', username: 'jeeva',  avatar: 'J' }
];

const facilities = [
  { id: 'f1', name: 'Swimming Pool', price: 200 },
  { id: 'f2', name: 'Gymnasium',     price: 150 },
  { id: 'f3', name: 'Tennis Court',  price: 300 },
  { id: 'f4', name: 'Party Hall',    price: 2000 },
  { id: 'f5', name: 'Guest Room',    price: 500 }
];

let bookings = [];

const billTypes = [
  { id: 'b1', name: 'Rent Payment',       amount: 15000, dueDate: '2026-04-05', status: 'pending' },
  { id: 'b2', name: 'Maintenance Charges',amount: 3500,  dueDate: '2026-04-10', status: 'pending' },
  { id: 'b3', name: 'Electricity Bill',   amount: 2200,  dueDate: '2026-04-15', status: 'pending' },
  { id: 'b4', name: 'Water Bill',         amount: 800,   dueDate: '2026-04-15', status: 'pending' },
  { id: 'b5', name: 'Gas Connection',     amount: 950,   dueDate: '2026-04-20', status: 'pending' },
  { id: 'b6', name: 'Parking Fee',        amount: 1500,  dueDate: '2026-04-05', status: 'paid'    }
];

let payments = [];

const maintenanceCategories = [
  { id: 'm1', name: 'Plumbing'     },
  { id: 'm2', name: 'Electrical'   },
  { id: 'm3', name: 'Elevator'     },
  { id: 'm4', name: 'Cleaning'     },
  { id: 'm5', name: 'Pest Control' },
  { id: 'm6', name: 'Civil Work'   }
];

let maintenanceTickets = [];

let emergencyAlerts = [];

let parkingSlots = [
  { id: 'p1',  slot: 'A-01', type: 'Car',     status: 'available', flat: null,    vehicle: null },
  { id: 'p2',  slot: 'A-02', type: 'Car',     status: 'occupied',  flat: '105-I', vehicle: 'TN 01 AB 1234' },
  { id: 'p3',  slot: 'A-03', type: 'Car',     status: 'available', flat: null,    vehicle: null },
  { id: 'p4',  slot: 'B-01', type: 'Bike',    status: 'available', flat: null,    vehicle: null },
  { id: 'p5',  slot: 'B-02', type: 'Bike',    status: 'occupied',  flat: '210-B', vehicle: 'TN 02 CD 5678' },
  { id: 'p6',  slot: 'B-03', type: 'Bike',    status: 'available', flat: null,    vehicle: null },
  { id: 'p7',  slot: 'C-01', type: 'Car',     status: 'reserved',  flat: '312-A', vehicle: 'TN 03 EF 9012' },
  { id: 'p8',  slot: 'C-02', type: 'Car',     status: 'available', flat: null,    vehicle: null },
  { id: 'p9',  slot: 'V-01', type: 'Visitor', status: 'available', flat: null,    vehicle: null },
  { id: 'p10', slot: 'V-02', type: 'Visitor', status: 'available', flat: null,    vehicle: null }
];

let parkingHistory = [
  { id: 'ph1', slot: 'A-02', flat: '105-I', vehicle: 'TN 01 AB 1234', action: 'Booked', timestamp: '2026-05-04T09:00:00.000Z' },
  { id: 'ph2', slot: 'B-02', flat: '210-B', vehicle: 'TN 02 CD 5678', action: 'Booked', timestamp: '2026-05-04T08:30:00.000Z' }
];

let workers = [
  { id: 'w1', name: 'Ravi',    role: 'Electrician',    phone: '9876500001', status: 'available', assignedTicket: null, joinedAt: '2025-01-10' },
  { id: 'w2', name: 'Kumar',   role: 'Plumber',        phone: '9876500002', status: 'available', assignedTicket: null, joinedAt: '2025-03-15' },
  { id: 'w3', name: 'Selvam',  role: 'Cleaner',        phone: '9876500003', status: 'busy',      assignedTicket: null, joinedAt: '2024-11-20' },
  { id: 'w4', name: 'Murugan', role: 'Security Guard', phone: '9876500004', status: 'available', assignedTicket: null, joinedAt: '2025-02-01' },
  { id: 'w5', name: 'Senthil', role: 'Elevator Tech',  phone: '9876500005', status: 'available', assignedTicket: null, joinedAt: '2025-04-05' }
];

const cctvCameras = [
  { id: 'c1',  name: 'Main Gate',       location: 'Entry/Exit',    floor: 'Ground',     status: 'online',  color: '#6366f1' },
  { id: 'c2',  name: 'Parking Area A',  location: 'Parking Zone A',floor: 'Ground',     status: 'online',  color: '#3b82f6' },
  { id: 'c3',  name: 'Parking Area B',  location: 'Parking Zone B',floor: 'Ground',     status: 'online',  color: '#0ea5e9' },
  { id: 'c4',  name: 'Lift Lobby – GF', location: 'Lift Lobby',    floor: 'Ground',     status: 'online',  color: '#10b981' },
  { id: 'c5',  name: 'Lift Lobby – 1F', location: 'Lift Lobby',    floor: '1st Floor',  status: 'online',  color: '#8b5cf6' },
  { id: 'c6',  name: 'Swimming Pool',   location: 'Amenity Area',  floor: 'Ground',     status: 'online',  color: '#06b6d4' },
  { id: 'c7',  name: 'Gym Entrance',    location: 'Amenity Area',  floor: '1st Floor',  status: 'offline', color: '#64748b' },
  { id: 'c8',  name: 'Stairwell Block A',location:'Common Area',   floor: 'Ground',     status: 'online',  color: '#f59e0b' },
  { id: 'c9',  name: 'Rooftop',         location: 'Terrace',       floor: 'Top Floor',  status: 'online',  color: '#f43f5e' },
  { id: 'c10', name: 'Visitor Lobby',   location: 'Reception',     floor: 'Ground',     status: 'online',  color: '#a855f7' }
];

let visitors = [
  { id: 'v1', name: 'Ramesh (Electrician)', type: 'Service', flat: '105-I', date: '2026-05-04', entryTime: '10:30 AM', exitTime: null,      status: 'Expected' },
  { id: 'v2', name: 'Priya (Guest)',         type: 'Guest',   flat: '210-B', date: '2026-05-04', entryTime: '2:00 PM',  exitTime: '5:00 PM', status: 'Exited'   }
];

// ============ MIDDLEWARE ============

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
}

function requireOwner(req, res, next) {
  if (req.user.role !== 'owner')
    return res.status(403).json({ error: 'Owner access required' });
  next();
}

// ============ AUTH ROUTES ============

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  const token = jwt.sign(
    { id: user.id, username: user.username, name: user.name, flat: user.flat, role: user.role, avatar: user.avatar },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
  res.json({ token, user: { id: user.id, name: user.name, username: user.username, flat: user.flat, role: user.role, avatar: user.avatar } });
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ id: user.id, name: user.name, username: user.username, flat: user.flat, role: user.role, avatar: user.avatar });
});

// ============ OWNER DASHBOARD ============

app.get('/api/owner/dashboard', authenticateToken, requireOwner, (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const todayBookings = bookings.filter(b => b.date === today);
  const activeAlerts = emergencyAlerts.filter(a => a.status === 'active');
  const monthlyRevenue = payments.reduce((s, p) => s + p.amount, 0);
  const recentActivity = [
    ...bookings.slice(-3).map(b   => ({ type: 'booking',  icon: '🗓️', text: `${b.userName} booked ${b.facilityName}`, time: b.createdAt })),
    ...maintenanceTickets.slice(-3).map(t => ({ type: 'ticket',   icon: '🔧', text: `${t.userName} raised ${t.categoryName} ticket`, time: t.createdAt })),
    ...payments.slice(-2).map(p   => ({ type: 'payment',  icon: '💰', text: `${p.userName} paid ₹${p.amount} for ${p.billName}`, time: p.paidAt }))
  ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 10);

  res.json({
    totalResidents:      residentUsers.length,
    activeComplaints:    maintenanceTickets.filter(t => t.status !== 'resolved').length,
    pendingMaintenance:  maintenanceTickets.filter(t => t.status === 'open').length,
    todayBookings:       todayBookings.length,
    totalParkingBooked:  parkingSlots.filter(s => s.status === 'occupied').length,
    monthlyRevenue,
    activeAlerts:        activeAlerts.length,
    totalWorkers:        workers.length,
    availableWorkers:    workers.filter(w => w.status === 'available').length,
    recentActivity,
    latestAlert:         activeAlerts[0] || null
  });
});

// ============ COMPLAINTS / TICKETS ============

app.get('/api/owner/complaints', authenticateToken, requireOwner, (req, res) => {
  res.json(maintenanceTickets.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

app.patch('/api/maintenance/ticket/:id', authenticateToken, requireOwner, (req, res) => {
  const ticket = maintenanceTickets.find(t => t.id === req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

  if (req.body.status && req.body.status !== ticket.status) {
    ticket.status = req.body.status;
    ticket.updatedAt = new Date().toISOString();
    const msg = req.body.message || `Status changed to ${req.body.status}`;
    ticket.timeline = ticket.timeline || [];
    ticket.timeline.push({ status: req.body.status, message: msg, timestamp: new Date().toISOString() });
  }
  if (req.body.assignedWorkerId) {
    const worker = workers.find(w => w.id === req.body.assignedWorkerId);
    if (worker) {
      if (ticket.assignedWorker) {
        const prev = workers.find(w => w.id === ticket.assignedWorker);
        if (prev) { prev.status = 'available'; prev.assignedTicket = null; }
      }
      ticket.assignedWorker = worker.id;
      ticket.workerName = worker.name;
      worker.status = 'busy';
      worker.assignedTicket = ticket.id;
      ticket.timeline.push({ status: ticket.status, message: `Worker ${worker.name} (${worker.role}) assigned`, timestamp: new Date().toISOString() });
    }
  }
  return res.json({ message: 'Ticket updated', ticket });
});

// ============ EMERGENCY ALERTS ============

app.get('/api/owner/emergency-alerts', authenticateToken, requireOwner, (req, res) => {
  res.json(emergencyAlerts.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

app.patch('/api/owner/emergency-alert/:id', authenticateToken, requireOwner, (req, res) => {
  const alert = emergencyAlerts.find(a => a.id === req.params.id);
  if (!alert) return res.status(404).json({ error: 'Alert not found' });
  alert.status = req.body.status || 'closed';
  alert.closedAt = new Date().toISOString();
  alert.closedBy = req.user.name;
  res.json({ message: 'Alert updated', alert });
});

// ============ BOOKINGS (OWNER VIEW) ============

app.get('/api/owner/bookings', authenticateToken, requireOwner, (req, res) => {
  res.json(bookings.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

app.patch('/api/owner/booking/:id', authenticateToken, requireOwner, (req, res) => {
  const booking = bookings.find(b => b.id === req.params.id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  const { action } = req.body;
  if (action === 'cancel')  booking.status = 'cancelled';
  else if (action === 'block')   booking.status = 'blocked';
  else if (action === 'restore') booking.status = 'confirmed';
  booking.updatedAt = new Date().toISOString();
  res.json({ message: `Booking ${action}d`, booking });
});

// ============ PARKING MANAGEMENT ============

app.get('/api/owner/parking', authenticateToken, requireOwner, (req, res) => {
  res.json({ slots: parkingSlots, history: parkingHistory.slice(-20).reverse() });
});

app.post('/api/owner/parking', authenticateToken, requireOwner, (req, res) => {
  const { slot, type } = req.body;
  if (!slot || !type) return res.status(400).json({ error: 'slot and type required' });
  const newSlot = { id: uuidv4(), slot, type, status: 'available', flat: null, vehicle: null };
  parkingSlots.push(newSlot);
  res.json({ message: 'Slot added', slot: newSlot });
});

app.delete('/api/owner/parking/:id', authenticateToken, requireOwner, (req, res) => {
  const idx = parkingSlots.findIndex(s => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Slot not found' });
  const removed = parkingSlots.splice(idx, 1)[0];
  res.json({ message: 'Slot removed', slot: removed });
});

app.patch('/api/owner/parking/:id', authenticateToken, requireOwner, (req, res) => {
  const slot = parkingSlots.find(s => s.id === req.params.id);
  if (!slot) return res.status(404).json({ error: 'Slot not found' });
  if (req.body.status)             slot.status  = req.body.status;
  if (req.body.flat !== undefined)    slot.flat    = req.body.flat;
  if (req.body.vehicle !== undefined) slot.vehicle = req.body.vehicle;
  parkingHistory.push({ id: uuidv4(), slot: slot.slot, flat: slot.flat, vehicle: slot.vehicle, action: `Status set to ${slot.status}`, timestamp: new Date().toISOString() });
  res.json({ message: 'Slot updated', slot });
});

// ============ FINANCE ============

app.get('/api/owner/finance', authenticateToken, requireOwner, (req, res) => {
  const totalCollected = payments.reduce((s, p) => s + p.amount, 0);
  const pendingAmount   = billTypes.filter(b => b.status === 'pending').reduce((s, b) => s + b.amount, 0);
  const breakdown = billTypes.map(b => ({ name: b.name, amount: b.amount, status: b.status, dueDate: b.dueDate }));
  const revenueByCategory = {};
  payments.forEach(p => { revenueByCategory[p.billName] = (revenueByCategory[p.billName] || 0) + p.amount; });
  res.json({ totalCollected, pendingAmount, breakdown, payments: payments.slice().reverse(), revenueByCategory });
});

// ============ WORKERS ============

app.get('/api/owner/workers', authenticateToken, requireOwner, (req, res) => {
  res.json(workers);
});

app.post('/api/owner/workers', authenticateToken, requireOwner, (req, res) => {
  const { name, role, phone } = req.body;
  if (!name || !role) return res.status(400).json({ error: 'name and role required' });
  const worker = { id: uuidv4(), name, role, phone: phone || '—', status: 'available', assignedTicket: null, joinedAt: new Date().toISOString().split('T')[0] };
  workers.push(worker);
  res.json({ message: 'Worker added', worker });
});

app.patch('/api/owner/worker/:id', authenticateToken, requireOwner, (req, res) => {
  const worker = workers.find(w => w.id === req.params.id);
  if (!worker) return res.status(404).json({ error: 'Worker not found' });
  if (req.body.status) worker.status = req.body.status;
  if (req.body.name)   worker.name   = req.body.name;
  if (req.body.role)   worker.role   = req.body.role;
  res.json({ message: 'Worker updated', worker });
});

app.delete('/api/owner/worker/:id', authenticateToken, requireOwner, (req, res) => {
  const idx = workers.findIndex(w => w.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Worker not found' });
  workers.splice(idx, 1);
  res.json({ message: 'Worker removed' });
});

// ============ RESIDENTS (READ-ONLY VIEW) ============

app.get('/api/owner/residents', authenticateToken, requireOwner, (req, res) => {
  const residentList = residentUsers.map(u => ({
    id: u.id, name: u.name, flat: u.flat, username: u.username, avatar: u.avatar,
    bookingCount: bookings.filter(b => b.userId === u.id).length,
    ticketCount:  maintenanceTickets.filter(t => t.userId === u.id).length,
    paymentCount: payments.filter(p => p.userId === u.id).length,
    pendingBills: billTypes.filter(b => b.status === 'pending').length
  }));
  res.json(residentList);
});

// ============ VISITORS ============

app.get('/api/owner/visitors', authenticateToken, requireOwner, (req, res) => {
  res.json(visitors.slice().reverse());
});

// ============ CCTV ============

app.get('/api/owner/cctv', authenticateToken, requireOwner, (req, res) => {
  res.json(cctvCameras);
});

// ============ ANALYTICS ============

app.get('/api/owner/analytics', authenticateToken, requireOwner, (req, res) => {
  const monthlyRevenue = [
    { month: 'Jan', amount: 48500 }, { month: 'Feb', amount: 52000 },
    { month: 'Mar', amount: 49000 }, { month: 'Apr', amount: 55000 },
    { month: 'May', amount: 61000 },
    { month: 'Jun', amount: 42000 + payments.reduce((s, p) => s + p.amount, 0) }
  ];
  const complaintsByCategory = maintenanceCategories.map(c => ({
    name: c.name, count: maintenanceTickets.filter(t => t.categoryId === c.id).length
  }));
  const facilityUsage = facilities.map(f => ({
    name: f.name, count: bookings.filter(b => b.facilityId === f.id).length
  }));
  const parkingUsage = {
    occupied:  parkingSlots.filter(s => s.status === 'occupied').length,
    available: parkingSlots.filter(s => s.status === 'available').length,
    reserved:  parkingSlots.filter(s => s.status === 'reserved').length
  };
  res.json({ monthlyRevenue, complaintsByCategory, facilityUsage, parkingUsage });
});

// ============ AI QUERY ============

app.post('/api/owner/ai-query', authenticateToken, requireOwner, (req, res) => {
  const { query } = req.body;
  const q = (query || '').toLowerCase();
  const openT    = maintenanceTickets.filter(t => t.status === 'open').length;
  const inProgT  = maintenanceTickets.filter(t => t.status === 'in-progress').length;
  const totalRevenue      = payments.reduce((s, p) => s + p.amount, 0);
  const pendingBillsAmt   = billTypes.filter(b => b.status === 'pending').reduce((s, b) => s + b.amount, 0);
  const pendingBillsCnt   = billTypes.filter(b => b.status === 'pending').length;
  const availW    = workers.filter(w => w.status === 'available').length;
  const today     = new Date().toISOString().split('T')[0];
  const todayBk   = bookings.filter(b => b.date === today).length;
  const activeAlerts = emergencyAlerts.filter(a => a.status === 'active').length;
  const mostBooked = facilities.map(f => ({ name: f.name, count: bookings.filter(b => b.facilityId === f.id).length })).sort((a, b) => b.count - a.count)[0];
  const occParking = parkingSlots.filter(s => s.status === 'occupied').length;

  let answer = '';
  if (q.includes('complaint') || q.includes('ticket') || (q.includes('pending') && !q.includes('bill') && !q.includes('rent'))) {
    answer = `📋 There are **${openT} open** and **${inProgT} in-progress** maintenance tickets. Total unresolved: **${openT + inProgT}**.`;
  } else if (q.includes('revenue') || q.includes('money') || q.includes('collection') || q.includes('payment')) {
    answer = `💰 Total revenue collected: **₹${totalRevenue.toLocaleString('en-IN')}**. Pending from residents: **₹${pendingBillsAmt.toLocaleString('en-IN')}** across ${pendingBillsCnt} bills.`;
  } else if (q.includes('unpaid') || q.includes('due') || q.includes('pending bill') || q.includes('pending rent')) {
    answer = `💳 **${pendingBillsCnt} pending bills** totalling **₹${pendingBillsAmt.toLocaleString('en-IN')}**.`;
  } else if (q.includes('resident')) {
    answer = `👥 **${residentUsers.length} residents** are registered. Flats: ${residentUsers.map(u => u.flat).join(', ')}.`;
  } else if (q.includes('booking') || q.includes('facilit') || q.includes('pool') || q.includes('gym')) {
    answer = `🏊 **${todayBk} bookings today**. Most popular: **${mostBooked ? mostBooked.name : 'None yet'}** (${mostBooked ? mostBooked.count : 0} total).`;
  } else if (q.includes('worker') || q.includes('staff') || q.includes('electrician') || q.includes('plumber')) {
    answer = `👷 **${workers.length} workers** total. **${availW} available** and **${workers.length - availW} busy** right now.`;
  } else if (q.includes('parking')) {
    answer = `🚗 Parking: **${occParking} occupied**, **${parkingSlots.filter(s => s.status === 'available').length} available**, **${parkingSlots.filter(s => s.status === 'reserved').length} reserved** out of ${parkingSlots.length} total slots.`;
  } else if (q.includes('emergency') || q.includes('alert')) {
    answer = `🚨 **${activeAlerts} active emergency alert${activeAlerts !== 1 ? 's' : ''}** right now. ${emergencyAlerts.length} total alerts recorded.`;
  } else if (q.includes('hi') || q.includes('hello') || q.includes('hey')) {
    answer = `👋 Hello! I'm your AI Management Assistant for Connect Apartment. Ask me about:\n\n• Complaints & Tickets\n• Revenue & Payments\n• Facility Bookings\n• Workers\n• Parking Status\n• Emergency Alerts\n• Residents`;
  } else {
    answer = `🤔 I can help with:\n\n• "How many complaints are pending?"\n• "What is the total revenue?"\n• "Show unpaid rent list"\n• "Which facility is most used?"\n• "How many workers are available?"\n• "What is the parking status?"`;
  }
  res.json({ answer, query });
});

// ============ NOTIFICATIONS ============

app.get('/api/owner/notifications', authenticateToken, requireOwner, (req, res) => {
  const notifications = [
    ...maintenanceTickets.slice(-5).map(t  => ({ type: 'complaint', message: `New complaint from Flat ${t.flat}: ${t.categoryName}`, time: t.createdAt, priority: t.priority })),
    ...emergencyAlerts.filter(a => a.status === 'active').map(a => ({ type: 'emergency', message: `🚨 EMERGENCY: ${a.type} at Flat ${a.flat}`, time: a.createdAt, priority: 'high' })),
    ...bookings.slice(-3).map(b => ({ type: 'booking', message: `${b.userName} booked ${b.facilityName} on ${b.date}`, time: b.createdAt, priority: 'low' }))
  ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 15);
  res.json(notifications);
});

// ============ ERROR HANDLING ============

app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});


// Only listen when running locally (not on Vercel)
if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🏢 Connect Apartment – Owner Portal running at http://localhost:${PORT}\n`);
    console.log('  Login credentials:');
    console.log('  ├─ owner       / owner@123');
    console.log('  ├─ association / assoc@123');
    console.log('  ├─ facility    / facility@123');
    console.log('  ├─ security    / security@123');
    console.log('  └─ maintenance / maint@123\n');
  });
}

module.exports = app;

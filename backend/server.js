const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const validator = require('validator');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('./database');

const app = express();
app.set('trust proxy', 1);

const PORT = process.env.PORT || 5005;
const JWT_SECRET = 'super_secret_jwt_key_for_dr_dey_clinic'; // In production, move to .env
const backupPath = path.resolve(__dirname, 'appointments_backup.json');

// --- PERSISTENCE HELPERS ---
const saveBackup = () => {
    db.all("SELECT id, trackingId, patientName, phone, department, date, time, status, createdAt FROM appointments ORDER BY createdAt ASC", [], (err, rows) => {
        if (!err && Array.isArray(rows)) {
            try {
                fs.writeFileSync(backupPath, JSON.stringify(rows, null, 2), 'utf8');
            } catch (e) {
                console.error('Backup write error:', e);
            }
        }
    });
};

const restoreBackup = () => {
    try {
        if (fs.existsSync(backupPath)) {
            const raw = fs.readFileSync(backupPath, 'utf8');
            const list = JSON.parse(raw);
            if (Array.isArray(list) && list.length > 0) {
                const insertSql = `INSERT OR IGNORE INTO appointments (trackingId, patientName, phone, department, date, time, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
                db.serialize(() => {
                    const stmt = db.prepare(insertSql);
                    list.forEach(a => {
                        if (a && a.trackingId) {
                            stmt.run([
                                a.trackingId,
                                a.patientName,
                                a.phone,
                                a.department || 'General Checkup',
                                a.date,
                                a.time,
                                a.status || 'Pending',
                                a.createdAt || new Date().toISOString()
                            ]);
                        }
                    });
                    stmt.finalize();
                });
                console.log(`Restored ${list.length} appointments from backup JSON.`);
            }
        }
    } catch (e) {
        console.error('Restore error:', e);
    }
};

setTimeout(restoreBackup, 500);

// 1. SECURITY HEADER MIDDLEWARE (Permit cross-origin browser access)
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// 2. UNRESTRICTED CORS (Supports cross-origin browser calls & all client headers)
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma', 'X-Requested-With', 'Accept', 'Origin'],
    credentials: false
}));
app.options('*', cors());

app.use(express.json({ limit: '10kb' }));

// 3. HEALTH CHECK & RATE LIMITING
// Instant health check route - always available, never rate-limited
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// Dedicated rate limiter for public appointment submissions to prevent spam while supporting high volume
const bookingLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100, // 100 bookings per 15 min per IP is generous for real clinic traffic
    message: { error: 'Too many booking attempts. Please wait a few minutes before trying again.' }
});

// Resilient API rate limiter for general routes
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 10000,   // High ceiling (10,000 req/15m) so normal browsing/refreshing never gets throttled
    skip: (req) => {
        // Authenticated admin operations and health checks are completely exempt
        return Boolean(req.headers['authorization']) || req.path === '/api/health';
    },
    message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', apiLimiter);

// --- AUTHENTICATION MIDDLEWARE ---
const verifyToken = (req, res, next) => {
    const bearerHeader = req.headers['authorization'];
    if (!bearerHeader) return res.status(401).json({ error: 'Access denied' });
    
    const token = bearerHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ error: 'Invalid token' });
        req.user = decoded;
        next();
    });
};

// --- ROUTES ---

// Login route for Admin (Secure DB check)
app.post('/api/login', (req, res) => {
    const { password } = req.body;
    
    db.get(`SELECT * FROM admin_users WHERE username = 'admin'`, [], (err, user) => {
        if (err || !user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const isValid = bcrypt.compareSync(password, user.password_hash);
        if (isValid) {
            const token = jwt.sign({ role: 'admin', id: user.id }, JWT_SECRET, { expiresIn: '30d' });
            res.json({ token });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    });
});

// Admin change password route (for complete security, can be used later)
app.put('/api/admin/password', verifyToken, (req, res) => {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    }
    const hash = bcrypt.hashSync(newPassword, 10);
    db.run(`UPDATE admin_users SET password_hash = ? WHERE username = 'admin'`, [hash], function(err) {
        if (err) return res.status(500).json({ error: 'Internal server error' });
        res.json({ message: 'Password updated securely.' });
    });
});

// Track appointment publicly
app.get('/api/appointments/track/:trackingId', (req, res) => {
    const { trackingId } = req.params;
    db.get(`SELECT patientName, department, date, time, status FROM appointments WHERE trackingId = ?`, [trackingId], (err, row) => {
        if (err) {
            return res.status(500).json({ error: 'Internal server error' });
        }
        if (!row) {
            return res.status(404).json({ error: 'Appointment not found' });
        }
        res.json({ appointment: row });
    });
});

// Get all appointments (PROTECTED) — returns createdAt so frontend can sort by actual submission time
app.get('/api/appointments', verifyToken, (req, res) => {
    db.all("SELECT id, trackingId, patientName, phone, department, date, time, status, createdAt FROM appointments ORDER BY createdAt ASC", [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Internal server error' });
        }
        res.json({ appointments: rows });
    });
});

// Create a new appointment (PUBLIC - protected by dedicated booking rate limiter)
app.post('/api/appointments', bookingLimiter, (req, res) => {
    let { patientName, phone, department, date, time } = req.body;
    
    if (!patientName || !phone || !department || !date || !time) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    patientName = validator.escape(patientName.trim());
    department = validator.escape(department.trim());
    date = validator.escape(date.trim());
    time = validator.escape(time.trim());

    if (!validator.isMobilePhone(phone, 'en-IN')) {
        return res.status(400).json({ error: 'Invalid phone number format' });
    }
    
    if (patientName.length > 100 || department.length > 50) {
        return res.status(400).json({ error: 'Input too long' });
    }

    // Generate Tracking ID (e.g. DEY-A1B2C)
    const trackingId = 'DEY-' + crypto.randomBytes(3).toString('hex').toUpperCase();

    // Store createdAt explicitly so it's always the exact moment the booking was submitted
    const createdAt = new Date().toISOString();
    const sql = `INSERT INTO appointments (trackingId, patientName, phone, department, date, time, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, 'Pending', ?)`;
    db.run(sql, [trackingId, patientName, phone, department, date, time, createdAt], function(err) {
        if (err) {
            console.error('DB Error:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        saveBackup();
        res.status(201).json({ 
            message: 'Appointment booked successfully', 
            appointmentId: this.lastID,
            trackingId: trackingId,
            createdAt: createdAt
        });
    });
});

// Bulk sync / restore appointments (PROTECTED - guarantees zero data loss on server restarts)
app.post('/api/appointments/sync', verifyToken, (req, res) => {
    const { appointments } = req.body;
    if (!Array.isArray(appointments) || appointments.length === 0) {
        return res.json({ message: 'No records to sync', count: 0 });
    }

    const insertSql = `INSERT OR IGNORE INTO appointments (trackingId, patientName, phone, department, date, time, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    
    db.serialize(() => {
        const stmt = db.prepare(insertSql);
        appointments.forEach(a => {
            if (a && a.trackingId && a.patientName && a.phone) {
                stmt.run([
                    a.trackingId,
                    validator.escape(String(a.patientName).trim()),
                    String(a.phone).trim(),
                    validator.escape(String(a.department || 'General Checkup').trim()),
                    validator.escape(String(a.date).trim()),
                    validator.escape(String(a.time).trim()),
                    a.status || 'Pending',
                    a.createdAt || new Date().toISOString()
                ]);
            }
        });
        stmt.finalize(() => {
            saveBackup();
            db.all("SELECT id, trackingId, patientName, phone, department, date, time, status, createdAt FROM appointments ORDER BY createdAt ASC", [], (err, rows) => {
                if (err) return res.status(500).json({ error: 'Internal server error' });
                res.json({ appointments: rows, syncedCount: rows.length });
            });
        });
    });
});

// Update appointment status (PROTECTED)
app.put('/api/appointments/:id/status', verifyToken, (req, res) => {
    const { status } = req.body;
    const { id } = req.params;

    if (!['Pending', 'Confirmed', 'Completed', 'Cancelled'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    const sql = `UPDATE appointments SET status = ? WHERE id = ?`;
    db.run(sql, [status, id], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Internal server error' });
        }
        saveBackup();
        res.json({ message: 'Status updated successfully', changes: this.changes });
    });
});

// Delete appointment (PROTECTED)
app.delete('/api/appointments/:id', verifyToken, (req, res) => {
    const { id } = req.params;
    const sql = `DELETE FROM appointments WHERE id = ?`;
    db.run(sql, [id], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Internal server error' });
        }
        saveBackup();
        res.json({ message: 'Appointment deleted successfully', changes: this.changes });
    });
});

app.listen(PORT, () => {
    console.log(`Secure Server running on http://localhost:${PORT}`);
});

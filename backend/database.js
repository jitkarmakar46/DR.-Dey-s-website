const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

const dbPath = path.resolve(__dirname, 'clinic.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        
        // Create appointments table (with createdAt for accurate booking timestamps)
        db.run(`CREATE TABLE IF NOT EXISTS appointments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            trackingId TEXT UNIQUE,
            patientName TEXT NOT NULL,
            phone TEXT NOT NULL,
            department TEXT NOT NULL,
            date TEXT NOT NULL,
            time TEXT NOT NULL,
            status TEXT DEFAULT 'Pending',
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, () => {
            // Safe migration: Add trackingId column if missing (ignore error if already exists)
            db.run(`ALTER TABLE appointments ADD COLUMN trackingId TEXT UNIQUE`, () => {});
            // Safe migration: Add createdAt column if missing
            db.run(`ALTER TABLE appointments ADD COLUMN createdAt TEXT`, () => {});

            // Seed initial clinic appointments if table is empty
            db.get(`SELECT COUNT(*) as count FROM appointments`, [], (err, row) => {
                if (!err && row && row.count === 0) {
                    const initialRecords = [
                        ['DEY-D95E3E', 'jt', '8976789088', 'General Checkup', '2026-09-10', 'Morning', 'Confirmed', '2026-09-10T07:15:00.000Z'],
                        ['DEY-BC6A5B', 'jiy', '9898767689', 'General Checkup', '2026-09-18', 'Morning', 'Pending', '2026-09-09T08:30:00.000Z'],
                        ['DEY-40770A', 'joh nor', '9098765645', 'Fever', '2026-09-10', 'Evening', 'Pending', '2026-09-10T07:45:00.000Z']
                    ];
                    const seedStmt = db.prepare(`INSERT OR IGNORE INTO appointments (trackingId, patientName, phone, department, date, time, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
                    initialRecords.forEach(r => seedStmt.run(r));
                    seedStmt.finalize();
                    console.log('Default appointments seeded successfully.');
                }
            });
        });

        // Create admin_users table
        db.run(`CREATE TABLE IF NOT EXISTS admin_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL
        )`, () => {
            // Seed a default admin if none exists
            db.get(`SELECT * FROM admin_users WHERE username = 'admin'`, [], (err, row) => {
                if (!row) {
                    const defaultPassword = 'admin123';
                    const hash = bcrypt.hashSync(defaultPassword, 10);
                    db.run(`INSERT INTO admin_users (username, password_hash) VALUES ('admin', ?)`, [hash]);
                    console.log('Default admin seeded. Username: admin');
                }
            });
        });
    }
});

module.exports = db;

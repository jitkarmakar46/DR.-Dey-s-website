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
            // Safe migration: Add createdAt column if missing (existing rows get current timestamp as fallback)
            db.run(`ALTER TABLE appointments ADD COLUMN createdAt DATETIME DEFAULT CURRENT_TIMESTAMP`, () => {});
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

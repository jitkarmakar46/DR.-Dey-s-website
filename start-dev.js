const { spawn } = require('child_process');
const path = require('path');

console.log('\x1b[36m%s\x1b[0m', '================================================================');
console.log('\x1b[1m\x1b[34m%s\x1b[0m', '  🏥 DR. DILIP DEY CLINIC - LOCAL DEVELOPMENT ENVIRONMENT');
console.log('\x1b[36m%s\x1b[0m', '================================================================');
console.log('\x1b[32m%s\x1b[0m', '  🌐 Main Website:        http://localhost:5173');
console.log('\x1b[35m%s\x1b[0m', '  🔐 Admin Portal:        http://localhost:5173/secure-portal-dey-77x9q');
console.log('\x1b[33m%s\x1b[0m', '  🗄️  Backend API & DB:    http://localhost:5005 (SQLite: clinic.db)');
console.log('\x1b[37m%s\x1b[0m', '  🔑 Admin Password:      admin123');
console.log('\x1b[36m%s\x1b[0m', '================================================================\n');

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

// 1. Start Backend Express & SQLite Server (port 5005)
const backend = spawn('node', ['server.js'], {
    cwd: path.join(__dirname, 'backend'),
    stdio: 'inherit'
});

// 2. Start Frontend Vite Dev Server (port 5173)
const frontend = spawn(npmCmd, ['run', 'dev'], {
    cwd: path.join(__dirname, 'frontend'),
    stdio: 'inherit'
});

const cleanup = () => {
    console.log('\nStopping servers...');
    backend.kill();
    frontend.kill();
    process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

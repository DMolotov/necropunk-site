#!/usr/bin/env node
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PID_FILE = path.resolve(__dirname, '..', 'server.pid');
const SERVER_JS = path.resolve(__dirname, '..', 'server.js');

function writePid(pid) {
  fs.writeFileSync(PID_FILE, String(pid), { encoding: 'utf8' });
}

function readPid() {
  if (!fs.existsSync(PID_FILE)) return null;
  try {
    const p = parseInt(fs.readFileSync(PID_FILE, 'utf8'), 10);
    return Number.isFinite(p) ? p : null;
  } catch (e) {
    return null;
  }
}

function removePidFile() {
  try { fs.unlinkSync(PID_FILE); } catch(e) {}
}

function isRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return false;
  }
}

function start() {
  const existing = readPid();
  if (existing && isRunning(existing)) {
    console.log('Server already running with PID', existing);
    return;
  }

  const node = process.execPath;
  const child = spawn(node, [SERVER_JS], {
    detached: true,
    stdio: 'ignore'
  });
  child.unref();
  writePid(child.pid);
  console.log('Started server, PID', child.pid);
}

function stop() {
  const pid = readPid();
  if (!pid) {
    console.log('No PID file found — is server running?');
    return;
  }

  if (!isRunning(pid)) {
    console.log('Process', pid, 'is not running. Removing PID file.');
    removePidFile();
    return;
  }

  try {
    // Try graceful kill
    process.kill(pid, 'SIGINT');
    // wait briefly
    const start = Date.now();
    while (isRunning(pid) && Date.now() - start < 3000) {}
    if (isRunning(pid)) {
      // Force kill on Windows or other OS
      if (os.platform() === 'win32') {
        execSync(`taskkill /PID ${pid} /F`);
      } else {
        process.kill(pid, 'SIGKILL');
      }
    }
    console.log('Stopped process', pid);
  } catch (e) {
    console.error('Error stopping process', pid, e && e.message ? e.message : e);
  } finally {
    removePidFile();
  }
}

function restart() {
  stop();
  // small delay
  setTimeout(() => start(), 300);
}

const cmd = process.argv[2];
if (!cmd) {
  console.log('Usage: node scripts/manage.js [start|stop|restart|status]');
  process.exit(1);
}

if (cmd === 'start') start();
else if (cmd === 'stop') stop();
else if (cmd === 'restart') restart();
else if (cmd === 'status') {
  const pid = readPid();
  if (pid && isRunning(pid)) console.log('Running, PID', pid);
  else console.log('Not running');
} else {
  console.log('Unknown command', cmd);
  process.exitCode = 2;
}

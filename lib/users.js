const fs = require('fs');
const path = require('path');

const DATA_PATH = path.resolve(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_PATH, 'users.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_PATH)) fs.mkdirSync(DATA_PATH, { recursive: true });
  if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '[]', 'utf8');
}

function readUsers() {
  ensureDataDir();
  const raw = fs.readFileSync(USERS_FILE, 'utf8');
  try {
    return JSON.parse(raw || '[]');
  } catch (e) {
    return [];
  }
}

function saveUsers(users) {
  ensureDataDir();
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
}

function findUserByUsername(username) {
  const users = readUsers();
  return users.find(u => u.username === username) || null;
}

function findUserById(id) {
  const users = readUsers();
  return users.find(u => u.id === id) || null;
}

function createUser(user) {
  const users = readUsers();
  users.push(user);
  saveUsers(users);
  return user;
}

module.exports = {
  readUsers,
  saveUsers,
  findUserByUsername,
  findUserById,
  createUser,
};

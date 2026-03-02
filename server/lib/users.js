const { getDb } = require('./mongo');

const COLLECTION = 'users';

async function readUsers() {
  const db = getDb();
  const users = await db.collection(COLLECTION).find({}).toArray();
  return users || [];
}

async function saveUsers(users) {
  const db = getDb();
  const col = db.collection(COLLECTION);
  await col.deleteMany({});
  if (Array.isArray(users) && users.length) {
    await col.insertMany(users);
  }
}

async function findUserByUsername(username) {
  const db = getDb();
  return await db.collection(COLLECTION).findOne({ username }) || null;
}

async function findUserById(id) {
  const db = getDb();
  return await db.collection(COLLECTION).findOne({ id }) || null;
}

async function createUser(user) {
  const db = getDb();
  await db.collection(COLLECTION).insertOne(user);
  return user;
}

module.exports = {
  readUsers,
  saveUsers,
  findUserByUsername,
  findUserById,
  createUser,
};

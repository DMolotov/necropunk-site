const { MongoClient } = require('mongodb');

let _client = null;
let _db = null;

async function connect(uri, dbName) {
  if (!uri) throw new Error('MONGODB_URI not provided');
  if (_client) return { client: _client, db: _db };
  _client = new MongoClient(uri);
  await _client.connect();
  _db = dbName ? _client.db(dbName) : _client.db();
  return { client: _client, db: _db };
}

function getDb() {
  if (!_db) throw new Error('MongoDB not connected. Call connect() first.');
  return _db;
}

function client() { return _client; }

module.exports = { connect, getDb, client };

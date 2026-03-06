#!/usr/bin/env node
require('dotenv').config();

const mongo = require('../server/lib/mongo');
const { reseedKnowledgeCollection } = require('../server/lib/knowledge');

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
  const dbName = process.env.MONGODB_DBNAME || 'necropunk';

  try {
    await mongo.connect(uri, dbName);
    const result = await reseedKnowledgeCollection();
    console.log(`Knowledge reseeded: ${result.count} item(s)`);
  } finally {
    const client = mongo.client();
    if (client && client.close) {
      await client.close();
    }
  }
}

main().catch((error) => {
  console.error('Seed failed', error);
  process.exit(1);
});

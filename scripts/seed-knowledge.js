#!/usr/bin/env node
require('dotenv').config();

const mysql = require('../server/lib/mysql');
const { reseedKnowledgeCollection } = require('../server/lib/knowledge');

async function main() {
  try {
    await mysql.connect();
    await mysql.initSchema();
    const result = await reseedKnowledgeCollection();
    console.log(`Knowledge reseeded: ${result.count} item(s)`);
  } finally {
    await mysql.close();
  }
}

main().catch((error) => {
  console.error('Seed failed', error);
  process.exit(1);
});

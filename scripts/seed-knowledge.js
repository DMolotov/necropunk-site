#!/usr/bin/env node
require('dotenv').config();

const { initKnowledgeCollection } = require('../server/lib/knowledge');

async function main() {
  const result = await initKnowledgeCollection({ forceReload: true });
  console.log(`Knowledge JSON loaded: ${result.count} item(s)`);
}

main().catch((error) => {
  console.error('Knowledge JSON check failed', error);
  process.exit(1);
});

'use strict';

const http = require('http');
const path = require('path');
const { createApp } = require('./app');
const { attachWebSocket } = require('./net/ws');

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'var');

const { app, world, accounts } = createApp({
  dataDir: DATA_DIR,
  seed: process.env.PF_SEED !== undefined ? Number(process.env.PF_SEED) : undefined,
  admins: (process.env.ADMINS || '').split(',').filter(Boolean),
  pointBuy: process.env.POINT_BUY ? Number(process.env.POINT_BUY) : 20,
  config: {
    turnTimeoutMs: Number(process.env.TURN_TIMEOUT_MS || 60000),
    restSeconds: Number(process.env.REST_SECONDS || 10),
    monstersUseDyingRules: process.env.MONSTER_DYING_RULES === '1',
  },
});

const server = http.createServer(app);
attachWebSocket(server, { world, accounts });
world.start();

server.listen(PORT, () => {
  console.log(`Macareno MMO server listening on http://localhost:${PORT} (WebSocket: ws://localhost:${PORT}/ws)`);
  console.log(`Data directory: ${DATA_DIR}`);
});

function shutdown() {
  console.log('Saving world state...');
  world.stop();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

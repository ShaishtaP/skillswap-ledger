import http from 'node:http';
import { createApp } from './app.js';
import { config } from './config/env.js';
import { initRealtime } from './services/realtime.js';

// Express handles normal requests; Socket.IO shares the same server for
// live updates.
export function startServer(port = config.port) {
  const server = http.createServer(createApp());
  initRealtime(server, { corsOrigin: config.clientOrigin });
  return new Promise((resolve) => {
    server.listen(port, () => {
      console.log(`SkillSwap running on http://localhost:${port}`);
      resolve(server);
    });
  });
}

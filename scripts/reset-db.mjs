import { spawn } from 'node:child_process';
import { existsSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = join(rootDir, 'potter_pulse.db');
const port = Number(process.env.RESET_DB_PORT || 4199);
const baseUrl = `http://127.0.0.1:${port}`;

if (existsSync(dbPath)) {
  unlinkSync(dbPath);
}

const server = spawn(process.execPath, ['scripts/server.mjs'], {
  cwd: rootDir,
  env: { ...process.env, PORT: String(port), FOOTBALL_API_KEY: '' },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let output = '';
server.stdout.on('data', (chunk) => { output += chunk.toString(); });
server.stderr.on('data', (chunk) => { output += chunk.toString(); });

try {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(baseUrl + '/api/data-sources');
      if (response.ok) break;
    } catch {
      await delay(200);
    }
    if (attempt === 49) {
      throw new Error('Server did not initialize the database.\n' + output);
    }
  }

  server.kill();
  await Promise.race([once(server, 'exit'), delay(3000)]);
  console.log('Reset complete: potter_pulse.db recreated with baseline schema and seed data.');
} catch (error) {
  if (!server.killed) server.kill();
  console.error(error.message);
  process.exit(1);
}

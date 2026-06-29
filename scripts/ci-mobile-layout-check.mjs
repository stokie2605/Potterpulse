import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const port = Number(process.env.PORT || 4183);
const baseUrl = `http://127.0.0.1:${port}`;

const server = spawn(process.execPath, ['scripts/server.mjs'], {
  env: { ...process.env, PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let output = '';
server.stdout.on('data', (chunk) => {
  output += chunk.toString();
});
server.stderr.on('data', (chunk) => {
  output += chunk.toString();
});

const stopServer = async () => {
  if (server.exitCode !== null || server.signalCode !== null) return;
  if (!server.killed) server.kill();
  await Promise.race([
    once(server, 'exit'),
    delay(3000),
  ]);
};

const waitForServer = async () => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      await delay(250);
    }
  }
  throw new Error(`Server did not become ready. Output:
${output}`);
};

try {
  await waitForServer();

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${baseUrl}/#matches`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#view-matches.active-view');
  await page.waitForSelector('#view-matches .matchday-briefing-card', { state: 'visible' });

  // Navigate to squad tab to view fixtures schedule
  await page.click('.bottom-nav [data-view="squad"]');
  await page.waitForSelector('#view-squad.active-view');
  await page.waitForSelector('#view-squad [data-fixture-list] .fixture-row', { state: 'visible' });

  const initialState = await page.evaluate(() => {
    const squadView = document.querySelector('#view-squad');
    const matchesView = document.querySelector('#view-matches');
    const visibleRows = [...squadView.querySelectorAll('.fixture-row')]
      .filter((row) => getComputedStyle(row).display !== 'none').length;
    const briefingCard = matchesView.querySelector('.matchday-briefing-card');
    const bottomNav = document.querySelector('.bottom-nav');
    return {
      squadActive: squadView.classList.contains('active-view'),
      visibleRows,
      cardWidth: Math.round(briefingCard.getBoundingClientRect().width),
      navPosition: getComputedStyle(bottomNav).position,
      hasPlaceholders: document.body.innerText.includes('{{'),
      headline: briefingCard.querySelector('#briefing-headline')?.textContent ?? '',
      hasCultureName: document.body.textContent.includes('The Potters') || document.body.textContent.includes('POTTERPULSE'),
      navItems: document.querySelectorAll('.bottom-nav [data-view]').length,
    };
  });

  if (!initialState.squadActive) throw new Error('Squad route did not activate the squad tab view.');
  if (initialState.hasPlaceholders) throw new Error('Rendered page contains unreplaced template placeholders.');
  if (initialState.visibleRows < 5) throw new Error(`Expected at least 5 visible fixture rows by default, got ${initialState.visibleRows}.`);
  if (initialState.cardWidth > 390) throw new Error(`Briefing card overflows mobile viewport: ${initialState.cardWidth}px.`);
  if (initialState.navPosition !== 'fixed') throw new Error(`Expected fixed mobile bottom nav, got ${initialState.navPosition}.`);
  if (!initialState.hasCultureName) throw new Error('Culture profile display name did not render.');
  if (initialState.navItems !== 3) throw new Error(`Expected 3 bottom navigation items, got ${initialState.navItems}.`);

  await page.click('#view-squad [data-fixture-toggle]');
  const expandedRows = await page.evaluate(() => [...document.querySelectorAll('#view-squad .fixture-row')]
    .filter((row) => getComputedStyle(row).display !== 'none').length);
  if (expandedRows < 5) throw new Error(`Expected at least 5 visible fixture rows after expanding, got ${expandedRows}.`);

  await page.click('#view-squad [data-fixture-toggle]');
  const collapsedRows = await page.evaluate(() => [...document.querySelectorAll('#view-squad .fixture-row')]
    .filter((row) => getComputedStyle(row).display !== 'none').length);
  if (collapsedRows !== 5) throw new Error(`Expected 5 visible fixture rows after collapse, got ${collapsedRows}.`);

  await browser.close();
  await stopServer();
  console.log('Mobile layout checks passed.');
} catch (error) {
  await stopServer();
  console.error(error);
  process.exit(1);
}

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const dbPath = join(rootDir, 'potter_pulse.db');
const templatePath = join(rootDir, 'index.html');
const port = Number(process.env.PORT || 4173);

const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const titleCase = (value) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const initials = (value) =>
  String(value ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('') || 'FC';

const shortPlayerName = (value) => {
  const parts = String(value ?? '').trim().split(/\s+/).filter(Boolean);
  return parts.at(-1) || value || 'Player';
};

const formatDate = (dateText) =>
  new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${dateText}T12:00:00Z`));

const formatShortDate = (dateText) =>
  new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
  }).format(new Date(`${dateText}T12:00:00Z`));

const render = () => {
  const db = new DatabaseSync(dbPath);
  try {
    const squad = db
      .prepare(
        'SELECT player_name, squad_number, position FROM stoke_squad ORDER BY squad_number',
      )
      .all();

    const fixtures = db
      .prepare(
        'SELECT opponent, match_date, competition, venue FROM efl_fixtures ORDER BY match_date',
      )
      .all();

    const hero =
      fixtures.find((fixture) => fixture.opponent === 'Swansea City' && fixture.venue === 'home') ??
      fixtures[0] ?? {
        opponent: 'TBC',
        match_date: '2026-08-15',
        competition: 'Championship',
        venue: 'home',
      };

    const squadCards = squad
      .map(
        (player) => `
          <article class="player-strip-card" data-number="#${escapeHtml(player.squad_number)}">
            <span class="position-pill">#${escapeHtml(player.squad_number)}</span>
            <h3 title="${escapeHtml(player.player_name)}">${escapeHtml(shortPlayerName(player.player_name))}</h3>
          </article>
        `,
      )
      .join('');

    const fixtureTimeline = fixtures
      .map(
        (fixture) => `
          <article class="fixture-row">
            <time class="date-tile" datetime="${escapeHtml(fixture.match_date)}">
              ${escapeHtml(formatShortDate(fixture.match_date))}
            </time>
            <div class="fixture-main">
              <h3>${escapeHtml(fixture.opponent)}</h3>
              <div class="fixture-meta">
                <span>${escapeHtml(fixture.competition)}</span>
                <span>${escapeHtml(titleCase(fixture.venue))}</span>
              </div>
            </div>
            <span class="fixture-arrow">&rsaquo;</span>
          </article>
        `,
      )
      .join('');

    const replacements = {
      generatedAt: `Updated ${new Date().toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
      })}`,
      heroOpponent: hero.opponent,
      heroInitials: initials(hero.opponent),
      heroVenue: titleCase(hero.venue),
      heroDate: formatDate(hero.match_date),
      heroDateShort: formatShortDate(hero.match_date),
      heroCompetition: hero.competition,
      squadCount: squad.length,
      fixtureCount: fixtures.length,
      squadCards,
      fixtureTimeline,
    };

    return Object.entries(replacements).reduce(
      (html, [key, value]) => html.replaceAll(`{{${key}}}`, String(value)),
      readFileSync(templatePath, 'utf8'),
    );
  } finally {
    db.close();
  }
};

const server = createServer((request, response) => {
  if (request.url === '/' || request.url === '/index.html') {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(render());
    return;
  }

  response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  response.end('Not found');
});

server.listen(port, () => {
  console.log(`Potter Pulse running at http://localhost:${port}`);
});

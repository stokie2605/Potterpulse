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

const awayGuides = {
  swansea_city: {
    opponent: 'Swansea City',
    stadium: 'Swansea.com Stadium',
    distance: '182 miles',
    pub: 'The Railway Inn',
    pubNote: 'Away friendly',
    pieIndex: '3.8 / 5',
    pieTip: 'Steak & Ale highly recommended',
    tag: 'Transit Match',
  },
  west_brom: {
    opponent: 'West Bromwich Albion',
    stadium: 'The Hawthorns',
    distance: '46 miles',
    pub: 'The Vine',
    pubNote: 'Legendary neutral/away mix',
    pieIndex: '4.5 / 5',
    pieTip: 'Chicken Balti',
    tag: 'Short Hop',
  },
};


const nextMatchBriefing = {
  swansea_city: {
    formHome: ['W', 'D', 'L', 'W', 'W'],
    formAway: ['L', 'L', 'D', 'W', 'L'],
    referee: 'Gavin Ward',
    officialsNote: 'Averages 4.2 yellows / game',
    forecastTemp: '14 C',
    forecastCond: 'Heavy rain and wind',
    kitTip: 'Pack the raincoat. Wind whipping off the bay.',
  },
  west_brom: {
    formHome: ['D', 'W', 'W', 'L', 'W'],
    formAway: ['W', 'D', 'L', 'D', 'W'],
    referee: 'David Webb',
    officialsNote: 'Stricter ref: 4.8 cards per game',
    forecastTemp: '18 C',
    forecastCond: 'Clear skies',
    kitTip: 'Perfect conditions. Standard layers fine.',
  },
};


const opponentAliases = {
  west_bromwich_albion: 'west_brom',
};

const normalizeOpponentKey = (value) => {
  const key = String(value ?? '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return opponentAliases[key] ?? key;
};

const hasMatchContext = (fixture) => {
  const key = normalizeOpponentKey(fixture?.opponent);
  return Boolean(awayGuides[key] && nextMatchBriefing[key]);
};

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

    const nowKeyDate = new Date().toISOString().slice(0, 10);
    const upcomingMatches = fixtures
      .filter((fixture) => fixture.match_date >= nowKeyDate)
      .slice(0, 5);
    const contextMatch = upcomingMatches.find(hasMatchContext) ?? hero;
    const contextKey = normalizeOpponentKey(contextMatch.opponent);
    const awayGuide = awayGuides[contextKey] ?? awayGuides.swansea_city;
    const matchBriefing = nextMatchBriefing[contextKey] ?? nextMatchBriefing.swansea_city;

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
      awayOpponent: awayGuide.opponent,
      awayStadium: awayGuide.stadium,
      awayDistance: awayGuide.distance,
      awayPub: awayGuide.pub,
      awayPubNote: awayGuide.pubNote,
      awayPieIndex: awayGuide.pieIndex,
      awayPieTip: awayGuide.pieTip,
      awayTag: awayGuide.tag,
      briefingReferee: matchBriefing.referee,
      briefingOfficialsNote: matchBriefing.officialsNote,
      briefingForecastTemp: matchBriefing.forecastTemp,
      briefingForecastCond: matchBriefing.forecastCond,
      briefingKitTip: matchBriefing.kitTip,
      briefingHomeForm: matchBriefing.formHome
        .map((result) => '<span class="form-dot ' + escapeHtml(result.toLowerCase()) + '">' + escapeHtml(result) + '</span>')
        .join(''),
      briefingAwayForm: matchBriefing.formAway
        .map((result) => '<span class="form-dot ' + escapeHtml(result.toLowerCase()) + '">' + escapeHtml(result) + '</span>')
        .join(''),
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

import { createServer } from 'node:http';
import { parse } from 'node:url';
import { readFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const dbPath = join(rootDir, 'potter_pulse.db');
const templatePath = join(rootDir, 'index.html');
const assetsDir = join(rootDir, 'assets');
const port = Number(process.env.PORT || 4173);
const activeCultureProfile = process.env.CULTURE_PROFILE || 'the_potters';
const cultureProfiles = {
  the_potters: {
    label: 'The Potters',
    homeTeam: 'Stoke City',
    useSupporterNicknames: true,
    teamNicknames: {
      stoke_city: 'The Potters',
      swansea_city: 'The Swans',
      west_bromwich_albion: 'The Baggies',
      west_brom: 'The Baggies',
    },
  },
};
const crestAssets = {
  stoke_city: '/assets/crests/stoke-city.svg',
  swansea_city: '/assets/crests/swansea-city.svg',
  west_brom: '/assets/crests/west-bromwich-albion.svg',
  west_bromwich_albion: '/assets/crests/west-bromwich-albion.svg',
  default: '/assets/crests/default-opponent.svg',
};
const pollCandidates = [
  { key: 'manhoef', label: 'Manhoef', note: 'explosive threat' },
  { key: 'jun_ho', label: 'Jun-ho', note: 'creative spark' },
  { key: 'johansson', label: 'Johansson', note: 'safe hands' },
];

const ensureSchema = (db) => {
  db.exec(
    'CREATE TABLE IF NOT EXISTS fan_poll_votes (' +
      'option_key TEXT PRIMARY KEY,' +
      'label TEXT NOT NULL,' +
      'note TEXT NOT NULL,' +
      'vote_count INTEGER NOT NULL DEFAULT 0,' +
      'created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,' +
      'updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP' +
    ')'
  );

  const seedVote = db.prepare(
    'INSERT OR IGNORE INTO fan_poll_votes (option_key, label, note, vote_count) ' +
      'VALUES (?, ?, ?, 0)'
  );

  for (const candidate of pollCandidates) {
    seedVote.run(candidate.key, candidate.label, candidate.note);
  }
};

const getPollResults = (db) => {
  ensureSchema(db);
  return db
    .prepare(
      'SELECT option_key, label, note, vote_count ' +
        'FROM fan_poll_votes ' +
        'ORDER BY CASE option_key ' +
        "WHEN 'manhoef' THEN 1 " +
        "WHEN 'jun_ho' THEN 2 " +
        "WHEN 'johansson' THEN 3 " +
        'ELSE 99 END, label'
    )
    .all();
};

const serializePollResults = (rows) => {
  const totalVotes = rows.reduce((sum, row) => sum + Number(row.vote_count), 0);
  return rows.map((row) => ({
    key: row.option_key,
    label: row.label,
    note: row.note,
    votes: Number(row.vote_count),
    percent: totalVotes > 0 ? Math.round((Number(row.vote_count) / totalVotes) * 100) : 0,
  }));
};

const renderPollOptions = (rows) =>
  serializePollResults(rows)
    .map((option) =>
      [
        '<button class="poll-option" type="button" data-vote-option="' + escapeHtml(option.key) + '">',
        '<strong>' + escapeHtml(option.label) + '</strong>',
        '<span class="poll-meter"><span style="width: ' + escapeHtml(option.percent) + '%;"></span></span>',
        '<small>' + escapeHtml(option.percent) + '% ' + escapeHtml(option.note) + ' - ' + escapeHtml(option.votes) + ' votes</small>',
        '</button>',
      ].join(''),
    )
    .join('');

const readJsonBody = (request) =>
  new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 8192) {
        reject(new Error('Request body too large'));
        request.destroy();
      }
    });
    request.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    request.on('error', reject);
  });

const awayGuides = {
  swansea_city: {
    opponent: 'Swansea City',
    stadium: 'Swansea.com Stadium',
    distance: '182 miles',
    travelTime: 'Approx. 3h 35m by road',
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
    travelTime: 'Approx. 55m by road',
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

const getCrestSrc = (teamName) => crestAssets[normalizeOpponentKey(teamName)] ?? crestAssets.default;
const activeCulture = cultureProfiles[activeCultureProfile] ?? cultureProfiles.the_potters;
const displayTeamName = (teamName) => {
  const key = normalizeOpponentKey(teamName);
  if (!activeCulture.useSupporterNicknames) return teamName;
  return activeCulture.teamNicknames[key] ?? teamName;
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
    ensureSchema(db);
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

    const pollRows = getPollResults(db);
    const fanPollOptions = renderPollOptions(pollRows);

    const fixtureTimeline = fixtures
      .map(
        (fixture, index) => `
          <article class="fixture-row${index >= 5 ? ' is-collapsed' : ''}">
            <time class="date-tile" datetime="${escapeHtml(fixture.match_date)}">
              ${escapeHtml(formatShortDate(fixture.match_date))}
            </time>
            <div class="fixture-main">
              <h3 title="${escapeHtml(fixture.opponent)}">${escapeHtml(displayTeamName(fixture.opponent))}</h3>
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
      heroOpponentDisplay: displayTeamName(hero.opponent),
      homeDisplayName: displayTeamName(activeCulture.homeTeam),
      cultureProfileName: activeCulture.label,
      homeCrestSrc: crestAssets.stoke_city,
      awayCrestSrc: getCrestSrc(hero.opponent),
      heroVenue: titleCase(hero.venue),
      heroDate: formatDate(hero.match_date),
      heroDateShort: formatShortDate(hero.match_date),
      heroCompetition: hero.competition,
      squadCount: squad.length,
      fixtureCount: fixtures.length,
      squadCards,
      fixtureTimeline,
      fanPollOptions,
      awayOpponent: awayGuide.opponent,
      awayOpponentDisplay: displayTeamName(awayGuide.opponent),
      awayStadium: awayGuide.stadium,
      awayDistance: awayGuide.distance,
      awayTravelTime: awayGuide.travelTime,
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

const sendAsset = (pathname, response) => {
  const decodedPath = decodeURIComponent(pathname.replace(/^\/+/, ''));
  const assetPath = resolve(rootDir, decodedPath);
  const assetRoot = resolve(assetsDir);

  if (!assetPath.toLowerCase().startsWith(assetRoot.toLowerCase())) {
    response.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Forbidden');
    return;
  }

  try {
    const extension = extname(assetPath).toLowerCase();
    const contentTypes = {
      '.svg': 'image/svg+xml; charset=utf-8',
      '.png': 'image/png',
    };
    response.writeHead(200, { 'content-type': contentTypes[extension] ?? 'application/octet-stream' });
    response.end(readFileSync(assetPath));
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
};
const handleVote = async (request, response) => {
  try {
    const body = await readJsonBody(request);
    const optionKey = normalizeOpponentKey(body.optionKey ?? body.option ?? '');
    const db = new DatabaseSync(dbPath);
    try {
      ensureSchema(db);
      const existing = db
        .prepare('SELECT option_key FROM fan_poll_votes WHERE option_key = ?')
        .get(optionKey);

      if (!existing) {
        response.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify({ error: 'Unknown vote option' }));
        return;
      }

      db.prepare(
        'UPDATE fan_poll_votes ' +
          'SET vote_count = vote_count + 1, updated_at = CURRENT_TIMESTAMP ' +
          'WHERE option_key = ?'
      ).run(optionKey);

      const results = serializePollResults(getPollResults(db));
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ ok: true, results }));
    } finally {
      db.close();
    }
  } catch (error) {
    response.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: error.message }));
  }
};

const server = createServer(async (request, response) => {
  const { pathname } = parse(request.url);

  if (request.method === 'GET' && pathname.startsWith('/assets/')) {
    sendAsset(pathname, response);
    return;
  }

  if (request.method === 'POST' && pathname === '/api/vote') {
    await handleVote(request, response);
    return;
  }

  if (request.method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
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

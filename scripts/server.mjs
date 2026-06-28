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

const voteSessions = new Map();
const voteDebounceMs = 8000;

const tacticalXi = [
  {
    squadNumber: '1',
    name: 'Viktor Johansson',
    label: 'Johansson',
    position: 'Goalkeeper',
    role433: 'gk',
    role532: 'gk',
    tracked: true,
    stats: { goals: 0, assists: 0, yellowCards: 1, redCards: 0, rating: '7.1' },
  },
  {
    squadNumber: '2',
    name: 'Ki-Jana Hoever',
    label: 'Hoever',
    position: 'Right Back',
    role433: 'rb',
    role532: 'rwb',
    stats: { goals: 2, assists: 7, yellowCards: 5, redCards: 0, rating: '6.8' },
  },
  {
    squadNumber: '5',
    name: 'Michael Rose',
    label: 'Rose',
    position: 'Centre Back',
    role433: 'rcb',
    role532: 'rcb',
    stats: { goals: 3, assists: 1, yellowCards: 8, redCards: 0, rating: '6.9' },
  },
  {
    squadNumber: '16',
    name: 'Ben Wilmot',
    label: 'Wilmot',
    position: 'Centre Back',
    role433: 'lcb',
    role532: 'cb',
    stats: { goals: 1, assists: 2, yellowCards: 7, redCards: 1, rating: '6.7' },
  },
  {
    squadNumber: '3',
    name: 'Enda Stevens',
    label: 'Stevens',
    position: 'Left Back',
    role433: 'lb',
    role532: 'lcb',
    stats: { goals: 0, assists: 4, yellowCards: 4, redCards: 0, rating: '6.6' },
  },
  {
    squadNumber: '22',
    name: 'Junior Tchamadeu',
    label: 'Tchamadeu',
    position: 'Wing Back',
    role433: 'dm',
    role532: 'lwb',
    tracked: true,
    stats: { goals: 1, assists: 5, yellowCards: 6, redCards: 0, rating: '6.9' },
  },
  {
    squadNumber: '28',
    name: 'Josh Laurent',
    label: 'Laurent',
    position: 'Midfielder',
    role433: 'rcm',
    role532: 'rcm',
    stats: { goals: 4, assists: 3, yellowCards: 9, redCards: 0, rating: '6.8' },
  },
  {
    squadNumber: '10',
    name: 'Bae Jun-ho',
    label: 'Jun-ho',
    position: 'Attacking Midfielder',
    role433: 'lcm',
    role532: 'lcm',
    tracked: true,
    stats: { goals: 7, assists: 9, yellowCards: 3, redCards: 0, rating: '7.4' },
  },
  {
    squadNumber: '42',
    name: 'Million Manhoef',
    label: 'Manhoef',
    position: 'Forward',
    role433: 'lw',
    role532: 'stl',
    tracked: true,
    stats: { goals: 11, assists: 6, yellowCards: 4, redCards: 0, rating: '7.6' },
  },
  {
    squadNumber: '19',
    name: 'Sam Gallagher',
    label: 'Gallagher',
    position: 'Striker',
    role433: 'st',
    role532: 'str',
    stats: { goals: 9, assists: 2, yellowCards: 5, redCards: 0, rating: '7.0' },
  },
  {
    squadNumber: '7',
    name: 'Lynden Gooch',
    label: 'Gooch',
    position: 'Wide Midfielder',
    role433: 'rw',
    role532: 'cm',
    stats: { goals: 3, assists: 6, yellowCards: 4, redCards: 0, rating: '6.9' },
  },
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
    pieIndex: '3.8 / 5',
    pieTip: 'Steak & Ale highly recommended',
    tag: 'Transit Match',
    modules: [
      {
        title: 'Away-Friendly Pubs',
        kicker: 'Safe options',
        items: [
          'Harvester Morfa Parc Swansea: practical away-day food stop near the retail park.',
          'The Bank Statement - JD Wetherspoon, Wind St: central option before heading toward the ground.',
          'Avoid home-only zones and colours-heavy pubs immediately around the stadium footprint.',
        ],
      },
      {
        title: 'Recommended Hotels',
        kicker: 'Overnight checklist',
        items: [
          'The Grand Hotel: opposite Swansea train station for rail arrivals and early departures.',
          'Village Hotel Swansea: waterfront base with easier taxi access back into town.',
          'Book flexible check-in if travelling after Friday traffic on the M4 corridor.',
        ],
      },
      {
        title: 'Matchday Transit & Logistics',
        kicker: 'Road plan',
        items: [
          'Use Felindre M4 Junction 46 Park & Ride for lower-stress stadium access.',
          'Arrive early for highway parking and allow time for post-match traffic release.',
          'Keep the final stadium walk simple; follow official away supporter routing.',
        ],
      },
    ],
  },
  west_brom: {
    opponent: 'West Bromwich Albion',
    stadium: 'The Hawthorns',
    distance: '46 miles',
    travelTime: 'Approx. 55m by road',
    pieIndex: '4.5 / 5',
    pieTip: 'Chicken Balti',
    tag: 'Short Hop',
    modules: [
      {
        title: 'Away-Friendly Pubs',
        kicker: 'Safe options',
        items: [
          'The Vine: respected mixed-supporter stop with food before the walk in.',
          'Use town-centre options if travelling early and keep colours sensible near home-only pubs.',
          'Avoid forcing routes through dense home supporter approaches close to kick-off.',
        ],
      },
      {
        title: 'Recommended Hotels',
        kicker: 'Overnight checklist',
        items: [
          'Central Birmingham hotels work well for rail links and late food options.',
          'West Bromwich town stays reduce matchday travel time but offer fewer late-night choices.',
          'Check parking terms before booking because matchday restrictions change quickly.',
        ],
      },
      {
        title: 'Matchday Transit & Logistics',
        kicker: 'Road plan',
        items: [
          'For short-hop driving, leave a buffer for M6/M5 merge delays.',
          'Use official or clearly marked paid parking rather than residential side streets.',
          'Rail travellers should check return connections before committing to a late departure.',
        ],
      },
    ],
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
const generateMatchdayBriefing = ({ match, briefing, homeName, opponentName }) => {
  const venueLabel = titleCase(match?.venue ?? 'home');
  const surfaceCue = String(briefing.forecastCond ?? '').toLowerCase().includes('rain')
    ? 'a slick surface and faster second balls'
    : 'a cleaner surface and sharper passing windows';
  const cardsCue = String(briefing.officialsNote ?? '').toLowerCase().includes('card') || String(briefing.officialsNote ?? '').toLowerCase().includes('yellow')
    ? 'discipline around transitions matters because the referee profile points toward regular cards'
    : 'the referee profile should still reward clean timing in midfield duels';

  return {
    headline: `${homeName} briefing: ${opponentName} under ${briefing.forecastCond.toLowerCase()}`,
    summary:
      `${venueLabel} conditions point to ${surfaceCue}, with ${briefing.forecastTemp} and ${briefing.forecastCond.toLowerCase()} shaping the tempo. ` +
      `${briefing.referee} takes charge, and ${cardsCue}. ` +
      `${briefing.kitTip}` ,
  };
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

const getFormRatings = (rating) => {
  const base = Number.parseFloat(rating);
  if (!Number.isFinite(base)) return [6.4, 6.5, 6.5, 6.6, 6.7];
  return [base - 0.4, base - 0.2, base - 0.1, base + 0.1, base].map((value) => Math.max(5.8, Math.min(8.4, value)).toFixed(1));
};

const renderTacticalNodes = ({ players, squadByNumber = new Map(), variant = 'home' }) =>
  players
    .map((slot) => {
      const dbPlayer = variant === 'home' ? squadByNumber.get(slot.squadNumber) : null;
      const fullName = dbPlayer?.player_name ?? slot.name;
      const displayName = dbPlayer ? shortPlayerName(dbPlayer.player_name) : slot.label;
      const position = dbPlayer?.position ?? slot.position;
      const stats = {
        goals: slot.stats?.goals ?? 0,
        assists: slot.stats?.assists ?? 0,
        yellowCards: slot.stats?.yellowCards ?? 0,
        redCards: slot.stats?.redCards ?? 0,
        rating: slot.stats?.rating ?? '0.0',
        form: slot.stats?.form ?? getFormRatings(slot.stats?.rating),
      };
      return `
        <button class="player-strip-card kit-node home-kit${slot.tracked ? ' is-tracked' : ''}" type="button"
          data-number="#${escapeHtml(slot.squadNumber)}"
          data-role-433="${escapeHtml(slot.role433)}"
          data-role-532="${escapeHtml(slot.role532)}"
          data-player-name="${escapeHtml(fullName)}"
          data-player-role="${escapeHtml(position)}"
          data-goals="${escapeHtml(stats.goals)}"
          data-assists="${escapeHtml(stats.assists)}"
          data-yellows="${escapeHtml(stats.yellowCards)}"
          data-reds="${escapeHtml(stats.redCards)}"
          data-rating="${escapeHtml(stats.rating)}"
          data-form="${escapeHtml(stats.form.join(','))}">
          <span class="mini-kit" aria-hidden="true"><span class="kit-sleeve left"></span><span class="kit-body"></span><span class="kit-sleeve right"></span></span>
          <span class="position-pill">#${escapeHtml(slot.squadNumber).replace(/^O/, '')}</span>
          <h3 title="${escapeHtml(fullName)}">${escapeHtml(displayName)}</h3>
        </button>
      `;
    })
    .join('');

const renderAwayGuideModules = (guide) =>
  (guide.modules ?? [])
    .map((module) =>
      [
        '<article class="supporter-guide-card">',
        '<span>' + escapeHtml(module.kicker) + '</span>',
        '<h3>' + escapeHtml(module.title) + '</h3>',
        '<ul>',
        ...(module.items ?? []).map((item) => '<li>' + escapeHtml(item) + '</li>'),
        '</ul>',
        '</article>',
      ].join(''),
    )
    .join('');

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
    const homeDisplayName = displayTeamName(activeCulture.homeTeam);
    const heroOpponentDisplay = displayTeamName(hero.opponent);
    const awayOpponentDisplay = displayTeamName(awayGuide.opponent);
    const matchdayBriefing = generateMatchdayBriefing({
      match: contextMatch,
      briefing: matchBriefing,
      homeName: homeDisplayName,
      opponentName: displayTeamName(contextMatch.opponent),
    });

    const squadByNumber = new Map(squad.map((player) => [String(player.squad_number), player]));
    const squadCards = renderTacticalNodes({ players: tacticalXi, squadByNumber, variant: 'home' });

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
      heroOpponentDisplay,
      homeDisplayName,
      cultureProfileName: activeCulture.label,
      homeCrestSrc: crestAssets.stoke_city,
      awayCrestSrc: getCrestSrc(hero.opponent),
      heroVenue: titleCase(hero.venue),
      heroDate: formatDate(hero.match_date),
      heroDateShort: formatShortDate(hero.match_date),
      heroCompetition: hero.competition,
      squadCount: tacticalXi.length,
      fixtureCount: fixtures.length,
      squadCards,
      fixtureTimeline,
      fanPollOptions,
      matchdayBriefingHeadline: matchdayBriefing.headline,
      matchdayBriefingSummary: matchdayBriefing.summary,
      awayOpponent: awayGuide.opponent,
      awayOpponentDisplay,
      awayStadium: awayGuide.stadium,
      awayDistance: awayGuide.distance,
      awayTravelTime: awayGuide.travelTime,
      awaySupporterCards: renderAwayGuideModules(awayGuide),
      awayPieIndex: awayGuide.pieIndex,
      awayPieTip: awayGuide.pieTip,
      awayTag: awayGuide.tag,
      voteLockKey: normalizeOpponentKey(hero.opponent) + '_' + hero.match_date,
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

    const renderedHtml = Object.entries(replacements).reduce(
      (html, [key, value]) => html.replaceAll(`{{${key}}}`, String(value)),
      readFileSync(templatePath, 'utf8'),
    );

    return renderedHtml.replaceAll('{{awaySupporterCards}}', renderAwayGuideModules(awayGuide));
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
    const sessionId = normalizeOpponentKey(body.sessionId ?? request.headers['x-forwarded-for'] ?? request.socket.remoteAddress ?? 'anonymous');
    const voteLockKey = normalizeOpponentKey(body.voteLockKey ?? 'current_match');
    const debounceKey = [sessionId, voteLockKey, optionKey].join(':');
    const now = Date.now();
    for (const [key, timestamp] of voteSessions.entries()) {
      if (now - timestamp > voteDebounceMs) voteSessions.delete(key);
    }
    if (voteSessions.has(debounceKey) && now - voteSessions.get(debounceKey) < voteDebounceMs) {
      const db = new DatabaseSync(dbPath);
      try {
        const results = serializePollResults(getPollResults(db));
        response.writeHead(202, { 'content-type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify({ ok: true, duplicate: true, results }));
      } finally {
        db.close();
      }
      return;
    }
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

      voteSessions.set(debounceKey, now);

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

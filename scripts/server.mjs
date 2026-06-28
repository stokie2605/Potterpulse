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
  {
    key: 'blind_optimism',
    label: 'Blind Optimism (3-0 Cruise)',
    note: 'Robins has cooked a masterclass over pre-season and Soumaré is going to absolutely boss the middle.',
  },
  {
    key: 'scarred_regular',
    label: 'The Scarred Regular (Scrappy 1-0)',
    note: "I'd snap your hand off for any win right now. Just don't pass it straight to their strikers in the first 10 minutes.",
  },
  {
    key: 'chronic_pessimism',
    label: 'Chronic Pessimism (The Usual ST4 Cold Shower)',
    note: '75% possession for them, a soft counter-attack goal conceded, and freezing rain whipping off the bay.',
  },
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
    name: 'Junior Tchamadeu',
    label: 'Tchamadeu',
    position: 'Defender',
    role433: 'rb',
    role532: 'rwb',
    stats: { goals: 1, assists: 5, yellowCards: 6, redCards: 0, rating: '6.9' },
  },
  {
    squadNumber: '16',
    name: 'Ben Wilmot',
    label: 'Wilmot',
    position: 'Defender',
    role433: 'rcb',
    role532: 'rcb',
    stats: { goals: 1, assists: 2, yellowCards: 7, redCards: 1, rating: '6.7' },
  },
  {
    squadNumber: '23',
    name: 'Ben Gibson',
    label: 'Gibson',
    position: 'Defender',
    role433: 'lcb',
    role532: 'cb',
    stats: { goals: 0, assists: 1, yellowCards: 4, redCards: 0, rating: '6.8' },
  },
  {
    squadNumber: '3',
    name: 'Eric Bocat',
    label: 'Bocat',
    position: 'Defender',
    role433: 'lb',
    role532: 'lcb',
    stats: { goals: 0, assists: 3, yellowCards: 3, redCards: 0, rating: '6.6' },
  },
  {
    squadNumber: '6',
    name: 'Wouter Burger',
    label: 'Burger',
    position: 'Midfielder',
    role433: 'dm',
    role532: 'lwb',
    stats: { goals: 4, assists: 4, yellowCards: 8, redCards: 0, rating: '7.0' },
  },
  {
    squadNumber: '15',
    name: 'Tatsuki Seko',
    label: 'Seko',
    position: 'Midfielder',
    role433: 'rcm',
    role532: 'rcm',
    stats: { goals: 0, assists: 2, yellowCards: 2, redCards: 0, rating: '6.7' },
  },
  {
    squadNumber: '8',
    name: 'Andrew Moran',
    label: 'Moran',
    position: 'Midfielder',
    role433: 'lcm',
    role532: 'lcm',
    stats: { goals: 2, assists: 4, yellowCards: 3, redCards: 0, rating: '6.8' },
  },
  {
    squadNumber: '10',
    name: 'Bae Jun-ho',
    label: 'Jun-ho',
    position: 'Attacking Midfielder',
    role433: 'lw',
    role532: 'stl',
    tracked: true,
    stats: { goals: 7, assists: 9, yellowCards: 3, redCards: 0, rating: '7.4' },
  },
  {
    squadNumber: '42',
    name: 'Million Manhoef',
    label: 'Manhoef',
    position: 'Forward',
    role433: 'rw',
    role532: 'cm',
    tracked: true,
    stats: { goals: 11, assists: 6, yellowCards: 4, redCards: 0, rating: '7.6' },
  },
  {
    squadNumber: '9',
    name: 'Tom Cannon',
    label: 'Tom Cannon',
    position: 'Striker',
    role433: 'st',
    role532: 'str',
    stats: { goals: 8, assists: 2, yellowCards: 2, redCards: 0, rating: '7.1' },
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

  db.exec(
    "DELETE FROM fan_poll_votes WHERE option_key NOT IN ('blind_optimism', 'scarred_regular', 'chronic_pessimism')"
  );

  const seedVote = db.prepare(
    'INSERT OR IGNORE INTO fan_poll_votes (option_key, label, note, vote_count) ' +
      'VALUES (?, ?, ?, 0)'
  );

  for (const candidate of pollCandidates) {
    seedVote.run(candidate.key, candidate.label, candidate.note);
  }

  // 1. Forum threads table
  let needsThreadsMigration = false;
  try {
    db.prepare('SELECT category FROM forum_threads LIMIT 1').get();
  } catch (err) {
    needsThreadsMigration = true;
  }

  if (needsThreadsMigration) {
    db.exec('DROP TABLE IF EXISTS forum_threads');
  }

  db.exec(
    'CREATE TABLE IF NOT EXISTS forum_threads (' +
      'id INTEGER PRIMARY KEY AUTOINCREMENT,' +
      'title TEXT NOT NULL,' +
      'username TEXT NOT NULL,' +
      'content TEXT NOT NULL,' +
      'category TEXT NOT NULL DEFAULT "Trending",' +
      'reply_count INTEGER NOT NULL DEFAULT 0,' +
      'created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,' +
      'updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP' +
    ')'
  );

  const threadCount = db.prepare('SELECT count(*) as count FROM forum_threads').get().count;
  if (threadCount === 0) {
    const seedThread = db.prepare('INSERT INTO forum_threads (title, username, content, category, reply_count) VALUES (?, ?, ?, ?, ?)');
    seedThread.run(
      "Pearson back in training - how long till his first booking?", 
      "Boothen_Ender92", 
      "Good to see him sweating it out at Clayton Wood, but let's be real - he'll be walking a suspension tightrope by October anyway. Glad to have his bite back in the engine room though, we need someone to stop us leaking soft goals on Tuesday nights.",
      "Matchday",
      14
    );
    seedThread.run(
      "Walters cooking? Retained list cleared & new winger links", 
      "Trentham_Potter", 
      "With Baker and Nzonzi off the wage bill, rumours are flying about a domestic winger. Let's just hope we don't panic-buy another flashy squad-filler who goes completely missing the second the winter wind whips off the bay.",
      "Transfers",
      37
    );
    seedThread.run(
      "Coordinated 'We'll Be With You' for the opener", 
      "Delilah_Roar", 
      "Big push from the independent lads to make the home opener deafening the second they walk out of the tunnel. Bring your scarves and leave your lungs on the terraces - none of that quiet main-stand whispering!",
      "Trending",
      22
    );
    seedThread.run(
      "Swansea Away - parking at Felindre or Landore?", 
      "ST4_Oli", 
      "Swansea away travel advice needed. Leaving early Saturday morning from the Potteries. Heard Felindre park and ride is best, but want to make sure it leaves enough time to get back to the shuttle coaches after the whistle.",
      "Away Days",
      9
    );
  }

  // 2. Match stats table
  db.exec(
    'CREATE TABLE IF NOT EXISTS match_stats (' +
      'opponent TEXT NOT NULL,' +
      'match_date TEXT NOT NULL,' +
      'poss_home INTEGER NOT NULL,' +
      'poss_away INTEGER NOT NULL,' +
      'shots_home INTEGER NOT NULL,' +
      'shots_away INTEGER NOT NULL,' +
      'sot_home INTEGER NOT NULL,' +
      'sot_away INTEGER NOT NULL,' +
      'corners_home INTEGER NOT NULL,' +
      'corners_away INTEGER NOT NULL,' +
      'fouls_home INTEGER NOT NULL,' +
      'fouls_away INTEGER NOT NULL,' +
      'scorers TEXT NOT NULL,' +
      'PRIMARY KEY (opponent, match_date)' +
    ')'
  );

  const statsCount = db.prepare('SELECT count(*) as count FROM match_stats').get().count;
  if (statsCount === 0) {
    const seedStats = db.prepare('INSERT OR IGNORE INTO match_stats (opponent, match_date, poss_home, poss_away, shots_home, shots_away, sot_home, sot_away, corners_home, corners_away, fouls_home, fouls_away, scorers) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    seedStats.run("Oldham Athletic", "2026-08-08", 58, 42, 16, 8, 7, 2, 8, 3, 11, 14, "Manhoef 32', Jun-ho 71' | Smith 89'");
  }

  // Update Oldham Athletic fixture scores to show completed cup match
  try {
    db.prepare("UPDATE efl_fixtures SET status = 'completed', stoke_score = 2, opponent_score = 1 WHERE opponent = 'Oldham Athletic' AND match_date = '2026-08-08'").run();
  } catch (e) {
    console.error("Failed to update Oldham fixture:", e.message);
  }

  // 3. Poll comments table
  db.exec(
    'CREATE TABLE IF NOT EXISTS poll_comments (' +
      'id INTEGER PRIMARY KEY AUTOINCREMENT,' +
      'vote_lock_key TEXT NOT NULL,' +
      'username TEXT NOT NULL,' +
      'comment_text TEXT NOT NULL,' +
      'created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP' +
    ')'
  );

  const commentsCount = db.prepare('SELECT count(*) as count FROM poll_comments').get().count;
  if (commentsCount === 0) {
    const seedComment = db.prepare('INSERT INTO poll_comments (vote_lock_key, username, comment_text) VALUES (?, ?, ?)');
    // Seed comments for Oldham Athletic match poll (past match)
    seedComment.run("oldham_athletic_2026-08-08", "StokeFan1863", "Robins has got us playing some proper football. Bring on the Swans!");
    seedComment.run("oldham_athletic_2026-08-08", "ST4_Lager", "Johansson is an absolute monster in net. That save at the end was class.");
    seedComment.run("oldham_athletic_2026-08-08", "ST4_Oli", "Hope we sign one more winger before the window closes, but the starting XI looks solid.");
    // Seed comments for Swansea City match poll (current match)
    seedComment.run("swansea_city_2026-08-15_15:00", "PotterPride", "Blind optimism as always! Let's get the 3 points.");
    seedComment.run("swansea_city_2026-08-15_15:00", "ST4_Lager", "Scarred regular here. Happy with a hard-fought draw to be honest.");
  }

  // 4. Player ratings table for completed matches
  db.exec(
    'CREATE TABLE IF NOT EXISTS player_ratings (' +
      'opponent TEXT NOT NULL,' +
      'match_date TEXT NOT NULL,' +
      'player_number TEXT NOT NULL,' +
      'rating_sum REAL NOT NULL,' +
      'rating_count INTEGER NOT NULL,' +
      'PRIMARY KEY (opponent, match_date, player_number)' +
    ')'
  );

  const ratingsCount = db.prepare('SELECT count(*) as count FROM player_ratings').get().count;
  if (ratingsCount === 0) {
    const seedRating = db.prepare('INSERT INTO player_ratings (opponent, match_date, player_number, rating_sum, rating_count) VALUES (?, ?, ?, ?, ?)');
    seedRating.run("Oldham Athletic", "2026-08-08", "1", 82.0, 10);
    seedRating.run("Oldham Athletic", "2026-08-08", "10", 135.0, 15);
    seedRating.run("Oldham Athletic", "2026-08-08", "22", 70.0, 10);
  }

  // 5. Stoke Transfers table
  db.exec(
    'CREATE TABLE IF NOT EXISTS stoke_transfers (' +
      'id INTEGER PRIMARY KEY AUTOINCREMENT,' +
      'player_name TEXT NOT NULL,' +
      'direction TEXT NOT NULL CHECK(direction IN (\'IN\', \'OUT\')),' +
      'details TEXT NOT NULL,' +
      'created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP' +
    ')'
  );

  const transferCount = db.prepare('SELECT count(*) as count FROM stoke_transfers').get().count;
  if (transferCount === 0) {
    const seedTransfer = db.prepare('INSERT INTO stoke_transfers (player_name, direction, details) VALUES (?, ?, ?)');
    seedTransfer.run('Boubakary Soumaré', 'IN', 'Leicester City - Loan');
    seedTransfer.run('Ki-Jana Hoever', 'IN', 'Wolves - Season Loan');
    seedTransfer.run('Viktor Johansson', 'IN', 'Rotherham - Perm');
    seedTransfer.run('Tyrese Campbell', 'OUT', 'Released - Perm');
    seedTransfer.run('Wesley', 'OUT', 'Released - Perm');
    seedTransfer.run('Luke Cundle', 'OUT', 'End of Loan');
  }

  // 6. Current Squad list database creation
  db.exec('DROP TABLE IF EXISTS stoke_squad');
  db.exec(
    'CREATE TABLE stoke_squad (' +
      'id INTEGER PRIMARY KEY AUTOINCREMENT,' +
      'player_name TEXT NOT NULL,' +
      'position TEXT NOT NULL,' +
      'squad_number INTEGER NOT NULL,' +
      'created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,' +
      'updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP' +
    ')'
  );
  
  const seedSquadPlayer = db.prepare('INSERT INTO stoke_squad (player_name, position, squad_number) VALUES (?, ?, ?)');
  seedSquadPlayer.run('Viktor Johansson', 'goalkeeper', 1);
  seedSquadPlayer.run('Junior Tchamadeu', 'defender', 2);
  seedSquadPlayer.run('Ben Wilmot', 'defender', 16);
  seedSquadPlayer.run('Ben Gibson', 'defender', 23);
  seedSquadPlayer.run('Eric Bocat', 'defender', 3);
  seedSquadPlayer.run('Wouter Burger', 'midfielder', 6);
  seedSquadPlayer.run('Tatsuki Seko', 'midfielder', 15);
  seedSquadPlayer.run('Andrew Moran', 'midfielder', 8);
  seedSquadPlayer.run('Bae Jun-ho', 'midfielder', 10);
  seedSquadPlayer.run('Million Manhoef', 'forward', 42);
  seedSquadPlayer.run('Tom Cannon', 'forward', 9);
  seedSquadPlayer.run('Lewis Koumas', 'forward', 11);
  seedSquadPlayer.run('Jordan Thompson', 'midfielder', 7);
  seedSquadPlayer.run('Niall Ennis', 'forward', 14);
};

const getPollResults = (db) => {
  ensureSchema(db);
  return db
    .prepare(
      'SELECT option_key, label, note, vote_count ' +
        'FROM fan_poll_votes ' +
        'ORDER BY CASE option_key ' +
        "WHEN 'blind_optimism' THEN 1 " +
        "WHEN 'scarred_regular' THEN 2 " +
        "WHEN 'chronic_pessimism' THEN 3 " +
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
        '<button class="poll-option" type="button" data-vote-option="' + escapeHtml(option.key) + '" data-votes="' + escapeHtml(option.votes) + '">',
        '<div class="vote-progress-fill" style="width: ' + escapeHtml(option.percent) + '%;"></div>',
        '<div class="radio-indicator"></div>',
        '<div class="option-content">',
        '<strong>' + escapeHtml(option.label) + '</strong>',
        '<p>' + escapeHtml(option.note) + '</p>',
        '</div>',
        '<span class="poll-percentage">' + escapeHtml(option.percent) + '%</span>',
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
        <span class="player-strip-card kit-node home-kit${slot.tracked ? ' is-tracked' : ''}"
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
          <span class="mini-kit" aria-hidden="true"><span class="kit-number">${escapeHtml(slot.squadNumber)}</span></span>
          <h3 title="${escapeHtml(fullName)}">${escapeHtml(displayName)}</h3>
        </span>
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

let supabaseUrl = process.env.SUPABASE_URL;
let supabaseKey = process.env.SUPABASE_ANON_KEY;

function loadEnvConfig() {
  if (!supabaseUrl || !supabaseKey) {
    try {
      const dotenvContent = readFileSync(resolve(rootDir, '.env'), 'utf8');
      const urlMatch = dotenvContent.match(/SUPABASE_URL\s*=\s*["']?([^\s"'#]+)["']?/i);
      const keyMatch = dotenvContent.match(/SUPABASE_ANON_KEY\s*=\s*["']?([^\s"'#]+)["']?/i);
      if (urlMatch) supabaseUrl = urlMatch[1];
      if (keyMatch) supabaseKey = keyMatch[1];
    } catch (err) {
      // Ignore
    }
  }
}

async function fetchSupabase(table, queryParams = '', options = {}) {
  const url = `${supabaseUrl}/rest/v1/${table}?${queryParams}`;
  const headers = {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json'
  };
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  if (res.ok) {
    if (options.method === 'POST' || options.method === 'PATCH' || options.method === 'DELETE') {
      return { ok: true };
    }
    return await res.json();
  } else {
    throw new Error(`Supabase error on ${table}: ${res.status} ${await res.text()}`);
  }
}

const render = async () => {
  loadEnvConfig();
  const useSupabase = Boolean(supabaseUrl && supabaseKey);
  const db = new DatabaseSync(dbPath);
  try {
    let squad, fixtures, transfers;
    if (useSupabase) {
      squad = await fetchSupabase('stoke_squad', 'select=player_name,squad_number,position&order=squad_number.asc');
      fixtures = await fetchSupabase('efl_fixtures', 'select=opponent,match_date,competition,venue,status,stoke_score,opponent_score&order=match_date.asc');
      transfers = await fetchSupabase('stoke_transfers', 'select=player_name,direction,details&order=id.desc');
    } else {
      ensureSchema(db);
      squad = db.prepare('SELECT player_name, squad_number, position FROM stoke_squad ORDER BY squad_number').all();
      fixtures = db.prepare('SELECT opponent, match_date, competition, venue, status, stoke_score, opponent_score FROM efl_fixtures ORDER BY match_date').all();
      transfers = db.prepare('SELECT player_name, direction, details FROM stoke_transfers ORDER BY id DESC').all();
    }
    const transfersInList = transfers
      .filter((t) => t.direction === 'IN')
      .map((t) => `<li style="color:#fff; font-weight:800;">• ${escapeHtml(t.player_name)} <span style="color:var(--muted); font-size:9px; font-weight:400;">(${escapeHtml(t.details)})</span></li>`)
      .join('') || '<li style="color:var(--muted); font-size:11px;">No arrivals yet.</li>';
      
    const transfersOutList = transfers
      .filter((t) => t.direction === 'OUT')
      .map((t) => `<li style="color:#fff; font-weight:800;">• ${escapeHtml(t.player_name)} <span style="color:var(--muted); font-size:9px; font-weight:400;">(${escapeHtml(t.details)})</span></li>`)
      .join('') || '<li style="color:var(--muted); font-size:11px;">No departures yet.</li>';
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
          <article class="fixture-row${index >= 5 ? ' is-collapsed' : ''}"
            data-opponent="${escapeHtml(fixture.opponent)}"
            data-match-date="${escapeHtml(fixture.match_date)}"
            data-completed="${fixture.stoke_score !== null ? 'true' : 'false'}">
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
            ${fixture.stoke_score !== null 
              ? `<span class="score-chip" style="margin-left: auto; background: var(--red-3); color: #fff; padding: 4px 8px; border-radius: 6px; font-weight: 800; font-size: 11px; font-family: inherit;">${fixture.stoke_score}-${fixture.opponent_score}</span>` 
              : `<span class="fixture-arrow">&rsaquo;</span>`
            }
          </article>
        `,
      )
      .join('');

    const squadTableRows = squad
      .map((p) => {
        let posTag = p.position.slice(0, 2).toUpperCase();
        if (posTag === 'GO') posTag = 'GK';
        if (posTag === 'DE') posTag = 'DF';
        if (posTag === 'MI') posTag = 'MF';
        if (posTag === 'FO') posTag = 'FW';
        return `
          <tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
            <td style="padding:6px 4px; font-weight:800;">${escapeHtml(p.player_name)}</td>
            <td style="padding:6px 4px; text-align:center; color:var(--muted); text-transform:uppercase;">${escapeHtml(posTag)}</td>
            <td style="padding:6px 4px; text-align:center;">-</td>
            <td style="padding:6px 4px; text-align:center;">-</td>
            <td style="padding:6px 4px; text-align:center;">-</td>
            <td style="padding:6px 4px; text-align:center;"><span style="background:var(--red-3); color:#fff; padding:1px 4px; border-radius:4px; font-weight:900;">7.0</span></td>
          </tr>
        `;
      })
      .join('');

    const replacements = {
      transfersInList,
      transfersOutList,
      squadTableRows,
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
      awayGuidesJson: JSON.stringify(awayGuides),
      briefingsJson: JSON.stringify(nextMatchBriefing),
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

const forumCooldowns = new Map();

const handleGetForumThreads = (request, response) => {
  const { query } = parse(request.url, true);
  const category = query.category;
  const db = new DatabaseSync(dbPath);
  try {
    ensureSchema(db);
    let threads;
    if (category && category !== 'All') {
      threads = db.prepare('SELECT id, title, username, content, category, reply_count, created_at FROM forum_threads WHERE category = ? ORDER BY id DESC').all(category);
    } else {
      threads = db.prepare('SELECT id, title, username, content, category, reply_count, created_at FROM forum_threads ORDER BY id DESC').all();
    }
    response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ ok: true, threads }));
  } finally {
    db.close();
  }
};

const handlePostForumThread = async (request, response) => {
  try {
    const body = await readJsonBody(request);
    const title = String(body.title ?? '').trim();
    const username = String(body.username ?? '').trim() || 'Anonymous';
    const content = String(body.content ?? '').trim();
    let category = String(body.category ?? 'Trending').trim();
    const sessionId = String(body.sessionId ?? request.socket.remoteAddress);

    const validCategories = ['Trending', 'Matchday', 'Transfers', 'Away Days'];
    if (!validCategories.includes(category)) {
      category = 'Trending';
    }

    // Cooldown Validation (15 seconds)
    const now = Date.now();
    const lastPost = forumCooldowns.get(sessionId) ?? 0;
    if (now - lastPost < 15000) {
      response.writeHead(429, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ error: 'Please wait 15 seconds between posts.' }));
      return;
    }

    // Length Validations
    if (!title || !content) {
      response.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ error: 'Title and content are required' }));
      return;
    }
    if (title.length > 100) {
      response.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ error: 'Title cannot exceed 100 characters.' }));
      return;
    }
    if (content.length > 500) {
      response.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ error: 'Content cannot exceed 500 characters.' }));
      return;
    }
    if (username.length > 30) {
      response.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ error: 'Username cannot exceed 30 characters.' }));
      return;
    }

    forumCooldowns.set(sessionId, now);

    const db = new DatabaseSync(dbPath);
    try {
      db.prepare('INSERT INTO forum_threads (title, username, content, category, reply_count) VALUES (?, ?, ?, ?, 0)').run(title, username, content, category);
      const threads = db.prepare('SELECT id, title, username, content, category, reply_count, created_at FROM forum_threads ORDER BY id DESC').all();
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ ok: true, threads }));
    } finally {
      db.close();
    }
  } catch (error) {
    response.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: error.message }));
  }
};

const handleGetPollComments = (request, response) => {
  const { query } = parse(request.url, true);
  const voteLockKey = query.voteLockKey ?? 'current_match';
  const db = new DatabaseSync(dbPath);
  try {
    ensureSchema(db);
    const comments = db.prepare('SELECT id, username, comment_text, created_at FROM poll_comments WHERE vote_lock_key = ? ORDER BY id DESC').all();
    response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ ok: true, comments }));
  } finally {
    db.close();
  }
};

const handlePostPollComment = async (request, response) => {
  try {
    const body = await readJsonBody(request);
    const voteLockKey = String(body.voteLockKey ?? 'current_match');
    const username = String(body.username ?? '').trim() || 'Anonymous';
    const commentText = String(body.commentText ?? '').trim();

    if (!commentText) {
      response.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ error: 'Comment text is required' }));
      return;
    }

    const db = new DatabaseSync(dbPath);
    try {
      db.prepare('INSERT INTO poll_comments (vote_lock_key, username, comment_text) VALUES (?, ?, ?)').run(voteLockKey, username, commentText);
      const comments = db.prepare('SELECT id, username, comment_text, created_at FROM poll_comments WHERE vote_lock_key = ? ORDER BY id DESC').all();
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ ok: true, comments }));
    } finally {
      db.close();
    }
  } catch (error) {
    response.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: error.message }));
  }
};

const handleGetMatchStats = (request, response) => {
  const { query } = parse(request.url, true);
  const opponent = query.opponent;
  const matchDate = query.matchDate;

  if (!opponent || !matchDate) {
    response.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: 'Opponent and matchDate are required' }));
    return;
  }

  const db = new DatabaseSync(dbPath);
  try {
    ensureSchema(db);
    const stats = db.prepare('SELECT * FROM match_stats WHERE opponent = ? AND match_date = ?').get(opponent, matchDate);
    if (!stats) {
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({
        ok: true,
        stats: {
          opponent,
          match_date: matchDate,
          poss_home: 50,
          poss_away: 50,
          shots_home: 10,
          shots_away: 10,
          sot_home: 4,
          sot_away: 4,
          corners_home: 5,
          corners_away: 5,
          fouls_home: 10,
          fouls_away: 10,
          scorers: 'No scorers data available'
        }
      }));
      return;
    }
    response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ ok: true, stats }));
  } finally {
    db.close();
  }
};

const handleGetPlayerRatings = (request, response) => {
  const { query } = parse(request.url, true);
  const opponent = query.opponent;
  const matchDate = query.matchDate;

  if (!opponent || !matchDate) {
    response.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: 'Opponent and matchDate are required' }));
    return;
  }

  const db = new DatabaseSync(dbPath);
  try {
    ensureSchema(db);
    const rows = db.prepare('SELECT player_number, rating_sum, rating_count FROM player_ratings WHERE opponent = ? AND match_date = ?').all();
    let potmNumber = null;
    let maxAvg = 0;
    const ratings = {};

    rows.forEach(r => {
      const avg = r.rating_count > 0 ? Number((r.rating_sum / r.rating_count).toFixed(1)) : 0;
      ratings[r.player_number] = { avg, count: r.rating_count };
      if (avg > maxAvg) {
        maxAvg = avg;
        potmNumber = r.player_number;
      }
    });

    response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ ok: true, ratings, potmNumber, maxAvg }));
  } finally {
    db.close();
  }
};

const handlePostPlayerRatings = async (request, response) => {
  try {
    const body = await readJsonBody(request);
    const opponent = String(body.opponent ?? '');
    const matchDate = String(body.matchDate ?? '');
    const ratingsMap = body.ratings ?? {};

    if (!opponent || !matchDate) {
      response.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ error: 'Opponent and matchDate are required' }));
      return;
    }

    const db = new DatabaseSync(dbPath);
    try {
      ensureSchema(db);
      const insertOrUpdate = db.prepare(
        'INSERT INTO player_ratings (opponent, match_date, player_number, rating_sum, rating_count) ' +
        'VALUES (?, ?, ?, ?, 1) ' +
        'ON CONFLICT(opponent, match_date, player_number) DO UPDATE SET ' +
        'rating_sum = rating_sum + excluded.rating_sum, ' +
        'rating_count = rating_count + 1'
      );

      db.exec('BEGIN');
      try {
        Object.entries(ratingsMap).forEach(([num, val]) => {
          const ratingVal = Number(val);
          if (ratingVal >= 1 && ratingVal <= 10) {
            insertOrUpdate.run(opponent, matchDate, num, ratingVal);
          }
        });
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }

      const rows = db.prepare('SELECT player_number, rating_sum, rating_count FROM player_ratings WHERE opponent = ? AND match_date = ?').all();
      let potmNumber = null;
      let maxAvg = 0;
      const ratings = {};

      rows.forEach(r => {
        const avg = r.rating_count > 0 ? Number((r.rating_sum / r.rating_count).toFixed(1)) : 0;
        ratings[r.player_number] = { avg, count: r.rating_count };
        if (avg > maxAvg) {
          maxAvg = avg;
          potmNumber = r.player_number;
        }
      });

      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ ok: true, ratings, potmNumber, maxAvg }));
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

  if (request.method === 'GET' && pathname === '/api/forum-threads') {
    handleGetForumThreads(request, response);
    return;
  }
  if (request.method === 'POST' && pathname === '/api/forum-threads') {
    await handlePostForumThread(request, response);
    return;
  }
  if (request.method === 'GET' && pathname === '/api/poll-comments') {
    handleGetPollComments(request, response);
    return;
  }
  if (request.method === 'POST' && pathname === '/api/poll-comments') {
    await handlePostPollComment(request, response);
    return;
  }
  if (request.method === 'GET' && pathname === '/api/match-stats') {
    handleGetMatchStats(request, response);
    return;
  }
  if (request.method === 'GET' && pathname === '/api/player-ratings') {
    handleGetPlayerRatings(request, response);
    return;
  }
  if (request.method === 'POST' && pathname === '/api/player-ratings') {
    await handlePostPlayerRatings(request, response);
    return;
  }

  if (request.method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(await render());
    return;
  }

  response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  response.end('Not found');
});

server.listen(port, () => {
  console.log(`Potter Pulse running at http://localhost:${port}`);
  runLiveSyncService();
});

// Live Real-World Football API Synchronization & Simulator
function runLiveSyncService() {
  let apiKey = process.env.FOOTBALL_API_KEY;
  if (!apiKey) {
    try {
      const dotenvContent = readFileSync(resolve(rootDir, '.env'), 'utf8');
      const match = dotenvContent.match(/FOOTBALL_API_KEY\s*=\s*["']?([a-f0-9]+)["']?/i);
      if (match) {
        apiKey = match[1];
      }
    } catch (err) {
      // Ignore if file doesn't exist
    }
  }

  const syncIntervalMs = 60000 * 5; // 5 minutes sync cycle
  
  const performSync = async () => {
    try {
      if (apiKey) {
        console.log("[LiveSync] Syncing with real-world Football API (api.football-data.org)...");
        const res = await fetch('https://api.football-data.org/v4/teams/70/matches?status=SCHEDULED', {
          headers: { 'X-Auth-Token': apiKey }
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.matches) {
            console.log(`[LiveSync] Successfully retrieved ${data.matches.length} fixtures from Football API.`);
            
            loadEnvConfig();
            const useSupabase = Boolean(supabaseUrl && supabaseKey);
            
            if (useSupabase) {
              for (const match of data.matches) {
                const opponentName = match.homeTeam.id === 70 ? match.awayTeam.name : match.homeTeam.name;
                const matchDate = match.utcDate.slice(0, 10);
                const comp = match.competition.name;
                try {
                  await fetchSupabase('efl_fixtures', `opponent=eq.${encodeURIComponent(opponentName)}`, {
                    method: 'PATCH',
                    body: { match_date: matchDate, competition: comp }
                  });
                } catch (e) {
                  // Ignore if row doesn't exist
                }
              }
              console.log("[LiveSync] Supabase cloud database successfully updated with real fixture dates.");
            } else {
              const db = new DatabaseSync(dbPath);
              try {
                const updateStmt = db.prepare(
                  'UPDATE efl_fixtures SET match_date = ?, competition = ? WHERE opponent = ?'
                );
                for (const match of data.matches) {
                  const opponentName = match.homeTeam.id === 70 ? match.awayTeam.name : match.homeTeam.name;
                  const matchDate = match.utcDate.slice(0, 10);
                  const comp = match.competition.name;
                  updateStmt.run(matchDate, comp, opponentName);
                }
                console.log("[LiveSync] SQLite database successfully updated with real fixture dates.");
              } finally {
                db.close();
              }
            }
          }
        } else {
          console.warn("[LiveSync] Football API returned status code:", res.status);
        }
      } else {
        // Simulation Mode: Dynamic updates simulating team announcements
        console.log("[LiveSync] Operating in local simulation mode. Set FOOTBALL_API_KEY in .env to connect real-world data.");
      }
    } catch (err) {
      console.error("[LiveSync] Error in sync service loop:", err);
    }
  };

  // Run initial sync asynchronously, then set interval
  performSync();
  setInterval(performSync, syncIntervalMs);
}

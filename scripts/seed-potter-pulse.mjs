import { DatabaseSync } from 'node:sqlite';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = join(rootDir, 'potter_pulse.db');
const db = new DatabaseSync(dbPath);

const players = [
  { player_name: 'Viktor Johansson', squad_number: 1, position: 'goalkeeper' },
  { player_name: 'Junior Tchamadeu', squad_number: 2, position: 'defender' },
  { player_name: 'Ben Wilmot', squad_number: 16, position: 'defender' },
  { player_name: 'Ben Gibson', squad_number: 23, position: 'defender' },
  { player_name: 'Eric Bocat', squad_number: 3, position: 'defender' },
  { player_name: 'Wouter Burger', squad_number: 6, position: 'midfielder' },
  { player_name: 'Tatsuki Seko', squad_number: 15, position: 'midfielder' },
  { player_name: 'Andrew Moran', squad_number: 8, position: 'midfielder' },
  { player_name: 'Bae Jun-ho', squad_number: 10, position: 'midfielder' },
  { player_name: 'Million Manhoef', squad_number: 42, position: 'forward' },
  { player_name: 'Tom Cannon', squad_number: 9, position: 'forward' },
  { player_name: 'Lewis Koumas', squad_number: 11, position: 'forward' },
  { player_name: 'Jordan Thompson', squad_number: 7, position: 'midfielder' },
  { player_name: 'Niall Ennis', squad_number: 14, position: 'forward' },
];

const fixtures = [
  { opponent: 'Oldham Athletic', match_date: '2026-08-08', competition: 'EFL Cup', venue: 'home', status: 'completed', stoke_score: 2, opponent_score: 1 },
  { opponent: 'Swansea City', match_date: '2026-08-15', competition: 'Championship', venue: 'home', status: 'scheduled', stoke_score: null, opponent_score: null },
  { opponent: 'Southampton', match_date: '2026-08-22', competition: 'Championship', venue: 'away', status: 'scheduled', stoke_score: null, opponent_score: null },
  { opponent: 'Wolverhampton Wanderers', match_date: '2026-08-29', competition: 'Championship', venue: 'away', status: 'scheduled', stoke_score: null, opponent_score: null },
  { opponent: 'Norwich City', match_date: '2026-09-01', competition: 'Championship', venue: 'home', status: 'scheduled', stoke_score: null, opponent_score: null },
];

db.exec(`CREATE TABLE IF NOT EXISTS stoke_squad (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_name TEXT NOT NULL,
  position TEXT NOT NULL,
  squad_number INTEGER NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`);

db.exec(`CREATE TABLE IF NOT EXISTS efl_fixtures (
  opponent TEXT NOT NULL,
  match_date TEXT NOT NULL,
  competition TEXT NOT NULL,
  venue TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  stoke_score INTEGER,
  opponent_score INTEGER,
  PRIMARY KEY (opponent, match_date)
)`);

db.exec('BEGIN');
try {
  const deletePlayer = db.prepare('DELETE FROM stoke_squad WHERE squad_number = ? OR player_name = ?');
  const insertPlayer = db.prepare('INSERT INTO stoke_squad (player_name, squad_number, position) VALUES (?, ?, ?)');

  for (const player of players) {
    deletePlayer.run(player.squad_number, player.player_name);
    insertPlayer.run(player.player_name, player.squad_number, player.position);
  }

  const upsertFixture = db.prepare(`INSERT INTO efl_fixtures (opponent, match_date, competition, venue, status, stoke_score, opponent_score)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(opponent, match_date) DO UPDATE SET
      competition = excluded.competition,
      venue = excluded.venue,
      status = excluded.status,
      stoke_score = excluded.stoke_score,
      opponent_score = excluded.opponent_score`);

  for (const fixture of fixtures) {
    upsertFixture.run(
      fixture.opponent,
      fixture.match_date,
      fixture.competition,
      fixture.venue,
      fixture.status,
      fixture.stoke_score,
      fixture.opponent_score,
    );
  }

  db.exec('COMMIT');
} catch (error) {
  db.exec('ROLLBACK');
  throw error;
}

const verification = {
  database: dbPath,
  stoke_squad_count: db.prepare('SELECT count(*) as count FROM stoke_squad').get().count,
  efl_fixtures_count: db.prepare('SELECT count(*) as count FROM efl_fixtures').get().count,
};

console.log(JSON.stringify(verification, null, 2));
db.close();

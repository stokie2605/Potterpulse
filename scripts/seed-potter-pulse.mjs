import { DatabaseSync } from 'node:sqlite';

const dbPath = 'C:\\Users\\Wilshaw\\Documents\\Potterpulse\\potter_pulse.db';
const db = new DatabaseSync(dbPath);

const players = [
  { player_name: 'Viktor Johansson', squad_number: 1, position: 'goalkeeper' },
  { player_name: 'Bae Jun-ho', squad_number: 10, position: 'midfielder' },
  { player_name: 'Junior Tchamadeu', squad_number: 22, position: 'defender' },
  { player_name: 'Million Manhoef', squad_number: 42, position: 'forward' },
];

const fixtures = [
  { opponent: 'Oldham Athletic', match_date: '2026-08-08', competition: 'EFL Cup', venue: 'home' },
  { opponent: 'Swansea City', match_date: '2026-08-15', competition: 'Championship', venue: 'home' },
  { opponent: 'Southampton', match_date: '2026-08-22', competition: 'Championship', venue: 'away' },
];

db.exec('BEGIN');
try {
  const deletePlayer = db.prepare('DELETE FROM stoke_squad WHERE player_name = ?');
  const insertPlayer = db.prepare('INSERT INTO stoke_squad (player_name, squad_number, position) VALUES (?, ?, ?)');

  for (const player of players) {
    deletePlayer.run(player.player_name);
    insertPlayer.run(player.player_name, player.squad_number, player.position);
  }

  const deleteFixture = db.prepare('DELETE FROM efl_fixtures WHERE opponent = ? AND match_date = ? AND competition = ?');
  const insertFixture = db.prepare('INSERT INTO efl_fixtures (opponent, match_date, competition, venue) VALUES (?, ?, ?, ?)');

  for (const fixture of fixtures) {
    deleteFixture.run(fixture.opponent, fixture.match_date, fixture.competition);
    insertFixture.run(fixture.opponent, fixture.match_date, fixture.competition, fixture.venue);
  }

  db.exec('COMMIT');
} catch (error) {
  db.exec('ROLLBACK');
  throw error;
}

const squadRows = db.prepare('SELECT player_name, squad_number, position FROM stoke_squad ORDER BY squad_number').all();
const fixtureRows = db.prepare('SELECT opponent, match_date, competition, venue FROM efl_fixtures ORDER BY match_date').all();

const verification = {
  database: dbPath,
  stoke_squad: squadRows,
  efl_fixtures: fixtureRows,
};

console.log(JSON.stringify(verification, null, 2));
db.close();
export default verification;

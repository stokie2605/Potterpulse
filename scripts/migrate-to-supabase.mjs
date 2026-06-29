import { DatabaseSync } from 'node:sqlite';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const dbPath = join(rootDir, 'potter_pulse.db');

let supabaseUrl = process.env.SUPABASE_URL;
let supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

// Load .env variables
const envPath = join(rootDir, '.env');
if (existsSync(envPath)) {
  const dotenvContent = readFileSync(envPath, 'utf8');
  const urlMatch = dotenvContent.match(/SUPABASE_URL\s*=\s*["']?([^\s"'#]+)["']?/i);
  const anonKeyMatch = dotenvContent.match(/SUPABASE_ANON_KEY\s*=\s*["']?([^\s"'#]+)["']?/i);
  const serviceKeyMatch = dotenvContent.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*["']?([^\s"'#]+)["']?/i);
  if (urlMatch) supabaseUrl = urlMatch[1];
  if (serviceKeyMatch) supabaseKey = serviceKeyMatch[1];
  else if (anonKeyMatch) supabaseKey = anonKeyMatch[1];
}

if (!supabaseUrl || !supabaseKey) {
  console.error("Error: SUPABASE_URL and SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY must be configured in .env first!");
  process.exit(1);
}

async function fetchSupabase(table, options = {}) {
  const url = `${supabaseUrl}/rest/v1/${table}`;
  const headers = {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates'
  };
  const res = await fetch(url, {
    method: options.method || 'POST',
    headers,
    body: JSON.stringify(options.body)
  });
  if (!res.ok) {
    throw new Error(`Failed to push data to ${table}: ${res.status} - ${await res.text()}`);
  }
}

async function migrate() {
  if (!existsSync(dbPath)) {
    console.error("Local SQLite database not found at:", dbPath);
    process.exit(1);
  }

  console.log("Connecting to local SQLite database...");
  const db = new DatabaseSync(dbPath);

  try {
    // 1. Migrate stoke_squad
    console.log("Fetching squad list from SQLite...");
    const squad = db.prepare('SELECT player_name, position, squad_number FROM stoke_squad').all();
    if (squad.length > 0) {
      console.log(`Pushing ${squad.length} players to Supabase 'stoke_squad'...`);
      await fetchSupabase('stoke_squad', {
        body: squad.map(p => ({
          player_name: p.player_name,
          position: p.position,
          squad_number: p.squad_number
        }))
      });
    }

    // 2. Migrate efl_fixtures
    console.log("Fetching fixtures from SQLite...");
    const fixtures = db.prepare('SELECT opponent, match_date, competition, venue, status, stoke_score, opponent_score FROM efl_fixtures').all();
    if (fixtures.length > 0) {
      console.log(`Pushing ${fixtures.length} fixtures to Supabase 'efl_fixtures'...`);
      await fetchSupabase('efl_fixtures', {
        body: fixtures.map(f => ({
          opponent: f.opponent,
          match_date: f.match_date,
          competition: f.competition,
          venue: f.venue,
          status: f.status,
          stoke_score: f.stoke_score,
          opponent_score: f.opponent_score
        }))
      });
    }

    // 3. Migrate stoke_transfers
    console.log("Fetching transfers from SQLite...");
    const transfers = db.prepare('SELECT player_name, direction, details FROM stoke_transfers').all();
    if (transfers.length > 0) {
      console.log(`Pushing ${transfers.length} transfers to Supabase 'stoke_transfers'...`);
      await fetchSupabase('stoke_transfers', {
        body: transfers.map(t => ({
          player_name: t.player_name,
          direction: t.direction,
          details: t.details
        }))
      });
    }

    console.log("Migration completed successfully!");
  } catch (err) {
    console.error("Migration failed with error:", err.message);
    process.exit(1);
  } finally {
    db.close();
  }
}

migrate();

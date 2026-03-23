/* ============================================
   PILL CHOICE — Express Backend
   Voting system with SQLite + IP hash anti-fraud
   ============================================ */

const express = require('express');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3456;

/* ============================================
   IP HASHING
   ------------------------------------------------
   We hash the IP with a salt so we never store
   the raw IP address. This provides privacy while
   still preventing double votes.

   LIMITATION: IP-based blocking is not perfect.
   Users behind the same NAT/VPN share an IP.
   Users can change IP via VPN. This is a reasonable
   trade-off for a simple voting system.
   ============================================ */
const IP_SALT = 'pill-choice-salt-2024-premium';

function hashIP(ip) {
  return crypto
    .createHash('sha256')
    .update(IP_SALT + ip)
    .digest('hex');
}

/**
 * Extract the real client IP.
 * Handles proxies via X-Forwarded-For header.
 */
function getClientIP(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.connection.remoteAddress || '127.0.0.1';
}

/* ============================================
   DATABASE SETUP
   ------------------------------------------------
   SQLite file stored in ./data/votes.db
   Created automatically on first run.
   UNIQUE constraint on ip_hash prevents double
   votes at the database level (last line of defense).
   ============================================ */
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'votes.db'));

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip_hash TEXT NOT NULL UNIQUE,
    choice TEXT NOT NULL CHECK(choice IN ('left', 'right')),
    created_at TEXT DEFAULT (datetime('now'))
  )
`);

/* ============================================
   PREPARED STATEMENTS
   ============================================ */
const stmtInsert = db.prepare(
  'INSERT INTO votes (ip_hash, choice) VALUES (?, ?)'
);

const stmtFindByHash = db.prepare(
  'SELECT choice FROM votes WHERE ip_hash = ?'
);

const stmtCountLeft = db.prepare(
  "SELECT COUNT(*) as count FROM votes WHERE choice = 'left'"
);

const stmtCountRight = db.prepare(
  "SELECT COUNT(*) as count FROM votes WHERE choice = 'right'"
);

/**
 * Get current vote tallies
 */
function getResults() {
  const left = stmtCountLeft.get().count;
  const right = stmtCountRight.get().count;
  const total = left + right;
  return { left, right, total };
}

/* ============================================
   MIDDLEWARE
   ============================================ */
app.use(express.json());

// CORS — allow requests from preview proxy or other origins
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Serve all static files (HTML, CSS, JS, assets)
app.use(express.static(__dirname));

// Trust proxy for correct IP behind reverse proxies (Hostinger, nginx, cloudflare)
app.set('trust proxy', 1);

/* ============================================
   API ROUTES
   ============================================ */

/**
 * POST /api/vote
 *
 * Body: { "choice": "left" | "right" }
 *
 * 1. Validates the choice
 * 2. Hashes the client IP
 * 3. Checks if this IP already voted
 * 4. If not: inserts vote, returns results
 * 5. If yes: returns results with alreadyVoted flag
 */
app.post('/api/vote', (req, res) => {
  try {
    const { choice } = req.body;

    // Validate choice
    if (!choice || !['left', 'right'].includes(choice)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid choice. Must be "left" or "right".'
      });
    }

    const ipHash = hashIP(getClientIP(req));

    // Check if already voted
    const existing = stmtFindByHash.get(ipHash);
    if (existing) {
      return res.json({
        success: false,
        alreadyVoted: true,
        previousChoice: existing.choice,
        results: getResults()
      });
    }

    // Insert new vote
    // The UNIQUE constraint is a safety net if two requests race
    try {
      stmtInsert.run(ipHash, choice);
    } catch (err) {
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        // Race condition: another request inserted first
        return res.json({
          success: false,
          alreadyVoted: true,
          results: getResults()
        });
      }
      throw err;
    }

    return res.json({
      success: true,
      results: getResults()
    });

  } catch (err) {
    console.error('Vote error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/results
 *
 * Returns current vote tallies.
 * Also checks if the requesting IP has already voted.
 */
app.get('/api/results', (req, res) => {
  try {
    const ipHash = hashIP(getClientIP(req));
    const existing = stmtFindByHash.get(ipHash);

    return res.json({
      results: getResults(),
      voted: existing ? existing.choice : null
    });

  } catch (err) {
    console.error('Results error:', err);
    return res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * DELETE /api/reset
 *
 * Resets all votes. Clears the entire database.
 */
app.get('/api/reset', (req, res) => {
  try {
    db.exec('DELETE FROM votes');
    console.log('All votes have been reset.');
    return res.json({ success: true, message: 'All votes reset' });
  } catch (err) {
    console.error('Reset error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/* ============================================
   START SERVER
   ============================================ */
app.listen(PORT, () => {
  console.log(`Pill Choice server running on http://localhost:${PORT}`);
});

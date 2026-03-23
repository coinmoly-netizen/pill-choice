/* ============================================
   GET /api/reset
   Clears all votes (use secret "reset" keyboard combo)
   ============================================ */
const { kv } = require('@vercel/kv');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // Reset vote counters
    await kv.set('votes:left', 0);
    await kv.set('votes:right', 0);

    // Delete all voted:* keys
    // Scan for all voted keys and delete them
    let cursor = 0;
    do {
      const [nextCursor, keys] = await kv.scan(cursor, { match: 'voted:*', count: 100 });
      cursor = nextCursor;
      if (keys.length > 0) {
        await kv.del(...keys);
      }
    } while (cursor !== 0);

    return res.json({ success: true, message: 'All votes reset' });
  } catch (err) {
    console.error('Reset error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

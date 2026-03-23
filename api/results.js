/* ============================================
   GET /api/results
   Returns current vote tallies + checks if IP voted
   ============================================ */
const { kv } = require('@vercel/kv');
const crypto = require('crypto');

const IP_SALT = 'pill-choice-salt-2024-premium';

function hashIP(ip) {
  return crypto.createHash('sha256').update(IP_SALT + ip).digest('hex');
}

function getClientIP(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || '127.0.0.1';
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const ipHash = hashIP(getClientIP(req));
    const existing = await kv.get(`voted:${ipHash}`);

    const left = (await kv.get('votes:left')) || 0;
    const right = (await kv.get('votes:right')) || 0;

    return res.json({
      results: { left, right, total: left + right },
      voted: existing || null
    });

  } catch (err) {
    console.error('Results error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

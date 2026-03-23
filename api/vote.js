/* ============================================
   POST /api/vote
   Serverless function for Vercel
   Stores votes in Vercel KV (Redis)
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
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { choice } = req.body;

    if (!choice || !['left', 'right'].includes(choice)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid choice. Must be "left" or "right".'
      });
    }

    const ipHash = hashIP(getClientIP(req));

    // Check if already voted (stored as voted:{hash} = "left"|"right")
    const existing = await kv.get(`voted:${ipHash}`);
    if (existing) {
      const left = (await kv.get('votes:left')) || 0;
      const right = (await kv.get('votes:right')) || 0;
      return res.json({
        success: false,
        alreadyVoted: true,
        previousChoice: existing,
        results: { left, right, total: left + right }
      });
    }

    // Record vote: increment counter + mark IP as voted
    await kv.incr(`votes:${choice}`);
    await kv.set(`voted:${ipHash}`, choice);

    const left = (await kv.get('votes:left')) || 0;
    const right = (await kv.get('votes:right')) || 0;

    return res.json({
      success: true,
      results: { left, right, total: left + right }
    });

  } catch (err) {
    console.error('Vote error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

import { db, requireAuth } from '../_lib/admin.js';

/**
 * Vercel equivalent of the Express route in backend/server.js
 * (`app.get('/api/devices', ...)`). Deployed at /api/devices because this
 * file lives at api/devices/index.js.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const user = await requireAuth(req, res);
  if (!user) return; // requireAuth already sent the 401 response

  const snapshot = await db.collection('devices').where('userId', '==', user.uid).get();
  const devices = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return res.status(200).json({ devices });
}

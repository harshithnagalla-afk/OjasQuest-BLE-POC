import { db, admin, requireAuth } from '../_lib/admin.js';

/**
 * Vercel equivalent of the Express route in backend/server.js
 * (`app.post('/api/devices/pair', ...)`) — same logic, adapted to a
 * Vercel Node function's (req, res) signature. Deployed at
 * /api/devices/pair because this file lives at api/devices/pair.js.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const user = await requireAuth(req, res);
  if (!user) return; // requireAuth already sent the 401 response

  const { deviceId, deviceName, browserDeviceId } = req.body ?? {};
  if (typeof deviceId !== 'string' || !deviceId.trim()) {
    return res.status(400).json({ error: 'deviceId is required.' });
  }

  const ref = db.collection('devices').doc(deviceId);
  const existing = await ref.get();

  if (existing.exists && existing.data().userId !== user.uid) {
    // Do not reveal which account owns it — just that it's taken.
    return res.status(409).json({ error: 'This device is already registered to another account.' });
  }

  const now = admin.firestore.FieldValue.serverTimestamp();
  await ref.set(
    {
      deviceId,
      deviceName: deviceName ?? null,
      browserDeviceId: browserDeviceId ?? null,
      userId: user.uid,
      lastConnectedAt: now,
      ...(existing.exists ? {} : { createdAt: now }),
    },
    { merge: true },
  );

  const saved = await ref.get();
  return res.status(200).json({ device: { id: ref.id, ...saved.data() } });
}

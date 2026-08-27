import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import admin from 'firebase-admin';

// Reads the service account from GOOGLE_APPLICATION_CREDENTIALS (see
// .env.example). This is the ONLY place in the whole stack that holds
// admin-level Firebase credentials — it must never be shipped to the
// browser or committed to source control.
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});
const db = admin.firestore();

const app = express();
app.use(cors({ origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173' }));
app.use(express.json());

/**
 * Verifies the Firebase ID token (a JWT) sent as `Authorization: Bearer
 * <token>` and attaches the decoded, trusted user identity to `req.user`.
 * Every route below that touches device data requires this — the frontend
 * user's claimed identity is never trusted on its own.
 */
async function requireAuth(req, res, next) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Missing bearer token.' });
  }
  try {
    req.user = await admin.auth().verifyIdToken(token);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

/**
 * Registers the user_id -> device_id association ("Claim Device" flow).
 * Bluetooth pairing at the OS/browser level grants no account-level
 * ownership by itself — this endpoint is what actually does that, and it's
 * the only place that writes to the devices collection.
 */
app.post('/api/devices/pair', requireAuth, async (req, res) => {
  const { deviceId, deviceName, browserDeviceId } = req.body ?? {};
  if (typeof deviceId !== 'string' || !deviceId.trim()) {
    return res.status(400).json({ error: 'deviceId is required.' });
  }

  const ref = db.collection('devices').doc(deviceId);
  const existing = await ref.get();

  if (existing.exists && existing.data().userId !== req.user.uid) {
    // Do not reveal which account owns it — just that it's taken.
    return res.status(409).json({ error: 'This device is already registered to another account.' });
  }

  const now = admin.firestore.FieldValue.serverTimestamp();
  await ref.set(
    {
      deviceId,
      deviceName: deviceName ?? null,
      browserDeviceId: browserDeviceId ?? null,
      userId: req.user.uid,
      lastConnectedAt: now,
      ...(existing.exists ? {} : { createdAt: now }),
    },
    { merge: true },
  );

  const saved = await ref.get();
  return res.status(200).json({ device: { id: ref.id, ...saved.data() } });
});

/** Lists the signed-in user's own devices — never another user's. */
app.get('/api/devices', requireAuth, async (req, res) => {
  const snapshot = await db.collection('devices').where('userId', '==', req.user.uid).get();
  const devices = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return res.status(200).json({ devices });
});

const port = process.env.PORT ?? 4000;
app.listen(port, () => console.log(`BLE pairing API listening on :${port}`));

import admin from 'firebase-admin';

// On Vercel there's no local serviceAccountKey.json file to read (unlike the
// backend/ Express server used for local dev) — credentials come from three
// separate environment variables set in the Vercel dashboard instead:
//   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
// (all three copied out of the same service account JSON from Firebase
// Console > Project settings > Service accounts > Generate new private key).
// Serverless functions can be re-invoked in the same warm process, so guard
// against calling initializeApp() more than once.
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Vercel stores env var values as plain text, so a real newline in the
      // private key arrives here as the two characters "\" + "n" — turn
      // those back into actual newlines or the key fails to parse.
      privateKey: (process.env.FIREBASE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
    }),
  });
}

export const db = admin.firestore();
export { admin };

/**
 * Verifies the `Authorization: Bearer <token>` header on a Vercel function
 * request. On failure it writes the error response itself and returns null
 * — callers should just `return` when they get null back. Mirrors
 * backend/server.js's requireAuth middleware, adapted to the (req, res)
 * shape of a Vercel Node function instead of Express middleware.
 */
export async function requireAuth(req, res) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: 'Missing bearer token.' });
    return null;
  }
  try {
    return await admin.auth().verifyIdToken(token);
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token.' });
    return null;
  }
}

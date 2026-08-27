# BLE Pairing POC

A minimal but real full-stack proof of concept: a React app acts as the
**Central/Master** over the Web Bluetooth API, your hardware is the
**Peripheral/Slave**, and an Express API records which user account each
physical device belongs to.

```
User → Firebase Auth (Google / email+password) → React app (Central)
                                                        │
                                                 Web Bluetooth API
                                                        │
                                                 GATT connection
                                                        │
                                              Your BLE Peripheral (Slave)

React app ──(Firebase ID token)──▶ Express API ──▶ Firestore
                                    (verifies token, records
                                     user_id ↔ device_id)
```

## Quick start

`frontend/.env` and `backend/.env` are already created with every non-secret
default filled in (ports, CORS origin, API URL) — you only need to add your
own Firebase values before sign-in will work end to end.

```bash
npm run install:all   # installs backend/ and frontend/ dependencies
npm run dev            # runs both dev servers together (backend :4000, frontend :5173)
```

Until you complete steps 1 and 4 below (your own Firebase project + your
hardware's real UUIDs), both servers start cleanly and the UI renders, but
"Continue with Google" / email sign-in and the Bluetooth chooser won't do
anything useful yet — that's expected, not a bug: this app talks to *your*
Firebase project and *your* hardware, neither of which can be filled in on
your behalf.

## 1. Firebase project setup

1. Create a project at https://console.firebase.google.com.
2. **Authentication > Sign-in method**: enable **Google** and **Email/Password**.
3. **Project settings > General > Your apps**: add a Web app, copy the config
   values into `frontend/.env` (copy from `frontend/.env.example`).
4. **Project settings > Service accounts**: click "Generate new private key",
   save the JSON as `backend/serviceAccountKey.json` (already gitignored —
   never commit it, never send it to the frontend).
5. **Firestore Database**: create a database (production mode is fine; the
   Express backend uses the Admin SDK, which bypasses Firestore security
   rules, so the backend is what actually enforces access control here).

## 2. Run the backend

```bash
cd backend
cp .env.example .env        # set GOOGLE_APPLICATION_CREDENTIALS if the path differs
npm install
npm run dev                 # listens on :4000
```

## 3. Run the frontend

```bash
cd frontend
cp .env.example .env        # fill in your Firebase web config
npm install
npm run dev                 # http://localhost:5173
```

## 4. Point it at your hardware

Edit `frontend/src/bluetoothConfig.ts` — replace the four placeholder UUIDs
and `DEVICE_NAME_PREFIX` with your firmware's real GATT profile. Everything
else in the frontend reads from that one file.

The app expects three characteristics inside one service:

| Characteristic | Direction    | Purpose                              |
|-----------------|--------------|----------------------------------------|
| `DEVICE_ID`      | Device → Web | A stable unique identifier (Read)     |
| `COMMAND`         | Web → Device | Test commands sent from the panel (Write) |
| `STATUS`            | Device → Web | Live values pushed to the panel (Notify) |

If your firmware isn't ready yet, you can still exercise the whole UI up to
the "Connect" button using Chrome's `chrome://bluetooth-internals` to
simulate a fake peripheral, or a BLE peripheral simulator app on a phone.

## 5. Deploy to Vercel

`frontend/api/` holds the same two routes as `backend/server.js`,
rewritten as Vercel serverless functions — `frontend/api/devices/pair.js`
and `frontend/api/devices/index.js`. `backend/` is untouched and still
works for local dev (`npm run dev`); it just isn't what gets deployed.
Because the built frontend and `api/` are served from the same Vercel
domain, the app calls the API with a relative `/api/...` URL — no CORS
setup and no `VITE_API_BASE_URL` needed in production.

1. `npm install -g vercel` (one-time)
2. `cd frontend`
3. `vercel login` — opens your browser to sign in (free tier is fine)
4. `vercel` — first run asks a few setup questions; the defaults are
   correct (it auto-detects Vite). This creates a preview deployment.
5. In the Vercel dashboard for the new project, **Settings > Environment
   Variables**, add:
   - `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`,
     `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` — same values as
     `frontend/.env`.
   - `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
     — the `project_id`, `client_email`, and `private_key` fields from the
     same service account JSON used for `backend/serviceAccountKey.json`.
     Paste the private key exactly as it appears, including the
     `-----BEGIN PRIVATE KEY-----` line and the line breaks.
   - Leave `VITE_API_BASE_URL` unset (see `frontend/.env.example`).
6. Firebase Console > **Authentication > Settings > Authorized domains** —
   add the `*.vercel.app` domain Vercel just gave you, or Google sign-in
   will fail with an unauthorized-domain error on the deployed site.
7. `vercel --prod` to ship it to the permanent production URL.

Web Bluetooth requires HTTPS, which Vercel provides automatically — so
"Connect Device" works on the deployed URL without any extra setup.

## Notes on what's a POC shortcut here vs. what's load-bearing

**Fine for a POC, worth revisiting before production:**
- Device identity is trusted directly off the `DEVICE_ID` characteristic. A
  device could claim any ID. Production hardware should support a
  challenge-response handshake (device signs a server-issued nonce with a
  provisioned key) so the backend — not just the browser — can confirm the
  device is genuine before recording ownership.
- No rate limiting on `/api/devices/pair`.
- Firestore is used directly from the backend with the Admin SDK; a bigger
  app would likely add explicit Firestore Security Rules too, in case any
  client ever talks to Firestore directly.

**Already real, not simplified:**
- Auth is real Firebase Auth (Google OAuth + email/password), and the
  backend genuinely verifies the ID token server-side rather than trusting
  whatever the frontend sends.
- The Web Bluetooth flow (`requestDevice` → GATT connect → service/characteristic
  discovery → read/write/notify) is the real API, not mocked.
- HTTPS requirement: Web Bluetooth only works on secure origins. `localhost`
  is exempted for local dev; any real deployment must be served over HTTPS
  or `navigator.bluetooth` won't exist in the browser at all.

import { useState, type FormEvent } from 'react';
import { signInWithEmail, signInWithGoogle, signUpWithEmail } from './firebase';

export default function Login() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleGoogleClick() {
    setError(null);
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(readableAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleEmailSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'signup') {
        await signUpWithEmail(email, password);
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err) {
      setError(readableAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: '80px auto', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: 20 }}>Sign in</h1>

      <button onClick={handleGoogleClick} disabled={busy} style={{ width: '100%', padding: 10, marginBottom: 16 }}>
        Continue with Google
      </button>

      <div style={{ textAlign: 'center', color: '#888', marginBottom: 16 }}>or</div>

      <form onSubmit={handleEmailSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ width: '100%', padding: 8, marginBottom: 8 }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          style={{ width: '100%', padding: 8, marginBottom: 8 }}
        />
        <button type="submit" disabled={busy} style={{ width: '100%', padding: 10 }}>
          {mode === 'signup' ? 'Create account' : 'Sign in'}
        </button>
      </form>

      <button
        onClick={() => setMode(mode === 'signup' ? 'signin' : 'signup')}
        style={{ marginTop: 12, background: 'none', border: 'none', color: '#3366cc', cursor: 'pointer' }}
      >
        {mode === 'signup' ? 'Already have an account? Sign in' : "Need an account? Sign up"}
      </button>

      {error && <p style={{ color: 'crimson', marginTop: 12 }}>{error}</p>}
    </div>
  );
}

function readableAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  if (code.includes('email-already-in-use')) return 'An account with that email already exists.';
  if (code.includes('invalid-credential') || code.includes('wrong-password')) return 'Incorrect email or password.';
  if (code.includes('user-not-found')) return 'No account found for that email.';
  if (code.includes('popup-closed-by-user')) return 'Sign-in was cancelled.';
  return 'Something went wrong signing in. Please try again.';
}

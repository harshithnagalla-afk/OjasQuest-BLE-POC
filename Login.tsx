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
    <div className="app-shell">
      <div className="wordmark">
        <span className="wordmark-dot" />
        OJASQUEST
      </div>

      <div className="login-card">
        <h1 className="login-title">Sign in</h1>
        <p className="login-subtitle">Pair and manage your BLE devices from one account.</p>

        <button className="btn btn-block" onClick={handleGoogleClick} disabled={busy}>
          Continue with Google
        </button>

        <div className="divider">or</div>

        <form onSubmit={handleEmailSubmit}>
          <input
            className="field"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="field"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            {mode === 'signup' ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <button className="link-button" onClick={() => setMode(mode === 'signup' ? 'signin' : 'signup')}>
          {mode === 'signup' ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
        </button>

        {error && <p className="error-text">{error}</p>}
      </div>
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

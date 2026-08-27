import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { watchAuthState } from './firebase';
import Login from './Login';
import Dashboard from './Dashboard';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = watchAuthState((u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) return null;
  return user ? <Dashboard user={user} /> : <Login />;
}

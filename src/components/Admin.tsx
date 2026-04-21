import { useState, useEffect } from 'react';
import AdminLogin from './AdminLogin';
import AdminPanel from './AdminPanel';
import { auth } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const isMasterLogged = localStorage.getItem('adminMasterLogged') === 'true';
    if (isMasterLogged) {
      setIsAuthenticated(true);
      // Wait for auth to settle but don't force logout
      const unsub = onAuthStateChanged(auth, () => {});
      return () => unsub();
    }

    const unsub = onAuthStateChanged(auth, (user) => {
      if (user && !user.isAnonymous) {
        setIsAuthenticated(true);
      } else if (isAuthenticated === null) {
        setIsAuthenticated(false);
      }
    });
    return () => unsub();
  }, []);

  if (isAuthenticated === null) return null; // Loading

  if (!isAuthenticated) {
    return <AdminLogin onLogin={() => setIsAuthenticated(true)} />;
  }

  return <AdminPanel onLogout={() => setIsAuthenticated(false)} />;
}

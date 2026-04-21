import { useState, useEffect } from 'react';
import AdminLogin from './AdminLogin';
import AdminPanel from './AdminPanel';
import { auth } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      // Se tiver usuário e ele NÃO for anônimo, ou se tiver logado via senha mestre (que não ativa o auth.currentUser do firebase neste caso, mas vamos manter a lógica atual)
      // Na verdade, a senha mestre é puramente local.
      // O usuário solicitou login por e-mail.
      if (user && !user.isAnonymous) {
        setIsAuthenticated(true);
      } else if (isAuthenticated === null) {
        // Se ainda não decidimos, mantemos falso por padrão para mostrar o login
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

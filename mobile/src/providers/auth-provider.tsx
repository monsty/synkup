import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { authApi, type Session, type User } from '@/services/auth-api';

type AuthStatus = 'loading' | 'signed-out' | 'signed-in';

type AuthContextValue = {
  status: AuthStatus;
  user: User | null;
  requestEmailCode: (email: string) => Promise<void>;
  verifyEmailCode: (email: string, code: string) => Promise<void>;
  signInWithProvider: (provider: 'apple' | 'google') => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Session utilisateur de l'app : restaurée depuis le stockage sécurisé au lancement
 * (`loading`), puis `signed-in` ou `signed-out`. Les routes protégées du layout racine
 * se basent sur `status` pour afficher la connexion ou l'app.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let active = true;
    authApi.restoreSession().then((session) => {
      if (!active) return;
      setUser(session?.user ?? null);
      setStatus(session ? 'signed-in' : 'signed-out');
    });
    return () => {
      active = false;
    };
  }, []);

  const adopt = useCallback((session: Session) => {
    setUser(session.user);
    setStatus('signed-in');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      requestEmailCode: (email) => authApi.requestEmailCode(email),
      verifyEmailCode: async (email, code) => adopt(await authApi.verifyEmailCode(email, code)),
      signInWithProvider: async (provider) => adopt(await authApi.signInWithProvider(provider)),
      signOut: async () => {
        await authApi.signOut();
        setUser(null);
        setStatus('signed-out');
      },
    }),
    [status, user, adopt]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth doit être utilisé sous <AuthProvider>.');
  return value;
}

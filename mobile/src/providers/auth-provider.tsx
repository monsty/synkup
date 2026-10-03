import { useAuth as useClerkAuth, useSignIn, useSignUp, useSSO, useUser } from '@clerk/expo';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';

import { setCurrentUser, type AuthProvider as Provider, type User } from '@/services/auth-api';

// Ferme proprement la fenêtre du navigateur au retour d'un parcours Google / Apple.
WebBrowser.maybeCompleteAuthSession();

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

/** Code Clerk renvoyé quand aucun compte n'existe pour l'adresse : on bascule en inscription. */
const IDENTIFIER_NOT_FOUND = 'form_identifier_not_found';

type ClerkLikeError = {
  code?: string;
  message?: string;
  longMessage?: string;
  errors?: { code?: string }[];
};

function errorCode(error: unknown): string | undefined {
  const e = error as ClerkLikeError | null;
  // Erreur d'API : le code utile est dans `errors[0]`, `code` n'est qu'un code générique.
  return e?.errors?.[0]?.code ?? e?.code;
}

/** Message d'erreur en français pour les cas courants, sinon celui de Clerk. */
function toMessage(error: unknown): string {
  const code = errorCode(error);
  if (code === 'form_code_incorrect') return 'Code incorrect.';
  if (code === 'verification_expired') return 'Ce code a expiré, demande-en un nouveau.';
  if (code === 'too_many_requests') return 'Trop de tentatives, réessaie dans un instant.';
  if (code === 'form_param_format_invalid') return 'Cette adresse ne semble pas valide.';
  const e = error as ClerkLikeError | null;
  return e?.longMessage ?? e?.message ?? 'Une erreur est survenue.';
}

/**
 * Session utilisateur de l'app, portée par Clerk : restaurée au lancement depuis le stockage
 * sécurisé (`loading`), puis `signed-in` ou `signed-out`. Garde la même interface que la
 * fausse authentification d'origine, pour que les écrans n'aient pas à changer.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, signOut: clerkSignOut } = useClerkAuth();
  const { user: clerkUser } = useUser();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const { startSSOFlow } = useSSO();

  // Le code par email sert à la connexion, ou à l'inscription si l'adresse est inconnue.
  const emailFlow = useRef<'sign-in' | 'sign-up'>('sign-in');

  const user = useMemo<User | null>(() => {
    if (!isSignedIn || !clerkUser) return null;
    const external = clerkUser.externalAccounts[0]?.provider;
    const provider: Provider =
      external === 'google' ? 'google' : external === 'apple' ? 'apple' : 'email';
    return {
      id: clerkUser.id,
      email: clerkUser.primaryEmailAddress?.emailAddress ?? '',
      provider,
    };
  }, [isSignedIn, clerkUser]);

  // Copie synchrone pour les stockages locaux, avant le rendu des écrans connectés.
  setCurrentUser(user);
  useEffect(() => () => setCurrentUser(null), []);

  const status: AuthStatus = !isLoaded
    ? 'loading'
    : isSignedIn
      ? user
        ? 'signed-in'
        : 'loading'
      : 'signed-out';

  const requestEmailCode = useCallback(
    async (email: string) => {
      const emailAddress = email.trim().toLowerCase();
      const { error } = await signIn.emailCode.sendCode({ emailAddress });
      if (!error) {
        emailFlow.current = 'sign-in';
        return;
      }
      if (errorCode(error) !== IDENTIFIER_NOT_FOUND) throw new Error(toMessage(error));

      // Pas encore de compte : même parcours, côté inscription.
      const created = await signUp.create({ emailAddress });
      if (created.error) throw new Error(toMessage(created.error));
      const sent = await signUp.verifications.sendEmailCode();
      if (sent.error) throw new Error(toMessage(sent.error));
      emailFlow.current = 'sign-up';
    },
    [signIn, signUp]
  );

  const verifyEmailCode = useCallback(
    async (_email: string, code: string) => {
      if (emailFlow.current === 'sign-in') {
        const { error } = await signIn.emailCode.verifyCode({ code: code.trim() });
        if (error) throw new Error(toMessage(error));
        if (signIn.status !== 'complete') throw new Error('Connexion incomplète, réessaie.');
        const done = await signIn.finalize();
        if (done.error) throw new Error(toMessage(done.error));
        return;
      }
      const { error } = await signUp.verifications.verifyEmailCode({ code: code.trim() });
      if (error) throw new Error(toMessage(error));
      if (signUp.status !== 'complete') throw new Error('Inscription incomplète, réessaie.');
      const done = await signUp.finalize();
      if (done.error) throw new Error(toMessage(done.error));
    },
    [signIn, signUp]
  );

  const signInWithProvider = useCallback(
    async (provider: 'apple' | 'google') => {
      try {
        const { createdSessionId, setActive } = await startSSOFlow({
          strategy: provider === 'google' ? 'oauth_google' : 'oauth_apple',
          redirectUrl: AuthSession.makeRedirectUri(),
        });
        // Fenêtre fermée sans terminer : ni erreur ni session, on reste sur l'écran.
        if (createdSessionId && setActive) await setActive({ session: createdSessionId });
      } catch (error) {
        throw new Error(toMessage(error));
      }
    },
    [startSSOFlow]
  );

  const signOut = useCallback(async () => {
    await clerkSignOut();
  }, [clerkSignOut]);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, requestEmailCode, verifyEmailCode, signInWithProvider, signOut }),
    [status, user, requestEmailCode, verifyEmailCode, signInWithProvider, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth doit être utilisé sous <AuthProvider>.');
  return value;
}

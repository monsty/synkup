import { focusManager, onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Network from 'expo-network';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import { ApiError } from '@/services/api-client';
import { useAuth } from '@/providers/auth-provider';

// React Native n'a ni « focus » de fenêtre ni événement « online » : on branche TanStack sur
// l'état de l'app (premier plan) et sur l'état du réseau.
onlineManager.setEventListener((setOnline) => {
  const subscription = Network.addNetworkStateListener((state) => {
    setOnline(state.isConnected !== false);
  });
  return () => subscription.remove();
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Les écrans s'ouvrent sur le cache, puis se mettent à jour en arrière-plan.
      staleTime: 30_000,
      // Une erreur 4xx ne s'arrangera pas en réessayant ; le réseau, si.
      retry: (count, error) =>
        count < 2 && !(error instanceof ApiError && error.status >= 400 && error.status < 500),
    },
  },
});

/**
 * Cache des appels à l'API. Un seul client pour toute l'app (les écrans restés montés dans la
 * pile doivent voir les mêmes données) ; il est vidé quand le compte connecté change, pour que
 * rien ne fuie d'un utilisateur à l'autre.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const ownerId = useRef(userId);

  useEffect(() => {
    const previous = ownerId.current;
    ownerId.current = userId;
    // Seulement quand un compte connecté s'en va (déconnexion, changement de compte) : au
    // premier chargement de la session, des écrans observent déjà le cache.
    if (previous !== null && previous !== userId) queryClient.clear();
  }, [userId]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const subscription = AppState.addEventListener('change', (state) => {
      focusManager.setFocused(state === 'active');
    });
    return () => subscription.remove();
  }, []);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

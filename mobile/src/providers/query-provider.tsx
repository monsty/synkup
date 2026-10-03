import { focusManager, onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import * as Network from 'expo-network';
import Storage from 'expo-sqlite/kv-store';
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

/** Le cache sauvegardé sert hors ligne pendant un mois ; au-delà, on repart de l'API. */
const PERSIST_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
/** À incrémenter quand la forme des données change : l'ancien cache est alors ignoré. */
const PERSIST_VERSION = '1';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Les écrans s'ouvrent sur le cache, puis se mettent à jour en arrière-plan.
      staleTime: 30_000,
      // Gardées aussi longtemps que le cache sauvegardé, sinon un album pas rouvert depuis
      // quelques minutes disparaîtrait de la sauvegarde et ne serait plus consultable hors ligne.
      gcTime: PERSIST_MAX_AGE_MS,
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
 *
 * Le cache est sauvegardé sur le téléphone, une sauvegarde par compte : au lancement, albums et
 * photos s'affichent tout de suite (même hors ligne), puis se rechargent en arrière-plan.
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
    if (!userId) return;
    const persister = createAsyncStoragePersister({
      storage: Storage,
      key: `query-cache:${userId}`,
      throttleTime: 2000,
    });
    const [unsubscribe] = persistQueryClient({
      queryClient,
      persister,
      maxAge: PERSIST_MAX_AGE_MS,
      buster: PERSIST_VERSION,
      // Par défaut, seules les requêtes dont le dernier appel a réussi sont sauvegardées : un
      // album consulté hors ligne (dernier appel en échec) disparaîtrait au prochain lancement.
      dehydrateOptions: { shouldDehydrateQuery: (query) => query.state.data !== undefined },
    });
    return unsubscribe;
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

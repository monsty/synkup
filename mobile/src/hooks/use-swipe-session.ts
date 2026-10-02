import { usePermissions } from 'expo-media-library';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { albumApi } from '@/services/album-api';
import { getGalleryPhotosBetween } from '@/services/gallery';
import { getDevicePhotos, markPhotoOnDevice } from '@/services/device-photos-store';
import { getReviews, saveReview } from '@/services/review-store';
import { getAlbumRange, type Album, type GalleryPhoto, type ReviewDecision } from '@/types/album';

export type SwipeSessionStatus =
  | 'loading'
  | 'unsupported'
  | 'permission-denied'
  | 'error'
  | 'ready';

/**
 * Pilote une session de tri : permission galerie, chargement des photos de la période
 * de l'album jamais proposées, et enregistrement des décisions (envoi ou passe).
 */
export function useSwipeSession() {
  const [album, setAlbum] = useState<Album | null>(null);
  const [permission, requestPermission] = usePermissions({ granularPermissions: ['photo'] });
  const [candidates, setCandidates] = useState<GalleryPhoto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadsInFlight, setUploadsInFlight] = useState(0);
  const hasAskedPermission = useRef(false);

  useEffect(() => {
    albumApi
      .getDefaultAlbum()
      .then(setAlbum)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(() => {
    if (!permission || permission.granted || hasAskedPermission.current) return;
    if (!permission.canAskAgain) return;
    hasAskedPermission.current = true;
    requestPermission();
  }, [permission, requestPermission]);

  const granted = permission?.granted ?? false;

  useEffect(() => {
    if (!album || !granted) return;
    let cancelled = false;

    (async () => {
      try {
        const { start, end } = getAlbumRange(album);
        const all = await getGalleryPhotosBetween(start, end);
        const reviews = getReviews(album.id);
        // Les photos téléchargées depuis l'album sont déjà dedans : on ne les re-propose pas.
        const fromAlbum = new Set(Object.values(getDevicePhotos(album.id)));
        if (!cancelled) {
          setCandidates(all.filter((photo) => !reviews[photo.id] && !fromAlbum.has(photo.id)));
        }
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [album, granted]);

  const decide = useCallback(
    (photo: GalleryPhoto, decision: ReviewDecision) => {
      if (!album) return;
      saveReview(album.id, photo.id, decision);
      setCandidates((current) => current?.filter((p) => p.id !== photo.id) ?? null);

      if (decision === 'sent') {
        setUploadsInFlight((n) => n + 1);
        albumApi
          .uploadPhoto(album.id, {
            localUri: photo.id,
            width: photo.width,
            height: photo.height,
            takenAt: photo.creationTime,
          })
          .then((uploaded) => {
            // Cette photo vient de la galerie de ce téléphone : ne jamais la retélécharger.
            markPhotoOnDevice(album.id, uploaded.id, photo.id);
          })
          .catch(() => {
            // POC : on ignore l'échec. À gérer (retry / file d'attente) avec la vraie API.
          })
          .finally(() => setUploadsInFlight((n) => n - 1));
      }
    },
    [album]
  );

  let status: SwipeSessionStatus = 'loading';
  if (Platform.OS === 'web') status = 'unsupported';
  else if (error) status = 'error';
  else if (permission?.status === 'denied') status = 'permission-denied';
  else if (album && granted && candidates !== null) status = 'ready';

  return {
    album,
    status,
    error,
    candidates: candidates ?? [],
    decide,
    uploadsInFlight,
    /** Sur Android on peut redemander ; sur iOS il faut passer par les réglages. */
    canAskPermissionAgain: permission?.canAskAgain ?? false,
    requestPermission,
  };
}

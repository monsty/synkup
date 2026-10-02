import { usePermissions } from 'expo-media-library';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { albumApi } from '@/services/album-api';
import { getGalleryPhotosBetween } from '@/services/gallery';
import { getDevicePhotos, markPhotoOnDevice } from '@/services/device-photos-store';
import { getReviews, saveReview } from '@/services/review-store';
import { getAlbumRange, type Album, type GalleryPhoto, type ReviewDecision } from '@/types/album';

export type SwipeSessionStatus =
  'loading' | 'unsupported' | 'permission-denied' | 'error' | 'ready';

/**
 * Pilote une session de tri : permission galerie, chargement des photos de la période
 * de l'album jamais proposées, et enregistrement des décisions (envoi ou passe).
 */
export function useSwipeSession(albumId: string) {
  const [album, setAlbum] = useState<Album | null>(null);
  const [permission, requestPermission] = usePermissions({ granularPermissions: ['photo'] });
  const [candidates, setCandidates] = useState<GalleryPhoto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadsInFlight, setUploadsInFlight] = useState(0);
  const hasAskedPermission = useRef(false);

  useEffect(() => {
    albumApi
      .getAlbum(albumId)
      .then((result) => {
        if (result) setAlbum(result);
        else setError('Album introuvable.');
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [albumId]);

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

  /** Envoie une photo de la galerie vers l'album, en arrière-plan. */
  /** Envoie une photo de la galerie vers l'album. Résout à vrai si l'envoi a réussi. */
  const uploadOne = useCallback(async (albumId: string, photo: GalleryPhoto): Promise<boolean> => {
    try {
      const uploaded = await albumApi.uploadPhoto(albumId, {
        localUri: photo.id,
        width: photo.width,
        height: photo.height,
        takenAt: photo.creationTime,
      });
      // Cette photo vient de la galerie de ce téléphone : ne jamais la retélécharger.
      markPhotoOnDevice(albumId, uploaded.id, photo.id);
      return true;
    } catch {
      // POC : on ignore l'échec. À gérer (retry / file d'attente) avec la vraie API.
      return false;
    }
  }, []);

  /** Envoi en arrière-plan depuis le swipe : juste un spinner à côté du compteur. */
  const upload = useCallback(
    (albumId: string, photo: GalleryPhoto) => {
      setUploadsInFlight((n) => n + 1);
      uploadOne(albumId, photo).finally(() => setUploadsInFlight((n) => n - 1));
    },
    [uploadOne]
  );

  const decide = useCallback(
    (photo: GalleryPhoto, decision: ReviewDecision) => {
      if (!album) return;
      saveReview(album.id, photo.id, decision);
      setCandidates((current) => current?.filter((p) => p.id !== photo.id) ?? null);
      if (decision === 'sent') upload(album.id, photo);
    },
    [album, upload]
  );

  /** Identifiants des photos de la galerie déjà envoyées dans cet album (swipe ou sélection). */
  const sentIds = useMemo(() => {
    if (!album) return new Set<string>();
    const reviews = getReviews(album.id);
    const sent = Object.entries(reviews)
      .filter(([, decision]) => decision === 'sent')
      .map(([id]) => id);
    return new Set([...sent, ...Object.values(getDevicePhotos(album.id))]);
    // Recalculé quand les candidates changent, c'est-à-dire après chaque décision.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [album, candidates]);

  /**
   * Sélection manuelle : envoie les photos choisies une par une (sauf celles déjà dans
   * l'album), en rapportant la progression, et les retire des candidates au swipe.
   */
  const sendMany = useCallback(
    async (
      photos: GalleryPhoto[],
      onProgress?: (done: number, total: number) => void
    ): Promise<{ sent: number; failed: number; skipped: number }> => {
      if (!album) return { sent: 0, failed: 0, skipped: photos.length };
      const fresh = photos.filter((p) => !sentIds.has(p.id));
      const result = { sent: 0, failed: 0, skipped: photos.length - fresh.length };
      if (fresh.length === 0) return result;

      const ids = new Set(fresh.map((p) => p.id));
      setCandidates((current) => current?.filter((p) => !ids.has(p.id)) ?? null);
      onProgress?.(0, fresh.length);
      for (const photo of fresh) {
        saveReview(album.id, photo.id, 'sent');
        if (await uploadOne(album.id, photo)) result.sent += 1;
        else result.failed += 1;
        onProgress?.(result.sent + result.failed, fresh.length);
      }
      return result;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [album, uploadOne, candidates]
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
    sendMany,
    sentIds,
    uploadsInFlight,
    /** Sur Android on peut redemander ; sur iOS il faut passer par les réglages. */
    canAskPermissionAgain: permission?.canAskAgain ?? false,
    requestPermission,
  };
}

import { usePermissions } from 'expo-media-library';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { useAlbumQuery, useUploadPhoto } from '@/queries/albums';
import { getGalleryPhotosBetween } from '@/services/gallery';
import { DuplicatePhotoError } from '@/services/photo-upload';
import { getDevicePhotos, markPhotoOnDevice } from '@/services/device-photos-store';
import { getReviews, saveReview } from '@/services/review-store';
import { getAlbumRange, type GalleryPhoto, type ReviewDecision } from '@/types/album';

export type SwipeSessionStatus =
  'loading' | 'unsupported' | 'permission-denied' | 'error' | 'ready';

/**
 * Pilote une session de tri : permission galerie, chargement des photos de la période
 * de l'album jamais proposées, et enregistrement des décisions (envoi ou passe).
 */
export function useSwipeSession(albumId: string) {
  const albumQuery = useAlbumQuery(albumId);
  const album = albumQuery.data ?? null;
  const { mutateAsync: uploadPhoto } = useUploadPhoto();
  const [permission, requestPermission] = usePermissions({ granularPermissions: ['photo'] });
  const [candidates, setCandidates] = useState<GalleryPhoto[] | null>(null);
  const [galleryError, setError] = useState<string | null>(null);
  const error =
    galleryError ??
    (albumQuery.isError
      ? albumQuery.error.message
      : albumQuery.data === null
        ? 'Album introuvable.'
        : null);
  const [uploadsInFlight, setUploadsInFlight] = useState(0);
  const hasAskedPermission = useRef(false);

  useEffect(() => {
    if (!permission || permission.granted || hasAskedPermission.current) return;
    if (!permission.canAskAgain) return;
    hasAskedPermission.current = true;
    requestPermission();
  }, [permission, requestPermission]);

  const granted = permission?.granted ?? false;

  // L'album est rechargé après chaque envoi (nouvel objet) : on ne recharge la galerie que si
  // la période change, sinon les candidates seraient recalculées en plein tri.
  const periodKey = album ? `${album.id}:${album.startDate}:${album.endDate}` : null;

  useEffect(() => {
    if (!periodKey || !granted) return;
    const [id, startDate, endDate] = periodKey.split(':');
    let cancelled = false;

    (async () => {
      try {
        const { start, end } = getAlbumRange({ startDate, endDate });
        const all = await getGalleryPhotosBetween(start, end);
        const reviews = getReviews(id);
        // Les photos téléchargées depuis l'album sont déjà dedans : on ne les re-propose pas.
        const fromAlbum = new Set(Object.values(getDevicePhotos(id)));
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
  }, [periodKey, granted]);

  /** Envoie une photo de la galerie vers l'album, en arrière-plan. */
  /** Envoie une photo de la galerie vers l'album. Résout à vrai si l'envoi a réussi. */
  const uploadOne = useCallback(async (albumId: string, photo: GalleryPhoto): Promise<boolean> => {
    try {
      const uploaded = await uploadPhoto({ albumId, photo });
      // Cette photo vient de la galerie de ce téléphone : ne jamais la retélécharger.
      markPhotoOnDevice(albumId, uploaded.id, photo.id);
      return true;
    } catch (error) {
      // Déjà dans l'album (envoyée par quelqu'un d'autre, ou depuis un autre téléphone).
      if (error instanceof DuplicatePhotoError) return true;
      // TODO : file d'attente avec nouvelle tentative ; pour l'instant l'échec est perdu.
      return false;
    }
  }, [uploadPhoto]);

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

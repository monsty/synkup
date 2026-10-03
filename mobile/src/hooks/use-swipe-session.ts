import { usePermissions } from 'expo-media-library';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { useAlbumUploads } from '@/hooks/use-upload-queue';
import { useAlbumQuery } from '@/queries/albums';
import { getGalleryPhotosBetween } from '@/services/gallery';
import { getDevicePhotos } from '@/services/device-photos-store';
import { getReviews, saveReview } from '@/services/review-store';
import { enqueueUploads } from '@/services/upload-queue';
import { getAlbumRange, type GalleryPhoto, type ReviewDecision } from '@/types/album';

export type SwipeSessionStatus =
  'loading' | 'unsupported' | 'permission-denied' | 'error' | 'ready';

/**
 * Pilote une session de tri : permission galerie, chargement des photos de la période
 * de l'album jamais proposées, et enregistrement des décisions (envoi ou passe). Les envois
 * partent dans la file d'arrière-plan : on peut swiper, et quitter l'écran, sans les attendre.
 */
export function useSwipeSession(albumId: string) {
  const albumQuery = useAlbumQuery(albumId);
  const album = albumQuery.data ?? null;
  const [permission, requestPermission] = usePermissions({ granularPermissions: ['photo'] });
  const [candidates, setCandidates] = useState<GalleryPhoto[] | null>(null);
  const [galleryError, setError] = useState<string | null>(null);
  // L'album en cache suffit : la galerie est locale et les envois attendent le réseau.
  const error =
    galleryError ??
    (albumQuery.data === undefined && albumQuery.isError
      ? albumQuery.error.message
      : albumQuery.data === null
        ? 'Album introuvable.'
        : null);
  const uploads = useAlbumUploads(albumId);
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

  const decide = useCallback(
    (photo: GalleryPhoto, decision: ReviewDecision) => {
      if (!album) return;
      saveReview(album.id, photo.id, decision);
      setCandidates((current) => current?.filter((p) => p.id !== photo.id) ?? null);
      if (decision === 'sent') enqueueUploads(album.id, [photo]);
    },
    [album]
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
   * Sélection manuelle : met en file les photos choisies (sauf celles déjà dans l'album) et
   * les retire des candidates au swipe. L'envoi se poursuit en arrière-plan.
   */
  const sendMany = useCallback(
    (photos: GalleryPhoto[]): { queued: number; skipped: number } => {
      if (!album) return { queued: 0, skipped: photos.length };
      const fresh = photos.filter((p) => !sentIds.has(p.id));
      if (fresh.length === 0) return { queued: 0, skipped: photos.length };

      const ids = new Set(fresh.map((p) => p.id));
      setCandidates((current) => current?.filter((p) => !ids.has(p.id)) ?? null);
      for (const photo of fresh) saveReview(album.id, photo.id, 'sent');
      enqueueUploads(album.id, fresh);
      return { queued: fresh.length, skipped: photos.length - fresh.length };
    },
    [album, sentIds]
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
    /** Photos de cet album en attente ou en cours d'envoi. */
    uploadsInFlight: uploads.active,
    /** Sur Android on peut redemander ; sur iOS il faut passer par les réglages. */
    canAskPermissionAgain: permission?.canAskAgain ?? false,
    requestPermission,
  };
}

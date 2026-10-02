import { useCallback, useEffect, useRef, useState } from 'react';

import type { DownloadOverlay } from '@/components/download-modal';
import {
  downloadPhotos,
  getPhotosOnDevice,
  PhotoPermissionError,
  type DownloadResult,
} from '@/services/photo-downloader';
import type { Album, AlbumPhoto } from '@/types/album';

/** Temps d'affichage du résultat dans la modale avant sa fermeture. */
const DONE_DURATION_MS = 1600;
const ERROR_DURATION_MS = 2600;

export type DownloadMode = 'idle' | 'selecting' | 'running';

function describe(result: DownloadResult): string {
  const parts: string[] = [];
  if (result.saved > 0) {
    parts.push(
      `${result.saved} photo${result.saved > 1 ? 's' : ''} enregistrée${result.saved > 1 ? 's' : ''}`
    );
  }
  if (result.failed > 0) parts.push(`${result.failed} en échec`);
  return parts.join(' · ') || 'Rien à enregistrer';
}

/**
 * Sélection de photos à enregistrer sur le téléphone : à l'ouverture, les photos absentes
 * sont pré-cochées ; l'utilisateur peut cocher ou décocher, puis lancer l'enregistrement.
 */
export function useDownloadSelection(album: Album | null, photos: AlbumPhoto[]) {
  const [mode, setMode] = useState<DownloadMode>('idle');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [overlay, setOverlay] = useState<DownloadOverlay | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    []
  );

  /** Affiche le résultat dans la modale puis la referme toute seule. */
  const finishWith = useCallback((text: string, error = false) => {
    setOverlay({ kind: 'done', text, error });
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(
      () => setOverlay(null),
      error ? ERROR_DURATION_MS : DONE_DURATION_MS
    );
  }, []);

  const failWith = useCallback(
    (e: unknown) => {
      finishWith(
        e instanceof PhotoPermissionError
          ? "Autorise l'accès aux photos dans les réglages"
          : 'Téléchargement impossible',
        true
      );
      setMode('idle');
    },
    [finishWith]
  );

  /** Ouvre la sélection avec les photos manquantes pré-cochées. */
  const start = useCallback(() => {
    if (!album || mode !== 'idle') return;
    const onDevice = getPhotosOnDevice(album.id, photos);
    setSelectedIds(new Set(photos.filter((photo) => !onDevice.has(photo.id)).map((p) => p.id)));
    setMode('selecting');
  }, [album, mode, photos]);

  const cancel = useCallback(() => {
    if (mode !== 'selecting') return;
    setSelectedIds(new Set());
    setMode('idle');
  }, [mode]);

  const toggle = useCallback((photoId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(photoId)) next.delete(photoId);
      else next.add(photoId);
      return next;
    });
  }, []);

  /** Enregistre la sélection, y compris les photos déjà présentes si l'utilisateur les a cochées. */
  const confirm = useCallback(async () => {
    if (!album || mode !== 'selecting' || selectedIds.size === 0) return;
    setMode('running');
    const chosen = photos.filter((photo) => selectedIds.has(photo.id));
    setOverlay({ kind: 'progress', done: 0, total: chosen.length });
    try {
      const result = await downloadPhotos(album.id, chosen, ({ done, total }) =>
        setOverlay({ kind: 'progress', done, total })
      );
      finishWith(describe(result));
      setSelectedIds(new Set());
      setMode('idle');
    } catch (e: unknown) {
      failWith(e);
    }
  }, [album, mode, photos, selectedIds, finishWith, failWith]);

  return {
    mode,
    selectedIds,
    overlay,
    start,
    cancel,
    toggle,
    confirm,
  };
}

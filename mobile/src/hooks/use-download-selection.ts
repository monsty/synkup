import { useCallback, useState } from 'react';

import { describeBatch, useProgressOverlay } from '@/hooks/use-progress-overlay';
import {
  downloadPhotos,
  getPhotosOnDevice,
  PhotoPermissionError,
} from '@/services/photo-downloader';
import type { Album, AlbumPhoto } from '@/types/album';

export type DownloadMode = 'idle' | 'selecting' | 'running';

/**
 * Sélection de photos à enregistrer sur le téléphone : à l'ouverture, les photos absentes
 * sont pré-cochées ; l'utilisateur peut cocher ou décocher, puis lancer l'enregistrement.
 */
export function useDownloadSelection(album: Album | null, photos: AlbumPhoto[]) {
  const [mode, setMode] = useState<DownloadMode>('idle');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const { overlay, progress, finish: finishWith } = useProgressOverlay();

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
    progress('Enregistrement', 0, chosen.length);
    try {
      const result = await downloadPhotos(album.id, chosen, ({ done, total }) =>
        progress('Enregistrement', done, total)
      );
      finishWith(describeBatch(result.saved, result.failed, 'enregistrée', 'Rien à enregistrer'));
      setSelectedIds(new Set());
      setMode('idle');
    } catch (e: unknown) {
      failWith(e);
    }
  }, [album, mode, photos, selectedIds, progress, finishWith, failWith]);

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

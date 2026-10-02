import { useCallback, useEffect, useRef, useState } from 'react';

import type { ProgressOverlay } from '@/components/progress-modal';

/** Temps d'affichage du résultat dans la modale avant sa fermeture. */
const DONE_DURATION_MS = 1600;
const ERROR_DURATION_MS = 2600;

/**
 * État d'une `ProgressModal` : progression d'une opération par lots, puis résultat affiché
 * quelques instants avant fermeture automatique.
 */
export function useProgressOverlay() {
  const [overlay, setOverlay] = useState<ProgressOverlay | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    []
  );

  const progress = useCallback((title: string, done: number, total: number) => {
    setOverlay({ kind: 'progress', title, done, total });
  }, []);

  /**
   * Affiche le résultat puis referme la modale toute seule. Résout une fois la modale fermée,
   * pour enchaîner (par exemple quitter l'écran) sans couper l'affichage du résultat.
   */
  const finish = useCallback((text: string, error = false): Promise<void> => {
    setOverlay({ kind: 'done', text, error });
    if (closeTimer.current) clearTimeout(closeTimer.current);
    return new Promise((resolve) => {
      closeTimer.current = setTimeout(
        () => {
          setOverlay(null);
          resolve();
        },
        error ? ERROR_DURATION_MS : DONE_DURATION_MS
      );
    });
  }, []);

  return { overlay, progress, finish };
}

/** « 3 photos envoyées · 1 en échec », ou un texte de repli si rien ne s'est passé. */
export function describeBatch(
  done: number,
  failed: number,
  verb: string,
  fallback: string
): string {
  const parts: string[] = [];
  if (done > 0) parts.push(`${done} photo${done > 1 ? 's' : ''} ${verb}${done > 1 ? 's' : ''}`);
  if (failed > 0) parts.push(`${failed} en échec`);
  return parts.join(' · ') || fallback;
}

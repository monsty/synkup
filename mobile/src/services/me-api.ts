/**
 * Le compte connecté (`/v1/me`) : profil, offre, usage du quota, suppression. Pas d'état ici :
 * le cache est géré par TanStack Query (`src/queries/me.ts`).
 */
import type { MeDto } from '@synkup/shared';

import { apiRequest } from '@/services/api-client';
import { uploadAvatar } from '@/services/photo-upload';

export type MeUpdate = {
  nickname?: string;
  /** Image locale choisie comme photo de profil ; `null` pour revenir à celle de la connexion. */
  avatarUri?: string | null;
};

export const meApi = {
  getMe(): Promise<MeDto> {
    return apiRequest<MeDto>('GET', '/me');
  },

  async updateMe({ nickname, avatarUri }: MeUpdate): Promise<MeDto> {
    // Une nouvelle photo est d'abord envoyée au stockage ; le profil retient sa clé.
    const avatarKey = avatarUri ? await uploadAvatar(avatarUri) : avatarUri;
    return apiRequest<MeDto>('PATCH', '/me', {
      ...(nickname !== undefined && { nickname }),
      ...(avatarKey !== undefined && { avatarKey }),
    });
  },

  deleteMe(): Promise<void> {
    return apiRequest<void>('DELETE', '/me');
  },
};

import { useCallback, useState } from 'react';

import {
  getProfileSync,
  profileApi,
  type Profile,
  type ProfileUpdate,
} from '@/services/profile-api';

type Status = 'loading' | 'ready' | 'error';

/** Profil de l'utilisateur, avec enregistrement des modifications. */
export function useProfile() {
  // Le profil est local : lu en synchrone, l'écran n'a pas d'état de chargement.
  const [profile, setProfile] = useState<Profile>(() => getProfileSync());
  const [status] = useState<Status>('ready');
  const [saving, setSaving] = useState(false);

  const save = useCallback(async (update: ProfileUpdate): Promise<boolean> => {
    setSaving(true);
    try {
      setProfile(await profileApi.updateProfile(update));
      return true;
    } catch {
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  return { profile, status, saving, save };
}

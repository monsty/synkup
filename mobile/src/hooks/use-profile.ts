import { useCallback, useEffect, useState } from 'react';

import { profileApi, type Profile, type ProfileUpdate } from '@/services/profile-api';

type Status = 'loading' | 'ready' | 'error';

/** Profil de l'utilisateur, avec enregistrement des modifications. */
export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    profileApi
      .getProfile()
      .then((result) => {
        if (!active) return;
        setProfile(result);
        setStatus('ready');
      })
      .catch(() => {
        if (active) setStatus('error');
      });
    return () => {
      active = false;
    };
  }, []);

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

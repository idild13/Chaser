import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

const KEY = "fp_issuer_profile";

export interface IssuerProfile {
  name: string;
  email: string;
}

export function useIssuerProfile() {
  const [profile, setProfile] = useState<IssuerProfile>({ name: "", email: "" });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((raw) => {
      if (raw) {
        try {
          setProfile(JSON.parse(raw));
        } catch {}
      }
      setLoaded(true);
    });
  }, []);

  const saveProfile = useCallback((p: IssuerProfile) => {
    setProfile(p);
    AsyncStorage.setItem(KEY, JSON.stringify(p));
  }, []);

  const hasProfile = loaded && (profile.name.trim().length > 0 || profile.email.trim().length > 0);

  return { profile, saveProfile, loaded, hasProfile };
}

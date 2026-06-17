import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  migrateFromAsyncStorage,
  secureGet,
  secureSet,
} from "@/utils/secureStore";

import { CurrencyCode, NumberFormat, isCurrencyCode } from "@/utils/currency";

export interface BusinessProfile {
  name: string;
  email: string;
  address: string;
  vatNumber: string;
  bankDetails: string;
  payLink: string;
  logoUri: string;
  defaultCurrency: CurrencyCode;
  defaultPaymentTerms: string;
  defaultTaxRate: number;
  numberFormat: NumberFormat;
}

export const DEFAULT_PROFILE: BusinessProfile = {
  name: "",
  email: "",
  address: "",
  vatNumber: "",
  bankDetails: "",
  payLink: "",
  logoUri: "",
  defaultCurrency: "EUR",
  defaultPaymentTerms: "Net-30",
  defaultTaxRate: 0,
  numberFormat: "comma-dot",
};

const KEY = "fp_business_profile";
const LEGACY_KEY = "fp_issuer_profile";

interface BusinessProfileContextType {
  profile: BusinessProfile;
  loaded: boolean;
  saveProfile: (p: Partial<BusinessProfile>) => void;
  hasProfile: boolean;
}

const BusinessProfileContext =
  createContext<BusinessProfileContextType | null>(null);

export function BusinessProfileProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [profile, setProfile] = useState<BusinessProfile>(DEFAULT_PROFILE);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // Migrate from plain AsyncStorage to SecureStore on first run.
        let raw = await migrateFromAsyncStorage(KEY, KEY);
        if (raw) {
          const parsed = { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
          if (!isCurrencyCode(parsed.defaultCurrency)) {
            parsed.defaultCurrency = DEFAULT_PROFILE.defaultCurrency;
          }
          setProfile(parsed);
        } else {
          // One-time migration from the old name/email-only profile (legacy AsyncStorage key).
          const legacyRaw = await AsyncStorage.getItem(LEGACY_KEY);
          if (legacyRaw) {
            const l = JSON.parse(legacyRaw);
            const migrated: BusinessProfile = {
              ...DEFAULT_PROFILE,
              name: l.name ?? "",
              email: l.email ?? "",
            };
            setProfile(migrated);
            await secureSet(KEY, JSON.stringify(migrated));
            await AsyncStorage.removeItem(LEGACY_KEY);
          }
        }
      } catch {
        // keep defaults
      }
      setLoaded(true);
    })();
  }, []);

  const saveProfile = useCallback((p: Partial<BusinessProfile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...p };
      secureSet(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const hasProfile =
    loaded &&
    (profile.name.trim().length > 0 || profile.email.trim().length > 0);

  return (
    <BusinessProfileContext.Provider
      value={{ profile, loaded, saveProfile, hasProfile }}
    >
      {children}
    </BusinessProfileContext.Provider>
  );
}

export function useBusinessProfile(): BusinessProfileContextType {
  const ctx = useContext(BusinessProfileContext);
  if (!ctx)
    throw new Error(
      "useBusinessProfile must be used within BusinessProfileProvider"
    );
  return ctx;
}

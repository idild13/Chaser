import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

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
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) {
          const parsed = { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
          if (!isCurrencyCode(parsed.defaultCurrency)) {
            parsed.defaultCurrency = DEFAULT_PROFILE.defaultCurrency;
          }
          setProfile(parsed);
        } else {
          // One-time migration from the old name/email-only profile.
          const legacy = await AsyncStorage.getItem(LEGACY_KEY);
          if (legacy) {
            const l = JSON.parse(legacy);
            const migrated: BusinessProfile = {
              ...DEFAULT_PROFILE,
              name: l.name ?? "",
              email: l.email ?? "",
            };
            setProfile(migrated);
            await AsyncStorage.setItem(KEY, JSON.stringify(migrated));
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
      AsyncStorage.setItem(KEY, JSON.stringify(next));
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

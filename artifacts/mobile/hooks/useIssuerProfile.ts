import { useBusinessProfile } from "@/context/BusinessProfileContext";

export interface IssuerProfile {
  name: string;
  email: string;
}

// Compatibility wrapper over the richer BusinessProfile context so existing
// callers (invoices screen, IssuerProfileModal) keep working with name/email.
export function useIssuerProfile() {
  const { profile, saveProfile, loaded, hasProfile } = useBusinessProfile();
  return {
    profile: { name: profile.name, email: profile.email } as IssuerProfile,
    saveProfile: (p: IssuerProfile) =>
      saveProfile({ name: p.name, email: p.email }),
    loaded,
    hasProfile,
  };
}

export interface DashboardProfileState {
  newsletterOptIn?: boolean;
  email?: string;
}

export function getCommunityStatus(profile: DashboardProfileState | null): 'Connected' | 'Private' {
  return profile?.newsletterOptIn ? 'Connected' : 'Private';
}

export function isDeleteConfirmationValid(
  expectedEmail: string | null | undefined,
  typedEmail: string,
): boolean {
  return Boolean(expectedEmail) && typedEmail === expectedEmail;
}

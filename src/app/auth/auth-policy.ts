export interface AuthPolicyUser {
  email: string | null | undefined;
  emailVerified: boolean;
}

export interface AuthPolicyProfile {
  registrationComplete?: boolean;
}

export function isAdminEmail(email: string | null | undefined): boolean {
  return email === 'schoedelb@gmail.com';
}

export function isVerifiedForApp(user: AuthPolicyUser | null | undefined): boolean {
  if (!user) {
    return false;
  }

  return isAdminEmail(user.email) || user.emailVerified;
}

export function getAuthRedirect(
  user: AuthPolicyUser | null | undefined,
  profile: AuthPolicyProfile | null | undefined,
): '/login' | '/onboarding' | '/dashboard/learn' {
  if (!user) {
    return '/login';
  }

  if (!isVerifiedForApp(user) || !profile?.registrationComplete) {
    return '/onboarding';
  }

  return '/dashboard/learn';
}

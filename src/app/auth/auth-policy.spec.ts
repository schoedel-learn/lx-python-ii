import { describe, expect, it } from 'vitest';

import { getAuthRedirect, isVerifiedForApp } from './auth-policy';

describe('auth-policy', () => {
  it('treats the admin email as verified for app access', () => {
    expect(
      isVerifiedForApp({
        email: 'schoedelb@gmail.com',
        emailVerified: false,
      }),
    ).toBe(true);
  });

  it('redirects anonymous users to login', () => {
    expect(getAuthRedirect(null, null)).toBe('/login');
  });

  it('redirects unverified or incomplete users to onboarding', () => {
    expect(
      getAuthRedirect(
        {
          email: 'learner@example.com',
          emailVerified: false,
        },
        {
          registrationComplete: true,
        },
      ),
    ).toBe('/onboarding');

    expect(
      getAuthRedirect(
        {
          email: 'learner@example.com',
          emailVerified: true,
        },
        {
          registrationComplete: false,
        },
      ),
    ).toBe('/onboarding');
  });

  it('redirects verified and complete users to dashboard learn', () => {
    expect(
      getAuthRedirect(
        {
          email: 'learner@example.com',
          emailVerified: true,
        },
        {
          registrationComplete: true,
        },
      ),
    ).toBe('/dashboard/learn');
  });
});

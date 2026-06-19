import { describe, expect, it, vi } from 'vitest';
import { buildDefaultUserProfile } from './auth-profile';

describe('buildDefaultUserProfile', () => {
  it('enables confirmed newsletter defaults for the owner email', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-18T12:00:00.000Z'));

    try {
      const profile = buildDefaultUserProfile({
        uid: 'owner-1',
        displayName: 'Barry Schoedel',
        email: 'schoedelb@gmail.com',
      });

      expect(profile).toMatchObject({
        uid: 'owner-1',
        firstName: 'Barry',
        email: 'schoedelb@gmail.com',
        dateJoined: '2026-06-18T12:00:00.000Z',
        pythonExperience: 'Beginner',
        registrationComplete: false,
        newsletterOptIn: true,
        newsletterConfirmed: true,
      });
      expect(profile.customId).toMatch(/^[a-zA-Z0-9*+_\-!?]{8}$/);
    } finally {
      vi.useRealTimers();
    }
  });
});

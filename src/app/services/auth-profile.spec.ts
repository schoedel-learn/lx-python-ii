import { Injector, PLATFORM_ID, runInInjectionContext } from '@angular/core';
import type { User as FirebaseUser } from 'firebase/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildDefaultUserProfile } from './auth-profile';
import { AUTH_SERVICE_DEPENDENCIES, AuthService, type AuthServiceDependencies } from './auth.service';

interface MockFirebaseUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  emailVerified?: boolean;
  delete: ReturnType<typeof vi.fn>;
}

const authMockState: {
  listener?: (user: FirebaseUser | null) => void;
} = {};

function createMockDependencies(): AuthServiceDependencies {
  return {
    onAuthStateChanged: vi.fn((listener) => {
      authMockState.listener = listener;
      return vi.fn();
    }),
    signInWithGoogle: vi.fn(),
    completeRedirectSignIn: vi.fn(async () => null),
    signOut: vi.fn(async () => undefined),
    fetchOrCreateUserProfile: vi.fn(),
    updateUserProfile: vi.fn(async () => undefined),
    sendVerificationEmail: vi.fn(async () => undefined),
    deleteUserProfile: vi.fn(async () => undefined),
    deleteCurrentUser: vi.fn(async () => undefined),
    reauthenticateWithGoogle: vi.fn(),
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

function buildMockUser(overrides: Partial<MockFirebaseUser> = {}): FirebaseUser {
  return {
    uid: 'mock-user',
    displayName: 'Learner Example',
    email: 'learner@example.com',
    emailVerified: true,
    delete: vi.fn(),
    ...overrides,
  } as unknown as FirebaseUser;
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

function createService(dependencies: AuthServiceDependencies): AuthService {
  return runInInjectionContext(
    Injector.create({
      providers: [
        {
          provide: AUTH_SERVICE_DEPENDENCIES,
          useValue: dependencies,
        },
        {
          provide: PLATFORM_ID,
          useValue: 'browser',
        },
      ],
    }),
    () => new AuthService(),
  );
}

describe('auth profile services', () => {
  let dependencies: AuthServiceDependencies;

  beforeEach(() => {
    authMockState.listener = undefined;
    dependencies = createMockDependencies();
  });

  it('enables confirmed newsletter defaults for the owner email', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-18T12:00:00.000Z'));

    try {
      const profile = buildDefaultUserProfile({
        uid: 'owner-1',
        displayName: 'Barry Schoedel',
        email: 'schoedelb@gmail.com',
      } as FirebaseUser);

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

  it('marks auth as pending and clears stale profiles until the matching profile load completes', async () => {
    const previousProfile = buildDefaultUserProfile({
      uid: 'old-user',
      displayName: 'Old Learner',
      email: 'old@example.com',
    } as FirebaseUser);
    const deferred = createDeferred<typeof previousProfile>();
    vi.mocked(dependencies.fetchOrCreateUserProfile)
      .mockResolvedValueOnce(previousProfile)
      .mockReturnValueOnce(deferred.promise);

    const service = createService(dependencies);
    const notifyAuthStateChange = authMockState.listener;
    expect(notifyAuthStateChange).toBeDefined();

    notifyAuthStateChange!(buildMockUser({ uid: 'old-user', email: 'old@example.com' }));
    await flushMicrotasks();

    const nextUser = buildMockUser({ uid: 'next-user', email: 'next@example.com' });
    const nextProfile = buildDefaultUserProfile(nextUser);

    notifyAuthStateChange!(nextUser);

    expect(service.currentUser()).toBe(nextUser);
    expect(service.userProfile()).toBeNull();
    expect(service.isAuthReady()).toBe(false);

    deferred.resolve(nextProfile);
    await deferred.promise;
    await flushMicrotasks();

    expect(service.userProfile()).toEqual(nextProfile);
    expect(service.isAuthReady()).toBe(true);
  });

  it('ignores stale profile loads from superseded auth revisions', async () => {
    const firstDeferred = createDeferred<ReturnType<typeof buildDefaultUserProfile>>();
    const secondDeferred = createDeferred<ReturnType<typeof buildDefaultUserProfile>>();
    vi.mocked(dependencies.fetchOrCreateUserProfile)
      .mockReturnValueOnce(firstDeferred.promise)
      .mockReturnValueOnce(secondDeferred.promise);

    const service = createService(dependencies);
    const notifyAuthStateChange = authMockState.listener;
    expect(notifyAuthStateChange).toBeDefined();
    const firstUser = buildMockUser({ uid: 'first-user', email: 'first@example.com' });
    const secondUser = buildMockUser({ uid: 'second-user', email: 'second@example.com' });
    const secondProfile = buildDefaultUserProfile(secondUser);

    notifyAuthStateChange!(firstUser);
    notifyAuthStateChange!(secondUser);

    expect(service.currentUser()).toBe(secondUser);
    expect(service.userProfile()).toBeNull();
    expect(service.isAuthReady()).toBe(false);

    firstDeferred.resolve(buildDefaultUserProfile(firstUser));
    await firstDeferred.promise;
    await flushMicrotasks();

    expect(service.currentUser()).toBe(secondUser);
    expect(service.userProfile()).toBeNull();
    expect(service.isAuthReady()).toBe(false);

    secondDeferred.resolve(secondProfile);
    await secondDeferred.promise;
    await flushMicrotasks();

    expect(service.userProfile()).toEqual(secondProfile);
    expect(service.isAuthReady()).toBe(true);
  });

  it('restores auth readiness when profile loading fails for the current revision', async () => {
    const profileLoadError = new Error('firestore unavailable');
    vi.mocked(dependencies.fetchOrCreateUserProfile).mockRejectedValueOnce(profileLoadError);
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      const service = createService(dependencies);
      const notifyAuthStateChange = authMockState.listener;
      expect(notifyAuthStateChange).toBeDefined();
      const user = buildMockUser({ uid: 'failed-user', email: 'failed@example.com' });

      notifyAuthStateChange!(user);
      await flushMicrotasks();

      expect(service.currentUser()).toBe(user);
      expect(service.userProfile()).toBeNull();
      expect(service.isAuthReady()).toBe(true);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to load user profile:', profileLoadError);
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});

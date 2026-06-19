import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildDefaultUserProfile } from './auth-profile';

interface MockFirebaseUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  emailVerified?: boolean;
  delete?: ReturnType<typeof vi.fn>;
}

interface MockProfileDoc {
  exists: () => boolean;
  data: () => unknown;
}

const authMockState = vi.hoisted(() => ({
  listener: undefined as ((user: MockFirebaseUser | null) => void) | undefined,
}));

const firestoreMocks = vi.hoisted(() => ({
  getDoc: vi.fn<() => Promise<MockProfileDoc>>(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
}));

const authMocks = vi.hoisted(() => ({
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  sendEmailVerification: vi.fn(),
}));

vi.mock('../../firebase', () => ({
  auth: {
    onAuthStateChanged: vi.fn((listener: (user: MockFirebaseUser | null) => void) => {
      authMockState.listener = listener;
      return vi.fn();
    }),
  },
  db: {},
}));

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: vi.fn(),
  signInWithPopup: authMocks.signInWithPopup,
  signOut: authMocks.signOut,
  sendEmailVerification: authMocks.sendEmailVerification,
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({ path: 'users/mock-user' })),
  getDoc: firestoreMocks.getDoc,
  setDoc: firestoreMocks.setDoc,
  updateDoc: firestoreMocks.updateDoc,
  deleteDoc: firestoreMocks.deleteDoc,
}));

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

function existingProfile(profile: unknown): MockProfileDoc {
  return {
    exists: () => true,
    data: () => profile,
  };
}

function buildMockUser(overrides: Partial<MockFirebaseUser> = {}): MockFirebaseUser {
  return {
    uid: 'mock-user',
    displayName: 'Learner Example',
    email: 'learner@example.com',
    emailVerified: true,
    delete: vi.fn(),
    ...overrides,
  };
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('auth profile services', () => {
  beforeEach(() => {
    authMockState.listener = undefined;
    firestoreMocks.getDoc.mockReset();
    firestoreMocks.setDoc.mockReset();
    firestoreMocks.updateDoc.mockReset();
    firestoreMocks.deleteDoc.mockReset();
    authMocks.signInWithPopup.mockReset();
    authMocks.signOut.mockReset();
    authMocks.sendEmailVerification.mockReset();
    vi.resetModules();
  });

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

  it('marks auth as pending and clears stale profiles until the matching profile load completes', async () => {
    const deferred = createDeferred<MockProfileDoc>();
    const previousProfile = buildDefaultUserProfile({
      uid: 'old-user',
      displayName: 'Old Learner',
      email: 'old@example.com',
    });
    firestoreMocks.getDoc
      .mockResolvedValueOnce(existingProfile(previousProfile))
      .mockReturnValueOnce(deferred.promise);

    const { AuthService } = await import('./auth.service');
    const service = new AuthService();
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

    deferred.resolve(existingProfile(nextProfile));
    await deferred.promise;
    await flushMicrotasks();

    expect(service.userProfile()).toEqual(nextProfile);
    expect(service.isAuthReady()).toBe(true);
  });

  it('ignores stale profile loads from superseded auth revisions', async () => {
    const firstDeferred = createDeferred<MockProfileDoc>();
    const secondDeferred = createDeferred<MockProfileDoc>();
    firestoreMocks.getDoc
      .mockReturnValueOnce(firstDeferred.promise)
      .mockReturnValueOnce(secondDeferred.promise);

    const { AuthService } = await import('./auth.service');
    const service = new AuthService();
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

    firstDeferred.resolve(existingProfile(buildDefaultUserProfile(firstUser)));
    await firstDeferred.promise;
    await flushMicrotasks();

    expect(service.currentUser()).toBe(secondUser);
    expect(service.userProfile()).toBeNull();
    expect(service.isAuthReady()).toBe(false);

    secondDeferred.resolve(existingProfile(secondProfile));
    await secondDeferred.promise;
    await flushMicrotasks();

    expect(service.userProfile()).toEqual(secondProfile);
    expect(service.isAuthReady()).toBe(true);
  });

  it('restores auth readiness when profile loading fails for the current revision', async () => {
    const profileLoadError = new Error('firestore unavailable');
    firestoreMocks.getDoc.mockRejectedValueOnce(profileLoadError);
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      const { AuthService } = await import('./auth.service');
      const service = new AuthService();
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

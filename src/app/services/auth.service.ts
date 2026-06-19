import { isPlatformBrowser } from '@angular/common';
import { Injectable, InjectionToken, PLATFORM_ID, inject, signal } from '@angular/core';
import { auth, db } from '../../firebase';
import {
  browserLocalPersistence,
  getRedirectResult,
  GoogleAuthProvider,
  sendEmailVerification,
  setPersistence,
  signInWithPopup,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';
import { buildDefaultUserProfile } from './auth-profile';
import type { UserProfile } from './auth-profile';

export type { UserProfile } from './auth-profile';

type AuthStateListener = (user: FirebaseUser | null) => void;

export interface AuthServiceDependencies {
  onAuthStateChanged(listener: AuthStateListener): () => void;
  signInWithGoogle(): Promise<unknown>;
  completeRedirectSignIn(): Promise<unknown>;
  signOut(): Promise<void>;
  fetchOrCreateUserProfile(user: FirebaseUser): Promise<UserProfile>;
  updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<void>;
  sendVerificationEmail(user: FirebaseUser): Promise<void>;
  deleteUserProfile(userId: string): Promise<void>;
  deleteCurrentUser(user: FirebaseUser): Promise<void>;
  reauthenticateWithGoogle(): Promise<unknown>;
}

function createAuthServiceDependencies(): AuthServiceDependencies {
  return {
    onAuthStateChanged: (listener) => auth.onAuthStateChanged(listener),
    signInWithGoogle: async () => {
      const provider = new GoogleAuthProvider();
      provider.addScope('profile');
      provider.addScope('email');
      await setPersistence(auth, browserLocalPersistence);
      return signInWithPopup(auth, provider);
    },
    completeRedirectSignIn: () => getRedirectResult(auth),
    signOut: () => signOut(auth),
    fetchOrCreateUserProfile: async (user) => {
      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return docSnap.data() as UserProfile;
      }

      const newProfile = buildDefaultUserProfile(user);
      await setDoc(docRef, newProfile);
      return newProfile;
    },
    updateUserProfile: async (userId, updates) => {
      const docRef = doc(db, 'users', userId);
      await updateDoc(docRef, updates);
    },
    sendVerificationEmail: (user) => sendEmailVerification(user),
    deleteUserProfile: async (userId) => {
      const docRef = doc(db, 'users', userId);
      await deleteDoc(docRef);
    },
    deleteCurrentUser: (user) => user.delete(),
    reauthenticateWithGoogle: () => {
      const provider = new GoogleAuthProvider();
      return signInWithPopup(auth, provider);
    },
  };
}

export const AUTH_SERVICE_DEPENDENCIES = new InjectionToken<AuthServiceDependencies>('AUTH_SERVICE_DEPENDENCIES', {
  providedIn: 'root',
  factory: createAuthServiceDependencies,
});

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  currentUser = signal<FirebaseUser | null>(null);
  userProfile = signal<UserProfile | null>(null);
  isAuthReady = signal<boolean>(false);
  authError = signal<string | null>(null);
  private authStateRevision = 0;
  private readonly dependencies = inject(AUTH_SERVICE_DEPENDENCIES);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  constructor() {
    this.dependencies.onAuthStateChanged((user) => {
      void this.handleAuthStateChange(user);
    });
    if (this.isBrowser) {
      void this.completePendingRedirectSignIn();
    }
  }

  async loginWithGoogle() {
    try {
      this.authError.set(null);
      if (!this.isBrowser) {
        return;
      }
      await this.dependencies.signInWithGoogle();
    } catch (error) {
      console.error('Login error:', error);
      this.authError.set(getAuthErrorMessage(error));
      throw error;
    }
  }

  async logout() {
    await this.dependencies.signOut();
  }

  private async handleAuthStateChange(user: FirebaseUser | null) {
    const revision = ++this.authStateRevision;
    this.currentUser.set(user);
    this.userProfile.set(null);
    this.isAuthReady.set(false);

    if (!user) {
      if (revision === this.authStateRevision) {
        this.isAuthReady.set(true);
      }
      return;
    }

    try {
      const profile = await this.dependencies.fetchOrCreateUserProfile(user);
      if (revision !== this.authStateRevision) {
        return;
      }

      this.userProfile.set(profile);
    } catch (error) {
      if (revision !== this.authStateRevision) {
        return;
      }

      console.error('Failed to load user profile:', error);
    }

    if (revision === this.authStateRevision) {
      this.isAuthReady.set(true);
    }
  }

  private async completePendingRedirectSignIn() {
    try {
      await this.dependencies.completeRedirectSignIn();
    } catch (error) {
      console.error('Redirect login error:', error);
      this.authError.set(getAuthErrorMessage(error));
    }
  }

  async updateProfile(updates: Partial<UserProfile>) {
    const user = this.currentUser();
    if (!user) return;

    await this.dependencies.updateUserProfile(user.uid, updates);

    const currentProfile = this.userProfile();
    if (currentProfile) {
      this.userProfile.set({ ...currentProfile, ...updates });
    }
  }

  async sendVerificationEmail() {
    const user = this.currentUser();
    if (user && !user.emailVerified) {
      await this.dependencies.sendVerificationEmail(user);
    }
  }

  async deleteAccount() {
    const user = this.currentUser();
    if (!user) return;

    try {
      await this.dependencies.deleteUserProfile(user.uid);
      await this.dependencies.deleteCurrentUser(user);
    } catch (error: unknown) {
      console.error('Error deleting account:', error);
      if (error instanceof FirebaseError && error.code === 'auth/requires-recent-login') {
        await this.dependencies.reauthenticateWithGoogle();
        await this.dependencies.deleteUserProfile(user.uid);
        await this.dependencies.deleteCurrentUser(user);
      } else {
        throw error;
      }
    }
  }
}

function getAuthErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    if (error.code === 'auth/unauthorized-domain') {
      return 'This domain is not authorized for Google sign-in in Firebase.';
    }

    if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user') {
      return 'The Google sign-in window was blocked or closed before sign-in finished.';
    }

    if (error.code === 'auth/network-request-failed') {
      return 'Google sign-in could not reach Firebase. Check your connection and try again.';
    }

    return `Google sign-in failed: ${error.code}`;
  }

  return 'Google sign-in failed. Please try again.';
}

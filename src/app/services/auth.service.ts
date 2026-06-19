import { Injectable, signal } from '@angular/core';
import { auth, db } from '../../firebase';
import { GoogleAuthProvider, signInWithPopup, signOut, type User as FirebaseUser, sendEmailVerification } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';
import { buildDefaultUserProfile } from './auth-profile';
import type { UserProfile } from './auth-profile';

export type { UserProfile } from './auth-profile';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  currentUser = signal<FirebaseUser | null>(null);
  userProfile = signal<UserProfile | null>(null);
  isAuthReady = signal<boolean>(false);
  private authStateRevision = 0;

  constructor() {
    auth.onAuthStateChanged((user) => {
      void this.handleAuthStateChange(user);
    });
  }

  async loginWithGoogle() {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async logout() {
    await signOut(auth);
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

    const profile = await this.fetchOrCreateUserProfile(user);
    if (revision !== this.authStateRevision) {
      return;
    }

    this.userProfile.set(profile);
    this.isAuthReady.set(true);
  }

  private async fetchOrCreateUserProfile(user: FirebaseUser): Promise<UserProfile> {
    const docRef = doc(db, 'users', user.uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data() as UserProfile;
    }

    const newProfile = buildDefaultUserProfile(user);
    await setDoc(docRef, newProfile);
    return newProfile;
  }

  async updateProfile(updates: Partial<UserProfile>) {
    const user = this.currentUser();
    if (!user) return;

    const docRef = doc(db, 'users', user.uid);
    await updateDoc(docRef, updates);

    const currentProfile = this.userProfile();
    if (currentProfile) {
      this.userProfile.set({ ...currentProfile, ...updates });
    }
  }

  async sendVerificationEmail() {
    const user = this.currentUser();
    if (user && !user.emailVerified) {
      await sendEmailVerification(user);
    }
  }

  async deleteAccount() {
    const user = this.currentUser();
    if (!user) return;

    try {
      // Delete user profile document from Firestore
      const docRef = doc(db, 'users', user.uid);
      await deleteDoc(docRef);

      // Delete user from Firebase Auth
      await user.delete();
    } catch (error: unknown) {
      console.error('Error deleting account:', error);
      // If re-authentication is required
      if (error instanceof FirebaseError && error.code === 'auth/requires-recent-login') {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);

        // Try again
        const docRef = doc(db, 'users', user.uid);
        await deleteDoc(docRef);
        await user.delete();
      } else {
        throw error;
      }
    }
  }
}

import type { User as FirebaseUser } from 'firebase/auth';
import { customAlphabet } from 'nanoid';
import { isAdminEmail } from '../auth/auth-policy';

const generateCustomId = customAlphabet('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789*+_-!?', 8);

type AuthProfileUser = Pick<FirebaseUser, 'uid' | 'displayName' | 'email'>;

export interface UserProfile {
  uid: string;
  customId: string;
  firstName: string;
  email: string;
  phoneNumber?: string;
  country?: string;
  dateJoined: string;
  birthday?: string;
  pythonExperience: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
  projectInterests?: string[];
  newsletterOptIn?: boolean;
  newsletterConfirmed?: boolean;
  registrationComplete?: boolean;
}

export function buildDefaultUserProfile(user: AuthProfileUser): UserProfile {
  const isAdmin = isAdminEmail(user.email);

  return {
    uid: user.uid,
    customId: generateCustomId(),
    firstName: user.displayName?.split(' ')[0] || 'Learner',
    email: user.email || '',
    dateJoined: new Date().toISOString(),
    pythonExperience: 'Beginner',
    registrationComplete: false,
    newsletterOptIn: isAdmin,
    newsletterConfirmed: isAdmin,
  };
}

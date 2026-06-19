# LXPython Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the reliability and maintainability improvements from GitHub `main` into the local LXPython app without replacing the current local UI framework.

**Architecture:** Keep the local component templates as the canonical product surface, and import only proven logic improvements from the donor branch. Extract fragile auth, routing, and AI-service behavior into small pure helpers first so donor changes can be integrated safely and tested without rewriting the screens the user likes.

**Tech Stack:** Angular 21, TypeScript, Angular Router, Firebase Auth/Firestore, OpenAI browser client, Angular unit tests, ESLint

---

## File Structure

- Create: `src/app/auth/auth-policy.ts` — pure helpers for admin detection, verification, registration completion, and route redirect decisions
- Create: `src/app/auth/auth-policy.spec.ts` — unit tests for route and verification rules
- Modify: `src/app/app.routes.ts` — replace inline guard logic with tested helpers while preserving existing routes
- Create: `src/app/services/auth-profile.ts` — pure helpers for profile creation and auth-state application
- Create: `src/app/services/auth-profile.spec.ts` — unit tests for default profile creation and state transitions
- Modify: `src/app/services/auth.service.ts` — remove race-prone inline auth logic and use extracted helpers
- Create: `src/app/services/learning-agent-request.ts` — build system prompt and message payloads outside the transport layer
- Create: `src/app/services/learning-agent-request.spec.ts` — unit tests for prompt/message construction
- Modify: `src/app/services/learning.service.ts` — keep current UX behavior while using extracted request builders
- Create: `src/app/components/dashboard/dashboard-view-model.ts` — pure display helpers for profile drawer state
- Create: `src/app/components/dashboard/dashboard-view-model.spec.ts` — unit tests for dashboard display state
- Create: `src/app/components/learning-module/learning-workspace-state.ts` — pure helpers for tab/view/runtime labels in the local learning studio
- Create: `src/app/components/learning-module/learning-workspace-state.spec.ts` — unit tests for workspace state helpers
- Modify: `src/app/components/dashboard/dashboard.component.ts` — keep template, replace inline derived logic with tested helpers
- Modify: `src/app/components/learning-module/learning-module.component.ts` — keep layout, replace inline derived logic with tested helpers
- Modify: `README.md` — document the reconciliation outcome and preview/validation path only if the implementation changes local setup expectations

### Task 1: Extract and Test Auth Policy

**Files:**
- Create: `src/app/auth/auth-policy.ts`
- Create: `src/app/auth/auth-policy.spec.ts`
- Modify: `src/app/app.routes.ts`

- [ ] **Step 1: Write the failing auth policy test**

```ts
import {
  getAuthRedirect,
  isAdminEmail,
  isVerifiedForApp,
} from './auth-policy';

describe('auth policy', () => {
  it('treats the owner email as admin and verified', () => {
    expect(isAdminEmail('schoedelb@gmail.com')).toBe(true);
    expect(isVerifiedForApp({ email: 'schoedelb@gmail.com', emailVerified: false })).toBe(true);
  });

  it('sends anonymous users to login', () => {
    expect(getAuthRedirect(null, null)).toBe('/login');
  });

  it('sends unverified or incomplete users to onboarding', () => {
    expect(
      getAuthRedirect(
        { email: 'learner@example.com', emailVerified: false },
        { registrationComplete: false }
      )
    ).toBe('/onboarding');
  });

  it('sends verified and complete users to the learning dashboard', () => {
    expect(
      getAuthRedirect(
        { email: 'learner@example.com', emailVerified: true },
        { registrationComplete: true }
      )
    ).toBe('/dashboard/learn');
  });
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `npm test -- --watch=false --include='src/app/auth/auth-policy.spec.ts' --browsers=ChromeHeadless`

Expected: FAIL because `src/app/auth/auth-policy.ts` does not exist yet.

- [ ] **Step 3: Implement the auth policy helper**

```ts
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

export function isVerifiedForApp(user: AuthPolicyUser | null): boolean {
  if (!user) return false;
  return isAdminEmail(user.email) || user.emailVerified;
}

export function getAuthRedirect(
  user: AuthPolicyUser | null,
  profile: AuthPolicyProfile | null
): '/login' | '/onboarding' | '/dashboard/learn' {
  if (!user) return '/login';
  if (!isVerifiedForApp(user) || !profile?.registrationComplete) return '/onboarding';
  return '/dashboard/learn';
}
```

- [ ] **Step 4: Replace inline route-guard branching with the helper**

```ts
import { getAuthRedirect } from './auth/auth-policy';

const authGuard = () => {
  const user = authService.currentUser();
  const profile = authService.userProfile();
  const redirect = getAuthRedirect(
    user ? { email: user.email, emailVerified: user.emailVerified } : null,
    profile
  );

  return redirect === '/dashboard/learn' ? true : router.parseUrl(redirect);
};
```

- [ ] **Step 5: Re-run the focused test and lint**

Run: `npm test -- --watch=false --include='src/app/auth/auth-policy.spec.ts' --browsers=ChromeHeadless && npm run lint`

Expected: PASS for the auth policy tests, then a clean lint run.

- [ ] **Step 6: Commit the auth policy slice**

```bash
git add src/app/auth/auth-policy.ts src/app/auth/auth-policy.spec.ts src/app/app.routes.ts
git commit -m "refactor: extract auth policy helpers"
```

### Task 2: Stabilize AuthService Without Changing the UI

**Files:**
- Create: `src/app/services/auth-profile.ts`
- Create: `src/app/services/auth-profile.spec.ts`
- Modify: `src/app/services/auth.service.ts`

- [ ] **Step 1: Write the failing auth profile helper test**

```ts
import { buildDefaultUserProfile } from './auth-profile';

describe('buildDefaultUserProfile', () => {
  it('creates an admin-friendly default profile for the owner email', () => {
    const profile = buildDefaultUserProfile({
      uid: 'abc123',
      email: 'schoedelb@gmail.com',
      displayName: 'Barry Schoedel',
    });

    expect(profile.firstName).toBe('Barry');
    expect(profile.registrationComplete).toBe(false);
    expect(profile.newsletterOptIn).toBe(true);
    expect(profile.newsletterConfirmed).toBe(true);
  });
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `npm test -- --watch=false --include='src/app/services/auth-profile.spec.ts' --browsers=ChromeHeadless`

Expected: FAIL because `buildDefaultUserProfile` does not exist yet.

- [ ] **Step 3: Implement the pure profile builder**

```ts
import { customAlphabet } from 'nanoid';
import type { UserProfile } from './auth.service';

const generateCustomId = customAlphabet('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789*+_-!?', 8);

export interface ProfileSeedUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

export function buildDefaultUserProfile(user: ProfileSeedUser): UserProfile {
  const isAdmin = user.email === 'schoedelb@gmail.com';

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
```

- [ ] **Step 4: Refactor AuthService to use a revision-safe auth-state handler**

```ts
private authStateRevision = 0;

constructor() {
  auth.onAuthStateChanged((user) => {
    void this.handleAuthStateChange(user);
  });
}

private async handleAuthStateChange(user: FirebaseUser | null) {
  const revision = ++this.authStateRevision;
  this.currentUser.set(user);

  if (!user) {
    if (revision === this.authStateRevision) {
      this.userProfile.set(null);
      this.isAuthReady.set(true);
    }
    return;
  }

  const profile = await this.fetchOrCreateUserProfile(user);
  if (revision !== this.authStateRevision) return;

  this.userProfile.set(profile);
  this.isAuthReady.set(true);
}

private async fetchOrCreateUserProfile(user: FirebaseUser): Promise<UserProfile> {
  const docRef = doc(db, 'users', user.uid);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    return docSnap.data() as UserProfile;
  }

  const profile = buildDefaultUserProfile({
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
  });

  await setDoc(docRef, profile);
  return profile;
}
```

- [ ] **Step 5: Re-run tests, lint, and the local build**

Run: `npm test -- --watch=false --include='src/app/services/auth-profile.spec.ts' --browsers=ChromeHeadless && npm run lint && npm run build`

Expected: PASS for the helper test, then a clean lint/build with the same local auth screen still rendered.

- [ ] **Step 6: Commit the auth service slice**

```bash
git add src/app/services/auth-profile.ts src/app/services/auth-profile.spec.ts src/app/services/auth.service.ts
git commit -m "refactor: stabilize auth state handling"
```

### Task 3: Separate Learning Request Construction from the AI Transport

**Files:**
- Create: `src/app/services/learning-agent-request.ts`
- Create: `src/app/services/learning-agent-request.spec.ts`
- Modify: `src/app/services/learning.service.ts`

- [ ] **Step 1: Write the failing request-builder test**

```ts
import { buildLearningMessages, buildSystemInstruction } from './learning-agent-request';

describe('learning agent request helpers', () => {
  it('includes the learner name, level, and memories in the system instruction', () => {
    const instruction = buildSystemInstruction(
      { firstName: 'Barry', pythonExperience: 'Intermediate', projectInterests: ['automation'] },
      '- [preference] prefers concise hints'
    );

    expect(instruction).toContain('Barry');
    expect(instruction).toContain('Intermediate');
    expect(instruction).toContain('prefers concise hints');
  });

  it('maps model messages into assistant-compatible payloads', () => {
    const messages = buildLearningMessages(
      'system prompt',
      [{ role: 'model', content: 'Try a loop', timestamp: '2026-06-18T00:00:00.000Z' }],
      'Explain enumerate'
    );

    expect(messages[1]).toEqual({ role: 'assistant', content: 'Try a loop' });
    expect(messages.at(-1)).toEqual({ role: 'user', content: 'Explain enumerate' });
  });
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `npm test -- --watch=false --include='src/app/services/learning-agent-request.spec.ts' --browsers=ChromeHeadless`

Expected: FAIL because the request helper file does not exist yet.

- [ ] **Step 3: Implement the request-building helper**

```ts
import OpenAI from 'openai';
import type { ChatMessage } from './learning.service';
import type { UserProfile } from './auth.service';

export function buildSystemInstruction(
  userProfile: Partial<UserProfile> | null,
  memoryString: string
): string {
  return `
    You are an expert Python facilitator. You are teaching ${userProfile?.firstName || 'the user'},
    whose skill level is ${userProfile?.pythonExperience || 'Beginner'} and is interested in ${userProfile?.projectInterests?.join(', ') || 'General Python'}.

    Here is their learning history and preferences:
    ${memoryString}
  `;
}

export function buildLearningMessages(
  systemInstruction: string,
  history: ChatMessage[],
  message: string
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  return [
    { role: 'system', content: systemInstruction },
    ...history.map((entry) => ({
      role: (entry.role === 'model' ? 'assistant' : entry.role) as 'user' | 'assistant' | 'system',
      content: entry.content,
    })),
    { role: 'user', content: message },
  ];
}
```

- [ ] **Step 4: Refactor `LearningAgentService` to use the helper while keeping current behavior**

```ts
const systemInstruction = buildSystemInstruction(userProfile, memoryString);
const messages = buildLearningMessages(systemInstruction, history, message);

const response = await this.ai.chat.completions.create({
  model: modelName,
  messages,
  temperature: 0.7,
  tools,
  reasoning_effort: 'medium',
});
```

- [ ] **Step 5: Re-run tests, lint, and build**

Run: `npm test -- --watch=false --include='src/app/services/learning-agent-request.spec.ts' --browsers=ChromeHeadless && npm run lint && npm run build`

Expected: PASS for the request helper tests, then a clean lint/build with the existing local learning studio still intact.

- [ ] **Step 6: Commit the learning service slice**

```bash
git add src/app/services/learning-agent-request.ts src/app/services/learning-agent-request.spec.ts src/app/services/learning.service.ts
git commit -m "refactor: isolate learning agent request building"
```

### Task 4: Extract Dashboard and Workspace View State Without Replacing the Local UI

**Files:**
- Create: `src/app/components/dashboard/dashboard-view-model.ts`
- Create: `src/app/components/dashboard/dashboard-view-model.spec.ts`
- Create: `src/app/components/learning-module/learning-workspace-state.ts`
- Create: `src/app/components/learning-module/learning-workspace-state.spec.ts`
- Modify: `src/app/components/dashboard/dashboard.component.ts`
- Modify: `src/app/components/learning-module/learning-module.component.ts`

- [ ] **Step 1: Write the failing view-model tests**

```ts
import { getCommunityStatus, isDeleteConfirmationValid } from './dashboard-view-model';
import { getExecutionSummary } from '../learning-module/learning-workspace-state';

describe('dashboard view model', () => {
  it('marks newsletter-enabled learners as connected', () => {
    expect(getCommunityStatus({ newsletterOptIn: true })).toBe('Connected');
  });

  it('validates delete confirmation against the profile email', () => {
    expect(isDeleteConfirmationValid('learner@example.com', 'learner@example.com')).toBe(true);
  });
});

describe('learning workspace state', () => {
  it('reports a successful execution summary', () => {
    expect(getExecutionSummary({ error: '', duration: 245 })).toBe('Captured successfully');
  });
});
```

- [ ] **Step 2: Run the focused tests and confirm they fail**

Run: `npm test -- --watch=false --include='src/app/components/dashboard/dashboard-view-model.spec.ts' --include='src/app/components/learning-module/learning-workspace-state.spec.ts' --browsers=ChromeHeadless`

Expected: FAIL because the helper files do not exist yet.

- [ ] **Step 3: Implement the pure view-state helpers**

```ts
export function getCommunityStatus(profile: { newsletterOptIn?: boolean } | null): string {
  return profile?.newsletterOptIn ? 'Connected' : 'Private';
}

export function isDeleteConfirmationValid(expectedEmail: string | undefined, typedEmail: string): boolean {
  return Boolean(expectedEmail) && expectedEmail === typedEmail;
}

export function getExecutionSummary(result: { error?: string | null } | null): string {
  if (!result) return 'No execution yet';
  return result.error ? 'Needs debugging' : 'Captured successfully';
}
```

- [ ] **Step 4: Replace inline derived logic in the local components**

```ts
communityStatus(): string {
  return getCommunityStatus(this.authService.userProfile());
}

canDeleteAccount(): boolean {
  return isDeleteConfirmationValid(this.authService.userProfile()?.email, this.deleteEmailConfirm);
}

executionSummary(): string {
  return getExecutionSummary(this.outputResult());
}
```

- [ ] **Step 5: Re-run focused tests, lint, and build**

Run: `npm test -- --watch=false --include='src/app/components/dashboard/dashboard-view-model.spec.ts' --include='src/app/components/learning-module/learning-workspace-state.spec.ts' --browsers=ChromeHeadless && npm run lint && npm run build`

Expected: PASS for the helper tests, then a clean lint/build with the local dashboard and learning studio layouts unchanged.

- [ ] **Step 6: Commit the component-state slice**

```bash
git add src/app/components/dashboard/dashboard-view-model.ts src/app/components/dashboard/dashboard-view-model.spec.ts src/app/components/learning-module/learning-workspace-state.ts src/app/components/learning-module/learning-workspace-state.spec.ts src/app/components/dashboard/dashboard.component.ts src/app/components/learning-module/learning-module.component.ts
git commit -m "refactor: extract local dashboard and workspace state"
```

### Task 5: Final Donor Review and Preview Validation

**Files:**
- Verify: `src/app/components/onboarding/onboarding.component.ts`
- Verify: `src/app/components/profile/profile.component.ts`
- Verify: `src/app/components/forum-list/forum-list.component.ts`
- Verify: `src/app/components/forum-post/forum-post.component.ts`

- [ ] **Step 1: Review remaining donor diffs before touching the last screens**

Run: `git --no-pager diff HEAD..origin/main -- src/app/components/onboarding/onboarding.component.ts src/app/components/profile/profile.component.ts src/app/components/forum-list/forum-list.component.ts src/app/components/forum-post/forum-post.component.ts`

Expected: A short list of remaining logic-only improvements that are worth porting without replacing the local templates.

- [ ] **Step 2: Confirm that no remaining screen still owns duplicated auth/profile logic**

Run: `rg "registrationComplete|newsletterOptIn|currentUser\\(|userProfile\\(" src/app/components/onboarding/onboarding.component.ts src/app/components/profile/profile.component.ts src/app/components/forum-list/forum-list.component.ts src/app/components/forum-post/forum-post.component.ts`

Expected: Any auth/profile-derived branching still left in these files should be obvious. If a remaining file still contains duplicated derived logic, stop and add a new pure helper + spec before editing that screen. If not, leave the screen code unchanged.

- [ ] **Step 3: Run the full project validation sequence**

Run: `npm run lint && npm run build && npm test -- --watch=false --browsers=ChromeHeadless`

Expected: Clean lint/build/test output for the reconciled local-first application.

- [ ] **Step 4: Smoke-test the preview path**

Run: `PORT=4173 npm run serve:ssr:app`

Expected: The app serves locally, the local auth screen still shows the current sanctuary-style design, and protected routes continue to use the local dashboard shell once authenticated.

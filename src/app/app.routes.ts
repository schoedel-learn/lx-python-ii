import { Routes } from '@angular/router';
import { AuthComponent } from './components/auth/auth.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { ProfileComponent } from './components/profile/profile.component';
import { LearningModuleComponent } from './components/learning-module/learning-module.component';
import { SecretsManagerComponent } from './components/secrets-manager/secrets-manager.component';
import { OnboardingComponent } from './components/onboarding/onboarding.component';
import { AdminPortalComponent } from './components/admin-portal/admin-portal.component';
import { ForumListComponent } from './components/forum-list/forum-list.component';
import { ForumPostComponent } from './components/forum-post/forum-post.component';
import { inject } from '@angular/core';
import { AuthService } from './services/auth.service';
import { Router } from '@angular/router';
import { getAuthRedirect } from './auth/auth-policy';

const authGuard = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const user = authService.currentUser();
  const profile = authService.userProfile();
  const redirect = getAuthRedirect(user, profile);

  return redirect === '/dashboard/learn' ? true : router.parseUrl(redirect);
};

const publicGuard = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  if (!authService.currentUser()) {
    return true;
  }
  return router.parseUrl('/dashboard/learn');
};

const onboardingGuard = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const user = authService.currentUser();
  const profile = authService.userProfile();
  const redirect = getAuthRedirect(user, profile);

  return redirect === '/onboarding' ? true : router.parseUrl(redirect);
};

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: AuthComponent, canActivate: [publicGuard] },
  { path: 'onboarding', component: OnboardingComponent, canActivate: [onboardingGuard] },
  { 
    path: 'dashboard', 
    component: DashboardComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'learn', pathMatch: 'full' },
      { path: 'learn', component: LearningModuleComponent },
      { path: 'forum', component: ForumListComponent },
      { path: 'forum/:id', component: ForumPostComponent },
      { path: 'profile', component: ProfileComponent },
      { path: 'secrets', component: SecretsManagerComponent },
      { path: 'admin', component: AdminPortalComponent }
    ]
  },
  { path: '**', redirectTo: 'login' }
];

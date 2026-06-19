import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { AuthComponent } from './auth.component';
import { AuthService } from '../../services/auth.service';

describe('AuthComponent', () => {
  const loginWithGoogle = vi.fn();

  beforeEach(async () => {
    loginWithGoogle.mockReset();

    await TestBed.configureTestingModule({
      imports: [AuthComponent],
      providers: [
        {
          provide: AuthService,
          useValue: {
            authError: signal<string | null>(null),
            loginWithGoogle,
          },
        },
      ],
    }).compileComponents();
  });

  it('renders the redesigned sanctuary sign-in experience', () => {
    const fixture = TestBed.createComponent(AuthComponent);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('LXPython');
    expect(element.textContent).toContain('Learn Python in a calmer, more focused workspace.');
    expect(element.textContent).toContain('Sign in with Google');
  });

  it('starts Google sign-in when the CTA is pressed', () => {
    const fixture = TestBed.createComponent(AuthComponent);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    button.click();

    expect(loginWithGoogle).toHaveBeenCalled();
  });
});

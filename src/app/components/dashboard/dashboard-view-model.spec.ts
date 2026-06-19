import { describe, expect, it } from 'vitest';

import { getCommunityStatus, isDeleteConfirmationValid } from './dashboard-view-model';

describe('dashboard view model', () => {
  it('marks newsletter-enabled learners as connected', () => {
    expect(getCommunityStatus({ newsletterOptIn: true })).toBe('Connected');
  });

  it('marks learners without community updates as private', () => {
    expect(getCommunityStatus({ newsletterOptIn: false })).toBe('Private');
    expect(getCommunityStatus(null)).toBe('Private');
  });

  it('validates delete confirmation against the profile email', () => {
    expect(isDeleteConfirmationValid('learner@example.com', 'learner@example.com')).toBe(true);
    expect(isDeleteConfirmationValid('learner@example.com', 'other@example.com')).toBe(false);
    expect(isDeleteConfirmationValid(undefined, 'learner@example.com')).toBe(false);
  });
});

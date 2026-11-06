import { expect, test, type Page } from '@playwright/test';
import { installMockAuthRuntimeDependencies } from './fixtures/auth';

const caseId = '00000000-0000-4000-8000-000000001086';
const requestId = '00000000-0000-4000-8000-000000001087';
const feedbackListApi = '**/api/accounts/feedback-requests';
const feedbackDetailApi = new RegExp(
  `/api/accounts/cases/${caseId}/feedback-requests/${requestId}(?:/asset)?(?:\\?.*)?$`,
);
const caseDetailsApi = new RegExp(`/api/accounts/cases/${caseId}$`);

function makeCaseAccountResponse() {
  return {
    id: '00000000-0000-4000-8000-000000001088',
    emailAddresses: ['e2e.user@example.com'],
    oids: ['00000000-0000-4000-8000-000000001089'],
    casesAccounts: [
      {
        accountId: caseId,
        caseNumber: 'CN-FEEDBACK-E2E',
        agreedToCaseTerms: true,
        isGuest: false,
        canAccessDocuments: true,
      },
    ],
    accountId: '00000000-0000-0000-0000-000000000000',
    agreedToTerms: true,
    isActive: true,
  };
}

async function installFeedbackRoutes(page: Page) {
  await installMockAuthRuntimeDependencies(page);

  await page.route(feedbackListApi, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: requestId,
          accountId: caseId,
          caseHeadliner: 'E2E Client v. E2E Respondent',
          filename: 'E2E-feedback-recording.mp4',
          status: 'completed',
          createdAt: '2026-09-22T12:00:00.000Z',
          isAccountOwned: true,
        },
      ]),
    }),
  );

  await page.route(caseDetailsApi, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(makeCaseAccountResponse()),
    }),
  );

  await page.route(feedbackDetailApi, (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('asset') === 'markdown') {
      return route.fulfill({
        status: 200,
        contentType: 'text/markdown; charset=utf-8',
        body: '# Video analysis\n\n- [0:00:01–0:00:04] Speaker 1: Hello.\n',
      });
    }
    if (url.searchParams.get('asset') === 'media') {
      return route.fulfill({ status: 404, body: '' });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: requestId,
        accountId: caseId,
        sourceId: '1351',
        identifier: 'Shared%2bDocuments%252fEvidence%252fVideo.mp4',
        type: 'speakerNames',
        status: 'pending',
        markdownPath: 'feedback/analysis.md',
        markdownSourceId: '1360',
      }),
    });
  });
}

test.describe('Feedback Center navigation', () => {
  test('returns from a feedback request to the Feedback Center list', async ({
    page,
  }) => {
    await installFeedbackRoutes(page);

    await page.goto('/feedback');
    const feedbackRow = page.getByRole('listitem').filter({ hasText: 'E2E-feedback-recording.mp4' });
    await expect(feedbackRow.getByText('Speaker name review')).toBeVisible();
    await expect(feedbackRow.getByText('completed', { exact: true })).toBeVisible();
    await expect(feedbackRow).toContainText('Case: E2E Client v. E2E Respondent');
    await expect(feedbackRow).toContainText('File: E2E-feedback-recording.mp4');
    await expect(feedbackRow.getByRole('button', { name: /options/i })).toHaveCount(0);
    const feedbackRequestLink = feedbackRow.getByRole('link', { name: 'View' });
    await expect(feedbackRequestLink).toHaveAttribute(
      'href',
      `/cases/${caseId}/feedback/${requestId}`,
    );

    await feedbackRequestLink.click();
    await expect(page).toHaveURL(`/cases/${caseId}/feedback/${requestId}`);

    const backLink = page.getByRole('link', {
      name: 'Back to Feedback Center',
    });
    await expect(backLink).toHaveAttribute('href', '/feedback');
    await backLink.click();

    await expect(page).toHaveURL('/feedback');
    await expect(feedbackRequestLink).toBeVisible();
  });

  test('shows shared feedback requests without a View action or menu', async ({ page }) => {
    await installFeedbackRoutes(page);
    await page.route(feedbackListApi, (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{
        id: requestId,
        accountId: caseId,
        caseHeadliner: 'Shared Client v. Respondent',
        filename: 'shared-recording.mp4',
        status: 'pending',
        createdAt: '2026-09-22T12:00:00.000Z',
        isAccountOwned: false,
      }]),
    }));

    await page.goto('/feedback');
    const feedbackRow = page.getByRole('listitem').filter({ hasText: 'shared-recording.mp4' });
    await expect(feedbackRow.getByText('pending', { exact: true })).toBeVisible();
    await expect(feedbackRow).toContainText('Unavailable: you do not own this case.');
    await expect(feedbackRow.getByRole('link', { name: 'View' })).toHaveCount(0);
    await expect(feedbackRow.getByRole('button', { name: /options/i })).toHaveCount(0);
  });

  test('filters feedback requests by case, filename, and status', async ({ page }) => {
    await installFeedbackRoutes(page);
    await page.route(feedbackListApi, (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: requestId,
          accountId: caseId,
          caseHeadliner: 'E2E Client v. E2E Respondent',
          filename: 'completed-recording.mp4',
          status: 'completed',
          isAccountOwned: true,
        },
        {
          id: '00000000-0000-4000-8000-000000001090',
          accountId: caseId,
          caseHeadliner: 'Shared Client v. Respondent',
          filename: 'pending-recording.mp4',
          status: 'pending',
          isAccountOwned: false,
        },
      ]),
    }));

    await page.goto('/feedback');
    const filters = page.getByRole('search', { name: 'Feedback request filters' });
    await filters.getByRole('searchbox', { name: 'Search feedback requests' }).fill('PENDING-RECORDING');
    await expect(page.getByText('File: pending-recording.mp4')).toBeVisible();
    await expect(page.getByText('File: completed-recording.mp4')).toHaveCount(0);
    await expect(page.getByText('Showing 1 of 2 feedback requests')).toBeVisible();

    await filters.getByRole('combobox', { name: 'Status' }).selectOption('completed');
    await expect(page.getByText('No matching feedback requests.')).toBeVisible();

    await filters.getByRole('button', { name: 'Clear filters' }).click();
    await expect(page.getByText('File: pending-recording.mp4')).toBeVisible();
    await expect(page.getByText('File: completed-recording.mp4')).toBeVisible();
    await filters.getByRole('searchbox', { name: 'Search feedback requests' }).fill('e2e client');
    await expect(page.getByText('File: completed-recording.mp4')).toBeVisible();
    await expect(page.getByText('File: pending-recording.mp4')).toHaveCount(0);
  });

  test('identifies a removed feedback request', async ({ page }) => {
    await installFeedbackRoutes(page);
    await page.route(feedbackDetailApi, (route) =>
      route.fulfill({ status: 404, body: '' }),
    );

    await page.goto(`/cases/${caseId}/feedback/${requestId}`);

    await expect(
      page.getByText('This feedback request is missing or has been removed.'),
    ).toBeVisible();
    await expect(
      page.getByText('Unable to load this feedback request.'),
    ).toHaveCount(0);
  });

  test('opens the feedback prompt immediately for a real-time alert', async ({
    page,
  }) => {
    await installFeedbackRoutes(page);
    let feedbackAlertWasRead = false;
    await page.route(
      `**/api/accounts/notifications/feedback-alert?notificationType=ALERT`,
      (route) => {
        feedbackAlertWasRead = route.request().method() === 'PUT';
        return route.fulfill({ status: 200, body: '' });
      },
    );

    await page.goto('/');
    await expect(
      page.getByRole('link', { name: 'Feedback Center' }),
    ).toBeVisible();
    // Event handlers are attached in a client-side effect after the shell mounts.
    await page.waitForTimeout(100);
    await page.evaluate(
      ({ accountId, feedbackRequestId }) => {
        window.dispatchEvent(
          new CustomEvent('notify:new', {
            detail: {
              id: 'feedback-alert',
              notificationType: 'ALERT',
              createdAt: new Date(),
              oid: 'e2e-user-oid',
              notice: {
                id: 'feedback-alert',
                oid: 'e2e-user-oid',
                notificationType: 'ALERT',
                createdAt: new Date().toISOString(),
                data: {
                  accountId,
                  sourceId: '1351',
                  clientFeedbackRequestId: feedbackRequestId,
                  markdownPath: 'feedback/analysis.md',
                  status: 'FEEDBACK_REQUIRED',
                },
              },
            },
          }),
        );
      },
      { accountId: caseId, feedbackRequestId: requestId },
    );

    await expect(
      page.getByRole('heading', { name: 'Provide speaker-name feedback?' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Open Feedback Center' }).click();

    await expect.poll(() => feedbackAlertWasRead).toBe(true);
    await expect(page).toHaveURL(`/cases/${caseId}/feedback/${requestId}`);
  });

  test('opens the feedback prompt after login for a recent pending request', async ({
    page,
  }) => {
    await installFeedbackRoutes(page);
    let feedbackListRequests = 0;
    await page.route(feedbackListApi, (route) => {
      feedbackListRequests += 1;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: requestId,
            accountId: caseId,
            caseHeadliner: 'E2E Client v. E2E Respondent',
            filename: 'E2E-feedback-recording.mp4',
            status: 'pending',
            createdAt: new Date().toISOString(),
            isAccountOwned: true,
          },
        ]),
      });
    });

    await page.goto('/');
    await expect.poll(() => feedbackListRequests).toBeGreaterThan(0);
    await expect(
      page.getByRole('heading', { name: 'Provide speaker-name feedback?' }),
    ).toBeVisible();
  });

  test('uses one global prompt when an alert arrives on Notifications', async ({
    page,
  }) => {
    await installFeedbackRoutes(page);
    const alert = {
      id: 'notification-page-feedback-alert',
      oid: 'e2e-user-oid',
      notificationType: 'ALERT',
      createdAt: new Date().toISOString(),
      read: false,
      deleted: false,
      data: {
        accountId: caseId,
        sourceId: '1351',
        clientFeedbackRequestId: requestId,
        markdownPath: 'feedback/analysis.md',
        status: 'FEEDBACK_REQUIRED',
      },
    };
    await page.route('**/api/accounts/notifications', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [alert] }),
      }),
    );

    await page.goto('/notifications');
    const prompt = page.getByRole('heading', {
      name: 'Provide speaker-name feedback?',
    });
    await expect(prompt).toHaveCount(0);
    await page.waitForTimeout(100);
    await page.evaluate((notice) => {
      window.dispatchEvent(
        new CustomEvent('notify:new', {
          detail: {
            id: notice.id,
            notificationType: notice.notificationType,
            createdAt: new Date(),
            oid: notice.oid,
            notice,
          },
        }),
      );
    }, alert);

    await expect(prompt).toHaveCount(1);
  });
});

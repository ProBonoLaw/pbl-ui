import { expect, test } from '@playwright/test';

test.describe('Home marketing sections', () => {
  test('renders Highlights section with four highlight bars', async ({
    page,
  }) => {
    await page.goto('/');

    const section = page
      .locator('section', {
        has: page.getByRole('heading', {
          name: 'Highlights of Using ProBono-Law',
          exact: true,
        }),
      })
      .first();

    await expect(
      section.getByRole('heading', {
        name: 'Highlights of Using ProBono-Law',
        exact: true,
      }),
    ).toBeVisible();
    const highlightTexts = [
      /Our AI answers questions, with sources/i,
      /find contradictions, unsubstantiated claims/i,
      /advocates for your client/i,
      /withstand scrutiny by opposing parties/i,
    ];
    await expect(highlightTexts).toHaveLength(4);
    for (const highlightText of highlightTexts) {
      await expect(section.getByText(highlightText)).toBeVisible();
    }
  });

  test('renders WhatsDifferent comparison section', async ({ page }) => {
    await page.goto('/');

    const section = page
      .locator('section', {
        has: page.getByRole('heading', {
          name: 'What makes an AI Dossier Analyst different?',
          exact: true,
        }),
      })
      .first();

    await expect(
      section.getByRole('heading', {
        name: 'What makes an AI Dossier Analyst different?',
        exact: true,
      }),
    ).toBeVisible();

    await expect(
      section.getByRole('heading', {
        name: 'Case Management System',
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      section.getByRole('heading', {
        name: 'Document Intelligence',
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      section.getByRole('heading', {
        name: 'AI Legal Research Tools',
        exact: true,
      }),
    ).toBeVisible();

    await expect(section.getByText(/does what.*CMS,/i)).toBeVisible();
    await expect(section.locator('article')).toHaveCount(3);
  });

  test('renders Privacy and security policies section with public links', async ({
    page,
  }) => {
    await page.goto('/');

    const section = page
      .locator('section', {
        has: page.getByRole('heading', {
          name: 'Privacy and security policies',
          exact: true,
        }),
      })
      .first();

    await expect(
      section.getByRole('heading', {
        name: 'Privacy and security policies',
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      section.getByText(/independent security\s+attestations/i),
    ).toBeVisible();

    await expect(
      section.getByRole('link', { name: /Open privacy page/i }),
    ).toHaveAttribute('href', '/privacy');
    await expect(
      section.getByRole('link', { name: /Request report/i }),
    ).toHaveAttribute('href', `mailto:${process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'support@example.test'}?subject=SOC%202%20Type%202%20report%20request`);
  });

  test('renders HowItWorks section with shared screenshot', async ({
    page,
  }) => {
    await page.goto('/');

    const section = page
      .locator('section', {
        has: page.getByRole('heading', {
          name: 'How an AI Dossier Analyst works',
          exact: true,
        }),
      })
      .first();

    await expect(
      section.getByRole('heading', {
        name: 'How an AI Dossier Analyst works',
        exact: true,
      }),
    ).toBeVisible();

    await expect(
      section.getByAltText('ProBono-Law case workspace displaying fictional example cases'),
    ).toBeVisible();

    await expect(
      section.getByText(/Upload all records you want analyzed once\./i),
    ).toBeVisible();
    await expect(
      section.getByText(/maps the data for future reference\./i),
    ).toBeVisible();
    await expect(
      section.getByText(
        /Ask questions, formulate arguments, draft declarations\./i,
      ),
    ).toBeVisible();
  });

  test('renders FAQ section with a GitHub project link', async ({
    page,
  }) => {
    await page.goto('/');

    const section = page
      .locator('section', {
        has: page.getByRole('heading', { name: 'FAQ', exact: true }),
      })
      .first();

    await expect(
      section.getByRole('heading', { name: 'FAQ', exact: true }),
    ).toBeVisible();
    await expect(
      section.getByText('Is my data safe and kept private?', { exact: true }),
    ).toBeVisible();
    await expect(
      section.getByText(
        'Does ProBono-Law use my data to train its AI models?',
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      section.getByText(
        /ProBono-Law does not use client data to train AI models\./,
      ),
    ).toBeVisible();

    const askLink = section.getByRole('link', {
      name: 'Explore ProBonoLaw on GitHub',
    });
    await expect(askLink).toBeVisible();

    await expect(askLink).toHaveAttribute('href', 'https://github.com/ProBonoLaw');
  });

  test('renders ContactUs section with beta CTA and newsletter signup form', async ({
    page,
  }) => {
    const betaTesterSignups: Array<{
      firstName?: string;
      lastName?: string;
      email?: string;
      consent?: boolean;
    }> = [];
    await page.route('**/api/beta-tester', async (route) => {
      const payload = route.request().postDataJSON() as {
        firstName?: string;
        lastName?: string;
        email?: string;
        consent?: boolean;
      };
      betaTesterSignups.push(payload);
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });

    const newsletterSignups: Array<{
      firstName?: string;
      lastName?: string;
      email?: string;
      consent?: boolean;
    }> = [];
    await page.route('**/api/newsletter', async (route) => {
      const payload = route.request().postDataJSON() as {
        firstName?: string;
        lastName?: string;
        email?: string;
        consent?: boolean;
      };
      newsletterSignups.push(payload);
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.goto('/');

    const section = page
      .locator('section', {
        has: page.getByRole('heading', { name: 'Connect with ProBonoLaw', exact: true }),
      })
      .first();

    await expect(
      section.getByRole('heading', { name: 'Connect with ProBonoLaw', exact: true }),
    ).toBeVisible();
    await expect(
      section.getByText('Full product release by Fall of 2026!', {
        exact: true,
      }),
    ).toBeVisible();

    const betaButton = section.getByRole('button', {
      name: 'Click here to be a Beta Tester',
    });
    await expect(betaButton).toBeVisible();
    await betaButton.click();

    const betaDialog = page.getByRole('dialog', { name: 'Beta Tester Sign Up' });
    await expect(betaDialog).toBeVisible();

    const betaSubmitButton = betaDialog.getByRole('button', { name: 'Submit' });
    await expect(betaSubmitButton).toBeDisabled();

    await betaDialog.getByLabel('First Name').fill('Alex');
    await betaDialog.getByLabel('Last Name').fill('Taylor');
    await betaDialog.getByLabel('Email Address').fill('alex.taylor@example.com');

    const betaConsentCheckbox = betaDialog.getByRole('checkbox', {
      name: /By selecting this checkmark, you are signing up to be a Pro Bono Law beta tester./i,
    });
    await betaConsentCheckbox.check();
    await expect(betaSubmitButton).toBeEnabled();

    await betaSubmitButton.click();
    await expect.poll(() => betaTesterSignups.length).toBe(1);
    expect(betaTesterSignups[0]).toEqual({
      firstName: 'Alex',
      lastName: 'Taylor',
      email: 'alex.taylor@example.com',
      consent: true,
    });
    await expect(
      section.getByText('Thanks, you are signed up to be a beta tester.', {
        exact: true,
      }),
    ).toBeVisible();

    const newsletterButton = section.getByRole('button', {
      name: 'Sign up for newsletter',
    });
    await expect(newsletterButton).toBeVisible();
    await newsletterButton.click();

    const dialog = page.getByRole('dialog', { name: 'Newsletter Sign Up' });
    await expect(dialog).toBeVisible();

    const submitButton = dialog.getByRole('button', { name: 'Submit' });
    await expect(submitButton).toBeDisabled();

    await dialog.getByLabel('First Name').fill('Jane');
    await dialog.getByLabel('Last Name').fill('Doe');
    await dialog.getByLabel('Email Address').fill('jane.doe@example.com');

    const consentCheckbox = dialog.getByRole('checkbox', {
      name: /By selecting this checkmark/i,
    });
    await consentCheckbox.check();
    await expect(submitButton).toBeEnabled();

    await submitButton.click();
    await expect.poll(() => newsletterSignups.length).toBe(1);
    expect(newsletterSignups[0]).toEqual({
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane.doe@example.com',
      consent: true,
    });
    await expect(
      section.getByText('Thanks, you are signed up for our newsletter.', {
        exact: true,
      }),
    ).toBeVisible();

    await expect(
      section.getByRole('link', { name: 'Visit ProBonoLaw on GitHub', exact: true }),
    ).toHaveAttribute('href', 'https://github.com/ProBonoLaw');
  });
});

import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Vercel Analytics only exists on Vercel. Serve an empty script so it can't log errors,
// then fail any test that logs a console error or a CSP violation.
async function watchErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];
  await page.route('**/_vercel/insights/**', (r) => r.fulfill({ contentType: 'text/javascript', body: '' }));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) =>
      console.error(`CSP violation: ${e.violatedDirective} ${e.blockedURI}`),
    );
  });
  return errors;
}

const title = (page: Page) => page.locator('#title');
const isTouch = (name: string) => name === 'mobile';

test.describe('first visit title card', () => {
  test('shows once, Start opens the game and the hero walks', async ({ page }, info) => {
    const errors = await watchErrors(page);
    await page.goto('/');
    await expect(title(page)).toBeVisible();
    await expect(page.locator('#title-name')).toHaveText('Jayvee Celestial');
    await expect(page.locator('#tutorial')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Press Start' })).toBeFocused();

    // Controls text matches the device.
    const touchText = title(page).locator('[data-tutorial-touch]');
    const keysText = title(page).locator('[data-tutorial-keys]');
    if (isTouch(info.project.name)) {
      await expect(touchText).toBeVisible();
      await expect(keysText).toBeHidden();
    } else {
      await expect(keysText).toBeVisible();
    }

    await page.keyboard.press('Enter');
    await expect(title(page)).toBeHidden();

    if (!isTouch(info.project.name)) {
      // Walk right until the next object is announced, then open whatever the hero stands at.
      await page.keyboard.down('ArrowRight');
      await expect(page.locator('#live')).toContainText('Press E to open', { timeout: 5000 });
      await page.keyboard.up('ArrowRight');
      await page.keyboard.press('e');
      await expect(page.locator('#panel')).toBeVisible();
      await expect(page.locator('#panel .sec')).toBeVisible();
    } else {
      await page.locator('[data-station="work"]').click();
      await expect(page.locator('#panel #work')).toBeVisible();
    }

    // Second visit: no title card, no tutorial.
    await page.goto('/');
    await expect(page.locator('#stage')).toBeVisible();
    await expect(title(page)).toBeHidden();
    await expect(page.locator('#tutorial')).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('Esc closes it', async ({ page }) => {
    await page.goto('/');
    await expect(title(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(title(page)).toBeHidden();
  });

  test('Just the CV opens the plain view and remembers it', async ({ page }) => {
    await page.goto('/');
    await title(page).getByRole('link', { name: 'Just the CV' }).click();
    await expect(page).toHaveURL(/view=plain/);
    await expect(page.locator('html')).not.toHaveClass(/game/);
    await page.goto('/');
    await expect(page.locator('html')).not.toHaveClass(/game/);
    await expect(page.locator('#about')).toBeVisible();
  });

  test('deep links skip it and open the station', async ({ page }) => {
    await page.goto('/#certs');
    await expect(title(page)).toBeHidden();
    await expect(page.locator('#panel #certs')).toBeVisible();
  });

  test('?view=play skips it', async ({ page }) => {
    await page.goto('/?view=play');
    await expect(page.locator('#stage')).toBeVisible();
    await expect(title(page)).toBeHidden();
  });
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('title card still works and stations open', async ({ page }) => {
    const errors = await watchErrors(page);
    await page.goto('/');
    await expect(title(page)).toBeVisible();
    // No game loop under reduced motion, so the card shows the pointer instructions.
    await expect(title(page).locator('[data-tutorial-touch]')).toBeVisible();
    await page.getByRole('button', { name: 'Press Start' }).click();
    await expect(title(page)).toBeHidden();
    await page.locator('[data-station="contact"]').click();
    await expect(page.locator('#panel #contact')).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe('plain view and other pages', () => {
  test('plain view shows every section with no console errors', async ({ page }) => {
    const errors = await watchErrors(page);
    await page.goto('/?view=plain');
    for (const id of ['about', 'work', 'certs', 'tools', 'off-duty', 'contact']) {
      await expect(page.locator(`#${id}`)).toBeVisible();
    }
    await expect(page.getByRole('heading', { level: 1, name: 'Jayvee Celestial' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('unknown pages get the 404 page', async ({ page }) => {
    const res = await page.goto('/no-such-page');
    expect(res?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'Nothing here.' })).toBeVisible();
  });
});

// Accessibility: fail on serious or critical axe findings. Chromium only, since the
// rules don't depend on the engine and it keeps CI fast.
test.describe('accessibility', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'axe runs once, in Chromium');

  for (const [name, url] of [
    ['plain view', '/?view=plain'],
    ['title card', '/'],
    ['game', '/?view=play'],
    ['404 page', '/no-such-page'],
  ] as const) {
    test(`no serious axe findings: ${name}`, async ({ page }) => {
      await watchErrors(page);
      await page.goto(url);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
      const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(bad.map((v) => `${v.id}: ${v.nodes.length} node(s), e.g. ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
    });
  }
});

// Layout shift: the game view used to paint as the plain CV first, then jump (CLS 0.3 to 0.6
// in Lighthouse). Chromium only, since it is the browser with the Layout Instability API.
test.describe('layout stability', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'layout-shift entries are Chromium only');

  for (const url of ['/?view=play', '/?view=plain']) {
    test(`no big layout shift on load: ${url}`, async ({ page }) => {
      await watchErrors(page);
      await page.addInitScript(() => {
        (window as unknown as { cls: number }).cls = 0;
        new PerformanceObserver((list) => {
          for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) {
            if (!e.hadRecentInput) (window as unknown as { cls: number }).cls += e.value;
          }
        }).observe({ type: 'layout-shift', buffered: true });
      });
      await page.goto(url);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(1000);
      const cls = await page.evaluate(() => (window as unknown as { cls: number }).cls);
      expect(cls).toBeLessThan(0.1);
    });
  }
});

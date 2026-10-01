import { test, expect } from '@grafana/plugin-e2e';

// Runs against `npm run server`, which provisions the demo dashboards and the
// TestData source (provisioning/).

test('draws the diagram and colours it from the data', async ({ gotoDashboardPage, page }) => {
  await gotoDashboardPage({ uid: 'diagramium-microservices' });
  const stage = page.getByTestId('diagramium-stage');
  await expect(stage.getByText('Payments')).toBeVisible();
  // Payments ends at 96% (red), Orders at 78% (orange); Mobile app and Stripe have no data.
  const legend = page.getByTestId('diagramium-legend');
  await expect(legend).toContainText('1 Critical');
  await expect(legend).toContainText('1 Warning');
  await expect(legend).toContainText('8 OK');
  await expect(stage.getByText('96%')).toBeVisible();
});

test('a table keyed by a column matches its rows', async ({ gotoDashboardPage, page }) => {
  await gotoDashboardPage({ uid: 'diagramium-hardware-rack' });
  const legend = page.getByTestId('diagramium-legend');
  await expect(legend).toContainText('1 Critical'); // srv-a04, 83 °C
  await expect(legend).toContainText('1 Warning'); // srv-a03, 77 °C
  await expect(page.getByTestId('diagramium-stage').getByText('83 °C')).toBeVisible();
});

test('a mapped shape without data says so', async ({ gotoDashboardPage, page }) => {
  await gotoDashboardPage({ uid: 'diagramium-production' });
  await expect(page.getByTestId('diagramium-stage').getByText('No data')).toBeVisible();
});

test('clicking a shape drills down with its matched name', async ({ gotoDashboardPage, page }) => {
  await gotoDashboardPage({ uid: 'diagramium-microservices' });
  await page.getByTestId('diagramium-stage').getByText('Payments').click();
  await expect(page).toHaveURL(/\/d\/diagramium-drill-down\/.*var-target=payments/);
});

test('a panel without a diagram explains how to add one', async ({ gotoDashboardPage, page }) => {
  // Opened from a provisioned dashboard rather than through the visualization
  // picker, whose markup changes between Grafana versions.
  await gotoDashboardPage({ uid: 'diagramium-start' });
  await expect(page.getByText('No diagram yet.')).toBeVisible();
});

test('the platform map drills into a service, and into Checkout', async ({ gotoDashboardPage, page }) => {
  await gotoDashboardPage({ uid: 'diagramium-platform' });
  const stage = page.getByTestId('diagramium-stage');
  await stage.getByText('Catalog', { exact: true }).click();
  await expect(page).toHaveURL(/\/d\/diagramium-service\/.*var-service=catalog/);
  await page.goBack();
  await page.getByTestId('diagramium-stage').getByText('Checkout', { exact: true }).click();
  await expect(page).toHaveURL(/\/d\/diagramium-checkout\//);
  await expect(page.getByTestId('diagramium-stage').getByText('Charge card')).toBeVisible();
});

test('a value mapping becomes the badge', async ({ gotoDashboardPage, page }) => {
  await gotoDashboardPage({ uid: 'diagramium-kubernetes' });
  await expect(page.getByTestId('diagramium-stage').getByText('Ready', { exact: true }).first()).toBeVisible();
});

test('blue series are information, counted apart from verdicts', async ({ gotoDashboardPage, page }) => {
  await gotoDashboardPage({ uid: 'diagramium-data-pipeline' });
  await expect(page.getByTestId('diagramium-legend')).toContainText('4 Info');
});

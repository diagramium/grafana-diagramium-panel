// Writes the demo dashboards in provisioning/dashboards/ from examples/*.json.
//
//   npm run demo:dashboards
//
// Each dashboard embeds one example diagram and feeds it from Grafana's
// built-in TestData source, so `npm run server` shows the panel working with
// no monitoring stack at all. They use different data shapes on purpose —
// series named by alias, series labelled with instance / service /
// deployment / consumer_group, tables keyed by a column, value mappings,
// informational (blue) series beside verdicts — because "match anything" is
// the claim the demo has to prove. Three of them drill into each other:
// platform map -> service dashboard, and Checkout -> its own internal flow.
import { readFileSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs';

const DIR = new URL('../provisioning/dashboards/', import.meta.url);
const EX = new URL('../examples/', import.meta.url);
const DS = { type: 'grafana-testdata-datasource', uid: 'trlxrdZVk' };
const DRILL = '/d/diagramium-drill-down/drill-down?var-target=${__node.match}&${__url_time_range}';

const diagram = (f) => JSON.stringify(JSON.parse(readFileSync(new URL(f, EX), 'utf8')));
const csvSeries = (refId, alias, values) => ({
  refId,
  datasource: DS,
  scenarioId: 'csv_metric_values',
  stringInput: values,
  alias,
});
// A repeating wave: live data that cycles through known values, so the demo
// shows every state within a minute instead of wherever a random walk drifts.
const wave = (refId, instance, values, timeStep = 10) => ({
  refId,
  datasource: DS,
  scenarioId: 'predictable_csv_wave',
  csvWave: [{ timeStep, valuesCSV: values, labels: `instance=${instance}`, name: '' }],
});
// Many labelled series in ONE query: { 'checkout': '420,610,880', ... }.
const waves = (refId, name, label, series, timeStep = 10) => ({
  refId,
  datasource: DS,
  scenarioId: 'predictable_csv_wave',
  csvWave: Object.entries(series).map(([key, values]) => ({
    timeStep,
    valuesCSV: values,
    labels: `${label}=${key}`,
    name,
  })),
});
const table = (refId, csvContent) => ({ refId, datasource: DS, scenarioId: 'csv_content', csvContent });
const steps = (warn, crit) => ({
  mode: 'absolute',
  steps: [
    { color: 'green', value: null },
    { color: 'orange', value: warn },
    { color: 'red', value: crit },
  ],
});
const override = (name, props) => ({ matcher: { id: 'byName', options: name }, properties: props });
const byQuery = (refId, props) => ({ matcher: { id: 'byFrameRefID', options: refId }, properties: props });
const blue = { id: 'color', value: { mode: 'fixed', fixedColor: 'blue' } };
const upDown = (up, down) => ({
  id: 'mappings',
  value: [
    {
      type: 'value',
      options: { 0: { text: down, color: 'red', index: 0 }, 1: { text: up, color: 'green', index: 1 } },
    },
  ],
});
const demoLinks = [
  {
    title: 'Demo dashboards',
    type: 'dashboards',
    tags: ['diagramium'],
    asDropdown: true,
    includeVars: false,
    keepTime: true,
  },
];

function dashboard({
  uid,
  title,
  description,
  file,
  targets,
  fieldConfig,
  options = {},
  refresh = '',
  pos = { h: 22, w: 24, x: 0, y: 0 },
  panels = [],
  links = [],
  templating = [],
}) {
  return {
    uid,
    title,
    description,
    tags: ['diagramium', 'demo'],
    editable: true,
    schemaVersion: 39,
    time: { from: 'now-1h', to: 'now' },
    refresh,
    templating: { list: templating },
    annotations: { list: [] },
    links: [...links, ...demoLinks],
    panels: [
      {
        id: 1,
        type: 'diagramium-diagram-panel',
        title,
        description,
        gridPos: pos,
        datasource: DS,
        targets,
        fieldConfig: {
          defaults: { color: { mode: 'thresholds' }, ...fieldConfig.defaults },
          overrides: fieldConfig.overrides ?? [],
        },
        options: {
          source: 'inline',
          diagram: diagram(file),
          url: '',
          matchLabel: '',
          nodes: {},
          reducer: 'lastNotNull',
          colorMode: 'border',
          badge: 'value',
          edges: 'target',
          unmatched: 'keep',
          defaultLink: DRILL,
          newTab: false,
          theme: 'auto',
          themeBackground: false,
          fontScale: 1,
          showLegend: true,
          showTour: true,
          stepSeconds: 4,
          ...options,
        },
      },
      ...panels,
    ],
  };
}

// Small helpers for the detail dashboards' ordinary panels.
let pid = 100;
const stat = (title, target, unit, thresholds, pos, extra = {}) => ({
  id: pid++,
  type: 'stat',
  title,
  gridPos: pos,
  datasource: DS,
  targets: [target],
  fieldConfig: { defaults: { unit, color: { mode: 'thresholds' }, thresholds, ...extra }, overrides: [] },
  options: { reduceOptions: { calcs: ['lastNotNull'] }, colorMode: 'background', graphMode: 'area', textMode: 'value' },
});
const series = (title, target, unit, pos) => ({
  id: pid++,
  type: 'timeseries',
  title,
  gridPos: pos,
  datasource: DS,
  targets: [target],
  fieldConfig: { defaults: { unit }, overrides: [] },
});
const text = (content, pos) => ({
  id: pid++,
  type: 'text',
  title: '',
  gridPos: pos,
  options: { mode: 'markdown', content },
});
const walk = (refId, alias, startValue, spread, min = 0, max) => ({
  refId,
  datasource: DS,
  scenarioId: 'random_walk',
  seriesCount: 1,
  alias,
  startValue,
  spread,
  min,
  ...(max !== undefined ? { max } : {}),
  seed: refId.charCodeAt(0) + startValue,
});

const boards = {
  'microservices.json': dashboard({
    uid: 'diagramium-microservices',
    title: 'Online store — microservices',
    description: 'Series named after services (query alias). No mapping at all: shapes match by their labels.',
    file: 'microservices.json',
    targets: [
      csvSeries('A', 'web-shop', '18,20,22,19,21'),
      csvSeries('B', 'api-gateway', '35,38,41,44,41'),
      csvSeries('C', 'auth', '12,15,14,16,18'),
      csvSeries('D', 'catalog', '30,33,31,36,35'),
      csvSeries('E', 'orders', '52,60,66,71,78'),
      csvSeries('F', 'payments', '48,70,88,94,96'),
      csvSeries('G', 'redis', '10,11,12,12,12'),
      csvSeries('H', 'orders-db', '55,58,60,62,64'),
      csvSeries('I', 'kafka', '22,25,28,30,30'),
      csvSeries('J', 'shipping', '20,21,24,26,25'),
    ],
    fieldConfig: { defaults: { unit: 'percent', thresholds: steps(70, 90) } },
  }),
  'production-deployment.json': dashboard({
    uid: 'diagramium-production',
    title: 'Production deployment',
    description:
      'Live series labelled instance="host:9100", like node_exporter, cycling every 10 s. backup-nas is mapped but has no data, so it says so.',
    file: 'production-deployment.json',
    refresh: '5s',
    targets: [
      wave('A', 'fw-edge:9100', '18,22,25,21'),
      wave('B', 'lb-1:9100', '30,34,41,38,33'),
      wave('C', 'web-1:9100', '44,52,61,58,49'),
      wave('D', 'web-2:9100', '48,57,66,74,63,55'),
      wave('E', 'web-3:9100', '62,78,93,97,84,70'),
      wave('F', 'app-1:9100', '51,58,63,60'),
      wave('G', 'app-2:9100', '38,44,40,36'),
      wave('H', 'db-primary:9100', '66,72,79,75,69'),
      wave('I', 'db-replica:9100', '25,28,31,27'),
    ],
    fieldConfig: { defaults: { unit: 'percent', displayName: 'CPU', thresholds: steps(70, 90) } },
    options: { nodes: { nas: { match: 'backup-nas' } } },
  }),
  'hardware-rack.json': dashboard({
    uid: 'diagramium-hardware-rack',
    title: 'Server room — rack A',
    description:
      'One table (SQL / CSV style), keyed by its "device" column. Each device shows its worst of temperature and power.',
    file: 'hardware-rack.json',
    targets: [
      table(
        'A',
        [
          'device,temp_c,power_w',
          'core-rtr-1,41,180',
          'fw-1,44,120',
          'tor-sw-a,47,150',
          'tor-sw-b,49,152',
          'srv-a01,52,310',
          'srv-a02,58,340',
          'srv-a03,77,388',
          'srv-a04,83,455',
          'nas-a1,39,95',
        ].join('\n')
      ),
    ],
    fieldConfig: {
      defaults: { unit: 'celsius', thresholds: steps(65, 80) },
      overrides: [
        override('temp_c', [{ id: 'displayName', value: 'Temperature' }]),
        override('power_w', [
          { id: 'displayName', value: 'Power' },
          { id: 'unit', value: 'watt' },
          { id: 'thresholds', value: steps(400, 500) },
        ]),
      ],
    },
    options: { matchLabel: 'device', colorMode: 'fill' },
  }),
  'docker-host.json': dashboard({
    uid: 'diagramium-docker-host',
    title: 'Docker host — docker-host-1',
    description:
      'A per-container table (CPU, memory, restarts — cAdvisor style) plus a host series. Restarts has its own thresholds.',
    file: 'docker-host.json',
    targets: [
      table(
        'A',
        [
          'container,cpu,mem,restarts',
          'nginx,4,12,0',
          'api,63,71,0',
          'worker,38,55,3',
          'redis,9,22,0',
          'postgres,27,93,0',
          'prometheus,15,40,0',
        ].join('\n')
      ),
      csvSeries('B', 'docker-host-1', '40,44,47,51,55'),
    ],
    fieldConfig: {
      defaults: { unit: 'percent', thresholds: steps(70, 90) },
      overrides: [
        override('cpu', [{ id: 'displayName', value: 'CPU' }]),
        override('mem', [{ id: 'displayName', value: 'Memory' }]),
        override('restarts', [
          { id: 'displayName', value: 'Restarts' },
          { id: 'unit', value: 'none' },
          { id: 'thresholds', value: steps(1, 5) },
        ]),
      ],
    },
    options: { theme: 'glassmorphism', themeBackground: true },
  }),

  // ---- the flagship: a whole product, three metric families plus an
  // informational one, drilling down to a service dashboard (any service)
  // and, for Checkout, to its own internal flow.
  'ecommerce-platform.json': dashboard({
    uid: 'diagramium-platform',
    title: 'Online store — the whole platform',
    description:
      'Error rate, p95 latency and saturation per service (label service=…), plus requests/s in blue as information. Click any service for its dashboard; click Checkout for its internal flow.',
    file: 'ecommerce-platform.json',
    refresh: '5s',
    targets: [
      waves('A', 'Error rate', 'service', {
        cdn: '0.1,0.1,0.2,0.1,0.1,0.1',
        'load-balancer': '0.1,0.2,0.1,0.1,0.2,0.1',
        storefront: '0.3,0.4,0.3,0.5,0.4,0.3',
        'api-gateway': '0.4,0.5,0.6,0.7,0.5,0.4',
        identity: '0.2,0.2,0.3,0.2,0.2,0.2',
        catalog: '0.3,0.2,0.4,0.3,0.3,0.2',
        search: '0.5,0.6,0.9,0.8,0.6,0.5',
        cart: '0.2,0.3,0.2,0.3,0.2,0.2',
        checkout: '0.6,0.9,1.4,1.8,1.1,0.7',
        inventory: '0.2,0.3,0.4,0.3,0.2,0.2',
        payments: '0.4,1.8,3.2,6.4,2.6,0.9',
        fulfilment: '0.1,0.1,0.2,0.1,0.1,0.1',
        notifications: '0.3,0.2,0.3,0.2,0.4,0.3',
      }),
      waves('B', 'p95 latency', 'service', {
        cdn: '18,21,19,22,20,18',
        'load-balancer': '4,5,4,6,5,4',
        storefront: '120,140,150,130,125,120',
        'api-gateway': '35,40,52,61,44,38',
        identity: '45,48,52,50,47,46',
        catalog: '80,85,92,88,84,80',
        search: '160,190,240,260,210,170',
        cart: '30,32,35,33,31,30',
        checkout: '420,610,880,940,700,520',
        inventory: '60,70,85,90,72,64',
        payments: '310,520,760,980,640,380',
        stripe: '280,480,690,920,600,350',
      }),
      waves('C', 'Saturation', 'service', {
        'users-db': '31,33,35,34,32,31',
        'catalog-db': '44,46,49,52,48,45',
        'search-index': '66,72,79,82,74,68',
        'session-cache': '22,24,25,23,22,21',
        'orders-db': '48,55,63,68,60,52',
        'event-bus': '35,38,44,41,37,35',
      }),
      waves('D', 'Requests/s', 'service', {
        storefront: '820,860,910,880,840,830',
        'api-gateway': '1450,1520,1610,1580,1500,1470',
        checkout: '42,45,51,48,44,43',
      }),
    ],
    fieldConfig: {
      defaults: { unit: 'percent', decimals: 1, thresholds: steps(1, 5) },
      overrides: [
        byQuery('B', [
          { id: 'unit', value: 'ms' },
          { id: 'decimals', value: 0 },
          { id: 'thresholds', value: steps(300, 800) },
        ]),
        byQuery('C', [
          { id: 'decimals', value: 0 },
          { id: 'thresholds', value: steps(75, 90) },
        ]),
        byQuery('D', [{ id: 'unit', value: 'reqps' }, { id: 'decimals', value: 0 }, blue]),
      ],
    },
    options: {
      defaultLink: '/d/diagramium-service/service?var-service=${__node.match}&${__url_time_range}',
      nodes: {
        checkout: { link: '/d/diagramium-checkout/inside-checkout?${__url_time_range}' },
        stripe: { link: 'https://status.stripe.com' },
      },
    },
  }),

  // ---- one level down: Checkout's own request flow, per-step latency.
  'checkout-internals.json': dashboard({
    uid: 'diagramium-checkout',
    title: 'Inside Checkout — POST /checkout',
    description:
      'Per-step p95 latency (label step=…) and outcome rates. Reached by clicking Checkout on the platform map.',
    file: 'checkout-internals.json',
    refresh: '5s',
    pos: { h: 24, w: 12, x: 0, y: 0 },
    targets: [
      waves('A', 'p95 latency', 'step', {
        'validate-cart': '12,14,13,15,12,12',
        'price-tax': '28,31,35,33,29,28',
        'reserve-stock': '60,70,85,90,72,64',
        'fraud-check': '90,110,140,150,120,95',
        'charge-card': '280,480,690,920,600,350',
        'create-order': '25,28,34,38,31,26',
        'publish-order-placed': '8,9,12,10,9,8',
      }),
      waves('B', 'Requests/s', 'step', { 'post-checkout': '42,45,51,48,44,43', '200-confirmed': '40,42,46,44,41,41' }),
      waves('C', 'Declined', 'step', { '402-declined': '1.2,1.6,2.4,3.1,2.0,1.4' }),
    ],
    fieldConfig: {
      defaults: { unit: 'ms', decimals: 0, thresholds: steps(200, 500) },
      overrides: [
        byQuery('B', [{ id: 'unit', value: 'reqps' }, blue]),
        byQuery('C', [
          { id: 'unit', value: 'percent' },
          { id: 'decimals', value: 1 },
          { id: 'thresholds', value: steps(2, 5) },
        ]),
      ],
    },
    options: { theme: 'auto' },
    links: [{ title: 'Platform map', type: 'link', url: '/d/diagramium-platform', keepTime: true, icon: 'arrow-left' }],
    panels: [
      text(
        '### Inside Checkout\nOne level below the platform map: each step of `POST /checkout`, coloured by its own p95 latency. **Charge card** waits on Stripe, so it is the first to turn orange.',
        { h: 4, w: 12, x: 12, y: 0 }
      ),
      stat(
        'Checkout success rate',
        walk('A', 'success', 98.6, 0.2, 90, 100),
        'percent',
        {
          mode: 'absolute',
          steps: [
            { color: 'red', value: null },
            { color: 'orange', value: 97 },
            { color: 'green', value: 99 },
          ],
        },
        { h: 6, w: 6, x: 12, y: 4 },
        { decimals: 2 }
      ),
      stat('Orders / min', walk('B', 'orders', 2600, 40), 'none', steps(1e9, 1e9), { h: 6, w: 6, x: 18, y: 4 }),
      series('Charge card — p95 (ms)', walk('C', 'charge-card', 450, 30), 'ms', { h: 14, w: 12, x: 12, y: 10 }),
    ],
  }),

  // ---- Kubernetes: deployments, stateful pods, node readiness (a value mapping).
  'kubernetes-cluster.json': dashboard({
    uid: 'diagramium-kubernetes',
    title: 'Kubernetes cluster — prod-eu-1',
    description:
      'CPU and restarts per deployment / pod, volume usage, and node readiness mapped 1 → Ready (green), 0 → NotReady (red).',
    file: 'kubernetes-cluster.json',
    refresh: '5s',
    targets: [
      waves('A', 'CPU', 'deployment', {
        'ingress-nginx': '22,25,31,28,24,22',
        frontend: '35,38,42,40,37,35',
        api: '48,61,74,82,66,52',
        worker: '30,34,38,36,33,31',
        prometheus: '41,43,45,44,42,41',
        alertmanager: '5,6,5,6,5,5',
      }),
      waves('B', 'CPU', 'pod', {
        'postgres-0': '38,41,47,45,40,39',
        'redis-0': '12,14,13,15,12,12',
        'kafka-0': '28,31,36,33,30,29',
      }),
      waves('C', 'Restarts (1h)', 'deployment', { api: '0,0,0,0,0,0', worker: '0,0,2,2,3,3', frontend: '0,0,0,0,0,0' }),
      waves('D', 'Volume used', 'pod', { 'postgres-0': '76,77,78,79,80,81', 'kafka-0': '41,42,42,43,43,44' }),
      waves('E', 'Ready', 'node', { 'node-1': '1,1,1,1,1,1', 'node-2': '1,1,0,0,1,1', 'node-3': '1,1,1,1,1,1' }),
    ],
    fieldConfig: {
      defaults: { unit: 'percent', decimals: 0, thresholds: steps(70, 90) },
      overrides: [
        byQuery('C', [
          { id: 'unit', value: 'none' },
          { id: 'thresholds', value: steps(1, 5) },
        ]),
        byQuery('D', [{ id: 'thresholds', value: steps(75, 90) }]),
        byQuery('E', [{ id: 'unit', value: 'none' }, upDown('Ready', 'NotReady')]),
      ],
    },
    options: { theme: 'bento-card', themeBackground: true, unmatched: 'keep' },
  }),

  // ---- a data pipeline: lag, freshness and failures; throughput in blue.
  'data-pipeline.json': dashboard({
    uid: 'diagramium-data-pipeline',
    title: 'Data pipeline — events to insight',
    description:
      'Consumer lag per stream job, freshness per table, failed loads, service health, and topic throughput as blue information that never decides a status.',
    file: 'data-pipeline.json',
    refresh: '5s',
    targets: [
      waves('A', 'Consumer lag', 'consumer_group', {
        sessionizer: '1200,1800,2400,2100,1500,1300',
        'fraud-scorer': '40,60,90,80,50,45',
        enricher: '2000,14000,42000,180000,60000,9000',
      }),
      waves('B', 'Throughput', 'topic', {
        'web-clickstream': '910,980,1040,1010,950,920',
        'clicks-topic': '905,975,1035,1005,945,915',
        'orders-topic': '44,46,51,48,45,44',
        'orders-cdc': '44,46,51,48,45,44',
      }),
      waves('C', 'Freshness', 'table', {
        'data-lake': '3,4,4,5,4,3',
        warehouse: '12,18,35,70,40,15',
        'feature-store': '1,1,2,1,1,1',
      }),
      waves('D', 'Failed loads (24h)', 'job', { 'file-loader': '0,0,1,1,1,0', 'partner-files': '0,0,0,0,0,0' }),
      waves('E', 'Up', 'service', { 'bi-dashboards': '1,1,1,1,1,1', recommendations: '1,1,1,0,1,1' }),
    ],
    fieldConfig: {
      defaults: { unit: 'short', decimals: 0, thresholds: steps(10000, 100000) },
      overrides: [
        byQuery('B', [{ id: 'unit', value: 'mps' }, blue]),
        byQuery('C', [
          { id: 'unit', value: 'm' },
          { id: 'thresholds', value: steps(15, 60) },
        ]),
        byQuery('D', [{ id: 'thresholds', value: steps(1, 3) }]),
        byQuery('E', [upDown('UP', 'DOWN')]),
      ],
    },
    options: { colorMode: 'fill', edges: 'both' },
  }),
};

// ---- where a click on the platform map lands: one dashboard for any service.
const serviceBoard = {
  uid: 'diagramium-service',
  title: 'Service',
  description: 'A per-service RED dashboard. The platform map links here with var-service set to the shape it matched.',
  tags: ['diagramium', 'demo'],
  editable: true,
  schemaVersion: 39,
  time: { from: 'now-1h', to: 'now' },
  refresh: '10s',
  links: [
    { title: 'Platform map', type: 'link', url: '/d/diagramium-platform', keepTime: true, icon: 'arrow-left' },
    ...demoLinks,
  ],
  templating: {
    list: [
      {
        name: 'service',
        type: 'textbox',
        label: 'Service',
        query: 'checkout',
        current: { text: 'checkout', value: 'checkout' },
      },
    ],
  },
  annotations: { list: [] },
  panels: [
    text(
      '## ${service}\nYou clicked **${service}** on the platform map, and landed on its own dashboard with the same time range. In production this is your RED dashboard (rate, errors, duration), filtered by the variable the panel filled in.',
      { h: 4, w: 24, x: 0, y: 0 }
    ),
    stat('Requests / s', walk('A', '${service}', 480, 12), 'reqps', steps(1e9, 1e9), { h: 5, w: 8, x: 0, y: 4 }),
    stat(
      'Error rate',
      walk('B', '${service}', 0.8, 0.15, 0, 10),
      'percent',
      steps(1, 5),
      { h: 5, w: 8, x: 8, y: 4 },
      { decimals: 2 }
    ),
    stat('p95 latency', walk('C', '${service}', 240, 20), 'ms', steps(300, 800), { h: 5, w: 8, x: 16, y: 4 }),
    series('${service} — requests / s', walk('D', '${service}', 480, 12), 'reqps', { h: 10, w: 12, x: 0, y: 9 }),
    series('${service} — p95 latency', walk('E', '${service}', 240, 20), 'ms', { h: 10, w: 12, x: 12, y: 9 }),
  ],
};

// ---- the home dashboard of `npm run server`.
const startBoard = {
  uid: 'diagramium-start',
  title: 'Diagramium panel — start here',
  tags: ['diagramium'],
  editable: true,
  schemaVersion: 39,
  time: { from: 'now-1h', to: 'now' },
  links: demoLinks,
  templating: { list: [] },
  annotations: { list: [] },
  panels: [
    text(
      [
        '# Diagramium panel',
        'Architecture diagrams drawn in [Diagramium](https://www.diagramium.com), coloured live by your data. Every demo here runs on the built-in TestData source.',
        '',
        '| Demo | What it shows |',
        '| --- | --- |',
        '| [Online store — the whole platform](/d/diagramium-platform) | 27 shapes, three metric families, blue informational series; **click a service** for its dashboard, **click Checkout** for its internal flow |',
        '| [Inside Checkout](/d/diagramium-checkout) | The second drill-down level: a request flow with per-step latency |',
        '| [Kubernetes cluster](/d/diagramium-kubernetes) | Deployments, stateful pods, node readiness as a value mapping (Ready / NotReady) |',
        '| [Data pipeline](/d/diagramium-data-pipeline) | Consumer lag, table freshness, failed loads, fill mode, connectors coloured at both ends |',
        '| [Production deployment](/d/diagramium-production) | node_exporter-style `instance="host:9100"` labels, live |',
        '| [Server room — rack A](/d/diagramium-hardware-rack) | One SQL-style table keyed by a column |',
        '| [Docker host](/d/diagramium-docker-host) | Containers from a table, plus a host series on the group frame |',
        '| [Microservices](/d/diagramium-microservices) | Zero configuration: series named after the shapes |',
        '',
        'Press **Explain** on any diagram for its guided tour. Hover a shape for its values. Open a panel in edit mode and look at **Data → Shapes** to see how each shape is matched.',
      ].join('\n'),
      { h: 20, w: 16, x: 0, y: 0 }
    ),
    {
      // An empty panel: what a new Diagramium panel looks like before a diagram is uploaded.
      id: pid++,
      type: 'diagramium-diagram-panel',
      title: 'Your diagram goes here',
      gridPos: { h: 20, w: 8, x: 16, y: 0 },
      options: { source: 'inline', diagram: '' },
    },
  ],
};

const drillDown = {
  uid: 'diagramium-drill-down',
  title: 'Drill-down',
  description: 'Where a click on a shape lands in the demo. ${target} is the thing the shape matched.',
  tags: ['diagramium', 'demo'],
  editable: true,
  schemaVersion: 39,
  time: { from: 'now-1h', to: 'now' },
  links: demoLinks,
  templating: {
    list: [
      {
        name: 'target',
        type: 'textbox',
        label: 'Target',
        query: 'orders',
        current: { text: 'orders', value: 'orders' },
      },
    ],
  },
  annotations: { list: [] },
  panels: [
    {
      id: 1,
      type: 'text',
      title: '',
      gridPos: { h: 4, w: 24, x: 0, y: 0 },
      options: {
        mode: 'markdown',
        content:
          '## ${target}\nYou clicked a shape on a Diagramium panel. In a real dashboard this is where its detail lives: the host, service or container dashboard, filtered to **${target}** and the same time range.',
      },
    },
    {
      id: 2,
      type: 'timeseries',
      title: '${target} — CPU',
      gridPos: { h: 10, w: 12, x: 0, y: 4 },
      datasource: DS,
      targets: [
        { refId: 'A', datasource: DS, scenarioId: 'random_walk', seriesCount: 1, alias: '${target}', min: 0, max: 100 },
      ],
      fieldConfig: { defaults: { unit: 'percent' }, overrides: [] },
    },
    {
      id: 3,
      type: 'timeseries',
      title: '${target} — requests / s',
      gridPos: { h: 10, w: 12, x: 12, y: 4 },
      datasource: DS,
      targets: [
        {
          refId: 'A',
          datasource: DS,
          scenarioId: 'random_walk',
          seriesCount: 1,
          alias: '${target}',
          min: 0,
          startValue: 300,
        },
      ],
      fieldConfig: { defaults: { unit: 'reqps' }, overrides: [] },
    },
  ],
};

for (const f of readdirSync(DIR)) {
  if (f.endsWith('.json')) {
    unlinkSync(new URL(f, DIR));
  }
}
for (const [file, board] of Object.entries(boards)) {
  writeFileSync(new URL(file.replace('.json', '.dashboard.json'), DIR), JSON.stringify(board, null, 2) + '\n');
}
for (const [name, board] of [
  ['drill-down', drillDown],
  ['service', serviceBoard],
  ['start', startBoard],
]) {
  writeFileSync(new URL(`${name}.dashboard.json`, DIR), JSON.stringify(board, null, 2) + '\n');
}
console.log(`wrote ${Object.keys(boards).length + 3} dashboards to provisioning/dashboards/`);

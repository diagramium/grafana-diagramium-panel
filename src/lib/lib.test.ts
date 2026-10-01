import {
  DataFrame,
  FieldColorModeId,
  FieldType,
  ReducerID,
  ThresholdsMode,
  createTheme,
  getDisplayProcessor,
  toDataFrame,
} from '@grafana/data';
import { keysOf, matches, nodePatterns, norm, parsePatterns } from './match';
import { Severity, reduceStatus, severityOfColor } from './status';
import { extractSignals } from './signals';
import { interpolateNode, internalPath, isSafeLink, resolveLink } from './links';

const theme = createTheme();

describe('matching', () => {
  test('normalises case, punctuation, ports and domains', () => {
    expect(norm('API-Gateway')).toBe('apigateway');
    expect(keysOf('api-gateway:8080')).toEqual(expect.arrayContaining(['apigateway8080', 'apigateway']));
    expect(keysOf('db-1.prod.internal:5432')).toContain('db1');
    expect(keysOf('10.0.0.5:9100')).toContain('10005');
    expect(keysOf('10.0.0.5:9100')).not.toContain('10');
  });

  test('a shape answers to its label and id by default', () => {
    const p = nodePatterns({ id: 'n3', label: 'Orders\nservice' });
    expect(matches(p, [], keysOf('orders service'))).toBe(true);
    expect(matches(p, [], keysOf('orders'))).toBe(true); // first line of a two-line label
    expect(matches(p, [], keysOf('n3'))).toBe(true);
    expect(matches(p, [], keysOf('payments'))).toBe(false);
  });

  test('a mapping replaces the label: lists, wildcards, regex', () => {
    const p = nodePatterns({ id: 'n1', label: 'Web tier' }, 'web-1, web-2');
    expect(matches(p, [], keysOf('web-2:80'))).toBe(true);
    expect(matches(p, [], keysOf('Web tier'))).toBe(false);
    const w = parsePatterns('worker-*');
    expect(matches(w, [], keysOf('worker-7'))).toBe(true);
    expect(matches(w, [], keysOf('web-7'))).toBe(false);
    const r = parsePatterns('/^pg-(primary|replica)$/');
    expect(matches(r, ['pg-replica'], keysOf('pg-replica'))).toBe(true);
    expect(matches(r, ['pg-standby'], keysOf('pg-standby'))).toBe(false);
    expect(parsePatterns('/[unclosed/')).toEqual([]);
  });
});

describe('status', () => {
  test('severity is read from the resolved colour', () => {
    const c = (n: string) => theme.visualization.getColorByName(n);
    expect(severityOfColor(c('green'))).toBe(Severity.Ok);
    expect(severityOfColor(c('orange'))).toBe(Severity.Warning);
    expect(severityOfColor(c('yellow'))).toBe(Severity.Warning);
    expect(severityOfColor(c('red'))).toBe(Severity.Critical);
    expect(severityOfColor(c('dark-red'))).toBe(Severity.Critical);
    expect(severityOfColor(c('blue'))).toBe(Severity.Info);
    expect(severityOfColor('#808080')).toBe(Severity.Info);
    expect(severityOfColor('rgb(242, 73, 92)')).toBe(Severity.Critical);
  });

  test('the worst signal decides; none is no data', () => {
    const s = reduceStatus([
      { severity: Severity.Ok },
      { severity: Severity.Critical },
      { severity: Severity.Warning },
    ]);
    expect(s.severity).toBe(Severity.Critical);
    expect(reduceStatus([]).severity).toBe(Severity.NoData);
  });
});

/** What Grafana hands a panel: fields carrying their config and display processor. */
function processed(frames: DataFrame[]): DataFrame[] {
  for (const frame of frames) {
    for (const field of frame.fields) {
      field.config = {
        ...field.config,
        color: { mode: FieldColorModeId.Thresholds },
        thresholds: {
          mode: ThresholdsMode.Absolute,
          steps: [
            { value: -Infinity, color: 'green' },
            { value: 70, color: 'orange' },
            { value: 90, color: 'red' },
          ],
        },
      };
      field.display = getDisplayProcessor({ field, theme });
    }
  }
  return frames;
}

describe('signals', () => {
  test('series: label values, display name and refId are keys; thresholds colour them', () => {
    const frames = processed([
      toDataFrame({
        refId: 'A',
        fields: [
          { name: 'time', type: FieldType.time, values: [1, 2, 3] },
          { name: 'cpu', type: FieldType.number, values: [10, 50, 95], labels: { service: 'checkout', env: 'prod' } },
        ],
      }),
    ]);
    const [s] = extractSignals(frames, { matchLabel: '', reducer: ReducerID.lastNotNull }, theme);
    expect(s.value).toBe(95);
    expect(s.severity).toBe(Severity.Critical);
    expect(s.raw).toContain('checkout');
    expect(s.raw).not.toContain('prod'); // a well-known label wins over the others
    expect(s.raw).toContain('A');
  });

  test('an explicit "Match by" label is the only key', () => {
    const frames = processed([
      toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1] },
          { name: 'up', type: FieldType.number, values: [1], labels: { instance: 'db-1:9100', job: 'node' } },
        ],
      }),
    ]);
    const [s] = extractSignals(frames, { matchLabel: 'instance', reducer: ReducerID.lastNotNull }, theme);
    expect(s.raw).toEqual(['db-1:9100']);
    expect(s.keys).toContain('db1');
  });

  test('tables: one signal per numeric cell, keyed by the row text', () => {
    const frames = processed([
      toDataFrame({
        fields: [
          { name: 'host', type: FieldType.string, values: ['rack-a', 'rack-b'] },
          { name: 'temp', type: FieldType.number, values: [45, 80] },
        ],
      }),
    ]);
    const sig = extractSignals(frames, { matchLabel: '', reducer: ReducerID.lastNotNull }, theme);
    expect(sig).toHaveLength(2);
    expect(sig[1].raw).toEqual(['rack-b']);
    expect(sig[1].severity).toBe(Severity.Warning);
  });

  test('empty series are no data', () => {
    const frames = processed([
      toDataFrame({ fields: [{ name: 'v', type: FieldType.number, values: [null], labels: { service: 'x' } }] }),
    ]);
    const [s] = extractSignals(frames, { matchLabel: '', reducer: ReducerID.lastNotNull }, theme);
    expect(s.severity).toBe(Severity.NoData);
  });
});

describe('links', () => {
  const node = { id: 'n1', label: 'Orders DB', match: 'db-1:5432', status: 'Critical' };
  test('node variables are URL-encoded; :raw leaves them', () => {
    expect(interpolateNode('/d/x?var-host=${__node.match}', node)).toBe('/d/x?var-host=db-1%3A5432');
    expect(interpolateNode('${__node.label:raw}', node)).toBe('Orders DB');
  });
  test('own link beats the default; dashboard variables go through Grafana', () => {
    const rv = (s: string) => s.replace('${__url_time_range}', 'from=now-1h&to=now');
    expect(resolveLink('', '/d/h?h=${__node.id}&${__url_time_range}', node, rv)).toBe('/d/h?h=n1&from=now-1h&to=now');
    expect(resolveLink('https://runbooks/x', '/d/h', node, rv)).toBe('https://runbooks/x');
    expect(resolveLink('', '', node, rv)).toBe('');
  });
  test('only web links run', () => {
    expect(isSafeLink('javascript:alert(1)')).toBe(false);
    expect(isSafeLink(' JavaScript:alert(1)')).toBe(false);
    expect(isSafeLink('data:text/html,x')).toBe(false);
    expect(isSafeLink('https://example.com')).toBe(true);
    expect(isSafeLink('/d/abc')).toBe(true);
  });
  test('same-origin links stay inside Grafana', () => {
    expect(internalPath('/d/abc?x=1', 'http://g:3000')).toBe('/d/abc?x=1');
    expect(internalPath('http://g:3000/d/abc', 'http://g:3000')).toBe('/d/abc');
    expect(internalPath('https://other/d', 'http://g:3000')).toBeNull();
    expect(internalPath('//evil.example/x', 'http://g:3000')).toBeNull();
  });
});

describe('the README examples', () => {
  test('a node_exporter series reaches the shape named after its host', () => {
    const p = nodePatterns({ id: 'n1', label: 'web-1' });
    expect(matches(p, ['web-1:9100'], keysOf('web-1:9100'))).toBe(true);
    expect(matches(p, ['web-12:9100'], keysOf('web-12:9100'))).toBe(false);
  });
  test('a fully qualified host reaches its short shape name', () => {
    const p = nodePatterns({ id: 'n1', label: 'web-1' });
    expect(matches(p, ['web-1.prod.example.com:9100'], keysOf('web-1.prod.example.com:9100'))).toBe(true);
  });
  test('a /regex/ mapping matches every web host', () => {
    const p = nodePatterns({ id: 'n1', label: 'Web tier' }, '/^web-\\d+/');
    expect(matches(p, ['web-3:9100'], keysOf('web-3:9100'))).toBe(true);
    expect(matches(p, ['db-1:9100'], keysOf('db-1:9100'))).toBe(false);
  });
});

describe('neutral colours', () => {
  test('an informational signal never outranks a verdict', () => {
    const s = reduceStatus([{ severity: Severity.Info }, { severity: Severity.Ok }]);
    expect(s.severity).toBe(Severity.Ok);
    expect(reduceStatus([{ severity: Severity.Info }]).severity).toBe(Severity.Info);
  });
});

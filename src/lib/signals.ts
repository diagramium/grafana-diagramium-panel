/**
 * Signals: the query results, reduced to one coloured value per measured thing.
 *
 * Two shapes of data are understood, which between them cover every data
 * source Grafana has:
 *
 *   - SERIES (Prometheus, Loki metrics, InfluxDB, CloudWatch, TestData…):
 *     each numeric field is one signal, reduced with the panel's calculation
 *     (last value by default). Its keys are the label values that name a
 *     thing, its display name and its query's refId.
 *   - TABLES (SQL, instant queries in table format, CSV): a frame with a text
 *     column gives one signal per numeric cell, keyed by the row's text.
 *
 * Colour and text come from Grafana itself — the field's display processor —
 * so thresholds, value mappings (1 → "UP", 0 → "DOWN" in red), units and
 * decimals are the ones the user set in the standard field options.
 */
import {
  DataFrame,
  Field,
  FieldType,
  GrafanaTheme2,
  ReducerID,
  formattedValueToString,
  getDisplayProcessor,
  getFieldDisplayName,
  reduceField,
} from '@grafana/data';
import { AUTO_LABELS, keysOf } from './match';
import { Severity, severityOfColor } from './status';

export interface Signal {
  /** The measurement's name as Grafana shows it (series display name / column). */
  name: string;
  /** Raw names this signal answers to (label values, series name, refId, row text). */
  raw: string[];
  /** The same, normalised (see match.ts). */
  keys: string[];
  value: number | null;
  /** Formatted value with its unit, e.g. "93.1%". */
  text: string;
  /** Resolved CSS colour. */
  color: string;
  severity: Severity;
}

function namesFromLabels(field: Field, matchLabel: string): string[] {
  const labels = field.labels ?? {};
  if (matchLabel) {
    const v = labels[matchLabel];
    return v ? [v] : [];
  }
  const named = AUTO_LABELS.map((l) => labels[l]).filter((v): v is string => !!v);
  // No well-known label: any label value can name the thing.
  return named.length ? named : Object.values(labels).filter(Boolean);
}

function displayOf(field: Field, value: number | null, theme: GrafanaTheme2) {
  const proc = field.display ?? getDisplayProcessor({ field, theme });
  const d = proc(value);
  return {
    text: formattedValueToString(d),
    color: d.color ? theme.visualization.getColorByName(d.color) : theme.colors.text.secondary,
  };
}

function signal(field: Field, name: string, raw: string[], value: number | null, theme: GrafanaTheme2): Signal {
  const uniq = [...new Set(raw.filter(Boolean))];
  const keys = [...new Set(uniq.flatMap(keysOf))];
  if (value == null || Number.isNaN(value)) {
    return {
      name,
      raw: uniq,
      keys,
      value: null,
      text: 'No data',
      color: theme.colors.text.disabled,
      severity: Severity.NoData,
    };
  }
  const d = displayOf(field, value, theme);
  return { name, raw: uniq, keys, value, text: d.text, color: d.color, severity: severityOfColor(d.color) };
}

function isTable(frame: DataFrame): boolean {
  const hasText = frame.fields.some((f) => f.type === FieldType.string);
  const hasNum = frame.fields.some((f) => f.type === FieldType.number);
  const hasTime = frame.fields.some((f) => f.type === FieldType.time);
  // A time series may carry a text column; a frame WITHOUT time and with text is a table.
  return hasText && hasNum && (!hasTime || frame.length <= 1);
}

export function extractSignals(
  series: DataFrame[],
  opts: { matchLabel: string; reducer: string },
  theme: GrafanaTheme2
): Signal[] {
  const out: Signal[] = [];
  const reducer = opts.reducer || ReducerID.lastNotNull;
  const matchLabel = (opts.matchLabel || '').trim();

  for (const frame of series) {
    if (isTable(frame)) {
      const textFields = frame.fields.filter((f) => f.type === FieldType.string);
      // "Match by" names the column that identifies the row; otherwise every text column does.
      const keyFields = matchLabel ? textFields.filter((f) => f.name === matchLabel) : textFields;
      for (const field of frame.fields) {
        if (field.type !== FieldType.number) {
          continue;
        }
        const name = getFieldDisplayName(field, frame, series);
        for (let i = 0; i < frame.length; i++) {
          const raw = keyFields.map((f) => String(f.values[i] ?? ''));
          out.push(signal(field, `${name}`, raw, toNum(field.values[i]), theme));
        }
      }
      continue;
    }
    for (const field of frame.fields) {
      if (field.type !== FieldType.number) {
        continue;
      }
      const name = getFieldDisplayName(field, frame, series);
      const raw = [...namesFromLabels(field, matchLabel)];
      if (!matchLabel) {
        raw.push(name, field.config.displayName ?? '', frame.name ?? '', frame.refId ?? '');
      }
      const calcs = reduceField({ field, reducers: [reducer] });
      out.push(signal(field, name, raw, toNum(calcs[reducer]), theme));
    }
  }
  return out;
}

function toNum(v: unknown): number | null {
  if (v == null) {
    return null;
  }
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

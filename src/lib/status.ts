/**
 * Status: from coloured signals to one state per shape.
 *
 * The COLOUR Grafana resolved for a value is the verdict — thresholds and
 * value mappings already encode what the user means by "bad" — so severity is
 * read from the colour's hue rather than from a second rule set that could
 * disagree with the one in the field options:
 *
 *   red / crimson / magenta  -> critical
 *   orange / amber / yellow  -> warning
 *   green / teal             -> ok
 *   blue / purple / grey     -> info (a neutral, informational colour)
 *
 * Info ranks BELOW ok: a request-rate series coloured blue sits beside an
 * error-rate verdict without ever deciding the shape's state.
 *
 * A shape takes its WORST signal; that signal's colour and value are what it
 * shows. A shape with signals that are all empty is "no data".
 */

export enum Severity {
  NoData = -1,
  /** A neutral colour: shown, but never outranks a verdict. */
  Info = 0,
  Ok = 1,
  Warning = 2,
  Critical = 3,
}

export const SEVERITY_NAME: Record<Severity, string> = {
  [Severity.NoData]: 'No data',
  [Severity.Ok]: 'OK',
  [Severity.Info]: 'Info',
  [Severity.Warning]: 'Warning',
  [Severity.Critical]: 'Critical',
};

/** Parse #rgb, #rrggbb(aa), rgb(a)(); anything else is null. */
export function parseColor(c: string): [number, number, number] | null {
  const s = String(c || '').trim();
  let m = /^#([0-9a-f]{3,8})$/i.exec(s);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) {
      h = h
        .slice(0, 3)
        .split('')
        .map((x) => x + x)
        .join('');
    }
    if (h.length < 6) {
      return null;
    }
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(s);
  if (m) {
    return [Number(m[1]), Number(m[2]), Number(m[3])];
  }
  return null;
}

/** Hue (0–360) and saturation (0–1) of an RGB triple. */
function hueSat([r, g, b]: [number, number, number]): [number, number] {
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const d = max - min;
  const l = (max + min) / 2;
  if (d === 0) {
    return [0, 0];
  }
  const sat = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === R) {
    h = ((G - B) / d) % 6;
  } else if (max === G) {
    h = (B - R) / d + 2;
  } else {
    h = (R - G) / d + 4;
  }
  h *= 60;
  return [h < 0 ? h + 360 : h, sat];
}

export function severityOfColor(color: string): Severity {
  const rgb = parseColor(color);
  if (!rgb) {
    return Severity.Info;
  }
  const [h, s] = hueSat(rgb);
  if (s < 0.2) {
    return Severity.Info; // grey / white / black: no verdict
  }
  if (h < 18 || h >= 320) {
    return Severity.Critical;
  }
  if (h < 65) {
    return Severity.Warning;
  }
  if (h < 185) {
    return Severity.Ok;
  }
  return Severity.Info;
}

export interface NodeStatus<S extends { severity: Severity } = { severity: Severity }> {
  severity: Severity;
  /** The signal that decided it (the worst), null with no signals. */
  top: S | null;
  signals: S[];
}

/** The worst signal wins; ties keep the first (query order). */
export function reduceStatus<S extends { severity: Severity }>(signals: S[]): NodeStatus<S> {
  let top: S | null = null;
  for (const s of signals) {
    if (!top || s.severity > top.severity) {
      top = s;
    }
  }
  return { severity: top ? top.severity : Severity.NoData, top, signals };
}

/** A colour at a given opacity, for fills that must not drown the label. */
export function withAlpha(color: string, alpha: number): string {
  const rgb = parseColor(color);
  return rgb ? `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})` : color;
}

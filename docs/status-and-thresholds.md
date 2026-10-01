# Status and thresholds

## The colour is the verdict

The panel has no rule engine of its own. For every signal it asks Grafana's display processor the same question a stat panel asks: _what colour is this value?_ That colour comes from your **thresholds** and **value mappings** in the standard field options. The panel then reads the colour's hue:

| Colour Grafana resolves | Status       | How the shape shows it                                           |
| ----------------------- | ------------ | ---------------------------------------------------------------- |
| red, crimson, magenta   | **Critical** | coloured outline (or fill), glowing; connectors into it pulse    |
| orange, amber, yellow   | **Warning**  | coloured outline (or fill); connectors into it take the colour   |
| green, teal             | **OK**       | coloured outline (or fill)                                       |
| blue, purple, grey      | **Info**     | coloured outline, never decides a status (see below)             |
| no value                | **No data**  | grey dashed outline and a "No data" badge, for shapes you mapped |

Because the status _is_ Grafana's colour, it always agrees with the rest of the dashboard: a value red on a stat panel is red on the diagram.

## One shape, many signals

A shape takes its **worst** signal. That signal's colour is the shape's colour, and its value is the badge (or its status word, under **Status → Badge**). The order is:

`Critical  >  Warning  >  OK  >  Info  >  No data`

Hover the shape to see every signal it received.

## Information that never decides

Some numbers are context, not verdicts: request rate, throughput, queue depth on a healthy queue. Give those queries a **fixed blue colour** (Overrides → Fields returned by query → Color scheme → Single color → blue). Blue ranks **below OK**:

- a shape with only blue signals shows them, outlined in blue (`45 msg/s`);
- a shape with a blue signal and an OK one is OK, and shows the OK value;
- the legend counts information separately ("4 Info").

The [data pipeline demo](examples.md#data-pipeline--events-to-insight) uses this for topic throughput, and the [checkout demo](examples.md#inside-checkout--post-checkout) for requests per second.

## Recipes

**Lower is better** (CPU, latency, error rate, lag): the defaults. Base green, orange at the warning level, red at the critical level.

**Higher is better** (success rate, free disk, availability): reverse the steps. Base **red**, orange at 97, green at 99.

**Up / down**: a value mapping. `1 → UP` with colour green, `0 → DOWN` with colour red. The mapped text becomes the badge.

**State codes** (`0` ok, `1` degraded, `2` down, `3` maintenance): map each number to a word and a colour. Map maintenance to blue if it shouldn't count as a problem. The panel reads numbers, so a status that only exists as text needs converting to a code in the query (for example a `CASE` in SQL).

**Different thresholds per metric**: one override per query (Fields returned by query → Thresholds) or per field name (Fields with name → Thresholds). The [hardware demo](examples.md#server-room--rack-a) gives temperature and power their own thresholds in a single table.

## How it looks

Under **Status**:

- **Show status as**: _Outline_ colours the shape's border, keeping the diagram's own fills. _Fill_ tints the whole shape, which reads well on dense diagrams and big screens.
- **Badge**: the deciding _value_ (`880 ms`), the _status_ word (`Critical`), or _none_.
- **Connectors**: _Into it_ colours a line leading into a shape in trouble (warning or worse); _both ends_ also colours lines leaving it; _off_ leaves connectors as drawn. A critical path keeps a travelling pulse in its colour.
- **Shapes without data**: _As drawn_ leaves unmatched shapes (users, the internet, third parties) alone; _Dim_ fades them so the monitored part stands out.

## No data

A shape that matches nothing is **unmatched**. It stays as drawn (or dimmed), because most diagrams have shapes that aren't monitored.

A shape you **mapped** (its Matches box is filled in) that receives nothing, or whose values are all empty, says **No data** with a grey dashed outline. Something you asked to watch has gone quiet, and that is a finding worth showing.

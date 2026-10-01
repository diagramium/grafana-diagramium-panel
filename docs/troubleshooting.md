# Troubleshooting

### Grafana doesn't list the plugin

The release zip isn't signed, so Grafana skips it unless you allow it by id:

```ini
[plugins]
allow_loading_unsigned_plugins = diagramium-diagram-panel
```

or `GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=diagramium-diagram-panel`. Restart Grafana afterwards. The Grafana server log names any plugin it refused and why. Grafana Cloud only loads signed plugins, so it can't run this build.

### "No diagram yet"

The panel has no diagram. Upload the `.json` saved from Diagramium (**File → Save**) under **Diagram**, or switch **Source** to a URL.

### "Could not read the diagram"

The file isn't a Diagramium diagram, or the URL didn't return one. With a URL source, check that the address is reachable from the browser and allows cross-origin reads (`Access-Control-Allow-Origin`), because the browser fetches it, not the Grafana server.

### A shape stays as drawn

Nothing in the results matched it. Open **Data → Shapes**: its dot is empty.

1. Look at what the data actually calls things: the panel's **Table view**, or **Inspect → Data**.
2. Check the query keeps the naming label: `sum by (instance) (…)`, not `sum(…)`.
3. Type the data's name into the shape's **Matches** box, or set **Match by** to the label that names things.

### A shape is the wrong colour

The colour is Grafana's own colour for the deciding value. Hover the shape: the tooltip lists every signal with its colour, so you can see which one decided. Fix the thresholds (or value mappings) for that query, usually with an override per query, since one default threshold rarely suits latency, error rate and CPU at once.

### Every shape matched the same thing

A series with no well-known label offers **all** its label values, so a common value like `env="prod"` can match a shape called "prod". Set **Match by** to the label that names things, or aggregate the label away in the query.

### Too many shapes show "No data"

Only shapes with a **Matches** entry say No data; the rest stay as drawn. If they should have data, the queries return nothing for them: check the time range and whether the series exist.

### The badge shows a number I didn't expect

The badge is the shape's **worst** signal. Pick what it shows under **Status → Badge**, or give informational series a fixed blue colour so they never become the badge ([Status and thresholds](status-and-thresholds.md#information-that-never-decides)).

### Clicking a shape does nothing

Set a **Default link** (Drill-down), or a link for that shape in **Data → Shapes**. Links that aren't web links (`javascript:`, `data:`, `mailto:`…) are ignored on purpose.

### Privacy

The panel loads nothing at runtime except a diagram URL you configure. It sends no analytics and no telemetry, and stores nothing outside the dashboard. The drawing engine, [diagramium-player](https://github.com/diagramium/diagramium-player), is bundled into the plugin.

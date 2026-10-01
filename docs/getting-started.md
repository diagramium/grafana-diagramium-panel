# Getting started

From an empty Grafana panel to a live, clickable map of your system in about ten minutes.

## 1. Draw the system

Open [www.diagramium.com](https://www.diagramium.com) and pick an editor. **System architecture** suits services and data stores (it has group frames for namespaces, VPCs and tiers), **Network** suits hosts and devices, and **Flowchart** suits a request or business flow. Any Diagramium diagram with shapes and connectors works.

Two habits make everything after this easier:

- **Name each shape after the thing it monitors**, the way your data names it: `checkout`, `web-1`, `postgres-0`, `srv-a04`. Case and punctuation don't matter (`Orders DB` matches `orders-db`), so you can keep labels readable.
- **Write a note for each step** (the Notes tab). The panel's **Explain** button plays those notes as a guided tour, which is how a new teammate learns the system.

Save it with **File → Save**. You get a `.json` file. That file is the whole diagram, and nothing about it lives on a server.

## 2. Add the panel

1. In a Grafana dashboard, **Add → Visualization** and pick **Diagramium**.
2. Under **Diagram**, click **Upload .json** and choose your file. The summary line shows its title and how many shapes and connectors it has.

The file is stored inside the dashboard JSON, so the panel needs nothing else to draw. If you'd rather keep the diagram in a repository, set **Source → From a URL** instead (see [Diagram from a URL](#diagram-from-a-url)).

## 3. Query the data

Add queries exactly as you would for any other panel. What matters is that each result **keeps the label that names the thing**:

```promql
# good: one series per host, labelled instance="web-1:9100"
100 - avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100

# no good: one series for everything, nothing left to match
100 - avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100
```

Open **Data → Shapes** in the panel options. Every shape is listed with a dot: a coloured dot means the current results reach that shape, an empty one means nothing matched. The header says how many shapes match ("9 of 11 shapes match the current data").

![The Shapes editor beside a live panel](https://raw.githubusercontent.com/diagramium/grafana-diagramium-panel/main/src/img/screenshots/editor-shapes.png)

If a shape stays empty, type the name your data uses into its **Matches** box. [Connecting data](connecting-data.md) explains the rules and has recipes for Prometheus, Loki, SQL, InfluxDB and CloudWatch.

## 4. Decide what red means

Status comes from Grafana's standard field options, so you set it the way you would for a stat panel:

- **Thresholds**: the panel starts with green, orange at 70 and red at 90. Change them, or give each query its own thresholds through an override.
- **Value mappings**: `1 → UP` (green) and `0 → DOWN` (red) turn a boolean metric into a status.
- **Unit and decimals** shape the badge text: `93.4%`, `880 ms`, `42 req/s`.

[Status and thresholds](status-and-thresholds.md) covers multiple metrics per shape, informational (blue) series and "higher is better" metrics.

## 5. Make it clickable

Under **Drill-down**, set a **Default link**: a URL template for every shape.

```text
/d/my-service-dashboard?var-service=${__node.match}&${__url_time_range}
```

Clicking a shape now opens its own dashboard, filtered to it, over the same time range. Individual shapes can override the link (a runbook, a status page, a deeper diagram). See [Drill-down](drill-down.md).

## 6. Tune the look

Under **Appearance**:

- **Theme**: _Follow Grafana_ uses Linear Midnight on dark and Bento Card on light. Glassmorphism is the third option.
- **Theme's own background**: off keeps the panel's background, so the diagram sits in the dashboard like any other visualization.
- **Text size**, **Legend**, the **Explain** button and its **Seconds per step**.

Under **Status**, choose **Outline** or **Fill**, what the badge shows (value, status word, or nothing), how connectors are coloured, and whether shapes without data stay as drawn or dim.

## Diagram from a URL

**Source → From a URL** loads the `.json` from any address that allows cross-origin reads, such as a raw file in your repository or a static host. Grafana fetches it when the dashboard loads, so a changed diagram shows on the next load, and the dashboard keeps its shape mappings and links. Shape mappings are keyed by the shape's id in the file, so they survive layout and label changes.

## Next

- [Connecting data](connecting-data.md): matching rules and per-source recipes
- [Status and thresholds](status-and-thresholds.md)
- [Drill-down](drill-down.md)
- [Examples](examples.md): eight complete dashboards to copy from
- [Troubleshooting](troubleshooting.md)

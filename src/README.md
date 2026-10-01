# Diagramium panel for Grafana

[![CI](https://github.com/diagramium/grafana-diagramium-panel/actions/workflows/ci.yml/badge.svg)](https://github.com/diagramium/grafana-diagramium-panel/actions/workflows/ci.yml)
[![Licence: MIT](https://img.shields.io/badge/licence-MIT-blue.svg)](https://github.com/diagramium/grafana-diagramium-panel/blob/main/LICENSE)
[![Grafana 12.3+](https://img.shields.io/badge/Grafana-12.3%2B-F46800?logo=grafana&logoColor=white)](https://github.com/diagramium/grafana-diagramium-panel/releases)

**Your architecture diagram, coloured live by your monitoring.**

Draw the system once in [Diagramium](https://www.diagramium.com): services, hosts, pods, queues, network gear, a business flow. Drop the saved file into this panel and every shape takes the status of the data it matches, green, orange or red from your own thresholds, with its current value on a badge.

- **Hover** a shape to see every signal it received.
- **Click** it to drill down to its own dashboard, or to the next diagram down.
- Press **Explain** to walk a teammate through the system step by step, over the live status.

![An online store's whole platform in Grafana: Checkout red at 880 ms, Payments, Stripe and the search index orange, the connectors leading to them coloured to match](https://raw.githubusercontent.com/diagramium/grafana-diagramium-panel/main/src/img/screenshots/platform.png)

## How a shape gets its colour

There is no wiring step. **The name in the drawing and the name in the data line up**:

1. You query as usual. Prometheus returns `{service="checkout"} 880`.
2. The panel finds the shape called **Checkout**. Case, punctuation, `:port` and domain suffixes are ignored, so `instance="web-1:9100"` finds `web-1`.
3. Your thresholds colour 880 ms red, and the shape turns red, with the value on its badge.
4. Several queries can feed one shape. It shows the **worst**, and the tooltip lists them all.

When a name differs, type the data's name (or `web-*`, or a `/regex/`) into that shape's **Matches** box. A dot beside every shape shows what the current data reaches.

## Drill down, level by level

![Platform map → a service's dashboard → Checkout's internal flow](https://raw.githubusercontent.com/diagramium/grafana-diagramium-panel/main/src/img/screenshots/drill-down.png)

One link template opens any shape's own dashboard: `/d/service-red?var-service=${__node.match}&${__url_time_range}`. Single shapes can link deeper, to another diagram, a runbook or a status page.

## Examples

Eight complete dashboards ship with the plugin, each a diagram made in Diagramium fed by Grafana's TestData source. Run them with `npm run server`.

|                                                                                                                                      |                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| ![Kubernetes](https://raw.githubusercontent.com/diagramium/grafana-diagramium-panel/main/src/img/screenshots/kubernetes.png)         | ![Data pipeline](https://raw.githubusercontent.com/diagramium/grafana-diagramium-panel/main/src/img/screenshots/data-pipeline.png)                 |
| **Kubernetes cluster.** Namespaces as frames; CPU and restarts per deployment; node readiness as a value mapping (Ready / NotReady). | **Data pipeline.** Consumer lag, table freshness, failed loads; throughput in blue as information; fill mode.                                      |
| ![Checkout](https://raw.githubusercontent.com/diagramium/grafana-diagramium-panel/main/src/img/screenshots/checkout.png)             | ![Production deployment](https://raw.githubusercontent.com/diagramium/grafana-diagramium-panel/main/src/img/screenshots/production-deployment.png) |
| **Inside Checkout.** The second drill-down level: a request flow with per-step latency, beside ordinary panels.                      | **Production deployment.** node_exporter-style `instance="host:9100"` labels; a mapped host with no data says so.                                  |
| ![Server rack](https://raw.githubusercontent.com/diagramium/grafana-diagramium-panel/main/src/img/screenshots/hardware-rack.png)     | ![Docker host](https://raw.githubusercontent.com/diagramium/grafana-diagramium-panel/main/src/img/screenshots/docker-host.jpg)                     |
| **Server rack.** One SQL-style table keyed by a `device` column, a threshold per column.                                             | **Docker host.** Containers from a cAdvisor-style table; the host's CPU on the group frame.                                                        |

What each one demonstrates: [docs/examples.md](https://github.com/diagramium/grafana-diagramium-panel/blob/main/docs/examples.md).

## Install

Free and MIT-licensed, distributed on the [releases page](https://github.com/diagramium/grafana-diagramium-panel/releases). It isn't in the Grafana catalog, so it's unsigned, and Grafana has to be told to load it. That works on any self-hosted Grafana 12.3 or newer; Grafana Cloud only loads signed plugins.

```bash
grafana cli --pluginUrl https://github.com/diagramium/grafana-diagramium-panel/releases/download/v0.1.0/diagramium-diagram-panel-0.1.0.zip plugins install diagramium-diagram-panel
```

```ini
# grafana.ini, or GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=diagramium-diagram-panel
[plugins]
allow_loading_unsigned_plugins = diagramium-diagram-panel
```

Restart Grafana. Alternatively, unzip the release into your plugins folder (for example `/var/lib/grafana/plugins`).

## Quick start

1. **Draw** at [www.diagramium.com](https://www.diagramium.com), naming each shape after what it monitors, and **File → Save** the `.json`.
2. **Add a panel**, choose **Diagramium**, and **Upload .json** under _Diagram_.
3. **Query** as usual, keeping the label that names things (`sum by (service) (…)`).
4. Set **Thresholds** (or value mappings) in the field options.
5. Set a **Default link** under _Drill-down_.

The full walkthrough is in [Getting started](https://github.com/diagramium/grafana-diagramium-panel/blob/main/docs/getting-started.md).

## Documentation

|                                                                                                                         |                                                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| [Getting started](https://github.com/diagramium/grafana-diagramium-panel/blob/main/docs/getting-started.md)             | From an empty panel to a live, clickable map                                                                                  |
| [Connecting data](https://github.com/diagramium/grafana-diagramium-panel/blob/main/docs/connecting-data.md)             | The matching rules, plus recipes for Prometheus (hosts, services, Kubernetes, containers), Loki, SQL, InfluxDB and CloudWatch |
| [Status and thresholds](https://github.com/diagramium/grafana-diagramium-panel/blob/main/docs/status-and-thresholds.md) | How colour becomes status; several metrics per shape; information that never decides; "higher is better" metrics              |
| [Drill-down](https://github.com/diagramium/grafana-diagramium-panel/blob/main/docs/drill-down.md)                       | Link templates and variables, nested diagrams, runbooks, the Explain tour                                                     |
| [Examples](https://github.com/diagramium/grafana-diagramium-panel/blob/main/docs/examples.md)                           | The eight demo dashboards and what each shows                                                                                 |
| [Troubleshooting](https://github.com/diagramium/grafana-diagramium-panel/blob/main/docs/troubleshooting.md)             | When a shape stays grey, shows the wrong colour, or Grafana won't load the plugin                                             |

## Try it locally

```bash
git clone https://github.com/diagramium/grafana-diagramium-panel.git
cd grafana-diagramium-panel
npm install
npm run build
npm run server        # Grafana on http://localhost:3000, opening on the demo index (needs Docker)
```

## Development

```bash
npm run dev           # rebuild on change
npm run test:ci       # unit tests: matching, status, signals, links
npm run typecheck
npm run lint
npm run e2e           # Playwright, against the running Grafana
npm run demo:dashboards   # regenerate provisioning/dashboards from examples/
```

See [CONTRIBUTING.md](https://github.com/diagramium/grafana-diagramium-panel/blob/main/CONTRIBUTING.md). The drawing engine is [diagramium-player](https://github.com/diagramium/diagramium-player), the open-source player for Diagramium files, bundled into the plugin. The panel loads nothing at runtime except a diagram URL you configure, and sends nothing anywhere.

## Licence

MIT © 2026 DhuRee Labs Inc.

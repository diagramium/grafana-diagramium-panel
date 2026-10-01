# Examples

Eight complete dashboards ship in this repository. Each one is a diagram drawn in Diagramium (the `.json` is in [`examples/`](../examples)), a Diagramium panel, and data from Grafana's built-in **TestData** source, so they run with no monitoring stack:

```bash
npm install && npm run build && npm run server   # http://localhost:3000, opens on "Start here"
```

They are chosen to cover the shapes data comes in: labelled series, tables, value mappings, informational series, and links from one level to the next. To copy one into your own Grafana, open its dashboard JSON from `provisioning/dashboards/`, import it, and replace the TestData queries with yours.

---

## Online store — the whole platform

![The platform map](https://raw.githubusercontent.com/diagramium/grafana-diagramium-panel/main/src/img/screenshots/platform.png)

A product's whole platform: 27 shapes in four groups (edge, a Kubernetes namespace, data stores, async workers) plus clients and third parties.

- **Data:** four labelled series families, all on `service=…`: error rate (orange 1%, red 5%), p95 latency (orange 300 ms, red 800 ms), saturation for the data stores (orange 75%, red 90%), and requests per second in **blue**, as information.
- **Watch:** Checkout's latency, Payments' errors and Stripe's latency rise together every minute. The connectors leading into them take their colour, and the red path pulses.
- **Click:** any service opens the **Service** dashboard with `var-service` set to it. **Checkout** has its own link, one level down. **Stripe** links to its public status page.
- Dashboard: `ecommerce-platform.dashboard.json` · Diagram: `examples/ecommerce-platform.json`

## Inside Checkout — POST /checkout

![The checkout flow](https://raw.githubusercontent.com/diagramium/grafana-diagramium-panel/main/src/img/screenshots/checkout.png)

The second drill-down level: one request's path through Checkout, drawn as a flowchart, next to ordinary stat and time-series panels.

- **Data:** p95 latency per step (`step=…`), requests per second in blue on the entry and exit, and the decline rate on the "402 Declined" outcome.
- **Shows:** a flowchart works like an architecture diagram (start/end pills, a decision diamond); a "higher is better" success rate (base red, orange 97, green 99) in the stat panel beside it.
- Dashboard: `checkout-internals.dashboard.json` · Diagram: `examples/checkout-internals.json`

## Kubernetes cluster — prod-eu-1

![The Kubernetes cluster](https://raw.githubusercontent.com/diagramium/grafana-diagramium-panel/main/src/img/screenshots/kubernetes.png)

Namespaces as group frames, deployments and stateful pods inside them, and the worker nodes underneath.

- **Data:** CPU per `deployment` and per `pod`, restarts in the last hour (orange at 1), volume usage, and node readiness through a **value mapping**: `1 → Ready` (green), `0 → NotReady` (red). The mapped word becomes the badge.
- **Shows:** the Bento Card theme with its own background, and node-2 dropping out of Ready every minute.
- Dashboard: `kubernetes-cluster.dashboard.json` · Diagram: `examples/kubernetes-cluster.json`

## Data pipeline — events to insight

![The data pipeline](https://raw.githubusercontent.com/diagramium/grafana-diagramium-panel/main/src/img/screenshots/data-pipeline.png)

Sources, topics, stream jobs, storage and consumers.

- **Data:** consumer lag per `consumer_group` (orange 10 K, red 100 K), table freshness in minutes (orange 15, red 60), failed loads, UP/DOWN for the consumers, and topic throughput in blue.
- **Shows:** **fill** mode and connectors coloured **at both ends**, so a lagging job lights up the path into it and out of it. Labels like `consumer_group` and `topic` aren't in the well-known list; they match because a series without a well-known label offers all of its label values.
- Dashboard: `data-pipeline.dashboard.json` · Diagram: `examples/data-pipeline.json`

## Production deployment

![Hosts](https://raw.githubusercontent.com/diagramium/grafana-diagramium-panel/main/src/img/screenshots/production-deployment.png)

Firewall, load balancer, web and app tiers, databases and a backup NAS, drawn in the Network editor.

- **Data:** CPU series labelled `instance="web-1:9100"`, like node_exporter. The port is ignored.
- **Shows:** `backup-nas` is mapped explicitly but has no data, so it says **No data**; network cables draw without arrowheads, as in the editor.

## Server room — rack A

![A rack](https://raw.githubusercontent.com/diagramium/grafana-diagramium-panel/main/src/img/screenshots/hardware-rack.png)

Router, firewall, two top-of-rack switches, four servers and a NAS.

- **Data:** one SQL-style table with `device`, `temp_c` and `power_w` columns. **Match by** is `device`.
- **Shows:** a different threshold per column (temperature 65 / 80 °C, power 400 / 500 W) and fill mode.

## Docker host — docker-host-1

![Containers](https://raw.githubusercontent.com/diagramium/grafana-diagramium-panel/main/src/img/screenshots/docker-host.jpg)

Six containers inside a group frame for the host.

- **Data:** a cAdvisor-style table (CPU, memory, restarts per container) plus a host CPU series that lands on the **group frame**.
- **Shows:** the Glassmorphism theme, and restarts with their own thresholds.

## Online store — microservices

![Zero configuration](https://raw.githubusercontent.com/diagramium/grafana-diagramium-panel/main/src/img/screenshots/microservices.png)

The smallest possible setup: series named after the services, no mapping at all.

---

## Drawing your own

Open any of the files in `examples/` at [www.diagramium.com](https://www.diagramium.com) (**File → Open**), change it, and save. A few tips from building these:

- **Groups** (System architecture → Group / boundary) carry a label, and can be matched to data like any shape: the Docker host frame takes the host's CPU.
- **Two-line labels** match on their first line: `web-1` / `nginx` matches `web-1`.
- **Write the notes.** The Explain tour is only as good as the step notes.
- **One diagram per level.** A platform map with 30 shapes and a link per service beats one diagram with 200.

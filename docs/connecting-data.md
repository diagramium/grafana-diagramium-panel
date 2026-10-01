# Connecting data

The panel never talks to a data source itself. Grafana runs the panel's queries, as it does for every visualization, and hands the panel the results. The panel's only job is deciding **which result belongs to which shape**, and it does that by name.

## The rule

1. Every result becomes one or more **signals**: one number each, with a set of **names**.
2. Every shape has a set of **patterns**: by default its own label and id.
3. A signal belongs to a shape when one of its names fits one of the shape's patterns.

That's the whole link. There is no per-shape query and no wiring step.

### Where a signal's names come from

**Time series** (Prometheus, Loki metric queries, InfluxDB, CloudWatch, Graphite, TestData…). Each numeric series is reduced to one number with the panel's **Value** setting (last value by default; mean, max, min, total). Its names are:

- the values of the well-known labels it carries, any of: `service`, `service_name`, `app`, `application`, `container`, `container_name`, `name`, `pod`, `deployment`, `host`, `hostname`, `instance`, `node`, `nodename`, `device`, `job`;
- if it has **none** of those, the values of **all** its labels (so `consumer_group="enricher"` or `step="charge-card"` work too);
- its display name (alias / legend), the frame name and the query's refId (`A`, `B`…).

**Tables** (SQL, instant queries in table format, CSV, JSON APIs). A frame with a text column and a numeric column, and no time column, is a table. Every numeric cell is a signal, and its names are the text values in the same row.

### How names are compared

Comparison is deliberately forgiving:

| Ignored                   | So this…                             | …matches the shape |
| ------------------------- | ------------------------------------ | ------------------ |
| case, spaces, punctuation | `orders-db`, `orders_db`, `OrdersDB` | `Orders DB`        |
| a trailing `:port`        | `instance="web-1:9100"`              | `web-1`            |
| a domain suffix           | `db-1.prod.internal:5432`            | `db-1`             |

IP addresses keep their dots, so `10.0.0.5:9100` matches a shape labelled `10.0.0.5`.

A two-line label like `web-1` / `nginx` matches on its whole text **or** its first line, so the second line can describe the box without breaking the match.

### When the names don't line up

Open **Data → Shapes**. Every shape has a **Matches** box. Leave it blank to use the label, or type what the data says:

| Matches                      | Meaning                                                                                         |
| ---------------------------- | ----------------------------------------------------------------------------------------------- |
| `payments-v2`                | this name instead of the label                                                                  |
| `web-1, web-2, web-3`        | any of these; the shape shows the worst                                                         |
| `web-*`                      | a wildcard (compared in the forgiving form above)                                               |
| `/^pg-(primary\|replica)\b/` | a regular expression, tested against the raw names; `instance` values still carry their `:port` |

**Match by** (under Data) narrows every shape to one label or table column, e.g. `instance` or `hostname`. Use it when the automatic choice picks the wrong label, for example when a series carries both `service` and `job` and the job name collides with a shape.

A coloured dot beside each shape in that list shows whether the **current** results reach it, so you can fix a mapping while looking at the answer.

## Recipes

### Prometheus: hosts (node_exporter)

| Signal        | Query                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------ |
| CPU %         | `100 - avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100`                        |
| Memory used % | `100 * (1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)`                              |
| Disk used %   | `100 * (1 - node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"})` |
| Up / down     | `up{job="node"}` with value mappings `1 → UP` (green), `0 → DOWN` (red)                                |

Shapes named after the hosts (`web-1`, `db-primary`) match `instance="web-1:9100"`. Put all four queries in one panel and each host shows its worst.

### Prometheus: services (RED)

```promql
# error rate %, one series per service
100 * sum by (service) (rate(http_requests_total{status=~"5.."}[5m]))
    / sum by (service) (rate(http_requests_total[5m]))

# p95 latency (seconds; set the unit to s)
histogram_quantile(0.95, sum by (service, le) (rate(http_request_duration_seconds_bucket[5m])))

# request rate, as blue information (see Status and thresholds)
sum by (service) (rate(http_requests_total[5m]))
```

Use whatever label your instrumentation has (`service`, `app`, `job`); `by (…)` must keep it.

### Prometheus: Kubernetes (kube-state-metrics, cAdvisor)

| Signal             | Query                                                                                                                                            | Matches shapes named after |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------- |
| CPU per deployment | `sum by (deployment) (label_replace(rate(container_cpu_usage_seconds_total{container!=""}[5m]), "deployment", "$1", "pod", "(.*)-[^-]+-[^-]+"))` | the deployment             |
| Restarts (1h)      | `sum by (pod) (increase(kube_pod_container_status_restarts_total[1h]))`                                                                          | the pod (`postgres-0`)     |
| Node ready         | `sum by (node) (kube_node_status_condition{condition="Ready",status="true"})` with `1 → Ready`, `0 → NotReady`                                   | the node                   |
| Volume used %      | `100 * sum by (persistentvolumeclaim) (kubelet_volume_stats_used_bytes) / sum by (persistentvolumeclaim) (kubelet_volume_stats_capacity_bytes)`  | the claim                  |

Aggregate **to** the label you want with `sum by (…)`. A raw kube-state-metrics or kubelet series also carries `instance`, `job` and `node`, and when any well-known label is present only those are used, so a claim or condition name on its own would not be considered.

### Prometheus: containers (cAdvisor / Docker)

```promql
100 * sum by (name) (rate(container_cpu_usage_seconds_total{name!=""}[5m]))
```

### Loki: error rates from logs

```logql
sum by (app) (count_over_time({env="prod"} |= "level=error" [5m]))
```

Any LogQL metric query works; keep the label naming the thing in `by (…)`.

### SQL (PostgreSQL, MySQL, SQL Server…)

Return a table with one row per thing, the name in a text column:

```sql
SELECT hostname, cpu_percent, temperature_c
FROM   device_latest
WHERE  rack = 'A';
```

Each numeric column is a signal for the row's shape. Set **Match by** to `hostname` if the table has other text columns. Give each column its own thresholds with an override (Fields with name → Thresholds).

### InfluxDB

InfluxQL: `SELECT last("usage_user") FROM "cpu" WHERE $timeFilter GROUP BY "host"`. Flux: keep the tag with `group(columns: ["host"])`. The tag becomes a label, and the shape named after the host matches.

### CloudWatch

Query by dimension (for example `InstanceId` or `DBInstanceIdentifier`) and set the label/alias to the dimension value. Name the shapes after the instance ids or names, or type the ids into **Matches**.

### Anything else

If a source can't produce a label, give each query an alias or legend equal to the shape's name. The display name is one of a signal's names, and so is the query's refId: a shape whose **Matches** is `C` takes query C.

## Several metrics, one shape

Queries add up. A host can have CPU, memory, disk and up/down at once. The shape takes its **worst** signal for its colour and badge, and the tooltip lists them all. Give each query its own thresholds with an override (**Overrides → Fields returned by query**). In the [platform demo](examples.md#online-store--the-whole-platform), error rate, latency and saturation each have their own thresholds.

## Performance

The panel does one pass over the results per refresh, so hundreds of series and shapes are fine. Diagrams with over a few hundred shapes become hard to read before they become slow; split them and link the pieces with [drill-down](drill-down.md).

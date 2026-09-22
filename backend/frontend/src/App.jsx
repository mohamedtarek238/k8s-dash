import { useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowDown, Blocks, Box, Check, CheckCircle2, ChevronDown, ChevronRight, CircleDot, Copy, Cpu, Database,
  ExternalLink, FileCode, FileText, Gauge, Globe, HardDrive, Layers3, LayoutDashboard, Menu, Moon, Network,
  Package, PanelLeftClose, PanelLeftOpen, RefreshCw, Route, Search, Server, Settings2, Shield, Sun, Terminal,
  X, Zap
} from 'lucide-react';

import { api } from './api';
import { formatMemoryQuantity, formatStorageQuantity, formatCpuQuantity } from './formatters';

const nav = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'nodes', label: 'Nodes', icon: Server },
  { key: 'namespaces', label: 'Namespaces', icon: Layers3 },
  { key: 'pods', label: 'Pods', icon: Box },
  { key: 'deployments', label: 'Deployments', icon: Package },
  { key: 'services', label: 'Services', icon: Network },
  { key: 'ingresses', label: 'Ingress', icon: ExternalLink },
  { key: 'storage', label: 'Storage', icon: HardDrive },
  { key: 'rbac', label: 'RBAC', icon: Shield },
  { key: 'operators', label: 'Operators & CRDs', icon: Blocks },
  { key: 'events', label: 'Events', icon: Activity },
];

const formatDate = (value) => value ? new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const age = (value) => value ? `${Math.max(0, Math.floor((Date.now() - new Date(value)) / 86400000))}d` : '—';
const display = (value) => value === null || value === undefined || value === '' ? '—' : String(value);
const statusTone = (value = '') => String(value).toLowerCase().replace('notready', 'danger').replace('failed', 'danger').replace('warning', 'warning').replace('critical', 'danger').replace('ready', 'success').replace('running', 'success').replace('available', 'success').replace('healthy', 'success').replace('pending', 'warning').replace('progressing', 'info');

function useResource(loader, dependencies = []) {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const reload = () => {
    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    Promise.resolve()
      .then(() => loader())
      .then((data) => {
        if (!cancelled) setState({ loading: false, data, error: null });
      })
      .catch((error) => {
        if (!cancelled) setState({ loading: false, data: null, error });
      });
    return () => {
      cancelled = true;
    };
  };

  useEffect(() => {
    let cancelled = false;
    setState((prev) => (prev.loading ? prev : { ...prev, loading: true, error: null }));
    Promise.resolve()
      .then(() => loader())
      .then((data) => {
        if (!cancelled) setState({ loading: false, data, error: null });
      })
      .catch((error) => {
        if (!cancelled) setState({ loading: false, data: null, error });
      });
    return () => {
      cancelled = true;
    };
  }, dependencies);

  return { ...state, reload };
}

function ClusterSwitcher({ clusterId, onClusterChange }) {
  const [open, setOpen] = useState(false);
  const clusters = useResource(api.clusters);
  const items = clusters.data?.data || [];

  const current = items.find((c) => c.id === clusterId) || items.find((c) => c.isDefault) || items[0];

  const handleSelect = (id) => {
    setOpen(false);
    if (id !== clusterId) {
      api.setCluster(id);
      onClusterChange(id);
    }
  };

  if (!items.length) return null;

  return (
    <div className="cluster-switcher">
      <button
        className={`cluster-switcher-btn ${open ? 'open' : ''}`}
        onClick={() => setOpen(!open)}
        title="Switch active Kubernetes cluster"
      >
        <div className="cluster-btn-icon">
          <Database size={14} />
        </div>
        <div className="cluster-btn-text">
          <span className="cluster-btn-kicker">Cluster ({items.length})</span>
          <span className="cluster-btn-name">{current?.name || 'Select cluster'}</span>
        </div>
        <ChevronDown size={14} className="cluster-btn-chevron" />
      </button>

      {open && (
        <>
          <div className="cluster-dropdown-backdrop" onClick={() => setOpen(false)} />
          <div className="cluster-dropdown-menu">
            <div className="cluster-dropdown-head">
              <span>Target Cluster</span>
              <Badge tone="info">{items.length} Configured</Badge>
            </div>
            <div className="cluster-dropdown-list">
              {items.map((c) => {
                const isActive = c.id === current?.id;
                return (
                  <button
                    key={c.id}
                    className={`cluster-item ${isActive ? 'active' : ''}`}
                    onClick={() => handleSelect(c.id)}
                  >
                    <div className="cluster-item-main">
                      <Server size={14} className="cluster-item-icon" />
                      <div className="cluster-item-info">
                        <div className="cluster-item-title">
                          <strong>{c.name}</strong>
                          {c.isDefault && <span className="cluster-item-badge">default</span>}
                        </div>
                        <span className="cluster-item-server">{c.server}</span>
                      </div>
                    </div>
                    {isActive && <Check size={14} className="cluster-item-check" />}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Badge({ children, tone }) { return <span className={`badge ${tone || statusTone(children)}`}><span className="badge-dot" />{display(children)}</span>; }
function Empty({ title = 'No resources found', text = 'The backend returned an empty collection.' }) { return <div className="empty"><CircleDot size={22} /><strong>{title}</strong><span>{text}</span></div>; }
function ErrorState({ error, reload }) { return <div className="error-state"><AlertTriangle size={22} /><div><strong>Backend request failed</strong><span>{error?.message || 'Unable to load this resource.'}</span></div><button className="button subtle" onClick={reload}><RefreshCw size={15} /> Retry</button></div>; }
function Loading({ rows = 5 }) { return <div className="skeleton-list">{Array.from({ length: rows }, (_, i) => <div className="skeleton-row" key={i}><span /><span /><span /><span /></div>)}</div>; }
function Metric({ icon: Icon, label, value, detail, accent = 'teal' }) { return <div className={`metric metric-${accent}`}><div className="metric-icon"><Icon size={18} /></div><div><span>{label}</span><strong>{display(value)}</strong><small>{detail}</small></div></div>; }
function Toolbar({ search, setSearch, onRefresh, children }) { return <div className="toolbar"><div className="search"><Search size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter resources..." /></div>{children}<button className="icon-button" title="Refresh" onClick={onRefresh}><RefreshCw size={16} /></button></div>; }
function Table({ columns, rows, onRow, emptyTitle }) { if (!rows.length) return <Empty title={emptyTitle} />; return <div className="table-wrap"><table><thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={row.id || row.name || index} onClick={() => onRow?.(row)} className={onRow ? 'clickable' : ''}>{columns.map((column) => <td key={column.key}>{column.render ? column.render(row) : display(row[column.key])}</td>)}</tr>)}</tbody></table></div>; }
function PageHeader({ eyebrow, title, description, action }) { return <div className="page-header"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action}</div>; }

function Overview({ currentCluster }) {
  const cluster = useResource(api.cluster, [currentCluster]);
  const health = useResource(api.health, [currentCluster]);
  const events = useResource(api.events, [currentCluster]);
  const metrics = useResource(api.metricsOverview, [currentCluster]);
  const reload = () => {
    cluster.reload();
    health.reload();
    events.reload();
    metrics.reload();
  };
  const loading = cluster.loading;
  const c = cluster?.data;
  const m = metrics?.data;
  const recentEvents = (events?.data?.data || []).slice(0, 6);
  const issues = health?.data?.issues || [];

  return (
    <>
      <PageHeader
        eyebrow="Cluster / telemetry"
        title="Operations overview"
        description="A live view of the resources returned by your Kubernetes control plane."
        action={
          <button className="button primary" onClick={reload}>
            <RefreshCw size={16} /> Refresh data
          </button>
        }
      />
      {loading ? (
        <Loading rows={4} />
      ) : cluster.error ? (
        <ErrorState error={cluster.error} reload={reload} />
      ) : (
        <>
          <div className="metrics-grid">
            <Metric
              icon={Gauge}
              label="Cluster health"
              value={c?.health?.status || health?.data?.status || 'Unknown'}
              detail={c?.health?.message || `${health?.data?.score ?? '—'} / 100 score`}
              accent="teal"
            />
            <Metric
              icon={Server}
              label="Nodes"
              value={c?.nodes?.total}
              detail={`${c?.nodes?.ready || 0} ready · ${c?.nodes?.notReady || 0} not ready`}
              accent="blue"
            />
            <Metric
              icon={Box}
              label="Pods"
              value={c?.pods}
              detail="All namespaces"
              accent="amber"
            />
            <Metric
              icon={Layers3}
              label="Namespaces"
              value={c?.namespaces}
              detail={`${c?.deployments ?? 0} deployments`}
              accent="coral"
            />
          </div>

          <div className="resource-cards-grid">
            <div className="resource-usage-card">
              <div className="resource-card-header">
                <div className="resource-card-title">
                  <div className="resource-card-icon cpu">
                    <Cpu size={18} />
                  </div>
                  <h3>Cluster CPU usage</h3>
                </div>
                {m?.available ? (
                  <Badge tone={m.cluster?.cpu?.usagePercentage > 85 ? 'danger' : m.cluster?.cpu?.usagePercentage > 70 ? 'warning' : 'blue'}>
                    {m.cluster?.cpu?.usagePercentage ?? 0}%
                  </Badge>
                ) : (
                  <Badge tone="warning">Unavailable</Badge>
                )}
              </div>
              {m?.available ? (
                <>
                  <div className="resource-card-stats">
                    <span className="resource-card-value">{m.cluster?.cpu?.usageFormatted || '0m'}</span>
                    <span className="resource-card-pct">{m.cluster?.cpu?.usagePercentage ?? 0}% allocated</span>
                  </div>
                  <div className="resource-bar-track">
                    <div
                      className={`resource-bar-fill ${m.cluster?.cpu?.usagePercentage > 85 ? 'critical' : m.cluster?.cpu?.usagePercentage > 70 ? 'high' : 'cpu'}`}
                      style={{ width: `${Math.min(100, m.cluster?.cpu?.usagePercentage ?? 0)}%` }}
                    />
                  </div>
                  <div className="resource-card-details">
                    <span>Allocatable: <strong>{m.cluster?.cpu?.allocatableFormatted || '—'}</strong></span>
                    <span>Capacity: <strong>{m.cluster?.cpu?.capacityFormatted || '—'}</strong></span>
                  </div>
                </>
              ) : (
                <div className="unsupported" style={{ marginTop: 0 }}>
                  <Gauge size={16} />
                  <span>Live metrics unavailable</span>
                </div>
              )}
            </div>

            <div className="resource-usage-card">
              <div className="resource-card-header">
                <div className="resource-card-title">
                  <div className="resource-card-icon memory">
                    <HardDrive size={18} />
                  </div>
                  <h3>Cluster memory usage</h3>
                </div>
                {m?.available ? (
                  <Badge tone={m.cluster?.memory?.usagePercentage > 85 ? 'danger' : m.cluster?.memory?.usagePercentage > 70 ? 'warning' : 'purple'}>
                    {m.cluster?.memory?.usagePercentage ?? 0}%
                  </Badge>
                ) : (
                  <Badge tone="warning">Unavailable</Badge>
                )}
              </div>
              {m?.available ? (
                <>
                  <div className="resource-card-stats">
                    <span className="resource-card-value">{m.cluster?.memory?.usageFormatted || '0 GiB'}</span>
                    <span className="resource-card-pct">{m.cluster?.memory?.usagePercentage ?? 0}% allocated</span>
                  </div>
                  <div className="resource-bar-track">
                    <div
                      className={`resource-bar-fill ${m.cluster?.memory?.usagePercentage > 85 ? 'critical' : m.cluster?.memory?.usagePercentage > 70 ? 'high' : 'memory'}`}
                      style={{ width: `${Math.min(100, m.cluster?.memory?.usagePercentage ?? 0)}%` }}
                    />
                  </div>
                  <div className="resource-card-details">
                    <span>Allocatable: <strong>{m.cluster?.memory?.allocatableFormatted || '—'}</strong></span>
                    <span>Capacity: <strong>{m.cluster?.memory?.capacityFormatted || '—'}</strong></span>
                  </div>
                </>
              ) : (
                <div className="unsupported" style={{ marginTop: 0 }}>
                  <Gauge size={16} />
                  <span>Live metrics unavailable</span>
                </div>
              )}
            </div>
          </div>

          <div className="split-grid">
            <section className="panel">
              <div className="panel-head">
                <div>
                  <span className="eyebrow">Control plane</span>
                  <h2>Cluster identity</h2>
                </div>
                <Badge tone="success">Connected</Badge>
              </div>
              <div className="identity-grid">
                <div><span>Context</span><strong>{display(c?.context)}</strong></div>
                <div><span>Cluster</span><strong>{display(c?.cluster)}</strong></div>
                <div><span>Server</span><strong>{display(c?.server)}</strong></div>
                <div><span>Kubernetes</span><strong>{display(c?.version?.gitVersion || c?.version?.major)}</strong></div>
              </div>
              {m?.available ? (
                <div className="telemetry-live-status">
                  <Activity size={16} />
                  <span>Metrics Server active · Live cluster and node telemetry streaming</span>
                </div>
              ) : (
                <div className="unsupported">
                  <Gauge size={17} />
                  <span>Live metrics unavailable. Capacity and allocatable values are available on the Nodes page.</span>
                </div>
              )}
            </section>
            <section className="panel">
              <div className="panel-head">
                <div>
                  <span className="eyebrow">Signal</span>
                  <h2>Health findings</h2>
                </div>
                <button className="text-button" onClick={() => (window.location.hash = '#events')}>
                  View events <ChevronRight size={15} />
                </button>
              </div>
              {issues.length ? (
                <div className="issue-list">
                  {issues.slice(0, 5).map((issue, i) => (
                    <div className="issue" key={i}>
                      <Badge tone={issue.severity === 'critical' ? 'danger' : 'warning'}>{issue.severity}</Badge>
                      <div>
                        <strong>{issue.resourceName}</strong>
                        <span>{issue.message}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty title="No active findings" text="Diagnostics returned a clean cluster signal." />
              )}
            </section>
          </div>

          {m?.available && m?.nodes?.length > 0 && (
            <section className="panel">
              <div className="panel-head">
                <div>
                  <span className="eyebrow">Infrastructure telemetry</span>
                  <h2>Node resource utilization</h2>
                </div>
                <span className="muted">{m.nodes.length} node{m.nodes.length === 1 ? '' : 's'} reporting</span>
              </div>
              <Table
                rows={m.nodes}
                emptyTitle="No node metrics available"
                columns={[
                  { key: 'name', label: 'Node', render: (r) => <strong className="resource-name"><Server size={16} />{r.name}</strong> },
                  {
                    key: 'cpu',
                    label: 'CPU usage / allocatable',
                    render: (r) => (
                      <div className="mini-usage-cell">
                        <div className="mini-usage-info">
                          <span className="mono">{r.cpu?.usageFormatted} / {r.cpu?.allocatableFormatted}</span>
                          <span className="pct">{r.cpu?.usagePercentage}%</span>
                        </div>
                        <div className="mini-progress-track">
                          <div
                            className={`mini-progress-fill ${r.cpu?.usagePercentage > 85 ? 'critical' : r.cpu?.usagePercentage > 70 ? 'high' : 'cpu'}`}
                            style={{ width: `${Math.min(100, r.cpu?.usagePercentage || 0)}%` }}
                          />
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: 'memory',
                    label: 'Memory usage / allocatable',
                    render: (r) => (
                      <div className="mini-usage-cell">
                        <div className="mini-usage-info">
                          <span className="mono">{r.memory?.usageFormatted} / {r.memory?.allocatableFormatted}</span>
                          <span className="pct">{r.memory?.usagePercentage}%</span>
                        </div>
                        <div className="mini-progress-track">
                          <div
                            className={`mini-progress-fill ${r.memory?.usagePercentage > 85 ? 'critical' : r.memory?.usagePercentage > 70 ? 'high' : 'memory'}`}
                            style={{ width: `${Math.min(100, r.memory?.usagePercentage || 0)}%` }}
                          />
                        </div>
                      </div>
                    ),
                  },
                  { key: 'cpuCapacity', label: 'CPU capacity', render: (r) => <span className="mono">{r.cpu?.capacityFormatted || '—'}</span> },
                  { key: 'memoryCapacity', label: 'Memory capacity', render: (r) => <span className="mono">{r.memory?.capacityFormatted || '—'}</span> },
                ]}
              />
            </section>
          )}

          <section className="panel">
            <div className="panel-head">
              <div>
                <span className="eyebrow">Recent activity</span>
                <h2>Cluster events</h2>
              </div>
              <span className="muted">Newest first</span>
            </div>
            <EventTable events={recentEvents} />
          </section>
        </>
      )}
    </>
  );
}

function EventTable({ events }) { return <Table rows={events} emptyTitle="No recent events" columns={[{ key: 'type', label: 'Type', render: (r) => <Badge tone={r.type === 'Warning' ? 'warning' : 'info'}>{r.type || 'Normal'}</Badge> }, { key: 'reason', label: 'Reason' }, { key: 'involvedObject', label: 'Object', render: (r) => <span className="mono">{r.involvedObject?.display || '—'}</span> }, { key: 'message', label: 'Message', render: (r) => <span className="truncate">{r.message}</span> }, { key: 'lastTimestamp', label: 'Last seen', render: (r) => formatDate(r.lastTimestamp || r.firstTimestamp) }]} />; }

function Nodes({ onSelect }) {
  const resource = useResource(api.nodes);
  const rows = resource.data?.data || [];
  return (
    <>
      <PageHeader
        eyebrow="Infrastructure"
        title="Nodes"
        description="Readiness, roles, live usage, capacity, and condition signals from every cluster node."
        action={<button className="button subtle" onClick={resource.reload}><RefreshCw size={16} /> Refresh</button>}
      />
      {resource.loading ? (
        <Loading />
      ) : resource.error ? (
        <ErrorState error={resource.error} reload={resource.reload} />
      ) : (
        <Table
          rows={rows}
          onRow={onSelect}
          emptyTitle="No nodes returned"
          columns={[
            { key: 'name', label: 'Node', render: (r) => <strong className="resource-name"><Server size={16} />{r.name}</strong> },
            { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
            { key: 'roles', label: 'Roles', render: (r) => r.roles?.join(', ') || '—' },
            { key: 'kubernetesVersion', label: 'Version' },
            {
              key: 'cpuUsage',
              label: 'CPU usage',
              render: (r) => r.cpuUsage ? (
                <div className="mini-usage-cell">
                  <div className="mini-usage-info">
                    <span className="mono">{r.cpuUsage}</span>
                    <span className="pct">{r.cpuUsagePercentage}%</span>
                  </div>
                  <div className="mini-progress-track">
                    <div
                      className={`mini-progress-fill ${r.cpuUsagePercentage > 85 ? 'critical' : r.cpuUsagePercentage > 70 ? 'high' : 'cpu'}`}
                      style={{ width: `${Math.min(100, r.cpuUsagePercentage)}%` }}
                    />
                  </div>
                </div>
              ) : <span className="muted">—</span>,
            },
            { key: 'cpuCapacity', label: 'CPU capacity', render: (r) => <span className="mono">{display(r.cpuCapacity)}</span> },
            {
              key: 'memoryUsage',
              label: 'Memory usage',
              render: (r) => r.memoryUsage ? (
                <div className="mini-usage-cell">
                  <div className="mini-usage-info">
                    <span className="mono">{r.memoryUsage}</span>
                    <span className="pct">{r.memoryUsagePercentage}%</span>
                  </div>
                  <div className="mini-progress-track">
                    <div
                      className={`mini-progress-fill ${r.memoryUsagePercentage > 85 ? 'critical' : r.memoryUsagePercentage > 70 ? 'high' : 'memory'}`}
                      style={{ width: `${Math.min(100, r.memoryUsagePercentage)}%` }}
                    />
                  </div>
                </div>
              ) : <span className="muted">—</span>,
            },
            { key: 'memoryCapacity', label: 'Memory capacity', render: (r) => <span className="mono">{formatMemoryQuantity(r.memoryCapacity)}</span> },
            { key: 'creationTimestamp', label: 'Age', render: (r) => age(r.creationTimestamp) },
          ]}
        />
      )}
    </>
  );
}

function Namespaces({ onSelect }) { const resource = useResource(api.namespaces); const rows = resource.data?.data || []; return <><PageHeader eyebrow="Organization" title="Namespaces" description="Namespace lifecycle and labels returned by the core API." action={<button className="button subtle" onClick={resource.reload}><RefreshCw size={16} /> Refresh</button>} />{resource.loading ? <Loading /> : resource.error ? <ErrorState error={resource.error} reload={resource.reload} /> : <Table rows={rows} onRow={onSelect} emptyTitle="No namespaces returned" columns={[{ key: 'name', label: 'Namespace', render: (r) => <strong className="resource-name"><Layers3 size={16} />{r.name}</strong> }, { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> }, { key: 'creationTimestamp', label: 'Created', render: (r) => formatDate(r.creationTimestamp) }, { key: 'labels', label: 'Labels', render: (r) => Object.keys(r.labels || {}).length || '—' }, { key: 'resourceSummary', label: 'Resource summary', render: () => <span className="muted">Not exposed</span> }]} />}</>; }

function Pods({ onSelect }) { const [namespace, setNamespace] = useState(''); const [search, setSearch] = useState(''); const resource = useResource(() => api.pods(namespace), [namespace]); const rows = (resource.data?.data || []).filter((r) => `${r.name} ${r.namespace}`.toLowerCase().includes(search.toLowerCase())); return <><PageHeader eyebrow="Workloads" title="Pods" description="Inspect pod health, placement, readiness, and container state across namespaces." action={<button className="button subtle" onClick={resource.reload}><RefreshCw size={16} /> Refresh</button>} /><Toolbar search={search} setSearch={setSearch} onRefresh={resource.reload}><input className="select" value={namespace} onChange={(e) => setNamespace(e.target.value)} placeholder="All namespaces" /></Toolbar>{resource.loading ? <Loading /> : resource.error ? <ErrorState error={resource.error} reload={resource.reload} /> : <Table rows={rows} onRow={onSelect} emptyTitle="No matching pods" columns={[{ key: 'name', label: 'Pod', render: (r) => <strong className="resource-name"><Box size={16} />{r.name}</strong> }, { key: 'namespace', label: 'Namespace' }, { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> }, { key: 'readiness', label: 'Ready', render: (r) => `${r.readiness?.ready || 0}/${r.readiness?.total || 0}` }, { key: 'restartCount', label: 'Restarts' }, { key: 'nodeName', label: 'Node' }, { key: 'podIP', label: 'IP', render: (r) => <span className="mono">{display(r.podIP)}</span> }, { key: 'creationTimestamp', label: 'Age', render: (r) => age(r.creationTimestamp) }]} />}</>; }

function Deployments({ onSelect }) { const [namespace, setNamespace] = useState(''); const [search, setSearch] = useState(''); const resource = useResource(() => api.deployments(namespace), [namespace]); const rows = (resource.data?.data || []).filter((r) => `${r.name} ${r.namespace}`.toLowerCase().includes(search.toLowerCase())); return <><PageHeader eyebrow="Workloads" title="Deployments" description="Replica health and rollout state for applications across the cluster." action={<button className="button subtle" onClick={resource.reload}><RefreshCw size={16} /> Refresh</button>} /><Toolbar search={search} setSearch={setSearch} onRefresh={resource.reload}><input className="select" value={namespace} onChange={(e) => setNamespace(e.target.value)} placeholder="All namespaces" /></Toolbar>{resource.loading ? <Loading /> : resource.error ? <ErrorState error={resource.error} reload={resource.reload} /> : <Table rows={rows} onRow={onSelect} emptyTitle="No matching deployments" columns={[{ key: 'name', label: 'Deployment', render: (r) => <strong className="resource-name"><Package size={16} />{r.name}</strong> }, { key: 'namespace', label: 'Namespace' }, { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> }, { key: 'desiredReplicas', label: 'Desired' }, { key: 'availableReplicas', label: 'Available' }, { key: 'readyReplicas', label: 'Ready' }, { key: 'updatedReplicas', label: 'Updated' }, { key: 'creationTimestamp', label: 'Age', render: (r) => age(r.creationTimestamp) }]} />}</>; }

function Services({ onSelect }) {
  const [namespace, setNamespace] = useState('');
  const [search, setSearch] = useState('');
  const resource = useResource(() => api.services(namespace), [namespace]);
  const rows = (resource.data?.data || []).filter((r) => `${r.name} ${r.namespace}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <PageHeader eyebrow="Networking" title="Services" description="Service discovery endpoints and exposed ports." action={<button className="button subtle" onClick={resource.reload}><RefreshCw size={16} /> Refresh</button>} />
      <Toolbar search={search} setSearch={setSearch} onRefresh={resource.reload}>
        <input className="select" value={namespace} onChange={(e) => setNamespace(e.target.value)} placeholder="All namespaces" />
      </Toolbar>
      {resource.loading ? (
        <Loading />
      ) : resource.error ? (
        <ErrorState error={resource.error} reload={resource.reload} />
      ) : (
        <Table
          rows={rows}
          onRow={onSelect}
          emptyTitle="No services returned"
          columns={[
            { key: 'name', label: 'Service', render: (r) => <strong className="resource-name"><Network size={16} />{r.name}</strong> },
            { key: 'namespace', label: 'Namespace' },
            { key: 'type', label: 'Type', render: (r) => <Badge tone="info">{r.type}</Badge> },
            { key: 'clusterIP', label: 'Cluster IP', render: (r) => <span className="mono">{display(r.clusterIP)}</span> },
            { key: 'externalIPs', label: 'External IP', render: (r) => r.externalIPs?.join(', ') || '—' },
            { key: 'ports', label: 'Ports', render: (r) => r.ports?.map((p) => `${p.port}${p.nodePort ? `:${p.nodePort}` : ''}/${p.protocol}`).join(', ') || '—' },
            { key: 'creationTimestamp', label: 'Age', render: (r) => age(r.creationTimestamp) },
          ]}
        />
      )}
    </>
  );
}

function Ingresses({ onSelect }) {
  const [activeTab, setActiveTab] = useState('httproutes');
  const [namespace, setNamespace] = useState('');
  const [search, setSearch] = useState('');

  const httpRoutesResource = useResource(() => api.httpRoutes(namespace), [namespace]);
  const ingressesResource = useResource(() => api.ingresses(namespace), [namespace]);
  const gatewaysResource = useResource(() => api.gateways(namespace), [namespace]);

  const currentResource =
    activeTab === 'httproutes'
      ? httpRoutesResource
      : activeTab === 'gateways'
      ? gatewaysResource
      : ingressesResource;

  const httpRouteRows = (httpRoutesResource.data?.data || []).filter((r) =>
    `${r.name} ${r.namespace} ${r.hostnames?.join(' ') || ''}`.toLowerCase().includes(search.toLowerCase())
  );

  const ingressRows = (ingressesResource.data?.data || []).filter((r) =>
    `${r.name} ${r.namespace} ${r.hosts?.join(' ') || ''}`.toLowerCase().includes(search.toLowerCase())
  );

  const gatewayRows = (gatewaysResource.data?.data || []).filter((r) =>
    `${r.name} ${r.namespace}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <PageHeader
        eyebrow="Networking & Ingress Gateway"
        title="Ingress & Kong Gateway"
        description="HTTP routing entry points, Kong API Gateway routes, hosts, paths, and backend services."
        action={
          <button className="button subtle" onClick={() => { httpRoutesResource.reload(); ingressesResource.reload(); gatewaysResource.reload(); }}>
            <RefreshCw size={16} /> Refresh
          </button>
        }
      />

      <div className="metrics-grid">
        <Metric
          icon={Route}
          label="Kong HTTPRoutes"
          value={httpRoutesResource.data?.data?.length ?? 0}
          detail={`${(httpRoutesResource.data?.data || []).filter((r) => r.controller?.detected || r.kong?.hasKongAnnotations).length} Kong managed`}
          accent="teal"
        />
        <Metric
          icon={ExternalLink}
          label="Standard Ingresses"
          value={ingressesResource.data?.data?.length ?? 0}
          detail="Classic Ingress rules"
          accent="blue"
        />
        <Metric
          icon={Zap}
          label="Gateways"
          value={gatewaysResource.data?.data?.length ?? 0}
          detail="Gateway API instances"
          accent="amber"
        />
        <Metric
          icon={Shield}
          label="Kong Plugins"
          value={new Set((httpRoutesResource.data?.data || []).flatMap((r) => r.kong?.plugins || [])).size}
          detail="Active attached plugins"
          accent="purple"
        />
      </div>

      <div className="sub-nav-tabs">
        <button
          className={`sub-nav-tab ${activeTab === 'httproutes' ? 'active' : ''}`}
          onClick={() => setActiveTab('httproutes')}
        >
          <Route size={15} /> Kong HTTPRoutes ({httpRoutesResource.data?.data?.length ?? '—'})
        </button>
        <button
          className={`sub-nav-tab ${activeTab === 'ingresses' ? 'active' : ''}`}
          onClick={() => setActiveTab('ingresses')}
        >
          <ExternalLink size={15} /> Standard Ingresses ({ingressesResource.data?.data?.length ?? '—'})
        </button>
        <button
          className={`sub-nav-tab ${activeTab === 'gateways' ? 'active' : ''}`}
          onClick={() => setActiveTab('gateways')}
        >
          <Zap size={15} /> Gateways ({gatewaysResource.data?.data?.length ?? '—'})
        </button>
      </div>

      <Toolbar search={search} setSearch={setSearch} onRefresh={currentResource.reload}>
        <input
          className="select"
          value={namespace}
          onChange={(e) => setNamespace(e.target.value)}
          placeholder="All namespaces"
        />
      </Toolbar>

      {currentResource.loading ? (
        <Loading />
      ) : currentResource.error ? (
        <ErrorState error={currentResource.error} reload={currentResource.reload} />
      ) : activeTab === 'httproutes' ? (
        <Table
          rows={httpRouteRows}
          onRow={(r) => onSelect?.({ type: 'httproute', value: r })}
          emptyTitle="No HTTPRoute resources found"
          columns={[
            {
              key: 'name',
              label: 'Route Name',
              render: (r) => (
                <strong className="resource-name">
                  <Route size={16} />
                  {r.name}
                </strong>
              ),
            },
            { key: 'namespace', label: 'Namespace' },
            {
              key: 'parentRefs',
              label: 'Gateway',
              render: (r) => r.parentRefs?.map((p) => p.name).join(', ') || 'kong-gateway',
            },
            {
              key: 'hostnames',
              label: 'Hostnames',
              render: (r) => (r.hostnames && r.hostnames.length ? r.hostnames.join(', ') : '*'),
            },
            {
              key: 'paths',
              label: 'Paths',
              render: (r) => r.paths?.map((p) => p.value || p).join(', ') || '/',
            },
            {
              key: 'plugins',
              label: 'Kong Plugins',
              render: (r) =>
                r.kong?.plugins && r.kong.plugins.length > 0
                  ? r.kong.plugins.map((p) => (
                      <span key={p} className="anno-tag">
                        <Shield size={10} /> {p}
                      </span>
                    ))
                  : '—',
            },
            {
              key: 'controller',
              label: 'Controller',
              render: (r) => (
                <Badge tone={r.controller?.detected ? 'success' : 'info'}>
                  {r.controller?.detected ? 'Kong' : 'Standard'}
                </Badge>
              ),
            },
            { key: 'age', label: 'Age', render: (r) => r.age || age(r.creationTimestamp) },
          ]}
        />
      ) : activeTab === 'gateways' ? (
        <Table
          rows={gatewayRows}
          onRow={(r) => onSelect?.({ type: 'gateway', value: r })}
          emptyTitle="No Gateway resources found"
          columns={[
            {
              key: 'name',
              label: 'Gateway',
              render: (r) => (
                <strong className="resource-name">
                  <Zap size={16} />
                  {r.name}
                </strong>
              ),
            },
            { key: 'namespace', label: 'Namespace' },
            { key: 'gatewayClassName', label: 'Gateway Class' },
            {
              key: 'listeners',
              label: 'Listeners',
              render: (r) =>
                r.listeners?.map((l) => `${l.name} (${l.protocol}:${l.port})`).join(', ') || '—',
            },
            {
              key: 'addresses',
              label: 'Addresses',
              render: (r) => r.addresses?.map((a) => a.value).join(', ') || '—',
            },
            { key: 'age', label: 'Age', render: (r) => r.age || age(r.creationTimestamp) },
          ]}
        />
      ) : (
        <Table
          rows={ingressRows}
          onRow={(r) => onSelect?.({ type: 'ingress', value: r })}
          emptyTitle="No Ingress resources found"
          columns={[
            {
              key: 'name',
              label: 'Ingress',
              render: (r) => (
                <strong className="resource-name">
                  <ExternalLink size={16} />
                  {r.name}
                </strong>
              ),
            },
            { key: 'namespace', label: 'Namespace' },
            {
              key: 'hosts',
              label: 'Hosts',
              render: (r) => (r.hosts && r.hosts.length ? r.hosts.join(', ') : '—'),
            },
            {
              key: 'addresses',
              label: 'Addresses',
              render: (r) =>
                r.addresses && r.addresses.length
                  ? r.addresses.map((a) => a.ip || a.hostname).filter(Boolean).join(', ') || '—'
                  : '—',
            },
            { key: 'ingressClass', label: 'Class', render: (r) => r.ingressClass || '—' },
            {
              key: 'controller',
              label: 'Controller',
              render: (r) => (
                <Badge tone={r.controller?.detected ? 'success' : 'info'}>
                  {r.controller?.detected ? 'Kong' : 'Standard'}
                </Badge>
              ),
            },
            { key: 'age', label: 'Age', render: (r) => r.age || age(r.creationTimestamp) },
          ]}
        />
      )}
    </>
  );
}

function Events() { const [namespace, setNamespace] = useState(''); const [search, setSearch] = useState(''); const resource = useResource(() => api.events(namespace), [namespace]); const rows = (resource.data?.data || []).filter((r) => `${r.reason} ${r.message} ${r.involvedObject?.display}`.toLowerCase().includes(search.toLowerCase())); return <><PageHeader eyebrow="Observability" title="Events" description="Newest-first signals emitted by Kubernetes resources." action={<button className="button subtle" onClick={resource.reload}><RefreshCw size={16} /> Refresh</button>} /><Toolbar search={search} setSearch={setSearch} onRefresh={resource.reload}><input className="select" value={namespace} onChange={(e) => setNamespace(e.target.value)} placeholder="All namespaces" /></Toolbar>{resource.loading ? <Loading /> : resource.error ? <ErrorState error={resource.error} reload={resource.reload} /> : <EventTable events={rows} />}</>; }

function YamlViewer({ resourceType, namespace, name, loader }) {
  const [copied, setCopied] = useState(false);
  const resource = useResource(
    () => (loader ? loader() : api.yaml(resourceType, namespace, name)),
    [resourceType, namespace, name, loader]
  );

  const handleCopy = () => {
    if (resource.data?.yaml) {
      navigator.clipboard.writeText(resource.data.yaml);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="yaml-viewer-wrapper">
      <div className="yaml-viewer-toolbar">
        <div className="yaml-info">
          {resource.data?.kind && <Badge tone="info">{resource.data.kind}</Badge>}
          {resource.data?.apiVersion && <span className="yaml-version mono">{resource.data.apiVersion}</span>}
        </div>
        <div className="yaml-actions">
          <button className="button subtle small" onClick={handleCopy} disabled={resource.loading || !resource.data?.yaml} title="Copy YAML to clipboard">
            {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
            <span>{copied ? 'Copied!' : 'Copy YAML'}</span>
          </button>
          <button className="button subtle small" onClick={resource.reload} disabled={resource.loading} title="Refresh live YAML from Kubernetes">
            <RefreshCw size={14} className={resource.loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>
      {resource.loading ? (
        <div className="terminal loading-terminal">Loading YAML manifest...</div>
      ) : resource.error ? (
        <ErrorState error={resource.error} reload={resource.reload} />
      ) : (
        <div className="yaml-pre-container">
          <pre className="yaml-code mono"><code>{resource.data?.yaml}</code></pre>
        </div>
      )}
    </div>
  );
}

function DetailPanel({ title, resourceType, namespace, name, children, onClose }) {
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    setTab('overview');
  }, [resourceType, namespace, name]);

  return (
    <div className="backdrop" onClick={onClose}>
      <aside className="detail-panel" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}><X size={18} /></button>
        <span className="eyebrow">Resource detail</span>
        <h2>{title}</h2>
        <div className="detail-tabs">
          <button className={`detail-tab ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>Overview</button>
          <button className={`detail-tab ${tab === 'yaml' ? 'active' : ''}`} onClick={() => setTab('yaml')}><FileCode size={14} /> YAML</button>
        </div>
        {tab === 'overview' ? children : <YamlViewer resourceType={resourceType} namespace={namespace} name={name} />}
      </aside>
    </div>
  );
}

function KeyValues({ values }) { return <div className="kv-grid">{Object.entries(values).map(([key, value]) => <div key={key}><span>{key}</span><strong>{typeof value === 'object' ? JSON.stringify(value) : display(value)}</strong></div>)}</div>; }

function NodeDetail({ node, onClose }) { return <DetailPanel key={`node-${node.name}`} title={node.name} resourceType="nodes" name={node.name} onClose={onClose}><Badge>{node.status}</Badge><KeyValues values={{ Roles: node.roles?.join(', '), Version: node.kubernetesVersion, OS: node.os, Architecture: node.architecture, 'CPU capacity': node.cpuCapacity, 'Memory capacity': formatMemoryQuantity(node.memoryCapacity || node.capacity?.memory), 'Allocatable CPU': node.allocatableCpu, 'Allocatable memory': formatMemoryQuantity(node.allocatableMemory || node.allocatable?.memory) }} /><div className="unsupported"><Gauge size={17} /><span>Current CPU and memory usage are not available from the backend.</span></div><h3>Conditions</h3><div className="mini-list">{node.conditions?.map((condition, i) => <div key={i}><Badge tone={condition.status === 'True' ? 'success' : 'warning'}>{condition.type}</Badge><span>{condition.message || condition.reason || condition.status}</span></div>)}</div></DetailPanel>; }

function NamespaceDetail({ namespace, onClose }) { return <DetailPanel key={`namespace-${namespace.name}`} title={namespace.name} resourceType="namespaces" name={namespace.name} onClose={onClose}><Badge>{namespace.status}</Badge><KeyValues values={{ Status: namespace.status, Created: formatDate(namespace.creationTimestamp), Labels: Object.keys(namespace.labels || {}).length }} /><div className="unsupported"><Layers3 size={17} /><span>Per-namespace pod, deployment, service, quota, CPU, and memory totals are not exposed by the backend.</span></div></DetailPanel>; }

function PodDetail({ pod, onClose }) {
  const detail = useResource(() => api.pod(pod.namespace, pod.name), [pod.namespace, pod.name]);
  const [showLogs, setShowLogs] = useState(false);
  return (
    <DetailPanel key={`pod-${pod.namespace}-${pod.name}`} title={pod.name} resourceType="pods" namespace={pod.namespace} name={pod.name} onClose={onClose}>
      {detail.loading ? (
        <Loading rows={3} />
      ) : detail.error ? (
        <ErrorState error={detail.error} reload={detail.reload} />
      ) : (
        <>
          <Badge>{detail.data?.status?.phase || pod.status}</Badge>
          <KeyValues values={{ Namespace: detail.data?.metadata?.namespace, Node: detail.data?.node, IP: detail.data?.ip, Restarts: detail.data?.restartCount, ServiceAccount: detail.data?.spec?.serviceAccountName, Created: formatDate(detail.data?.metadata?.creationTimestamp) }} />
          <div className="detail-actions">
            <button className="button primary" onClick={() => setShowLogs(true)}><Terminal size={16} /> View logs</button>
          </div>
          <h3>Containers</h3>
          <div className="mini-list">
            {detail.data?.containers?.map((container) => (
              <div key={container.name}><strong>{container.name}</strong><span>{container.image}</span></div>
            ))}
          </div>
          {detail.data?.volumes && detail.data.volumes.length > 0 && (
            <>
              <h3>Mounted Volumes ({detail.data.volumes.length})</h3>
              <div className="mini-list">
                {detail.data.volumes.map((vol, idx) => (
                  <div key={idx} style={{ flexDirection: 'column', alignItems: 'stretch', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong className="resource-name"><HardDrive size={14} />{vol.name}</strong>
                      <Badge tone="info">{vol.type}</Badge>
                    </div>
                    {vol.pvcName && (
                      <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                        Bound PVC: <span className="mono" style={{ color: 'var(--teal)' }}>{vol.pvcName}</span>
                      </div>
                    )}
                    {vol.mounts && vol.mounts.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '2px' }}>
                        {vol.mounts.map((m, mIdx) => (
                          <span key={mIdx} className="anno-tag">
                            {m.container}: {m.mountPath} {m.readOnly ? '(ro)' : '(rw)'}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
          <h3>Related events</h3>
          <EventTable events={detail.data?.events || []} />
        </>
      )}
      {showLogs && <Logs pod={pod} onClose={() => setShowLogs(false)} />}
    </DetailPanel>
  );
}

function DeploymentDetail({ deployment, onClose }) { const detail = useResource(() => api.deployment(deployment.namespace, deployment.name), [deployment.namespace, deployment.name]); return <DetailPanel key={`deployment-${deployment.namespace}-${deployment.name}`} title={deployment.name} resourceType="deployments" namespace={deployment.namespace} name={deployment.name} onClose={onClose}>{detail.loading ? <Loading rows={3} /> : detail.error ? <ErrorState error={detail.error} reload={detail.reload} /> : <><Badge>{detail.data?.summary?.status || deployment.status}</Badge><KeyValues values={{ Namespace: detail.data?.metadata?.namespace, Desired: detail.data?.summary?.desiredReplicas, Available: detail.data?.summary?.availableReplicas, Ready: detail.data?.summary?.readyReplicas, Updated: detail.data?.summary?.updatedReplicas, Created: formatDate(detail.data?.metadata?.creationTimestamp) }} /><h3>Strategy</h3><pre className="json-block">{JSON.stringify(detail.data?.spec?.strategy || {}, null, 2)}</pre></>}</DetailPanel>; }

function ServiceDetail({ service, onClose }) {
  const detail = useResource(() => api.service(service.namespace, service.name), [service.namespace, service.name]);
  const data = detail.data || service;
  return (
    <DetailPanel
      key={`service-${service.namespace}-${service.name}`}
      title={service.name}
      resourceType="services"
      namespace={service.namespace}
      name={service.name}
      onClose={onClose}
    >
      {detail.loading ? (
        <Loading rows={3} />
      ) : detail.error ? (
        <ErrorState error={detail.error} reload={detail.reload} />
      ) : (
        <>
          <Badge tone="info">{data.type || 'ClusterIP'}</Badge>
          <KeyValues
            values={{
              Namespace: data.namespace,
              Type: data.type,
              'Cluster IP': data.clusterIP,
              'External IPs': data.externalIPs?.join(', ') || '—',
              Ports: data.ports?.map((p) => `${p.port}${p.nodePort ? `:${p.nodePort}` : ''}/${p.protocol}`).join(', ') || '—',
              Created: formatDate(data.creationTimestamp),
            }}
          />
        </>
      )}
    </DetailPanel>
  );
}

function RoutingChainDiagram({ routing }) {
  if (!routing) return null;
  const gw = routing.gateway || {};
  const entry = routing.entry || {};
  const backends = routing.backends || [];

  return (
    <div className="routing-chain">
      <div className="routing-step">
        <div className="routing-step-icon"><Globe size={16} /></div>
        <div className="routing-step-content">
          <strong>Client / Inbound Traffic</strong>
          <span>Incoming HTTP/HTTPS requests to cluster ingress entrypoint</span>
        </div>
      </div>

      <div className="routing-arrow-down"><ArrowDown size={14} /></div>

      <div className="routing-step">
        <div className="routing-step-icon"><Zap size={16} /></div>
        <div className="routing-step-content">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <strong>{gw.type === 'kong' ? 'Kong API Gateway' : 'Ingress Gateway'}</strong>
            <Badge tone="info">{gw.detected ? 'Kong Controller' : 'Gateway Controller'}</Badge>
          </div>
          <span>Controller: {gw.controllerName || 'ingress-controllers.konghq.com/kong'} · Class: {gw.className || 'kong'}</span>
        </div>
      </div>

      <div className="routing-arrow-down"><ArrowDown size={14} /></div>

      <div className="routing-step">
        <div className="routing-step-icon"><Route size={16} /></div>
        <div className="routing-step-content">
          <strong>{entry.resourceType || 'Route'}: {entry.name}</strong>
          <span>Hosts: {entry.hosts && entry.hosts.length ? entry.hosts.join(', ') : '*'} · Paths: {entry.paths && entry.paths.length ? entry.paths.join(', ') : '/'}</span>
        </div>
      </div>

      <div className="routing-arrow-down"><ArrowDown size={14} /></div>

      {backends.length > 0 ? (
        backends.map((b, i) => (
          <div className="routing-step" key={i}>
            <div className="routing-step-icon"><Network size={16} /></div>
            <div className="routing-step-content">
              <strong>Service: {b.namespace}/{b.serviceName}</strong>
              <span>
                Port: {b.port || '—'} · Weight: {b.weight ?? 1} · Pods: {b.readyPods ?? b.totalPods ?? 0} ready
                {b.pods && b.pods.length > 0 && ` (${b.pods.map((p) => p.podName).filter(Boolean).slice(0, 3).join(', ')})`}
              </span>
            </div>
          </div>
        ))
      ) : (
        <div className="routing-step">
          <div className="routing-step-icon"><Network size={16} /></div>
          <div className="routing-step-content">
            <strong>Backend Services</strong>
            <span>No backend services detected in routing chain</span>
          </div>
        </div>
      )}
    </div>
  );
}

function KongCard({ kong, controller }) {
  const [openConfig, setOpenConfig] = useState({});

  if (!kong && !controller?.detected) return null;

  const toggleConfig = (name) => {
    setOpenConfig((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const hasKong = controller?.detected || kong?.hasKongAnnotations || (kong?.plugins && kong.plugins.length > 0);

  return (
    <div style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
      <h3 style={{ marginTop: '6px', marginBottom: '10px' }}>Kong Gateway Integration</h3>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <Badge tone={hasKong ? 'success' : 'info'}>
          {controller?.detected ? `Kong Controller (${controller.className || 'kong'})` : 'Standard Controller'}
        </Badge>
        {kong?.hasKongAnnotations && <Badge tone="info">Kong Annotations Attached</Badge>}
      </div>

      {kong?.hasKongAnnotations && (
        <div style={{ marginBottom: '14px' }}>
          <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '6px', fontWeight: '700' }}>
            KONG ANNOTATIONS & BEHAVIORS
          </div>
          <div>
            {kong.stripPath !== null && (
              <span className="anno-tag">strip-path: {String(kong.stripPath)}</span>
            )}
            {kong.preserveHost !== null && (
              <span className="anno-tag">preserve-host: {String(kong.preserveHost)}</span>
            )}
            {kong.protocols && (
              <span className="anno-tag">protocols: {kong.protocols.join(', ')}</span>
            )}
            {kong.methods && (
              <span className="anno-tag">methods: {kong.methods.join(', ')}</span>
            )}
            {kong.annotations &&
              Object.entries(kong.annotations).map(([k, v]) => (
                <span className="anno-tag" key={k}>
                  {k.replace('konghq.com/', '')}: {v}
                </span>
              ))}
          </div>
        </div>
      )}

      {kong?.resolvedPlugins && kong.resolvedPlugins.length > 0 ? (
        <div style={{ marginBottom: '14px' }}>
          <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '8px', fontWeight: '700' }}>
            ATTACHED KONG PLUGINS ({kong.resolvedPlugins.length})
          </div>
          {kong.resolvedPlugins.map((plugin) => (
            <div className="plugin-card" key={plugin.name}>
              <div className="plugin-header">
                <div className="plugin-title">
                  <Shield size={14} style={{ color: 'var(--teal)' }} />
                  <span>{plugin.name}</span>
                  <Badge tone={plugin.resolved ? 'success' : 'warning'}>
                    {plugin.resolved ? plugin.kind : 'Unresolved'}
                  </Badge>
                </div>
                {plugin.config && Object.keys(plugin.config).length > 0 && (
                  <button className="button subtle small" onClick={() => toggleConfig(plugin.name)}>
                    {openConfig[plugin.name] ? 'Hide Config' : 'View Config'}
                  </button>
                )}
              </div>
              {plugin.error && (
                <span style={{ color: 'var(--danger)', fontSize: '11px', marginTop: '4px', display: 'block' }}>
                  {plugin.error}
                </span>
              )}
              {openConfig[plugin.name] && plugin.config && (
                <pre className="plugin-config">{JSON.stringify(plugin.config, null, 2)}</pre>
              )}
            </div>
          ))}
        </div>
      ) : kong?.plugins && kong.plugins.length > 0 ? (
        <div style={{ marginBottom: '14px' }}>
          <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '8px', fontWeight: '700' }}>
            REFERENCED KONG PLUGINS
          </div>
          {kong.plugins.map((pName) => (
            <span className="anno-tag" key={pName}>
              <Shield size={12} /> {pName}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function HttpRouteDetail({ route, onClose }) {
  const detail = useResource(() => api.httpRoute(route.namespace, route.name), [route.namespace, route.name]);
  const data = detail.data || route;
  const hosts = data.hostnames?.length ? data.hostnames.join(', ') : '*';
  const paths = data.paths?.map((p) => p.value || p.path || p).join(', ') || '/';
  const parents = data.parentRefs?.map((p) => p.name).join(', ') || 'kong-gateway';

  return (
    <DetailPanel
      key={`httproute-${route.namespace}-${route.name}`}
      title={route.name}
      resourceType="httproutes"
      namespace={route.namespace}
      name={route.name}
      onClose={onClose}
    >
      {detail.loading ? (
        <Loading rows={3} />
      ) : detail.error ? (
        <ErrorState error={detail.error} reload={detail.reload} />
      ) : (
        <>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <Badge tone="success">HTTPRoute (Gateway API)</Badge>
            {data.controller?.detected && <Badge tone="info">Kong Gateway</Badge>}
          </div>

          <KeyValues
            values={{
              Namespace: data.namespace,
              'Parent Gateway': parents,
              Hostnames: hosts,
              Paths: paths,
              Created: formatDate(data.creationTimestamp),
              Age: data.age || age(data.creationTimestamp),
            }}
          />

          <h3>Visual Routing Flow</h3>
          <RoutingChainDiagram routing={data.routing} />

          <KongCard kong={data.kong} controller={data.controller} />

          {data.backendServices && data.backendServices.length > 0 && (
            <>
              <h3>Target Backend Services</h3>
              <div className="mini-list">
                {data.backendServices.map((b, idx) => (
                  <div key={idx}>
                    <strong>{b.namespace}/{b.serviceName}</strong>
                    <span>Port: {b.servicePort || '—'} · Weight: {b.weight ?? 1}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {data.events && data.events.length > 0 && (
            <>
              <h3>Related Events</h3>
              <EventTable events={data.events} />
            </>
          )}
        </>
      )}
    </DetailPanel>
  );
}

function GatewayDetail({ gateway, onClose }) {
  const detail = useResource(() => api.gateway(gateway.namespace, gateway.name), [gateway.namespace, gateway.name]);
  const data = detail.data || gateway;
  return (
    <DetailPanel
      key={`gateway-${gateway.namespace}-${gateway.name}`}
      title={gateway.name}
      resourceType="gateways"
      namespace={gateway.namespace}
      name={gateway.name}
      onClose={onClose}
    >
      {detail.loading ? (
        <Loading rows={3} />
      ) : detail.error ? (
        <ErrorState error={detail.error} reload={detail.reload} />
      ) : (
        <>
          <Badge tone="success">Gateway</Badge>
          <KeyValues
            values={{
              Namespace: data.namespace,
              Class: data.gatewayClassName || 'kong-class',
              Created: formatDate(data.creationTimestamp),
              Age: data.age || age(data.creationTimestamp),
            }}
          />
          <h3>Listeners</h3>
          <div className="mini-list">
            {(data.listeners || []).map((l, i) => (
              <div key={i}>
                <strong>{l.name} ({l.protocol}:{l.port})</strong>
                <span>Host: {l.hostname || '*'}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </DetailPanel>
  );
}

function IngressDetail({ ingress, onClose }) {
  const detail = useResource(() => api.ingress(ingress.namespace, ingress.name), [ingress.namespace, ingress.name]);
  const data = detail.data || ingress;
  const hosts = data.hosts?.length ? data.hosts.join(', ') : '—';
  const addresses = (data.addresses || data.loadBalancerAddresses || []).map((a) => a.ip || a.hostname).filter(Boolean).join(', ') || '—';

  return (
    <DetailPanel
      key={`ingress-${ingress.namespace}-${ingress.name}`}
      title={ingress.name}
      resourceType="ingresses"
      namespace={ingress.namespace}
      name={ingress.name}
      onClose={onClose}
    >
      {detail.loading ? (
        <Loading rows={3} />
      ) : detail.error ? (
        <ErrorState error={detail.error} reload={detail.reload} />
      ) : (
        <>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <Badge tone="success">{data.ingressClassName || data.ingressClass || 'Ingress'}</Badge>
            {data.controller?.detected && <Badge tone="info">Kong Controller</Badge>}
          </div>

          <KeyValues
            values={{
              Namespace: data.namespace,
              Class: data.ingressClassName || data.ingressClass || '—',
              Hosts: hosts,
              Addresses: addresses,
              Created: formatDate(data.creationTimestamp),
              Age: data.age || age(data.creationTimestamp),
            }}
          />

          <h3>Visual Routing Flow</h3>
          <RoutingChainDiagram routing={data.routing} />

          <KongCard kong={data.kong} controller={data.controller} />

          {data.paths && data.paths.length > 0 && (
            <>
              <h3>Rules & Paths</h3>
              <div className="mini-list">
                {data.paths.map((p, idx) => (
                  <div key={idx}>
                    <strong>{p.host || '*'}{p.path || '/'}</strong>
                    <span>{p.serviceName ? `→ ${p.serviceName}${p.servicePort ? `:${p.servicePort}` : ''}` : p.pathType || 'ImplementationSpecific'}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          {data.related?.services && data.related.services.length > 0 && (
            <>
              <h3>Backend Services</h3>
              <div className="mini-list">
                {data.related.services.map((svc) => (
                  <div key={svc.name}>
                    <strong>{svc.name}</strong>
                    <span>{svc.type} · IP: {svc.clusterIP || '—'} · Ports: {svc.ports?.map((p) => p.port).join(', ') || '—'}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          {data.events && data.events.length > 0 && (
            <>
              <h3>Related Events</h3>
              <EventTable events={data.events} />
            </>
          )}
        </>
      )}
    </DetailPanel>
  );
}

function OperatorsView({ onSelectCRD }) {
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');

  const crdsResource = useResource(api.crds, []);
  const operatorsResource = useResource(api.operators, []);

  const allCRDs = crdsResource.data?.data || [];
  const operators = operatorsResource.data?.data || [];

  const groups = useMemo(() => {
    const set = new Set();
    allCRDs.forEach((c) => { if (c.group) set.add(c.group); });
    return Array.from(set).sort();
  }, [allCRDs]);

  const namespacedCount = useMemo(() => allCRDs.filter((c) => c.scope === 'Namespaced').length, [allCRDs]);
  const clusterCount = useMemo(() => allCRDs.filter((c) => c.scope === 'Cluster').length, [allCRDs]);
  const detectedOperatorsCount = useMemo(() => operators.filter((o) => o.detected).length, [operators]);

  const filteredCRDs = useMemo(() => {
    let list = allCRDs;
    if (activeTab === 'namespaced') {
      list = list.filter((c) => c.scope === 'Namespaced');
    } else if (activeTab === 'cluster') {
      list = list.filter((c) => c.scope === 'Cluster');
    }
    if (selectedGroup) {
      list = list.filter((c) => c.group === selectedGroup || (c.operator?.name && c.operator.name === selectedGroup));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        c.kind.toLowerCase().includes(q) ||
        c.group.toLowerCase().includes(q) ||
        (c.operator?.name && c.operator.name.toLowerCase().includes(q)) ||
        (c.shortNames && c.shortNames.some((sn) => sn.toLowerCase().includes(q)))
      );
    }
    return list;
  }, [allCRDs, activeTab, selectedGroup, search]);

  const filteredOperators = useMemo(() => {
    if (!search.trim()) return operators;
    const q = search.toLowerCase();
    return operators.filter((o) =>
      o.name.toLowerCase().includes(q) ||
      o.group.toLowerCase().includes(q) ||
      o.crds.some((c) => c.name.toLowerCase().includes(q) || c.kind.toLowerCase().includes(q))
    );
  }, [operators, search]);

  const isLoading = crdsResource.loading || operatorsResource.loading;
  const error = crdsResource.error || operatorsResource.error;
  const reload = () => {
    crdsResource.reload();
    operatorsResource.reload();
  };

  return (
    <>
      <PageHeader
        eyebrow="Custom Resources & Controllers"
        title="Operators & CRDs Explorer"
        description="Discover CustomResourceDefinitions dynamically, explore detected operators, and inspect custom resource instances."
        action={
          <button className="button subtle" onClick={reload}>
            <RefreshCw size={16} /> Refresh
          </button>
        }
      />

      <div className="metrics-grid">
        <Metric
          icon={Blocks}
          label="Total CRDs"
          value={allCRDs.length}
          detail="Installed in cluster"
          accent="teal"
        />
        <Metric
          icon={Shield}
          label="Detected Operators"
          value={detectedOperatorsCount}
          detail={`${operators.length} API Groups`}
          accent="blue"
        />
        <Metric
          icon={Box}
          label="Namespaced CRDs"
          value={namespacedCount}
          detail="Scoped to namespaces"
          accent="amber"
        />
        <Metric
          icon={Server}
          label="Cluster-Scoped CRDs"
          value={clusterCount}
          detail="Cluster-wide resources"
          accent="coral"
        />
      </div>

      <div className="sub-nav-tabs">
        <button
          className={`sub-nav-tab ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => { setActiveTab('all'); setSelectedGroup(''); }}
        >
          <Blocks size={15} /> All CRDs ({allCRDs.length})
        </button>
        <button
          className={`sub-nav-tab ${activeTab === 'operators' ? 'active' : ''}`}
          onClick={() => setActiveTab('operators')}
        >
          <Shield size={15} /> By Operator / Group ({operators.length})
        </button>
        <button
          className={`sub-nav-tab ${activeTab === 'namespaced' ? 'active' : ''}`}
          onClick={() => { setActiveTab('namespaced'); setSelectedGroup(''); }}
        >
          <Box size={15} /> Namespaced ({namespacedCount})
        </button>
        <button
          className={`sub-nav-tab ${activeTab === 'cluster' ? 'active' : ''}`}
          onClick={() => { setActiveTab('cluster'); setSelectedGroup(''); }}
        >
          <Server size={15} /> Cluster-Scoped ({clusterCount})
        </button>
      </div>

      <Toolbar search={search} setSearch={setSearch} onRefresh={reload}>
        {activeTab !== 'operators' && (
          <select
            className="select"
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
          >
            <option value="">All API Groups ({groups.length})</option>
            {groups.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        )}
      </Toolbar>

      {isLoading ? (
        <Loading rows={6} />
      ) : error ? (
        <ErrorState error={error} reload={reload} />
      ) : activeTab === 'operators' ? (
        <div className="operators-grid">
          {filteredOperators.map((op) => (
            <div
              key={op.name}
              className={`operator-card ${selectedGroup === op.name ? 'active' : ''}`}
              onClick={() => {
                setSelectedGroup(op.name);
                setActiveTab('all');
              }}
            >
              <div className="operator-card-header">
                <div className="operator-card-title">
                  <Shield size={16} />
                  <span>{op.name}</span>
                </div>
                <Badge tone={op.detected ? 'success' : 'info'}>
                  {op.detected ? 'Operator' : 'API Group'}
                </Badge>
              </div>
              <div className="operator-card-group">{op.group}</div>
              <div className="operator-card-crds">
                {op.crds.slice(0, 6).map((c) => (
                  <span key={c.name} className="operator-crd-tag">
                    {c.kind}
                  </span>
                ))}
                {op.crds.length > 6 && (
                  <span className="operator-crd-tag" style={{ color: 'var(--muted)' }}>
                    +{op.crds.length - 6} more
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Table
          rows={filteredCRDs}
          onRow={onSelectCRD}
          emptyTitle="No CustomResourceDefinitions found"
          columns={[
            {
              key: 'kind',
              label: 'Custom Resource Kind',
              render: (r) => (
                <strong className="resource-name">
                  <Blocks size={16} />
                  {r.kind}
                </strong>
              ),
            },
            {
              key: 'group',
              label: 'API Group / Version',
              render: (r) => (
                <div>
                  <span className="mono" style={{ fontSize: '11.5px' }}>{r.group}</span>
                  <div style={{ fontSize: '10.5px', color: 'var(--muted)' }}>{r.version}</div>
                </div>
              ),
            },
            {
              key: 'scope',
              label: 'Scope',
              render: (r) => (
                <Badge tone={r.scope === 'Namespaced' ? 'warning' : 'info'}>
                  {r.scope}
                </Badge>
              ),
            },
            {
              key: 'operator',
              label: 'Associated Operator',
              render: (r) => (
                <Badge tone={r.operator?.detected ? 'success' : 'default'}>
                  {r.operator?.detected ? r.operator.name : 'Standard / Group'}
                </Badge>
              ),
            },
            {
              key: 'status',
              label: 'Status',
              render: (r) => (
                <Badge tone={r.established ? 'success' : 'warning'}>
                  {r.established ? 'Established' : 'Pending'}
                </Badge>
              ),
            },
            {
              key: 'age',
              label: 'Age',
              render: (r) => r.age || age(r.creationTimestamp),
            },
          ]}
        />
      )}
    </>
  );
}

function CRDDetail({ crd, onClose, onSelectInstance }) {
  const [tab, setTab] = useState('overview');
  const [instanceNamespace, setInstanceNamespace] = useState('');
  const [instanceSearch, setInstanceSearch] = useState('');

  const detail = useResource(() => api.crd(crd.name), [crd.name]);
  const instances = useResource(
    () => api.customResources(crd.group, crd.version, crd.plural, {
      scope: crd.scope,
      namespace: instanceNamespace,
    }),
    [crd.group, crd.version, crd.plural, crd.scope, instanceNamespace]
  );

  const data = detail.data || crd;
  const instanceRows = (instances.data?.data || []).filter((r) =>
    `${r.name} ${r.namespace || ''}`.toLowerCase().includes(instanceSearch.toLowerCase())
  );

  return (
    <div className="backdrop" onClick={onClose}>
      <aside className="detail-panel" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}><X size={18} /></button>
        <span className="eyebrow">CustomResourceDefinition</span>
        <h2>{data.kind}</h2>

        <div className="detail-tabs">
          <button className={`detail-tab ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>
            Overview
          </button>
          <button className={`detail-tab ${tab === 'instances' ? 'active' : ''}`} onClick={() => setTab('instances')}>
            <Box size={14} /> Live Instances ({instances.data?.data?.length ?? '—'})
          </button>
          <button className={`detail-tab ${tab === 'yaml' ? 'active' : ''}`} onClick={() => setTab('yaml')}>
            <FileCode size={14} /> YAML
          </button>
        </div>

        {tab === 'overview' ? (
          detail.loading ? (
            <Loading rows={4} />
          ) : detail.error ? (
            <ErrorState error={detail.error} reload={detail.reload} />
          ) : (
            <>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <Badge tone={data.scope === 'Namespaced' ? 'warning' : 'info'}>{data.scope}</Badge>
                {data.operator?.detected && (
                  <Badge tone="success">{data.operator.name}</Badge>
                )}
                <Badge tone={data.established ? 'success' : 'warning'}>
                  {data.established ? 'Established' : 'Pending'}
                </Badge>
              </div>

              <KeyValues
                values={{
                  'Full Name': data.name,
                  'API Group': data.group,
                  'Preferred Version': data.version,
                  'Versions Served': data.versions?.map((v) => v.name).join(', ') || data.version,
                  'Plural / Singular': `${data.plural} / ${data.singular}`,
                  'Short Names': data.shortNames?.join(', ') || '—',
                  'Categories': data.categories?.join(', ') || '—',
                  'Created': formatDate(data.creationTimestamp),
                  'Age': data.age || age(data.creationTimestamp),
                }}
              />

              {data.description && (
                <>
                  <h3>Schema Description</h3>
                  <div className="schema-description">
                    {data.description}
                  </div>
                </>
              )}

              {data.conditions && data.conditions.length > 0 && (
                <>
                  <h3>Conditions</h3>
                  <div className="mini-list">
                    {data.conditions.map((c, idx) => (
                      <div key={idx}>
                        <strong>{c.type}</strong>
                        <span>{c.status} {c.message ? `— ${c.message}` : ''}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )
        ) : tab === 'instances' ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
                <input
                  className="select"
                  style={{ flex: 1 }}
                  value={instanceSearch}
                  onChange={(e) => setInstanceSearch(e.target.value)}
                  placeholder="Filter instances..."
                />
                {data.scope === 'Namespaced' && (
                  <input
                    className="select"
                    value={instanceNamespace}
                    onChange={(e) => setInstanceNamespace(e.target.value)}
                    placeholder="All namespaces"
                  />
                )}
              </div>
              <button className="icon-button" style={{ marginLeft: '8px' }} onClick={instances.reload} title="Refresh instances">
                <RefreshCw size={14} />
              </button>
            </div>

            {instances.loading ? (
              <Loading rows={3} />
            ) : instances.error ? (
              <ErrorState error={instances.error} reload={instances.reload} />
            ) : (
              <Table
                rows={instanceRows}
                onRow={(inst) => onSelectInstance({ crd: data, instance: inst })}
                emptyTitle={`No ${data.kind} instances found`}
                columns={[
                  {
                    key: 'name',
                    label: 'Name',
                    render: (r) => (
                      <strong className="resource-name">
                        <Box size={14} />
                        {r.name}
                      </strong>
                    ),
                  },
                  ...(data.scope === 'Namespaced' ? [{ key: 'namespace', label: 'Namespace' }] : []),
                  {
                    key: 'statusSummary',
                    label: 'Status / Phase',
                    render: (r) => r.statusSummary ? <Badge tone="info">{r.statusSummary}</Badge> : '—',
                  },
                  {
                    key: 'age',
                    label: 'Age',
                    render: (r) => r.age || age(r.creationTimestamp),
                  },
                ]}
              />
            )}
          </>
        ) : (
          <YamlViewer resourceType="crd" name={data.name} />
        )}
      </aside>
    </div>
  );
}

function CustomResourceDetail({ crd, instance, onClose }) {
  const [tab, setTab] = useState('overview');
  const detail = useResource(
    () => api.customResource(
      crd.group,
      crd.version,
      crd.plural,
      instance.namespace,
      instance.name,
      crd.scope
    ),
    [crd.group, crd.version, crd.plural, instance.namespace, instance.name, crd.scope]
  );

  const data = detail.data || {};
  const meta = data.metadata || {};

  return (
    <div className="backdrop" onClick={onClose}>
      <aside className="detail-panel" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}><X size={18} /></button>
        <span className="eyebrow">{crd.kind} Instance</span>
        <h2>{instance.name}</h2>

        <div className="detail-tabs">
          <button className={`detail-tab ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>
            Overview
          </button>
          <button className={`detail-tab ${tab === 'yaml' ? 'active' : ''}`} onClick={() => setTab('yaml')}>
            <FileCode size={14} /> YAML
          </button>
        </div>

        {tab === 'overview' ? (
          detail.loading ? (
            <Loading rows={4} />
          ) : detail.error ? (
            <ErrorState error={detail.error} reload={detail.reload} />
          ) : (
            <>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <Badge tone="info">{crd.kind}</Badge>
                {meta.namespace && <Badge tone="warning">{meta.namespace}</Badge>}
                {crd.operator?.detected && <Badge tone="success">{crd.operator.name}</Badge>}
              </div>

              <KeyValues
                values={{
                  Name: meta.name || instance.name,
                  ...(meta.namespace ? { Namespace: meta.namespace } : {}),
                  'API Version': data.apiVersion || `${crd.group}/${crd.version}`,
                  Kind: data.kind || crd.kind,
                  UID: meta.uid || '—',
                  Generation: meta.generation !== undefined ? String(meta.generation) : '—',
                  Created: formatDate(meta.creationTimestamp),
                  Age: instance.age || age(meta.creationTimestamp),
                }}
              />

              {meta.labels && Object.keys(meta.labels).length > 0 && (
                <>
                  <h3>Labels</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {Object.entries(meta.labels).map(([k, v]) => (
                      <span key={k} className="anno-tag">{k}: {v}</span>
                    ))}
                  </div>
                </>
              )}

              {data.spec && Object.keys(data.spec).length > 0 && (
                <>
                  <h3>Spec</h3>
                  <pre className="json-block">{JSON.stringify(data.spec, null, 2)}</pre>
                </>
              )}

              {data.status && Object.keys(data.status).length > 0 && (
                <>
                  <h3>Status</h3>
                  <pre className="json-block">{JSON.stringify(data.status, null, 2)}</pre>
                </>
              )}
            </>
          )
        ) : (
          <YamlViewer
            loader={() =>
              api.customResourceYaml(
                crd.group,
                crd.version,
                crd.plural,
                instance.namespace,
                instance.name,
                crd.scope
              )
            }
          />
        )}
      </aside>
    </div>
  );
}

function Logs({ pod, onClose }) { const [container, setContainer] = useState(''); const [previous, setPrevious] = useState(false); const [tailLines, setTailLines] = useState(200); const [auto, setAuto] = useState(false); const resource = useResource(() => api.logs(pod.namespace, pod.name, { container, tailLines, previous }), [pod.namespace, pod.name, container, tailLines, previous, auto ? Date.now() : 0]); return <div className="log-modal"><div className="log-head"><div><span className="eyebrow">Pod logs</span><h3>{pod.name}</h3></div><button className="close-button" onClick={onClose}><X size={18} /></button></div><div className="log-controls"><input className="select" value={container} onChange={(e) => setContainer(e.target.value)} placeholder="Container (optional)" /><input className="number-input" type="number" min="1" max="10000" value={tailLines} onChange={(e) => setTailLines(e.target.value)} /><label className="check"><input type="checkbox" checked={previous} onChange={(e) => setPrevious(e.target.checked)} /> Previous</label><label className="check"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Auto-refresh</label></div>{resource.loading ? <div className="terminal loading-terminal">Loading logs...</div> : resource.error ? <ErrorState error={resource.error} reload={resource.reload} /> : <pre className="terminal">{resource.data?.logs || 'No log output returned.'}</pre>}</div>; }


// ---------------------------------------------------------------------------
// Storage Explorer Components
// ---------------------------------------------------------------------------

function StorageRelationshipFlow({ storageClass, pvc, pv, csiDriver, onSelectPV, onSelectPVC, onSelectSC }) {
  return (
    <div className="storage-chain">
      <div className="storage-chain-card">
        <div className="storage-chain-card-header">
          <Layers3 size={14} />
          <span>Storage Class</span>
        </div>
        <strong>{storageClass || 'standard'}</strong>
        <span>Provisioner / Reclaim policy</span>
      </div>

      <div className="storage-chain-card">
        <div className="storage-chain-card-header">
          <Database size={14} />
          <span>PersistentVolumeClaim</span>
        </div>
        <strong>{pvc ? (typeof pvc === 'string' ? pvc : `${pvc.namespace}/${pvc.name}`) : '—'}</strong>
        <span>User workload request</span>
      </div>

      <div className="storage-chain-card">
        <div className="storage-chain-card-header">
          <HardDrive size={14} />
          <span>PersistentVolume</span>
        </div>
        <strong>{pv ? (typeof pv === 'string' ? pv : pv.name) : '—'}</strong>
        <span>Cluster physical volume</span>
      </div>

      <div className="storage-chain-card">
        <div className="storage-chain-card-header">
          <Server size={14} />
          <span>CSI Driver / Backend</span>
        </div>
        <strong>{csiDriver || 'standard'}</strong>
        <span>Storage plugin implementation</span>
      </div>
    </div>
  );
}

function StorageView({ onSelectPV, onSelectPVC, onSelectSC, onSelectCSI, onSelectSnapshot }) {
  console.log("[STORAGE DEBUG] StoragePage rendered");
  const [activeTab, setActiveTab] = useState('overview');
  const [namespace, setNamespace] = useState('');
  const [search, setSearch] = useState('');

  const overviewResource = useResource(api.storageOverview, []);
  const pvsResource = useResource(() => api.persistentVolumes({ search }), [search]);
  const pvcsResource = useResource(() => api.persistentVolumeClaims(namespace, { search }), [namespace, search]);
  const scsResource = useResource(() => api.storageClasses({ search }), [search]);
  const csiResource = useResource(api.csiDrivers, []);
  const snapshotsResource = useResource(() => api.volumeSnapshots(namespace), [namespace]);

  const overview = overviewResource.data || {};
  const pvs = pvsResource.data?.data || [];
  const pvcs = pvcsResource.data?.data || [];
  const scs = scsResource.data?.data || [];
  const csi = csiResource.data?.data || [];
  const snapshotsData = snapshotsResource.data || {};
  const snapshots = snapshotsData.items || [];

  const reloadAll = () => {
    overviewResource.reload();
    pvsResource.reload();
    pvcsResource.reload();
    scsResource.reload();
    csiResource.reload();
    snapshotsResource.reload();
  };

  return (
    <>
      <PageHeader
        eyebrow="Cluster Storage & Volumes"
        title="Storage Explorer"
        description="Explore Persistent Volumes, Claims, Storage Classes, CSI Drivers, and Volume Snapshots across the cluster."
        action={
          <button className="button subtle" onClick={reloadAll}>
            <RefreshCw size={16} /> Refresh
          </button>
        }
      />

      <div className="metrics-grid">
        <Metric
          icon={HardDrive}
          label="Persistent Volumes"
          value={overview.persistentVolumes?.total ?? pvs.length}
          detail={`${overview.persistentVolumes?.bound ?? 0} bound · ${overview.persistentVolumes?.available ?? 0} available`}
          accent="teal"
        />
        <Metric
          icon={Database}
          label="Volume Claims"
          value={overview.persistentVolumeClaims?.total ?? pvcs.length}
          detail={`${overview.persistentVolumeClaims?.bound ?? 0} bound · ${overview.persistentVolumeClaims?.pending ?? 0} pending`}
          accent="blue"
        />
        <Metric
          icon={Layers3}
          label="Storage Classes"
          value={overview.storageClasses?.total ?? scs.length}
          detail={overview.storageClasses?.defaultClass ? `Default: ${overview.storageClasses.defaultClass}` : 'No default class'}
          accent="amber"
        />
        <Metric
          icon={Server}
          label="CSI Drivers"
          value={overview.csiDrivers?.total ?? csi.length}
          detail={snapshotsData.available ? 'Snapshots available' : 'No snapshot CRDs'}
          accent="coral"
        />
      </div>

      <div className="sub-nav-tabs">
        <button
          className={`sub-nav-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <LayoutDashboard size={15} /> Overview
        </button>
        <button
          className={`sub-nav-tab ${activeTab === 'pvs' ? 'active' : ''}`}
          onClick={() => setActiveTab('pvs')}
        >
          <HardDrive size={15} /> Persistent Volumes ({pvs.length})
        </button>
        <button
          className={`sub-nav-tab ${activeTab === 'pvcs' ? 'active' : ''}`}
          onClick={() => setActiveTab('pvcs')}
        >
          <Database size={15} /> Claims ({pvcs.length})
        </button>
        <button
          className={`sub-nav-tab ${activeTab === 'storageclasses' ? 'active' : ''}`}
          onClick={() => setActiveTab('storageclasses')}
        >
          <Layers3 size={15} /> Storage Classes ({scs.length})
        </button>
        <button
          className={`sub-nav-tab ${activeTab === 'csidrivers' ? 'active' : ''}`}
          onClick={() => setActiveTab('csidrivers')}
        >
          <Server size={15} /> CSI Drivers ({csi.length})
        </button>
        <button
          className={`sub-nav-tab ${activeTab === 'snapshots' ? 'active' : ''}`}
          onClick={() => setActiveTab('snapshots')}
        >
          <FileText size={15} /> Snapshots ({snapshots.length})
        </button>
      </div>

      {activeTab !== 'overview' && activeTab !== 'analysis' && (
        <Toolbar search={search} setSearch={setSearch} onRefresh={reloadAll}>
          {(activeTab === 'pvcs' || activeTab === 'snapshots') && (
            <input
              className="select"
              value={namespace}
              onChange={(e) => setNamespace(e.target.value)}
              placeholder="All namespaces"
            />
          )}
        </Toolbar>
      )}

      {activeTab === 'overview' ? (
        overviewResource.loading ? (
          <Loading rows={4} />
        ) : overviewResource.error ? (
          <ErrorState error={overviewResource.error} reload={overviewResource.reload} />
        ) : (
          <>
            <div className="storage-overview-grid">
              <div className="storage-overview-card">
                <div className="storage-overview-card-header">
                  <h3><HardDrive size={16} /> PV Phase Breakdown</h3>
                  <Badge tone="teal">{overview.persistentVolumes?.total ?? 0} Total</Badge>
                </div>
                <div className="storage-breakdown-list">
                  <div className="storage-breakdown-item">
                    <span>Bound (in use)</span>
                    <Badge tone="success">{overview.persistentVolumes?.bound ?? 0}</Badge>
                  </div>
                  <div className="storage-breakdown-item">
                    <span>Available (free)</span>
                    <Badge tone="info">{overview.persistentVolumes?.available ?? 0}</Badge>
                  </div>
                  <div className="storage-breakdown-item">
                    <span>Released (pending reclaim)</span>
                    <Badge tone="warning">{overview.persistentVolumes?.released ?? 0}</Badge>
                  </div>
                  <div className="storage-breakdown-item">
                    <span>Failed</span>
                    <Badge tone="danger">{overview.persistentVolumes?.failed ?? 0}</Badge>
                  </div>
                </div>
              </div>

              <div className="storage-overview-card">
                <div className="storage-overview-card-header">
                  <h3><Database size={16} /> PVC Phase Breakdown</h3>
                  <Badge tone="blue">{overview.persistentVolumeClaims?.total ?? 0} Total</Badge>
                </div>
                <div className="storage-breakdown-list">
                  <div className="storage-breakdown-item">
                    <span>Bound (attached)</span>
                    <Badge tone="success">{overview.persistentVolumeClaims?.bound ?? 0}</Badge>
                  </div>
                  <div className="storage-breakdown-item">
                    <span>Pending (unbound)</span>
                    <Badge tone="warning">{overview.persistentVolumeClaims?.pending ?? 0}</Badge>
                  </div>
                  <div className="storage-breakdown-item">
                    <span>Lost</span>
                    <Badge tone="danger">{overview.persistentVolumeClaims?.lost ?? 0}</Badge>
                  </div>
                </div>
              </div>

              <div className="storage-overview-card">
                <div className="storage-overview-card-header">
                  <h3><Layers3 size={16} /> Storage Classes & Drivers</h3>
                  <Badge tone="amber">{overview.storageClasses?.total ?? 0} Classes</Badge>
                </div>
                <div className="storage-breakdown-list">
                  <div className="storage-breakdown-item">
                    <span>Default StorageClass</span>
                    <strong>{overview.storageClasses?.defaultClass || 'None'}</strong>
                  </div>
                  <div className="storage-breakdown-item">
                    <span>CSI Drivers Installed</span>
                    <Badge tone="info">{overview.csiDrivers?.total ?? 0}</Badge>
                  </div>
                  <div className="storage-breakdown-item">
                    <span>Snapshot Support</span>
                    <Badge tone={snapshotsData.available ? 'success' : 'warning'}>
                      {snapshotsData.available ? 'Available' : 'CRDs Not Installed'}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <span className="eyebrow">Architecture</span>
                  <h2>Storage Relationship Model</h2>
                </div>
                <Badge tone="info">Kubernetes CSI</Badge>
              </div>
              <StorageRelationshipFlow
                storageClass={overview.storageClasses?.defaultClass || 'local-path'}
                pvc="workload-pvc"
                pv="pvc-volume-id"
                csiDriver={overview.csiDrivers?.drivers?.[0] || 'csi-driver'}
              />
            </section>
          </>
        )
      ) : activeTab === 'pvs' ? (
        pvsResource.loading ? (
          <Loading rows={5} />
        ) : pvsResource.error ? (
          <ErrorState error={pvsResource.error} reload={pvsResource.reload} />
        ) : (
          <Table
            rows={pvs}
            onRow={onSelectPV}
            emptyTitle="No Persistent Volumes found"
            columns={[
              {
                key: 'name',
                label: 'Volume Name',
                render: (r) => (
                  <strong className="resource-name">
                    <HardDrive size={16} />
                    {r.name}
                  </strong>
                ),
              },
              {
                key: 'capacity',
                label: 'Capacity',
                render: (r) => <span className="mono">{formatStorageQuantity(r.capacity)}</span>,
              },
              {
                key: 'accessModes',
                label: 'Access Modes',
                render: (r) => r.accessModes?.join(', ') || '—',
              },
              {
                key: 'reclaimPolicy',
                label: 'Reclaim Policy',
                render: (r) => <Badge tone="info">{r.reclaimPolicy}</Badge>,
              },
              {
                key: 'status',
                label: 'Status',
                render: (r) => (
                  <Badge tone={r.status === 'Bound' ? 'success' : r.status === 'Available' ? 'info' : 'warning'}>
                    {r.status}
                  </Badge>
                ),
              },
              {
                key: 'storageClass',
                label: 'StorageClass',
                render: (r) => <span className="mono">{r.storageClass}</span>,
              },
              {
                key: 'claim',
                label: 'Bound Claim',
                render: (r) => (r.claim ? <span className="mono">{r.claim}</span> : '—'),
              },
              {
                key: 'age',
                label: 'Age',
                render: (r) => r.age || age(r.creationTimestamp),
              },
            ]}
          />
        )
      ) : activeTab === 'pvcs' ? (
        pvcsResource.loading ? (
          <Loading rows={5} />
        ) : pvcsResource.error ? (
          <ErrorState error={pvcsResource.error} reload={pvcsResource.reload} />
        ) : (
          <Table
            rows={pvcs}
            onRow={onSelectPVC}
            emptyTitle="No Persistent Volume Claims found"
            columns={[
              {
                key: 'name',
                label: 'Claim Name',
                render: (r) => (
                  <strong className="resource-name">
                    <Database size={16} />
                    {r.name}
                  </strong>
                ),
              },
              { key: 'namespace', label: 'Namespace' },
              {
                key: 'status',
                label: 'Status',
                render: (r) => (
                  <Badge tone={r.status === 'Bound' ? 'success' : 'warning'}>
                    {r.status}
                  </Badge>
                ),
              },
              {
                key: 'volumeName',
                label: 'Bound Volume',
                render: (r) => (r.volumeName ? <span className="mono">{r.volumeName}</span> : '—'),
              },
              {
                key: 'capacity',
                label: 'Capacity',
                render: (r) => <span className="mono">{formatStorageQuantity(r.capacity)}</span>,
              },
              {
                key: 'storageClass',
                label: 'StorageClass',
                render: (r) => <span className="mono">{r.storageClass}</span>,
              },
              {
                key: 'age',
                label: 'Age',
                render: (r) => r.age || age(r.creationTimestamp),
              },
            ]}
          />
        )
      ) : activeTab === 'storageclasses' ? (
        scsResource.loading ? (
          <Loading rows={5} />
        ) : scsResource.error ? (
          <ErrorState error={scsResource.error} reload={scsResource.reload} />
        ) : (
          <Table
            rows={scs}
            onRow={onSelectSC}
            emptyTitle="No Storage Classes found"
            columns={[
              {
                key: 'name',
                label: 'Class Name',
                render: (r) => (
                  <strong className="resource-name">
                    <Layers3 size={16} />
                    {r.name}
                    {r.isDefault && <Badge tone="success">Default</Badge>}
                  </strong>
                ),
              },
              { key: 'provisioner', label: 'Provisioner' },
              { key: 'reclaimPolicy', label: 'Reclaim Policy' },
              { key: 'volumeBindingMode', label: 'Binding Mode' },
              {
                key: 'allowVolumeExpansion',
                label: 'Allow Expansion',
                render: (r) => (r.allowVolumeExpansion ? 'Yes' : 'No'),
              },
              {
                key: 'age',
                label: 'Age',
                render: (r) => r.age || age(r.creationTimestamp),
              },
            ]}
          />
        )
      ) : activeTab === 'csidrivers' ? (
        csiResource.loading ? (
          <Loading rows={5} />
        ) : csiResource.error ? (
          <ErrorState error={csiResource.error} reload={csiResource.reload} />
        ) : (
          <Table
            rows={csi}
            onRow={onSelectCSI}
            emptyTitle="No CSI Drivers found"
            columns={[
              {
                key: 'name',
                label: 'Driver Name',
                render: (r) => (
                  <strong className="resource-name">
                    <Server size={16} />
                    {r.name}
                  </strong>
                ),
              },
              {
                key: 'attachRequired',
                label: 'Attach Required',
                render: (r) => (r.attachRequired ? 'Yes' : 'No'),
              },
              {
                key: 'podInfoOnMount',
                label: 'Pod Info On Mount',
                render: (r) => (r.podInfoOnMount ? 'Yes' : 'No'),
              },
              {
                key: 'volumeLifecycleModes',
                label: 'Lifecycle Modes',
                render: (r) => r.volumeLifecycleModes?.join(', ') || 'Persistent',
              },
              {
                key: 'age',
                label: 'Age',
                render: (r) => r.age || age(r.creationTimestamp),
              },
            ]}
          />
        )
      ) : snapshotsResource.loading ? (
        <Loading rows={5} />
      ) : snapshotsResource.error ? (
        <ErrorState error={snapshotsResource.error} reload={snapshotsResource.reload} />
      ) : !snapshotsData.available ? (
        <div className="unsupported">
          <AlertTriangle size={18} />
          <div>
            <strong>VolumeSnapshot CRDs Not Installed</strong>
            <span>
              The Kubernetes VolumeSnapshot CRDs (snapshot.storage.k8s.io) are not installed on this cluster.
              To enable snapshot management, install the standard Kubernetes external-snapshotter CRDs.
            </span>
          </div>
        </div>
      ) : (
        <Table
          rows={snapshots}
          onRow={onSelectSnapshot}
          emptyTitle="No Volume Snapshots found"
          columns={[
            {
              key: 'name',
              label: 'Snapshot Name',
              render: (r) => (
                <strong className="resource-name">
                  <FileText size={16} />
                  {r.name}
                </strong>
              ),
            },
            { key: 'namespace', label: 'Namespace' },
            {
              key: 'readyToUse',
              label: 'Ready',
              render: (r) => (
                <Badge tone={r.readyToUse ? 'success' : 'warning'}>
                  {r.readyToUse ? 'Ready' : 'Pending'}
                </Badge>
              ),
            },
            {
              key: 'restoreSize',
              label: 'Restore Size',
              render: (r) => <span className="mono">{formatStorageQuantity(r.restoreSize)}</span>,
            },
            { key: 'sourcePVC', label: 'Source PVC' },
            { key: 'snapshotClassName', label: 'Snapshot Class' },
            {
              key: 'age',
              label: 'Age',
              render: (r) => r.age || age(r.creationTimestamp),
            },
          ]}
        />
      )}
    </>
  );
}

function PVDetail({ pv, onClose, onSelectPVC, onSelectSC }) {
  const detail = useResource(() => api.persistentVolume(pv.name), [pv.name]);
  const data = detail.data || pv;

  return (
    <DetailPanel
      key={`pv-${pv.name}`}
      title={pv.name}
      resourceType="persistentvolumes"
      name={pv.name}
      onClose={onClose}
    >
      {detail.loading ? (
        <Loading rows={4} />
      ) : detail.error ? (
        <ErrorState error={detail.error} reload={detail.reload} />
      ) : (
        <>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <Badge tone={data.status === 'Bound' ? 'success' : data.status === 'Available' ? 'info' : 'warning'}>
              {data.status}
            </Badge>
            <Badge tone="info">{data.volumeMode || 'Filesystem'}</Badge>
            <Badge tone="info">{data.reclaimPolicy || 'Retain'}</Badge>
          </div>

          <KeyValues
            values={{
              'Volume Name': data.name,
              Capacity: formatStorageQuantity(data.capacity),
              'Access Modes': data.accessModes?.join(', ') || '—',
              'Storage Class': data.storageClass || '—',
              'Bound Claim': data.claim || '—',
              'CSI Driver': data.csiDriver || 'standard',
              'Reclaim Policy': data.reclaimPolicy || 'Retain',
              'Created': formatDate(data.creationTimestamp),
              'Age': data.age || age(data.creationTimestamp),
            }}
          />

          <h3>Storage Relationship</h3>
          <StorageRelationshipFlow
            storageClass={data.storageClass}
            pvc={data.claimRef ? `${data.claimRef.namespace}/${data.claimRef.name}` : data.claim}
            pv={data.name}
            csiDriver={data.csiDriver}
          />

          {data.mountOptions && data.mountOptions.length > 0 && (
            <>
              <h3>Mount Options</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {data.mountOptions.map((opt, i) => (
                  <span key={i} className="anno-tag">{opt}</span>
                ))}
              </div>
            </>
          )}

          {data.labels && Object.keys(data.labels).length > 0 && (
            <>
              <h3>Labels</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {Object.entries(data.labels).map(([k, v]) => (
                  <span key={k} className="anno-tag">{k}: {v}</span>
                ))}
              </div>
            </>
          )}

          {data.events && data.events.length > 0 && (
            <>
              <h3>Related Events</h3>
              <EventTable events={data.events} />
            </>
          )}
        </>
      )}
    </DetailPanel>
  );
}

function PVCDetail({ pvc, onClose, onSelectPV, onSelectSC }) {
  const detail = useResource(() => api.persistentVolumeClaim(pvc.namespace, pvc.name), [pvc.namespace, pvc.name]);
  const data = detail.data || pvc;

  return (
    <DetailPanel
      key={`pvc-${pvc.namespace}-${pvc.name}`}
      title={pvc.name}
      resourceType="persistentvolumeclaims"
      namespace={pvc.namespace}
      name={pvc.name}
      onClose={onClose}
    >
      {detail.loading ? (
        <Loading rows={4} />
      ) : detail.error ? (
        <ErrorState error={detail.error} reload={detail.reload} />
      ) : (
        <>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <Badge tone={data.status === 'Bound' ? 'success' : 'warning'}>
              {data.status}
            </Badge>
            <Badge tone="info">{data.volumeMode || 'Filesystem'}</Badge>
          </div>

          <KeyValues
            values={{
              Namespace: data.namespace,
              'Claim Name': data.name,
              Capacity: formatStorageQuantity(data.capacity),
              'Requested Storage': formatStorageQuantity(data.requestedStorage),
              'Access Modes': data.accessModes?.join(', ') || '—',
              'Storage Class': data.storageClass || '—',
              'Bound Volume': data.volumeName || '—',
              'Created': formatDate(data.creationTimestamp),
              'Age': data.age || age(data.creationTimestamp),
            }}
          />

          <h3>Storage Relationship</h3>
          <StorageRelationshipFlow
            storageClass={data.storageClass}
            pvc={`${data.namespace}/${data.name}`}
            pv={data.volumeName}
            csiDriver={data.related?.volume?.csiDriver || 'standard'}
          />

          {data.labels && Object.keys(data.labels).length > 0 && (
            <>
              <h3>Labels</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {Object.entries(data.labels).map(([k, v]) => (
                  <span key={k} className="anno-tag">{k}: {v}</span>
                ))}
              </div>
            </>
          )}

          {data.events && data.events.length > 0 && (
            <>
              <h3>Related Events</h3>
              <EventTable events={data.events} />
            </>
          )}
        </>
      )}
    </DetailPanel>
  );
}

function StorageClassDetail({ storageClass, onClose }) {
  const detail = useResource(() => api.storageClass(storageClass.name), [storageClass.name]);
  const data = detail.data || storageClass;

  return (
    <DetailPanel
      key={`sc-${storageClass.name}`}
      title={storageClass.name}
      resourceType="storageclasses"
      name={storageClass.name}
      onClose={onClose}
    >
      {detail.loading ? (
        <Loading rows={4} />
      ) : detail.error ? (
        <ErrorState error={detail.error} reload={detail.reload} />
      ) : (
        <>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <Badge tone="info">{data.provisioner}</Badge>
            {data.isDefault && <Badge tone="success">Default Class</Badge>}
            <Badge tone="info">{data.reclaimPolicy || 'Delete'}</Badge>
          </div>

          <KeyValues
            values={{
              'Class Name': data.name,
              Provisioner: data.provisioner,
              'Reclaim Policy': data.reclaimPolicy || 'Delete',
              'Binding Mode': data.volumeBindingMode || 'Immediate',
              'Allow Volume Expansion': data.allowVolumeExpansion ? 'Yes' : 'No',
              'Default Class': data.isDefault ? 'Yes' : 'No',
              'Created': formatDate(data.creationTimestamp),
              'Age': data.age || age(data.creationTimestamp),
            }}
          />

          {data.parameters && Object.keys(data.parameters).length > 0 && (
            <>
              <h3>Parameters</h3>
              <pre className="json-block">{JSON.stringify(data.parameters, null, 2)}</pre>
            </>
          )}

          {data.mountOptions && data.mountOptions.length > 0 && (
            <>
              <h3>Mount Options</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {data.mountOptions.map((opt, i) => (
                  <span key={i} className="anno-tag">{opt}</span>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </DetailPanel>
  );
}

function CSIDriverDetail({ driver, onClose }) {
  const detail = useResource(() => api.csiDriver(driver.name), [driver.name]);
  const data = detail.data || driver;

  return (
    <DetailPanel
      key={`csi-${driver.name}`}
      title={driver.name}
      resourceType="csidrivers"
      name={driver.name}
      onClose={onClose}
    >
      {detail.loading ? (
        <Loading rows={4} />
      ) : detail.error ? (
        <ErrorState error={detail.error} reload={detail.reload} />
      ) : (
        <>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <Badge tone="success">CSI Driver</Badge>
            <Badge tone={data.attachRequired ? 'info' : 'warning'}>
              {data.attachRequired ? 'Attach Required' : 'No Attach'}
            </Badge>
          </div>

          <KeyValues
            values={{
              'Driver Name': data.name,
              'Attach Required': data.attachRequired ? 'Yes' : 'No',
              'Pod Info On Mount': data.podInfoOnMount ? 'Yes' : 'No',
              'Storage Capacity': data.storageCapacity ? 'Yes' : 'No',
              'Lifecycle Modes': data.volumeLifecycleModes?.join(', ') || 'Persistent',
              'Requires Reparse': data.requiresReparse ? 'Yes' : 'No',
              'Created': formatDate(data.creationTimestamp),
              'Age': data.age || age(data.creationTimestamp),
            }}
          />
        </>
      )}
    </DetailPanel>
  );
}

function VolumeSnapshotDetail({ snapshot, onClose }) {
  const detail = useResource(() => api.volumeSnapshot(snapshot.namespace, snapshot.name), [snapshot.namespace, snapshot.name]);
  const data = detail.data || snapshot;

  return (
    <DetailPanel
      key={`snap-${snapshot.namespace}-${snapshot.name}`}
      title={snapshot.name}
      resourceType="volumesnapshots"
      namespace={snapshot.namespace}
      name={snapshot.name}
      onClose={onClose}
    >
      {detail.loading ? (
        <Loading rows={4} />
      ) : detail.error ? (
        <ErrorState error={detail.error} reload={detail.reload} />
      ) : (
        <>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <Badge tone={data.readyToUse ? 'success' : 'warning'}>
              {data.readyToUse ? 'Ready' : 'Pending'}
            </Badge>
          </div>

          <KeyValues
            values={{
              Namespace: data.namespace,
              'Snapshot Name': data.name,
              'Ready To Use': data.readyToUse ? 'Yes' : 'No',
              'Restore Size': formatStorageQuantity(data.restoreSize),
              'Source PVC': data.sourcePVC || '—',
              'Snapshot Class': data.snapshotClassName || '—',
              'Bound Content': data.snapshotContentName || '—',
              'Created': formatDate(data.creationTimestamp),
              'Age': data.age || age(data.creationTimestamp),
            }}
          />
        </>
      )}
    </DetailPanel>
  );
}



// ---------------------------------------------------------------------------
// RBAC Components
// ---------------------------------------------------------------------------

function verbBadgeTone(verb) {
  const v = String(verb).toLowerCase();
  if (v === 'get' || v === 'list' || v === 'watch') return 'info';
  if (v === 'create' || v === 'update' || v === 'patch') return 'warning';
  if (v === 'delete' || v === 'deletecollection') return 'danger';
  if (v === '*') return 'success';
  return 'muted';
}

function RBACRuleTable({ rules }) {
  if (!rules || !rules.length) {
    return <Empty title="No rules defined" text="This role does not contain any permission rules." />;
  }

  return (
    <div className="table-wrap" style={{ marginTop: '12px' }}>
      <table>
        <thead>
          <tr>
            <th>API Groups</th>
            <th>Resources</th>
            <th>Resource Names</th>
            <th>Verbs</th>
            <th>Non-Resource URLs</th>
          </tr>
        </thead>
        <tbody>
          {rules.map((rule, idx) => (
            <tr key={idx}>
              <td>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {(rule.apiGroups || []).length ? (
                    rule.apiGroups.map((g, i) => (
                      <Badge key={i} tone="info">{g === '' ? 'core ("")' : g}</Badge>
                    ))
                  ) : (
                    <span className="muted">—</span>
                  )}
                </div>
              </td>
              <td>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {(rule.resources || []).length ? (
                    rule.resources.map((r, i) => (
                      <Badge key={i}>{r}</Badge>
                    ))
                  ) : (
                    <span className="muted">—</span>
                  )}
                </div>
              </td>
              <td>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {(rule.resourceNames || []).length ? (
                    rule.resourceNames.map((rn, i) => (
                      <span key={i} className="mono" style={{ fontSize: '12px' }}>{rn}</span>
                    ))
                  ) : (
                    <span className="muted">* (all)</span>
                  )}
                </div>
              </td>
              <td>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {(rule.verbs || []).map((verb, i) => (
                    <Badge key={i} tone={verbBadgeTone(verb)}>{verb}</Badge>
                  ))}
                </div>
              </td>
              <td>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {(rule.nonResourceURLs || []).length ? (
                    rule.nonResourceURLs.map((url, i) => (
                      <span key={i} className="mono" style={{ fontSize: '12px' }}>{url}</span>
                    ))
                  ) : (
                    <span className="muted">—</span>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RBACRelationshipFlow() {
  return (
    <div style={{ padding: '16px', background: 'var(--panel-2)', borderRadius: '8px', border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1', minWidth: '160px', padding: '12px', background: 'rgba(56, 189, 248, 0.08)', borderRadius: '6px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <Box size={16} color="#38bdf8" />
            <strong style={{ fontSize: '13px', color: '#38bdf8' }}>1. Subjects</strong>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>ServiceAccount / User / Group</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
          <ChevronRight size={18} />
        </div>

        <div style={{ flex: '1', minWidth: '160px', padding: '12px', background: 'rgba(168, 85, 247, 0.08)', borderRadius: '6px', border: '1px solid rgba(168, 85, 247, 0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <Network size={16} color="#c084fc" />
            <strong style={{ fontSize: '13px', color: '#c084fc' }}>2. Binding</strong>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>RoleBinding (Namespaced) or ClusterRoleBinding</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
          <ChevronRight size={18} />
        </div>

        <div style={{ flex: '1', minWidth: '160px', padding: '12px', background: 'rgba(245, 158, 11, 0.08)', borderRadius: '6px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <Shield size={16} color="#fbbf24" />
            <strong style={{ fontSize: '13px', color: '#fbbf24' }}>3. Role Ref</strong>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Role (in namespace) or ClusterRole (cluster-wide)</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
          <ChevronRight size={18} />
        </div>

        <div style={{ flex: '1', minWidth: '160px', padding: '12px', background: 'rgba(34, 197, 94, 0.08)', borderRadius: '6px', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <CheckCircle2 size={16} color="#4ade80" />
            <strong style={{ fontSize: '13px', color: '#4ade80' }}>4. Rules & Verbs</strong>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>get, list, watch, create, update, delete on Resources</span>
        </div>
      </div>
    </div>
  );
}


function RBACAdvancedAnalysis({ data, loading, error, reload, onSelectSA, onSelectRole, onSelectRB, onSelectCR, onSelectCRB }) {
  const [viewMode, setViewMode] = useState('matrix');
  
  // Matrix / Global Filters
  const [matrixSearch, setMatrixSearch] = useState('');
  const [matrixNamespace, setMatrixNamespace] = useState('');
  const [matrixApiGroup, setMatrixApiGroup] = useState('');
  const [matrixResource, setMatrixResource] = useState('');
  const [matrixVerb, setMatrixVerb] = useState('');
  const [matrixScope, setMatrixScope] = useState('all'); // all, namespaced, cluster

  // Subject Access / Effective Filters
  const [selectedSubjectKey, setSelectedSubjectKey] = useState('');
  const [subjectQuery, setSubjectQuery] = useState('');

  // Resource Access Filters
  const [resAccessNamespace, setResAccessNamespace] = useState('');
  const [resAccessGroup, setResAccessGroup] = useState('');
  const [resAccessResource, setResAccessResource] = useState('');
  const [resAccessVerb, setResAccessVerb] = useState('');

  // Global Search
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');

  if (loading) return <Loading rows={5} />;
  if (error) return <ErrorState error={error} reload={reload} />;
  if (!data) return <Empty title="No analysis data" text="Unable to compute RBAC analysis for this cluster." />;

  const {
    subjects = [],
    roles = [],
    clusterRoles = [],
    roleBindings = [],
    clusterRoleBindings = [],
    permissionMatrix = [],
    indicators = {},
    namespaces = [],
    summary = {}
  } = data;

  // 1. Permission Matrix Filtering
  const filteredMatrix = (permissionMatrix || []).filter((entry) => {
    if (!entry) return false;
    if (matrixNamespace && entry.scope !== matrixNamespace && !entry.isClusterScoped) return false;
    if (matrixScope === 'namespaced' && entry.isClusterScoped) return false;
    if (matrixScope === 'cluster' && !entry.isClusterScoped) return false;
    if (matrixApiGroup && !((entry.apiGroups || []).some((g) => (g === '' ? 'core' : g).toLowerCase().includes(matrixApiGroup.toLowerCase())))) return false;
    if (matrixResource && !((entry.resources || []).some((r) => r.toLowerCase().includes(matrixResource.toLowerCase())))) return false;
    if (matrixVerb && !(entry.verbs || []).includes('*') && !(entry.verbs || []).map((v) => v.toLowerCase()).includes(matrixVerb.toLowerCase())) return false;
    if (matrixSearch) {
      const q = matrixSearch.toLowerCase();
      const matchSubject = `${entry.subject?.kind || ''} ${entry.subject?.display || ''}`.toLowerCase().includes(q);
      const matchBinding = (entry.binding?.name || '').toLowerCase().includes(q);
      const matchRole = (entry.role?.name || '').toLowerCase().includes(q);
      const matchRes = (entry.resources || []).some((r) => r.toLowerCase().includes(q));
      if (!matchSubject && !matchBinding && !matchRole && !matchRes) return false;
    }
    return true;
  });

  // Unique Subjects filtered for picker
  const filteredSubjects = (subjects || []).filter((s) =>
    !subjectQuery || `${s.kind || ''} ${s.display || ''}`.toLowerCase().includes(subjectQuery.toLowerCase())
  );
  const activeSubject =
    (subjects || []).find((s) => `${s.kind}:${s.namespace || ''}:${s.name}` === selectedSubjectKey) ||
    filteredSubjects[0] ||
    (subjects || [])[0] ||
    null;

  // Subject specific entries
  const subjectEntries = activeSubject
    ? (permissionMatrix || []).filter(
        (e) =>
          e.subject &&
          e.subject.kind === activeSubject.kind &&
          e.subject.name === activeSubject.name &&
          (e.subject.namespace === activeSubject.namespace || !e.subject.namespace)
      )
    : [];

  // Subject bindings
  const subjectRoleBindings = activeSubject
    ? (roleBindings || []).filter((rb) =>
        (rb.subjects || []).some(
          (s) =>
            s.kind === activeSubject.kind &&
            s.name === activeSubject.name &&
            (s.namespace === activeSubject.namespace || !s.namespace)
        )
      )
    : [];

  const subjectClusterRoleBindings = activeSubject
    ? (clusterRoleBindings || []).filter((crb) =>
        (crb.subjects || []).some(
          (s) =>
            s.kind === activeSubject.kind &&
            s.name === activeSubject.name &&
            (s.namespace === activeSubject.namespace || !s.namespace)
        )
      )
    : [];

  // 4. Effective Permissions Calculation
  const effectiveRulesMap = new Map();
  if (activeSubject) {
    for (const entry of subjectEntries) {
      for (const res of entry.resources || []) {
        for (const grp of ((entry.apiGroups || []).length ? entry.apiGroups : [''])) {
          const resNames = (entry.resourceNames || []).length ? entry.resourceNames.slice().sort().join(',') : '*';
          const key = `${grp}:${res}:${resNames}:${entry.scope}`;
          if (!effectiveRulesMap.has(key)) {
            effectiveRulesMap.set(key, {
              apiGroup: grp === '' ? 'core ("")' : grp,
              resource: res,
              resourceNames: (entry.resourceNames || []).length ? entry.resourceNames : ['* (all)'],
              scope: entry.scope,
              isClusterScoped: entry.isClusterScoped,
              verbs: new Set(entry.verbs || []),
              sources: new Set([`${entry.binding?.kind}/${entry.binding?.name} -> ${entry.role?.kind}/${entry.role?.name}`]),
            });
          } else {
            const item = effectiveRulesMap.get(key);
            (entry.verbs || []).forEach((v) => item.verbs.add(v));
            item.sources.add(`${entry.binding?.kind}/${entry.binding?.name} -> ${entry.role?.kind}/${entry.role?.name}`);
          }
        }
      }
    }
  }
  const effectiveRulesList = Array.from(effectiveRulesMap.values()).map((item) => ({
    ...item,
    verbs: Array.from(item.verbs),
    sources: Array.from(item.sources),
  }));

  // 3. Resource Access Matching
  const resourceAccessMatches = (permissionMatrix || []).filter((entry) => {
    if (!entry) return false;
    if (resAccessNamespace && entry.scope !== resAccessNamespace && !entry.isClusterScoped) return false;
    if (resAccessGroup && !((entry.apiGroups || []).some((g) => (g === '' ? 'core' : g).toLowerCase().includes(resAccessGroup.toLowerCase())))) return false;
    if (resAccessResource && !((entry.resources || []).some((r) => r.toLowerCase().includes(resAccessResource.toLowerCase()) || r === '*'))) return false;
    if (resAccessVerb && !(entry.verbs || []).includes('*') && !(entry.verbs || []).map((v) => v.toLowerCase()).includes(resAccessVerb.toLowerCase())) return false;
    return true;
  });

  const distinctMatchingSubjects = Array.from(
    new Map(
      resourceAccessMatches
        .filter((m) => m.subject)
        .map((m) => [`${m.subject.kind}:${m.subject.namespace || ''}:${m.subject.name}`, m.subject])
    ).values()
  );

  // 5. Global Search matches
  const gq = (globalSearchQuery || '').trim().toLowerCase();
  const globalMatches = gq
    ? {
        serviceAccounts: (subjects || []).filter(
          (s) => s.kind === 'ServiceAccount' && `${s.name} ${s.namespace || ''}`.toLowerCase().includes(gq)
        ),
        roles: (roles || []).filter(
          (r) =>
            (r.name || '').toLowerCase().includes(gq) ||
            (r.namespace || '').toLowerCase().includes(gq) ||
            (r.rules || []).some((rule) => (rule.resources || []).some((res) => res.toLowerCase().includes(gq)))
        ),
        clusterRoles: (clusterRoles || []).filter(
          (cr) =>
            (cr.name || '').toLowerCase().includes(gq) ||
            (cr.rules || []).some((rule) => (rule.resources || []).some((res) => res.toLowerCase().includes(gq)))
        ),
        roleBindings: (roleBindings || []).filter(
          (rb) =>
            (rb.name || '').toLowerCase().includes(gq) ||
            (rb.namespace || '').toLowerCase().includes(gq) ||
            (rb.roleRef?.name || '').toLowerCase().includes(gq) ||
            (rb.subjects || []).some((s) => (s.name || '').toLowerCase().includes(gq))
        ),
        clusterRoleBindings: (clusterRoleBindings || []).filter(
          (crb) =>
            (crb.name || '').toLowerCase().includes(gq) ||
            (crb.roleRef?.name || '').toLowerCase().includes(gq) ||
            (crb.subjects || []).some((s) => (s.name || '').toLowerCase().includes(gq))
        ),
        matrixPermissions: (permissionMatrix || []).filter(
          (p) =>
            (p.resources || []).some((r) => r.toLowerCase().includes(gq)) ||
            (p.verbs || []).some((v) => v.toLowerCase().includes(gq)) ||
            (p.subject?.name || '').toLowerCase().includes(gq)
        ),
      }
    : null;

  return (
    <div style={{ marginTop: '16px' }}>
      {/* Sub-mode switcher */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <button
          className={`button subtle ${viewMode === 'matrix' ? 'primary' : ''}`}
          onClick={() => setViewMode('matrix')}
        >
          <Layers3 size={14} /> Permission Matrix ({(permissionMatrix || []).length})
        </button>
        <button
          className={`button subtle ${viewMode === 'subject' ? 'primary' : ''}`}
          onClick={() => setViewMode('subject')}
        >
          <Box size={14} /> Subject Access View
        </button>
        <button
          className={`button subtle ${viewMode === 'resource' ? 'primary' : ''}`}
          onClick={() => setViewMode('resource')}
        >
          <Search size={14} /> Resource Access View
        </button>
        <button
          className={`button subtle ${viewMode === 'effective' ? 'primary' : ''}`}
          onClick={() => setViewMode('effective')}
        >
          <Shield size={14} /> Effective Permissions
        </button>
        <button
          className={`button subtle ${viewMode === 'globalsearch' ? 'primary' : ''}`}
          onClick={() => setViewMode('globalsearch')}
        >
          <Globe size={14} /> Global RBAC Search
        </button>
        <button
          className={`button subtle ${viewMode === 'indicators' ? 'primary' : ''}`}
          onClick={() => setViewMode('indicators')}
        >
          <Activity size={14} /> Configuration Indicators
        </button>
        <button
          className={`button subtle ${viewMode === 'graph' ? 'primary' : ''}`}
          onClick={() => setViewMode('graph')}
        >
          <Network size={14} /> Relationship Graph
        </button>
      </div>

      {/* 1. PERMISSION MATRIX */}
      {viewMode === 'matrix' && (
        <section className="panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">Authorization Grid</span>
              <h2>RBAC Permission Matrix</h2>
            </div>
            <Badge tone="teal">Showing {filteredMatrix.length} of {(permissionMatrix || []).length} entries</Badge>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', marginBottom: '16px' }}>
            <input
              className="select"
              value={matrixSearch}
              onChange={(e) => setMatrixSearch(e.target.value)}
              placeholder="Search subject / role / resource..."
            />
            <select className="select" value={matrixNamespace} onChange={(e) => setMatrixNamespace(e.target.value)}>
              <option value="">All Namespaces</option>
              {(namespaces || []).map((ns) => (
                <option key={ns} value={ns}>{ns}</option>
              ))}
            </select>
            <input
              className="select"
              value={matrixApiGroup}
              onChange={(e) => setMatrixApiGroup(e.target.value)}
              placeholder="Filter API Group (e.g. apps, core)"
            />
            <input
              className="select"
              value={matrixResource}
              onChange={(e) => setMatrixResource(e.target.value)}
              placeholder="Filter Resource (e.g. pods, secrets)"
            />
            <select className="select" value={matrixVerb} onChange={(e) => setMatrixVerb(e.target.value)}>
              <option value="">All Verbs</option>
              {['get', 'list', 'watch', 'create', 'update', 'patch', 'delete', '*'].map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
            <select className="select" value={matrixScope} onChange={(e) => setMatrixScope(e.target.value)}>
              <option value="all">All Scopes</option>
              <option value="namespaced">Namespaced only</option>
              <option value="cluster">Cluster-wide only</option>
            </select>
          </div>

          {!filteredMatrix.length ? (
            <Empty title="No permissions match your filters" text="Try clearing search queries or expanding the namespace selection." />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Scope</th>
                    <th>API Group</th>
                    <th>Resource</th>
                    <th>Resource Names</th>
                    <th>Verbs</th>
                    <th>Source Binding</th>
                    <th>Source Role</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMatrix.slice(0, 200).map((entry, idx) => (
                    <tr key={idx}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Badge tone="info">{entry.subject?.kind || 'Subject'}</Badge>
                          <strong
                            className="resource-name clickable"
                            onClick={() =>
                              entry.subject?.kind === 'ServiceAccount' &&
                              onSelectSA?.({ name: entry.subject.name, namespace: entry.subject.namespace || 'default' })
                            }
                          >
                            {entry.subject?.display || entry.subject?.name}
                          </strong>
                        </div>
                      </td>
                      <td>
                        <Badge tone={entry.isClusterScoped ? 'purple' : 'teal'}>{entry.scope}</Badge>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {(entry.apiGroups || []).map((g, i) => (
                            <Badge key={i} tone="info">{g === '' ? 'core' : g}</Badge>
                          ))}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {(entry.resources || []).map((r, i) => (
                            <strong key={i} style={{ fontSize: '12px' }}>{r}</strong>
                          ))}
                        </div>
                      </td>
                      <td>
                        <span className="mono" style={{ fontSize: '12px' }}>
                          {(entry.resourceNames || []).length ? entry.resourceNames.join(', ') : '*'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {(entry.verbs || []).map((v, i) => (
                            <Badge key={i} tone={verbBadgeTone(v)}>{v}</Badge>
                          ))}
                        </div>
                      </td>
                      <td>
                        <span
                          className="mono clickable"
                          onClick={() =>
                            entry.binding?.kind === 'RoleBinding'
                              ? onSelectRB?.({ name: entry.binding.name, namespace: entry.binding.namespace })
                              : onSelectCRB?.({ name: entry.binding?.name })
                          }
                          style={{ fontSize: '12px', color: '#38bdf8' }}
                        >
                          {entry.binding?.name}
                        </span>
                      </td>
                      <td>
                        <span
                          className="mono clickable"
                          onClick={() =>
                            entry.role?.kind === 'Role'
                              ? onSelectRole?.({ name: entry.role.name, namespace: entry.role.namespace })
                              : onSelectCR?.({ name: entry.role?.name })
                          }
                          style={{ fontSize: '12px', color: '#c084fc' }}
                        >
                          {entry.role?.name}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredMatrix.length > 200 && (
                <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                  Showing first 200 of {filteredMatrix.length} matching permission records. Use filters above to narrow your query.
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* 2. SUBJECT ACCESS VIEW */}
      {viewMode === 'subject' && (
        <section className="panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">Identity-to-Permissions Traversal</span>
              <h2>Subject Access View</h2>
            </div>
            {activeSubject && <Badge tone="info">{activeSubject.kind}: {activeSubject.display}</Badge>}
          </div>

          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1', minWidth: '240px' }}>
              <input
                className="select"
                value={subjectQuery}
                onChange={(e) => setSubjectQuery(e.target.value)}
                placeholder="Filter subjects list..."
              />
            </div>
            <div style={{ flex: '2', minWidth: '280px' }}>
              <select
                className="select"
                value={selectedSubjectKey || (activeSubject ? `${activeSubject.kind}:${activeSubject.namespace || ''}:${activeSubject.name}` : '')}
                onChange={(e) => setSelectedSubjectKey(e.target.value)}
              >
                {filteredSubjects.map((sub) => {
                  const key = `${sub.kind}:${sub.namespace || ''}:${sub.name}`;
                  return (
                    <option key={key} value={key}>
                      [{sub.kind}] {sub.display}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {activeSubject ? (
            <div>
              <div style={{ padding: '16px', background: 'var(--panel-2)', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Box size={22} color="#38bdf8" />
                    <div>
                      <strong style={{ fontSize: '15px' }}>{activeSubject.name}</strong>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        Kind: <Badge tone="info">{activeSubject.kind}</Badge> {activeSubject.namespace && <>· Namespace: <Badge tone="teal">{activeSubject.namespace}</Badge></>}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>RoleBindings</span>
                      <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{subjectRoleBindings.length}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ClusterRoleBindings</span>
                      <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{subjectClusterRoleBindings.length}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Declared Rules</span>
                      <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#38bdf8' }}>{subjectEntries.length}</div>
                    </div>
                  </div>
                </div>
              </div>

              <h3>1. Namespaced RoleBindings ({subjectRoleBindings.length})</h3>
              {subjectRoleBindings.length ? (
                <div className="mini-list" style={{ marginBottom: '16px' }}>
                  {subjectRoleBindings.map((rb, idx) => (
                    <div key={idx} className="clickable" onClick={() => onSelectRB?.(rb)}>
                      <div>
                        <strong><Network size={14} /> {rb.name}</strong>
                        <span>Namespace: {rb.namespace} · RoleRef: {rb.roleRef?.kind}/{rb.roleRef?.name}</span>
                      </div>
                      <Badge tone={rb.roleRef?.kind === 'ClusterRole' ? 'purple' : 'info'}>{rb.roleRef?.kind}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted" style={{ fontSize: '13px', marginBottom: '16px' }}>No namespaced RoleBindings bind this subject directly.</p>
              )}

              <h3>2. ClusterRoleBindings ({subjectClusterRoleBindings.length})</h3>
              {subjectClusterRoleBindings.length ? (
                <div className="mini-list" style={{ marginBottom: '16px' }}>
                  {subjectClusterRoleBindings.map((crb, idx) => (
                    <div key={idx} className="clickable" onClick={() => onSelectCRB?.(crb)}>
                      <div>
                        <strong><Network size={14} /> {crb.name}</strong>
                        <span>Cluster-Wide · RoleRef: ClusterRole/{crb.roleRef?.name}</span>
                      </div>
                      <Badge tone="purple">Cluster-Wide</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted" style={{ fontSize: '13px', marginBottom: '16px' }}>No ClusterRoleBindings bind this subject directly.</p>
              )}

              <h3>3. Resolved Granted Rules ({subjectEntries.length})</h3>
              {!subjectEntries.length ? (
                <Empty title="No permission rules found" text="This subject has no active role bindings or grants no rules." />
              ) : (
                <RBACRuleTable rules={subjectEntries} />
              )}
            </div>
          ) : (
            <Empty title="Select a subject" text="Choose a ServiceAccount, User, or Group above to inspect its access graph." />
          )}
        </section>
      )}

      {/* 3. RESOURCE ACCESS VIEW */}
      {viewMode === 'resource' && (
        <section className="panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">Who Can Access What</span>
              <h2>Resource Access View</h2>
            </div>
            <Badge tone="teal">{distinctMatchingSubjects.length} Authorized Subjects</Badge>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', marginBottom: '16px' }}>
            <select className="select" value={resAccessNamespace} onChange={(e) => setResAccessNamespace(e.target.value)}>
              <option value="">All Namespaces</option>
              {(namespaces || []).map((ns) => (
                <option key={ns} value={ns}>{ns}</option>
              ))}
            </select>
            <input
              className="select"
              value={resAccessGroup}
              onChange={(e) => setResAccessGroup(e.target.value)}
              placeholder="API Group (e.g. apps, core)"
            />
            <input
              className="select"
              value={resAccessResource}
              onChange={(e) => setResAccessResource(e.target.value)}
              placeholder="Target Resource (e.g. pods, secrets, *)"
            />
            <select className="select" value={resAccessVerb} onChange={(e) => setResAccessVerb(e.target.value)}>
              <option value="">Any Verb (*)</option>
              {['get', 'list', 'watch', 'create', 'update', 'patch', 'delete'].map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px', alignItems: 'start' }}>
            <div style={{ background: 'var(--panel-2)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <strong style={{ fontSize: '13px' }}>Matching Subjects</strong>
                <Badge tone="info">{distinctMatchingSubjects.length}</Badge>
              </div>
              <div className="mini-list" style={{ maxHeight: '420px', overflowY: 'auto' }}>
                {distinctMatchingSubjects.map((sub, i) => (
                  <div
                    key={i}
                    className="clickable"
                    onClick={() => {
                      setSelectedSubjectKey(`${sub.kind}:${sub.namespace || ''}:${sub.name}`);
                      setViewMode('effective');
                    }}
                  >
                    <div>
                      <strong>{sub.name}</strong>
                      <span>{sub.kind} {sub.namespace ? `· ${sub.namespace}` : ''}</span>
                    </div>
                    <ChevronRight size={14} />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <strong style={{ fontSize: '13px', display: 'block', marginBottom: '8px' }}>
                Declared Permission Mappings ({resourceAccessMatches.length})
              </strong>
              {!resourceAccessMatches.length ? (
                <Empty title="No matching RBAC rules" text="No subjects have declared rules matching these criteria." />
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Subject</th>
                        <th>Scope</th>
                        <th>Resource</th>
                        <th>Verbs</th>
                        <th>Via Binding</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resourceAccessMatches.slice(0, 100).map((m, idx) => (
                        <tr key={idx}>
                          <td>
                            <strong style={{ fontSize: '12px' }}>{m.subject?.display || m.subject?.name}</strong>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{m.subject?.kind}</div>
                          </td>
                          <td><Badge tone={m.isClusterScoped ? 'purple' : 'teal'}>{m.scope}</Badge></td>
                          <td><span className="mono" style={{ fontSize: '12px' }}>{(m.resources || []).join(', ')}</span></td>
                          <td>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                              {(m.verbs || []).map((v, i) => (
                                <Badge key={i} tone={verbBadgeTone(v)}>{v}</Badge>
                              ))}
                            </div>
                          </td>
                          <td>
                            <span className="mono" style={{ fontSize: '11px' }}>{m.binding?.name}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* 4. EFFECTIVE PERMISSIONS */}
      {viewMode === 'effective' && (
        <section className="panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">Deduplicated Authority</span>
              <h2>Effective Permissions Analysis</h2>
            </div>
            {activeSubject && <Badge tone="teal">{effectiveRulesList.length} Consolidated Rule Sets</Badge>}
          </div>

          <div style={{ padding: '12px 16px', background: 'rgba(56, 189, 248, 0.05)', borderRadius: '6px', border: '1px solid rgba(56, 189, 248, 0.2)', marginBottom: '16px', fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} color="#38bdf8" />
            <span>
              <strong>Declared RBAC Permissions:</strong> This view aggregates rules declared across RoleBindings and ClusterRoleBindings. Cluster Admission Webhooks, Node authorizers, and namespace quotas may also govern access.
            </span>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1', minWidth: '240px' }}>
              <input
                className="select"
                value={subjectQuery}
                onChange={(e) => setSubjectQuery(e.target.value)}
                placeholder="Filter subjects list..."
              />
            </div>
            <div style={{ flex: '2', minWidth: '280px' }}>
              <select
                className="select"
                value={selectedSubjectKey || (activeSubject ? `${activeSubject.kind}:${activeSubject.namespace || ''}:${activeSubject.name}` : '')}
                onChange={(e) => setSelectedSubjectKey(e.target.value)}
              >
                {filteredSubjects.map((sub) => {
                  const key = `${sub.kind}:${sub.namespace || ''}:${sub.name}`;
                  return (
                    <option key={key} value={key}>
                      [{sub.kind}] {sub.display}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {activeSubject ? (
            !effectiveRulesList.length ? (
              <Empty title="No effective permissions found" text="This subject is not granted any permissions via active bindings." />
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>API Group</th>
                      <th>Resource</th>
                      <th>Resource Names</th>
                      <th>Scope</th>
                      <th>Consolidated Verbs</th>
                      <th>Granted Via</th>
                    </tr>
                  </thead>
                  <tbody>
                    {effectiveRulesList.map((rule, idx) => (
                      <tr key={idx}>
                        <td><Badge tone="info">{rule.apiGroup}</Badge></td>
                        <td><strong style={{ fontSize: '13px' }}>{rule.resource}</strong></td>
                        <td><span className="mono" style={{ fontSize: '12px' }}>{rule.resourceNames.join(', ')}</span></td>
                        <td><Badge tone={rule.isClusterScoped ? 'purple' : 'teal'}>{rule.scope}</Badge></td>
                        <td>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                            {rule.verbs.map((v, i) => (
                              <Badge key={i} tone={verbBadgeTone(v)}>{v}</Badge>
                            ))}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            {rule.sources.map((src, i) => (
                              <span key={i} className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{src}</span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            <Empty title="Select a subject" text="Choose a subject to compute its effective permissions." />
          )}
        </section>
      )}

      {/* 5. GLOBAL RBAC SEARCH */}
      {viewMode === 'globalsearch' && (
        <section className="panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">Multi-Object Search</span>
              <h2>Global RBAC Search</h2>
            </div>
            {globalMatches && (
              <Badge tone="teal">
                {(globalMatches.serviceAccounts.length + globalMatches.roles.length + globalMatches.clusterRoles.length + globalMatches.roleBindings.length + globalMatches.clusterRoleBindings.length)} Object Matches
              </Badge>
            )}
          </div>

          <div style={{ marginBottom: '16px' }}>
            <input
              className="select"
              style={{ width: '100%', fontSize: '14px', padding: '10px 14px' }}
              value={globalSearchQuery}
              onChange={(e) => setGlobalSearchQuery(e.target.value)}
              placeholder="Type anything (e.g. cluster-admin, secrets, system:node, *)..."
            />
          </div>

          {!globalMatches ? (
            <Empty title="Type a search query" text="Search across ServiceAccounts, Roles, RoleBindings, ClusterRoles, ClusterRoleBindings, and permissions." />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              <div style={{ background: 'var(--panel-2)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <strong><Box size={14} /> Service Accounts</strong>
                  <Badge tone="info">{globalMatches.serviceAccounts.length}</Badge>
                </div>
                <div className="mini-list" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {globalMatches.serviceAccounts.map((sa, i) => (
                    <div key={i} className="clickable" onClick={() => onSelectSA?.(sa)}>
                      <strong>{sa.name}</strong>
                      <Badge tone="teal">{sa.namespace}</Badge>
                    </div>
                  ))}
                  {!globalMatches.serviceAccounts.length && <span className="muted" style={{ fontSize: '12px' }}>No matches</span>}
                </div>
              </div>

              <div style={{ background: 'var(--panel-2)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <strong><Shield size={14} /> Roles & ClusterRoles</strong>
                  <Badge tone="info">{globalMatches.roles.length + globalMatches.clusterRoles.length}</Badge>
                </div>
                <div className="mini-list" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {globalMatches.roles.map((r, i) => (
                    <div key={i} className="clickable" onClick={() => onSelectRole?.(r)}>
                      <strong>{r.name}</strong>
                      <Badge tone="info">{r.namespace}</Badge>
                    </div>
                  ))}
                  {globalMatches.clusterRoles.map((cr, i) => (
                    <div key={i} className="clickable" onClick={() => onSelectCR?.(cr)}>
                      <strong>{cr.name}</strong>
                      <Badge tone="purple">ClusterRole</Badge>
                    </div>
                  ))}
                  {!globalMatches.roles.length && !globalMatches.clusterRoles.length && <span className="muted" style={{ fontSize: '12px' }}>No matches</span>}
                </div>
              </div>

              <div style={{ background: 'var(--panel-2)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <strong><Network size={14} /> Bindings</strong>
                  <Badge tone="info">{globalMatches.roleBindings.length + globalMatches.clusterRoleBindings.length}</Badge>
                </div>
                <div className="mini-list" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {globalMatches.roleBindings.map((rb, i) => (
                    <div key={i} className="clickable" onClick={() => onSelectRB?.(rb)}>
                      <strong>{rb.name}</strong>
                      <Badge tone="info">{rb.namespace}</Badge>
                    </div>
                  ))}
                  {globalMatches.clusterRoleBindings.map((crb, i) => (
                    <div key={i} className="clickable" onClick={() => onSelectCRB?.(crb)}>
                      <strong>{crb.name}</strong>
                      <Badge tone="purple">ClusterRoleBinding</Badge>
                    </div>
                  ))}
                  {!globalMatches.roleBindings.length && !globalMatches.clusterRoleBindings.length && <span className="muted" style={{ fontSize: '12px' }}>No matches</span>}
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* 6. CONFIGURATION INDICATORS */}
      {viewMode === 'indicators' && (
        <div>
          <div style={{ padding: '12px 16px', background: 'var(--panel-2)', borderRadius: '6px', border: '1px solid var(--border)', marginBottom: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
            <strong>Factual Configuration Patterns:</strong> Objective patterns discovered across declared RBAC objects in this cluster.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            <div className="storage-overview-card">
              <div className="storage-overview-card-header">
                <h3><Shield size={16} /> Wildcard API Groups</h3>
                <Badge tone="info">{indicators.wildcardApiGroups?.count || 0}</Badge>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Roles declaring `apiGroups: ["*"]`</p>
              <div className="mini-list" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                {(indicators.wildcardApiGroups?.roles || []).map((r, i) => (
                  <div key={i} className="clickable" onClick={() => r.kind === 'Role' ? onSelectRole?.(r) : onSelectCR?.(r)}>
                    <strong>{r.name}</strong>
                    <Badge tone={r.kind === 'ClusterRole' ? 'purple' : 'info'}>{r.kind}</Badge>
                  </div>
                ))}
              </div>
            </div>

            <div className="storage-overview-card">
              <div className="storage-overview-card-header">
                <h3><Shield size={16} /> Wildcard Resources</h3>
                <Badge tone="info">{indicators.wildcardResources?.count || 0}</Badge>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Roles declaring `resources: ["*"]`</p>
              <div className="mini-list" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                {(indicators.wildcardResources?.roles || []).map((r, i) => (
                  <div key={i} className="clickable" onClick={() => r.kind === 'Role' ? onSelectRole?.(r) : onSelectCR?.(r)}>
                    <strong>{r.name}</strong>
                    <Badge tone={r.kind === 'ClusterRole' ? 'purple' : 'info'}>{r.kind}</Badge>
                  </div>
                ))}
              </div>
            </div>

            <div className="storage-overview-card">
              <div className="storage-overview-card-header">
                <h3><Shield size={16} /> Wildcard Verbs</h3>
                <Badge tone="info">{indicators.wildcardVerbs?.count || 0}</Badge>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Roles declaring `verbs: ["*"]`</p>
              <div className="mini-list" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                {(indicators.wildcardVerbs?.roles || []).map((r, i) => (
                  <div key={i} className="clickable" onClick={() => r.kind === 'Role' ? onSelectRole?.(r) : onSelectCR?.(r)}>
                    <strong>{r.name}</strong>
                    <Badge tone={r.kind === 'ClusterRole' ? 'purple' : 'info'}>{r.kind}</Badge>
                  </div>
                ))}
              </div>
            </div>

            <div className="storage-overview-card">
              <div className="storage-overview-card-header">
                <h3><Network size={16} /> cluster-admin Bindings</h3>
                <Badge tone="purple">{indicators.clusterAdminBindings?.count || 0}</Badge>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Bindings referencing ClusterRole/cluster-admin</p>
              <div className="mini-list" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                {(indicators.clusterAdminBindings?.bindings || []).map((b, i) => (
                  <div key={i} className="clickable" onClick={() => b.kind === 'RoleBinding' ? onSelectRB?.(b) : onSelectCRB?.(b)}>
                    <strong>{b.name}</strong>
                    <Badge tone={b.kind === 'ClusterRoleBinding' ? 'purple' : 'info'}>{b.kind}</Badge>
                  </div>
                ))}
              </div>
            </div>

            <div className="storage-overview-card">
              <div className="storage-overview-card-header">
                <h3><Globe size={16} /> Non-Resource URL Rules</h3>
                <Badge tone="teal">{indicators.nonResourceUrls?.count || 0}</Badge>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Roles declaring nonResourceURLs rules</p>
              <div className="mini-list" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                {(indicators.nonResourceUrls?.roles || []).map((r, i) => (
                  <div key={i} className="clickable" onClick={() => r.kind === 'Role' ? onSelectRole?.(r) : onSelectCR?.(r)}>
                    <strong>{r.name}</strong>
                    <Badge tone={r.kind === 'ClusterRole' ? 'purple' : 'info'}>{r.kind}</Badge>
                  </div>
                ))}
              </div>
            </div>

            <div className="storage-overview-card">
              <div className="storage-overview-card-header">
                <h3><Box size={16} /> ServiceAccount Bindings</h3>
                <Badge tone="teal">{indicators.serviceAccountBindings?.count || 0}</Badge>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Total bindings assigned to workload ServiceAccounts</p>
            </div>

            <div className="storage-overview-card">
              <div className="storage-overview-card-header">
                <h3><Box size={16} /> User & Group Bindings</h3>
                <Badge tone="info">{indicators.userGroupBindings?.count || 0}</Badge>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Total bindings assigned to User or Group identities</p>
            </div>
          </div>
        </div>
      )}

      {/* 7. RELATIONSHIP GRAPH */}
      {viewMode === 'graph' && (
        <section className="panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">Visual Authorization Graph</span>
              <h2>RBAC Relationship Graph</h2>
            </div>
            {activeSubject && <Badge tone="info">{activeSubject.display}</Badge>}
          </div>

          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1', minWidth: '240px' }}>
              <input
                className="select"
                value={subjectQuery}
                onChange={(e) => setSubjectQuery(e.target.value)}
                placeholder="Search subject..."
              />
            </div>
            <div style={{ flex: '2', minWidth: '280px' }}>
              <select
                className="select"
                value={selectedSubjectKey || (activeSubject ? `${activeSubject.kind}:${activeSubject.namespace || ''}:${activeSubject.name}` : '')}
                onChange={(e) => setSelectedSubjectKey(e.target.value)}
              >
                {filteredSubjects.map((sub) => {
                  const key = `${sub.kind}:${sub.namespace || ''}:${sub.name}`;
                  return (
                    <option key={key} value={key}>
                      [{sub.kind}] {sub.display}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {activeSubject ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ padding: '16px', background: 'rgba(56, 189, 248, 0.08)', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.2)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Box size={24} color="#38bdf8" />
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Selected Subject Node</span>
                  <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#38bdf8' }}>{activeSubject.display} ({activeSubject.kind})</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
                {subjectRoleBindings.map((rb, i) => (
                  <div key={i} style={{ padding: '14px', background: 'var(--panel-2)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#c084fc', marginBottom: '6px' }}>
                      <Network size={16} />
                      <strong>RoleBinding: {rb.name}</strong>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                      Namespace: {rb.namespace} · Target Role: <strong style={{ color: '#fbbf24' }}>{rb.roleRef?.kind}/{rb.roleRef?.name}</strong>
                    </div>
                    <div style={{ padding: '8px', background: 'var(--panel-2)', borderRadius: '4px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Rules granted via this binding</span>
                      <div style={{ marginTop: '4px', fontSize: '12px' }}>
                        {(permissionMatrix || []).filter((e) => e.binding?.name === rb.name).map((e, idx) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                            <Badge tone="teal">{(e.resources || []).join(', ')}</Badge>
                            <span style={{ fontSize: '11px' }}>({(e.verbs || []).join(', ')})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}

                {subjectClusterRoleBindings.map((crb, i) => (
                  <div key={i} style={{ padding: '14px', background: 'var(--panel-2)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#c084fc', marginBottom: '6px' }}>
                      <Network size={16} />
                      <strong>ClusterRoleBinding: {crb.name}</strong>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                      Cluster-Wide · Target Role: <strong style={{ color: '#fbbf24' }}>ClusterRole/{crb.roleRef?.name}</strong>
                    </div>
                    <div style={{ padding: '8px', background: 'var(--panel-2)', borderRadius: '4px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Rules granted via this binding</span>
                      <div style={{ marginTop: '4px', fontSize: '12px' }}>
                        {(permissionMatrix || []).filter((e) => e.binding?.name === crb.name).map((e, idx) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                            <Badge tone="purple">{(e.resources || []).join(', ')}</Badge>
                            <span style={{ fontSize: '11px' }}>({(e.verbs || []).join(', ')})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <Empty title="Select a subject" text="Choose a subject to render its authorization graph." />
          )}
        </section>
      )}
    </div>
  );
}


function RBACView({ onSelectSA, onSelectRole, onSelectRB, onSelectCR, onSelectCRB }) {
  console.log("[RBAC DEBUG] RBACPage rendered");
  const [activeTab, setActiveTab] = useState('overview');
  const [namespace, setNamespace] = useState('');
  const [search, setSearch] = useState('');

  const overviewResource = useResource(api.rbacOverview, []);
  const analysisResource = useResource(api.rbacAnalysis, []);
  const sasResource = useResource(() => api.serviceAccounts(namespace, { search }), [namespace, search]);
  const rolesResource = useResource(() => api.roles(namespace, { search }), [namespace, search]);
  const rbsResource = useResource(() => api.roleBindings(namespace, { search }), [namespace, search]);
  const crsResource = useResource(() => api.clusterRoles({ search }), [search]);
  const crbsResource = useResource(() => api.clusterRoleBindings({ search }), [search]);

  const overview = overviewResource.data || {};
  const sas = sasResource.data?.data || [];
  const roles = rolesResource.data?.data || [];
  const rbs = rbsResource.data?.data || [];
  const crs = crsResource.data?.data || [];
  const crbs = crbsResource.data?.data || [];

  const reloadAll = () => {
    overviewResource.reload();
    analysisResource.reload();
    sasResource.reload();
    rolesResource.reload();
    rbsResource.reload();
    crsResource.reload();
    crbsResource.reload();
  };

  return (
    <>
      <PageHeader
        eyebrow="Access Control & Security"
        title="Role-Based Access Control (RBAC)"
        description="Explore Service Accounts, Roles, Role Bindings, Cluster Roles, and Cluster Role Bindings across the cluster."
        action={
          <button className="button subtle" onClick={reloadAll}>
            <RefreshCw size={16} /> Refresh
          </button>
        }
      />

      <div className="metrics-grid">
        <Metric
          icon={Box}
          label="Service Accounts"
          value={overview.serviceAccounts?.total ?? sas.length}
          detail={`${overview.serviceAccounts?.namespacesCount ?? 0} active namespaces`}
          accent="teal"
        />
        <Metric
          icon={Shield}
          label="Namespaced Roles"
          value={overview.roles?.total ?? roles.length}
          detail={`${overview.roles?.namespacesCount ?? 0} namespaces`}
          accent="blue"
        />
        <Metric
          icon={Network}
          label="Role Bindings"
          value={overview.roleBindings?.total ?? rbs.length}
          detail={`${overview.roleBindings?.referencingClusterRoles ?? 0} ref ClusterRole`}
          accent="amber"
        />
        <Metric
          icon={Shield}
          label="Cluster Roles"
          value={overview.clusterRoles?.total ?? crs.length}
          detail={`${overview.clusterRoles?.userCreated ?? 0} user · ${overview.clusterRoles?.system ?? 0} system`}
          accent="coral"
        />
        <Metric
          icon={Network}
          label="Cluster Role Bindings"
          value={overview.clusterRoleBindings?.total ?? crbs.length}
          detail={`${overview.clusterRoleBindings?.userCreated ?? 0} user · ${overview.clusterRoleBindings?.system ?? 0} system`}
          accent="purple"
        />
      </div>

      <div className="sub-nav-tabs">
        <button
          className={`sub-nav-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <LayoutDashboard size={15} /> Overview
        </button>
        <button
          className={`sub-nav-tab ${activeTab === 'serviceaccounts' ? 'active' : ''}`}
          onClick={() => setActiveTab('serviceaccounts')}
        >
          <Box size={15} /> Service Accounts ({overview.serviceAccounts?.total ?? sas.length})
        </button>
        <button
          className={`sub-nav-tab ${activeTab === 'roles' ? 'active' : ''}`}
          onClick={() => setActiveTab('roles')}
        >
          <Shield size={15} /> Roles ({overview.roles?.total ?? roles.length})
        </button>
        <button
          className={`sub-nav-tab ${activeTab === 'rolebindings' ? 'active' : ''}`}
          onClick={() => setActiveTab('rolebindings')}
        >
          <Network size={15} /> Role Bindings ({overview.roleBindings?.total ?? rbs.length})
        </button>
        <button
          className={`sub-nav-tab ${activeTab === 'clusterroles' ? 'active' : ''}`}
          onClick={() => setActiveTab('clusterroles')}
        >
          <Shield size={15} /> Cluster Roles ({overview.clusterRoles?.total ?? crs.length})
        </button>
        <button
          className={`sub-nav-tab ${activeTab === 'clusterrolebindings' ? 'active' : ''}`}
          onClick={() => setActiveTab('clusterrolebindings')}
        >
          <Network size={15} /> Cluster Role Bindings ({overview.clusterRoleBindings?.total ?? crbs.length})
        </button>
        <button
          className={`sub-nav-tab ${activeTab === 'analysis' ? 'active' : ''}`}
          onClick={() => setActiveTab('analysis')}
        >
          <Activity size={15} /> Advanced Analysis
        </button>
      </div>

      {activeTab !== 'overview' && (
        <Toolbar search={search} setSearch={setSearch} onRefresh={reloadAll}>
          {(activeTab === 'serviceaccounts' || activeTab === 'roles' || activeTab === 'rolebindings') && (
            <input
              className="select"
              value={namespace}
              onChange={(e) => setNamespace(e.target.value)}
              placeholder="All namespaces"
            />
          )}
        </Toolbar>
      )}

      {activeTab === 'overview' ? (
        overviewResource.loading ? (
          <Loading rows={4} />
        ) : overviewResource.error ? (
          <ErrorState error={overviewResource.error} reload={overviewResource.reload} />
        ) : (
          <>
            <div className="storage-overview-grid">
              <div className="storage-overview-card">
                <div className="storage-overview-card-header">
                  <h3><Shield size={16} /> Roles & Scopes</h3>
                  <Badge tone="teal">{(overview.roles?.total ?? 0) + (overview.clusterRoles?.total ?? 0)} Total</Badge>
                </div>
                <div className="storage-breakdown-list">
                  <div className="storage-breakdown-item">
                    <span>Namespaced Roles</span>
                    <Badge tone="info">{overview.roles?.total ?? 0}</Badge>
                  </div>
                  <div className="storage-breakdown-item">
                    <span>Cluster-Wide Roles</span>
                    <Badge tone="success">{overview.clusterRoles?.total ?? 0}</Badge>
                  </div>
                  <div className="storage-breakdown-item">
                    <span>User-Defined Cluster Roles</span>
                    <Badge tone="teal">{overview.clusterRoles?.userCreated ?? 0}</Badge>
                  </div>
                  <div className="storage-breakdown-item">
                    <span>Kubernetes System Roles</span>
                    <Badge tone="warning">{overview.clusterRoles?.system ?? 0}</Badge>
                  </div>
                </div>
              </div>

              <div className="storage-overview-card">
                <div className="storage-overview-card-header">
                  <h3><Network size={16} /> Bindings & Assignments</h3>
                  <Badge tone="blue">{(overview.roleBindings?.total ?? 0) + (overview.clusterRoleBindings?.total ?? 0)} Total</Badge>
                </div>
                <div className="storage-breakdown-list">
                  <div className="storage-breakdown-item">
                    <span>Namespaced RoleBindings</span>
                    <Badge tone="info">{overview.roleBindings?.total ?? 0}</Badge>
                  </div>
                  <div className="storage-breakdown-item">
                    <span>ClusterRoleBindings</span>
                    <Badge tone="success">{overview.clusterRoleBindings?.total ?? 0}</Badge>
                  </div>
                  <div className="storage-breakdown-item">
                    <span>Bindings referencing Role</span>
                    <Badge tone="teal">{overview.roleBindings?.referencingRoles ?? 0}</Badge>
                  </div>
                  <div className="storage-breakdown-item">
                    <span>Bindings referencing ClusterRole</span>
                    <Badge tone="purple">{overview.roleBindings?.referencingClusterRoles ?? 0}</Badge>
                  </div>
                </div>
              </div>

              <div className="storage-overview-card">
                <div className="storage-overview-card-header">
                  <h3><Box size={16} /> Bound Subjects Distribution</h3>
                  <Badge tone="amber">
                    {(overview.subjectsBreakdown?.serviceAccounts ?? 0) + (overview.subjectsBreakdown?.users ?? 0) + (overview.subjectsBreakdown?.groups ?? 0)} Bound
                  </Badge>
                </div>
                <div className="storage-breakdown-list">
                  <div className="storage-breakdown-item">
                    <span>Service Accounts</span>
                    <Badge tone="teal">{overview.subjectsBreakdown?.serviceAccounts ?? 0}</Badge>
                  </div>
                  <div className="storage-breakdown-item">
                    <span>Users</span>
                    <Badge tone="info">{overview.subjectsBreakdown?.users ?? 0}</Badge>
                  </div>
                  <div className="storage-breakdown-item">
                    <span>Groups</span>
                    <Badge tone="amber">{overview.subjectsBreakdown?.groups ?? 0}</Badge>
                  </div>
                  <div className="storage-breakdown-item">
                    <span>Namespaces with RBAC</span>
                    <Badge tone="success">{overview.namespacesCount ?? 0}</Badge>
                  </div>
                </div>
              </div>
            </div>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <span className="eyebrow">Authorization Model</span>
                  <h2>Kubernetes RBAC Architecture</h2>
                </div>
                <Badge tone="info">RBAC v1</Badge>
              </div>
              <RBACRelationshipFlow />
            </section>
          </>
        )
      ) : activeTab === 'serviceaccounts' ? (
        sasResource.loading ? (
          <Loading rows={5} />
        ) : sasResource.error ? (
          <ErrorState error={sasResource.error} reload={sasResource.reload} />
        ) : (
          <Table
            rows={sas}
            onRow={onSelectSA}
            emptyTitle="No Service Accounts found"
            columns={[
              {
                key: 'name',
                label: 'Service Account',
                render: (r) => (
                  <strong className="resource-name">
                    <Box size={16} />
                    {r.name}
                  </strong>
                ),
              },
              { key: 'namespace', label: 'Namespace' },
              {
                key: 'secretsCount',
                label: 'Secrets',
                render: (r) => <Badge tone="info">{r.secretsCount}</Badge>,
              },
              {
                key: 'automountServiceAccountToken',
                label: 'Automount Token',
                render: (r) => (
                  <Badge tone={r.automountServiceAccountToken ? 'success' : 'muted'}>
                    {r.automountServiceAccountToken ? 'Enabled' : 'Disabled'}
                  </Badge>
                ),
              },
              {
                key: 'age',
                label: 'Age',
                render: (r) => r.age || age(r.creationTimestamp),
              },
            ]}
          />
        )
      ) : activeTab === 'roles' ? (
        rolesResource.loading ? (
          <Loading rows={5} />
        ) : rolesResource.error ? (
          <ErrorState error={rolesResource.error} reload={rolesResource.reload} />
        ) : (
          <Table
            rows={roles}
            onRow={onSelectRole}
            emptyTitle="No Roles found"
            columns={[
              {
                key: 'name',
                label: 'Role Name',
                render: (r) => (
                  <strong className="resource-name">
                    <Shield size={16} />
                    {r.name}
                  </strong>
                ),
              },
              { key: 'namespace', label: 'Namespace' },
              {
                key: 'rulesCount',
                label: 'Rules',
                render: (r) => <Badge tone="teal">{r.rulesCount} Rules</Badge>,
              },
              {
                key: 'age',
                label: 'Age',
                render: (r) => r.age || age(r.creationTimestamp),
              },
            ]}
          />
        )
      ) : activeTab === 'rolebindings' ? (
        rbsResource.loading ? (
          <Loading rows={5} />
        ) : rbsResource.error ? (
          <ErrorState error={rbsResource.error} reload={rbsResource.reload} />
        ) : (
          <Table
            rows={rbs}
            onRow={onSelectRB}
            emptyTitle="No Role Bindings found"
            columns={[
              {
                key: 'name',
                label: 'Role Binding',
                render: (r) => (
                  <strong className="resource-name">
                    <Network size={16} />
                    {r.name}
                  </strong>
                ),
              },
              { key: 'namespace', label: 'Namespace' },
              {
                key: 'roleRef',
                label: 'Referenced Role',
                render: (r) => (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Badge tone={r.roleRef?.kind === 'ClusterRole' ? 'purple' : 'info'}>
                      {r.roleRef?.kind}
                    </Badge>
                    <span className="mono">{r.roleRef?.name}</span>
                  </div>
                ),
              },
              {
                key: 'subjectsCount',
                label: 'Subjects',
                render: (r) => (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Badge tone="teal">{r.subjectsCount}</Badge>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {(r.subjects || []).map((s) => `${s.kind}: ${s.name}`).slice(0, 2).join(', ')}
                      {(r.subjects || []).length > 2 ? ' ...' : ''}
                    </span>
                  </div>
                ),
              },
              {
                key: 'age',
                label: 'Age',
                render: (r) => r.age || age(r.creationTimestamp),
              },
            ]}
          />
        )
      ) : activeTab === 'clusterroles' ? (
        crsResource.loading ? (
          <Loading rows={5} />
        ) : crsResource.error ? (
          <ErrorState error={crsResource.error} reload={crsResource.reload} />
        ) : (
          <Table
            rows={crs}
            onRow={onSelectCR}
            emptyTitle="No Cluster Roles found"
            columns={[
              {
                key: 'name',
                label: 'Cluster Role Name',
                render: (r) => (
                  <strong className="resource-name">
                    <Shield size={16} />
                    {r.name}
                  </strong>
                ),
              },
              {
                key: 'isSystem',
                label: 'Type',
                render: (r) => (
                  <Badge tone={r.isSystem ? 'warning' : 'success'}>
                    {r.isSystem ? 'System' : 'User-Created'}
                  </Badge>
                ),
              },
              {
                key: 'rulesCount',
                label: 'Rules',
                render: (r) => <Badge tone="teal">{r.rulesCount} Rules</Badge>,
              },
              {
                key: 'aggregationRule',
                label: 'Aggregation',
                render: (r) => (
                  r.aggregationRule ? <Badge tone="purple">Aggregated</Badge> : <span className="muted">Direct</span>
                ),
              },
              {
                key: 'age',
                label: 'Age',
                render: (r) => r.age || age(r.creationTimestamp),
              },
            ]}
          />
        )
      ) : activeTab === 'clusterrolebindings' ? (
        crbsResource.loading ? (
          <Loading rows={5} />
        ) : crbsResource.error ? (
          <ErrorState error={crbsResource.error} reload={crbsResource.reload} />
        ) : (
          <Table
            rows={crbs}
            onRow={onSelectCRB}
            emptyTitle="No Cluster Role Bindings found"
            columns={[
              {
                key: 'name',
                label: 'Binding Name',
                render: (r) => (
                  <strong className="resource-name">
                    <Network size={16} />
                    {r.name}
                  </strong>
                ),
              },
              {
                key: 'isSystem',
                label: 'Type',
                render: (r) => (
                  <Badge tone={r.name?.startsWith('system:') ? 'warning' : 'success'}>
                    {r.name?.startsWith('system:') ? 'System' : 'User-Created'}
                  </Badge>
                ),
              },
              {
                key: 'roleRef',
                label: 'Referenced ClusterRole',
                render: (r) => (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Badge tone="purple">ClusterRole</Badge>
                    <span className="mono">{r.roleRef?.name}</span>
                  </div>
                ),
              },
              {
                key: 'subjectsCount',
                label: 'Subjects',
                render: (r) => (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Badge tone="teal">{r.subjectsCount}</Badge>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {(r.subjects || []).map((s) => `${s.kind}: ${s.name}`).slice(0, 2).join(', ')}
                      {(r.subjects || []).length > 2 ? ' ...' : ''}
                    </span>
                  </div>
                ),
              },
              {
                key: 'age',
                label: 'Age',
                render: (r) => r.age || age(r.creationTimestamp),
              },
            ]}
          />
        )
      ) : activeTab === 'analysis' ? (
        <RBACAdvancedAnalysis
          data={analysisResource.data}
          loading={analysisResource.loading}
          error={analysisResource.error}
          reload={analysisResource.reload}
          onSelectSA={onSelectSA}
          onSelectRole={onSelectRole}
          onSelectRB={onSelectRB}
          onSelectCR={onSelectCR}
          onSelectCRB={onSelectCRB}
        />
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// RBAC Detail Drawers
// ---------------------------------------------------------------------------

function ServiceAccountDetail({ serviceAccount, onClose, onSelectRB, onSelectCRB }) {
  const detail = useResource(
    () => api.serviceAccount(serviceAccount.namespace, serviceAccount.name),
    [serviceAccount.namespace, serviceAccount.name]
  );
  const data = detail.data || serviceAccount;
  const related = data.related || {};

  return (
    <DetailPanel
      key={`sa-${serviceAccount.namespace}-${serviceAccount.name}`}
      title={serviceAccount.name}
      resourceType="serviceaccounts"
      namespace={serviceAccount.namespace}
      name={serviceAccount.name}
      onClose={onClose}
    >
      {detail.loading ? (
        <Loading rows={4} />
      ) : detail.error ? (
        <ErrorState error={detail.error} reload={detail.reload} />
      ) : (
        <>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <Badge tone="teal">ServiceAccount</Badge>
            <Badge tone={data.automountServiceAccountToken ? 'success' : 'muted'}>
              {data.automountServiceAccountToken ? 'Token Automount: Yes' : 'Token Automount: No'}
            </Badge>
          </div>

          <KeyValues
            values={{
              Namespace: data.namespace,
              'Automount Token': data.automountServiceAccountToken ? 'true' : 'false',
              'Secrets Count': (data.secrets || []).length,
              'Image Pull Secrets': (data.imagePullSecrets || []).length,
              Created: formatDate(data.creationTimestamp),
              Age: data.age || age(data.creationTimestamp),
            }}
          />

          {data.secrets && data.secrets.length > 0 && (
            <>
              <h3>Referenced Secrets</h3>
              <div className="mini-list">
                {data.secrets.map((sec, i) => (
                  <div key={i}>
                    <strong><Box size={14} /> {sec.name}</strong>
                    <span>Secret Reference</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <h3>Bound RoleBindings ({related.roleBindings?.length || 0})</h3>
          {related.roleBindings?.length ? (
            <div className="mini-list">
              {related.roleBindings.map((rb, i) => (
                <div key={i} className="clickable" onClick={() => onSelectRB?.(rb)}>
                  <div>
                    <strong><Network size={14} /> {rb.name}</strong>
                    <span>Ref: {rb.roleRef?.kind} / {rb.roleRef?.name}</span>
                  </div>
                  <Badge tone="info">{rb.namespace}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <span className="muted" style={{ fontSize: '13px' }}>No namespaced RoleBindings directly bind this ServiceAccount.</span>
          )}

          <h3>Bound ClusterRoleBindings ({related.clusterRoleBindings?.length || 0})</h3>
          {related.clusterRoleBindings?.length ? (
            <div className="mini-list">
              {related.clusterRoleBindings.map((crb, i) => (
                <div key={i} className="clickable" onClick={() => onSelectCRB?.(crb)}>
                  <div>
                    <strong><Network size={14} /> {crb.name}</strong>
                    <span>Ref: {crb.roleRef?.kind} / {crb.roleRef?.name}</span>
                  </div>
                  <Badge tone="purple">Cluster-Wide</Badge>
                </div>
              ))}
            </div>
          ) : (
            <span className="muted" style={{ fontSize: '13px' }}>No ClusterRoleBindings directly bind this ServiceAccount.</span>
          )}

          {related.resolvedRoles && related.resolvedRoles.length > 0 && (
            <>
              <h3>Inherited Permission Rules</h3>
              {related.resolvedRoles.map((role, idx) => (
                <div key={idx} style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <strong style={{ fontSize: '13px' }}>
                      <Shield size={14} /> {role.name} ({role.bindingType})
                    </strong>
                    <Badge tone="teal">{role.rulesCount || (role.rules || []).length} Rules</Badge>
                  </div>
                  <RBACRuleTable rules={role.rules} />
                </div>
              ))}
            </>
          )}

          {data.events && data.events.length > 0 && (
            <>
              <h3>Related Events</h3>
              <EventTable events={data.events} />
            </>
          )}
        </>
      )}
    </DetailPanel>
  );
}

function RoleDetail({ role, onClose, onSelectSA }) {
  const detail = useResource(() => api.role(role.namespace, role.name), [role.namespace, role.name]);
  const data = detail.data || role;
  const related = data.related || {};

  return (
    <DetailPanel
      key={`role-${role.namespace}-${role.name}`}
      title={role.name}
      resourceType="roles"
      namespace={role.namespace}
      name={role.name}
      onClose={onClose}
    >
      {detail.loading ? (
        <Loading rows={4} />
      ) : detail.error ? (
        <ErrorState error={detail.error} reload={detail.reload} />
      ) : (
        <>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <Badge tone="info">Namespaced Role</Badge>
            <Badge tone="teal">{data.rulesCount || (data.rules || []).length} Rules</Badge>
          </div>

          <KeyValues
            values={{
              Namespace: data.namespace,
              'Rules Count': data.rulesCount || (data.rules || []).length,
              Created: formatDate(data.creationTimestamp),
              Age: data.age || age(data.creationTimestamp),
            }}
          />

          <h3>Permission Rules</h3>
          <RBACRuleTable rules={data.rules} />

          <h3>Bound Subjects ({related.boundSubjects?.length || 0})</h3>
          {related.boundSubjects?.length ? (
            <div className="mini-list">
              {related.boundSubjects.map((sub, i) => (
                <div key={i} className={sub.kind === 'ServiceAccount' ? 'clickable' : ''} onClick={() => sub.kind === 'ServiceAccount' && onSelectSA?.(sub)}>
                  <div>
                    <strong><Box size={14} /> {sub.kind}: {sub.name}</strong>
                    <span>Via RoleBinding: {sub.viaRoleBinding}</span>
                  </div>
                  {sub.namespace && <Badge tone="info">{sub.namespace}</Badge>}
                </div>
              ))}
            </div>
          ) : (
            <span className="muted" style={{ fontSize: '13px' }}>No subjects currently bound via RoleBindings.</span>
          )}

          {data.events && data.events.length > 0 && (
            <>
              <h3>Related Events</h3>
              <EventTable events={data.events} />
            </>
          )}
        </>
      )}
    </DetailPanel>
  );
}

function RoleBindingDetail({ roleBinding, onClose, onSelectSA, onSelectRole }) {
  const detail = useResource(
    () => api.roleBinding(roleBinding.namespace, roleBinding.name),
    [roleBinding.namespace, roleBinding.name]
  );
  const data = detail.data || roleBinding;
  const related = data.related || {};

  return (
    <DetailPanel
      key={`rb-${roleBinding.namespace}-${roleBinding.name}`}
      title={roleBinding.name}
      resourceType="rolebindings"
      namespace={roleBinding.namespace}
      name={roleBinding.name}
      onClose={onClose}
    >
      {detail.loading ? (
        <Loading rows={4} />
      ) : detail.error ? (
        <ErrorState error={detail.error} reload={detail.reload} />
      ) : (
        <>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <Badge tone="teal">RoleBinding</Badge>
            <Badge tone={data.roleRef?.kind === 'ClusterRole' ? 'purple' : 'info'}>
              Ref: {data.roleRef?.kind}
            </Badge>
          </div>

          <KeyValues
            values={{
              Namespace: data.namespace,
              'Role Ref Kind': data.roleRef?.kind,
              'Role Ref Name': data.roleRef?.name,
              'API Group': data.roleRef?.apiGroup,
              'Subjects Count': (data.subjects || []).length,
              Created: formatDate(data.creationTimestamp),
              Age: data.age || age(data.creationTimestamp),
            }}
          />

          <h3>Bound Subjects ({(data.subjects || []).length})</h3>
          <div className="mini-list">
            {(data.subjects || []).map((sub, i) => (
              <div key={i} className={sub.kind === 'ServiceAccount' ? 'clickable' : ''} onClick={() => sub.kind === 'ServiceAccount' && onSelectSA?.(sub)}>
                <div>
                  <strong><Box size={14} /> {sub.kind}: {sub.name}</strong>
                  <span>{sub.namespace ? `Namespace: ${sub.namespace}` : 'Cluster-Scoped User/Group'}</span>
                </div>
                <Badge tone="info">{sub.kind}</Badge>
              </div>
            ))}
          </div>

          <h3>Inherited Permissions from {data.roleRef?.kind}: {data.roleRef?.name}</h3>
          <RBACRuleTable rules={related.rules} />

          {data.events && data.events.length > 0 && (
            <>
              <h3>Related Events</h3>
              <EventTable events={data.events} />
            </>
          )}
        </>
      )}
    </DetailPanel>
  );
}

function ClusterRoleDetail({ clusterRole, onClose, onSelectSA }) {
  const detail = useResource(() => api.clusterRole(clusterRole.name), [clusterRole.name]);
  const data = detail.data || clusterRole;
  const related = data.related || {};

  return (
    <DetailPanel
      key={`cr-${clusterRole.name}`}
      title={clusterRole.name}
      resourceType="clusterroles"
      name={clusterRole.name}
      onClose={onClose}
    >
      {detail.loading ? (
        <Loading rows={4} />
      ) : detail.error ? (
        <ErrorState error={detail.error} reload={detail.reload} />
      ) : (
        <>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <Badge tone="purple">ClusterRole</Badge>
            <Badge tone={data.isSystem ? 'warning' : 'success'}>
              {data.isSystem ? 'System' : 'User-Created'}
            </Badge>
            <Badge tone="teal">{data.rulesCount || (data.rules || []).length} Rules</Badge>
          </div>

          <KeyValues
            values={{
              'Cluster Role': data.name,
              Type: data.isSystem ? 'System Component' : 'User-Created',
              'Rules Count': data.rulesCount || (data.rules || []).length,
              Aggregation: data.aggregationRule ? 'Aggregated' : 'None',
              Created: formatDate(data.creationTimestamp),
              Age: data.age || age(data.creationTimestamp),
            }}
          />

          <h3>Permission Rules</h3>
          <RBACRuleTable rules={data.rules} />

          <h3>Bound Subjects ({related.boundSubjects?.length || 0})</h3>
          {related.boundSubjects?.length ? (
            <div className="mini-list">
              {related.boundSubjects.map((sub, i) => (
                <div key={i} className={sub.kind === 'ServiceAccount' ? 'clickable' : ''} onClick={() => sub.kind === 'ServiceAccount' && onSelectSA?.(sub)}>
                  <div>
                    <strong><Box size={14} /> {sub.kind}: {sub.name}</strong>
                    <span>Via {sub.bindingType}: {sub.bindingName}</span>
                  </div>
                  {sub.namespace && <Badge tone="info">{sub.namespace}</Badge>}
                </div>
              ))}
            </div>
          ) : (
            <span className="muted" style={{ fontSize: '13px' }}>No subjects currently bound to this ClusterRole.</span>
          )}
        </>
      )}
    </DetailPanel>
  );
}

function ClusterRoleBindingDetail({ clusterRoleBinding, onClose, onSelectSA, onSelectCR }) {
  const detail = useResource(() => api.clusterRoleBinding(clusterRoleBinding.name), [clusterRoleBinding.name]);
  const data = detail.data || clusterRoleBinding;
  const related = data.related || {};

  return (
    <DetailPanel
      key={`crb-${clusterRoleBinding.name}`}
      title={clusterRoleBinding.name}
      resourceType="clusterrolebindings"
      name={clusterRoleBinding.name}
      onClose={onClose}
    >
      {detail.loading ? (
        <Loading rows={4} />
      ) : detail.error ? (
        <ErrorState error={detail.error} reload={detail.reload} />
      ) : (
        <>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <Badge tone="purple">ClusterRoleBinding</Badge>
            <Badge tone={data.name?.startsWith('system:') ? 'warning' : 'success'}>
              {data.name?.startsWith('system:') ? 'System' : 'User-Created'}
            </Badge>
          </div>

          <KeyValues
            values={{
              'Binding Name': data.name,
              'Role Ref Kind': data.roleRef?.kind,
              'Referenced ClusterRole': data.roleRef?.name,
              'API Group': data.roleRef?.apiGroup,
              'Subjects Count': (data.subjects || []).length,
              Created: formatDate(data.creationTimestamp),
              Age: data.age || age(data.creationTimestamp),
            }}
          />

          <h3>Bound Subjects ({(data.subjects || []).length})</h3>
          <div className="mini-list">
            {(data.subjects || []).map((sub, i) => (
              <div key={i} className={sub.kind === 'ServiceAccount' ? 'clickable' : ''} onClick={() => sub.kind === 'ServiceAccount' && onSelectSA?.(sub)}>
                <div>
                  <strong><Box size={14} /> {sub.kind}: {sub.name}</strong>
                  <span>{sub.namespace ? `Namespace: ${sub.namespace}` : 'Cluster-Scoped User/Group'}</span>
                </div>
                <Badge tone="info">{sub.kind}</Badge>
              </div>
            ))}
          </div>

          <h3>Inherited Permissions from ClusterRole: {data.roleRef?.name}</h3>
          <RBACRuleTable rules={related.rules} />
        </>
      )}
    </DetailPanel>
  );
}


function Troubleshooting() {
  console.log("[TROUBLESHOOTING DEBUG] TroubleshootingPage rendered");
  const resource = useResource(api.troubleshooting); const groups = resource.data || {}; return <><PageHeader eyebrow="Observability" title="Troubleshooting" description="Actionable issues grouped by severity from backend diagnostics." action={<button className="button subtle" onClick={resource.reload}><RefreshCw size={16} /> Refresh</button>} />{resource.loading ? <Loading /> : resource.error ? <ErrorState error={resource.error} reload={resource.reload} /> : <div className="diagnostic-grid">{['critical', 'warning', 'info'].map((severity) => <section className="panel" key={severity}><div className="panel-head"><h2>{severity}</h2><Badge tone={severity === 'critical' ? 'danger' : severity === 'warning' ? 'warning' : 'info'}>{groups[severity]?.length || 0}</Badge></div>{groups[severity]?.length ? <div className="issue-list">{groups[severity].map((issue, i) => <div className="issue" key={i}><div><strong>{issue.resourceName}</strong><span>{issue.message}</span><small>{issue.recommendation}</small></div></div>)}</div> : <Empty title={`No ${severity} issues`} text="No diagnostics were returned in this category." />}</section>)}</div>}</>; }

function getPageFromLocation() {
  const hash = (window.location.hash || '').replace(/^#\/?/, '').split('?')[0].trim();
  if (hash) return hash;
  const path = (window.location.pathname || '').replace(/^\//, '').split('?')[0].trim();
  if (path) return path;
  return 'overview';
}

function App() {
  const [page, setPage] = useState(getPageFromLocation);
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('k8s-dashboard-theme');
    if (saved !== null) return saved === 'dark';
    return true;
  });

  useEffect(() => {
    localStorage.setItem('k8s-dashboard-theme', dark ? 'dark' : 'light');
    if (dark) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }, [dark]);
  const [collapsed, setCollapsed] = useState(false);
  const [selected, setSelected] = useState(null);
  const [currentCluster, setCurrentCluster] = useState(() => api.getCluster());

  useEffect(() => {
    const onRoute = () => setPage(getPageFromLocation());
    window.addEventListener('hashchange', onRoute);
    window.addEventListener('popstate', onRoute);
    return () => {
      window.removeEventListener('hashchange', onRoute);
      window.removeEventListener('popstate', onRoute);
    };
  }, []);

  const status = useResource(api.status, [currentCluster]);

  const handleClusterChange = (newClusterId) => {
    setCurrentCluster(newClusterId);
    setSelected(null);
  };

  const isOverview = page === '' || page === 'overview';
  const isNodes = page === 'nodes' || page === 'node';
  const isNamespaces = page === 'namespaces' || page === 'namespace';
  const isPods = page === 'pods' || page === 'pod';
  const isDeployments = page === 'deployments' || page === 'deployment';
  const isServices = page === 'services' || page === 'service';
  const isIngress = page === 'ingresses' || page === 'ingress';
  const isStorage = page === 'storage' || page === 'pv' || page === 'pvc' || page === 'storageclass' || page === 'storageclasses' || page === 'csidriver' || page === 'csidrivers' || page === 'volumesnapshots' || page === 'volumesnapshot';
  const isRBAC = page === 'rbac' || page === 'serviceaccount' || page === 'serviceaccounts' || page === 'role' || page === 'roles' || page === 'rolebinding' || page === 'rolebindings' || page === 'clusterrole' || page === 'clusterroles' || page === 'clusterrolebinding' || page === 'clusterrolebindings';
  const isOperators = page === 'operators' || page === 'operator' || page === 'crds' || page === 'crd';
  const isEvents = page === 'events' || page === 'event';
  const isTroubleshooting = page === 'troubleshooting';

  const title = isStorage
    ? 'Storage'
    : isRBAC
    ? 'Role-Based Access Control'
    : isTroubleshooting
    ? 'Troubleshooting'
    : isOperators
    ? 'Operators & CRDs'
    : isEvents
    ? 'Events'
    : isIngress
    ? 'Ingress'
    : isServices
    ? 'Services'
    : isPods
    ? 'Pods'
    : isDeployments
    ? 'Deployments'
    : isNodes
    ? 'Nodes'
    : isNamespaces
    ? 'Namespaces'
    : 'Overview';

  const content = isStorage
    ? <StorageView
        key={currentCluster}
        onSelectPV={(pv) => setSelected({ type: 'pv', value: pv })}
        onSelectPVC={(pvc) => setSelected({ type: 'pvc', value: pvc })}
        onSelectSC={(sc) => setSelected({ type: 'storageclass', value: sc })}
        onSelectCSI={(csi) => setSelected({ type: 'csidriver', value: csi })}
        onSelectSnapshot={(snap) => setSelected({ type: 'volumesnapshot', value: snap })}
      />
    : isRBAC
    ? <RBACView
        key={currentCluster}
        onSelectSA={(sa) => setSelected({ type: 'serviceaccount', value: sa })}
        onSelectRole={(role) => setSelected({ type: 'role', value: role })}
        onSelectRB={(rb) => setSelected({ type: 'rolebinding', value: rb })}
        onSelectCR={(cr) => setSelected({ type: 'clusterrole', value: cr })}
        onSelectCRB={(crb) => setSelected({ type: 'clusterrolebinding', value: crb })}
      />
    : isTroubleshooting
    ? <Troubleshooting key={currentCluster} />
    : isOperators
    ? <OperatorsView key={currentCluster} onSelectCRD={(crd) => setSelected({ type: 'crd', value: crd })} />
    : isEvents
    ? <Events key={currentCluster} />
    : isNodes
    ? <Nodes key={currentCluster} onSelect={(node) => setSelected({ type: 'node', value: node })} />
    : isNamespaces
    ? <Namespaces key={currentCluster} onSelect={(namespace) => setSelected({ type: 'namespace', value: namespace })} />
    : isPods
    ? <Pods key={currentCluster} onSelect={(pod) => setSelected({ type: 'pod', value: pod })} />
    : isDeployments
    ? <Deployments key={currentCluster} onSelect={(deployment) => setSelected({ type: 'deployment', value: deployment })} />
    : isServices
    ? <Services key={currentCluster} onSelect={(service) => setSelected({ type: 'service', value: service })} />
    : isIngress
    ? <Ingresses key={currentCluster} onSelect={(item) => setSelected(item?.type ? item : { type: 'ingress', value: item })} />
    : <Overview key={currentCluster} currentCluster={currentCluster} />;

  const isNavActive = (key) => {
    if (key === 'overview' && (page === 'overview' || page === '')) return true;
    if (key === 'nodes' && (page === 'nodes' || page === 'node')) return true;
    if (key === 'namespaces' && (page === 'namespaces' || page === 'namespace')) return true;
    if (key === 'pods' && (page === 'pods' || page === 'pod')) return true;
    if (key === 'deployments' && (page === 'deployments' || page === 'deployment')) return true;
    if (key === 'services' && (page === 'services' || page === 'service')) return true;
    if (key === 'ingresses' && (page === 'ingresses' || page === 'ingress')) return true;
    if (key === 'storage' && (page === 'storage' || page === 'pv' || page === 'pvc' || page === 'storageclass' || page === 'storageclasses' || page === 'csidriver' || page === 'csidrivers' || page === 'volumesnapshots' || page === 'volumesnapshot')) return true;
    if (key === 'rbac' && (page === 'rbac' || page === 'serviceaccount' || page === 'serviceaccounts' || page === 'role' || page === 'roles' || page === 'rolebinding' || page === 'rolebindings' || page === 'clusterrole' || page === 'clusterroles' || page === 'clusterrolebinding' || page === 'clusterrolebindings')) return true;
    if (key === 'operators' && (page === 'operators' || page === 'operator' || page === 'crds' || page === 'crd')) return true;
    if (key === 'events' && (page === 'events' || page === 'event')) return true;
    if (key === 'troubleshooting' && page === 'troubleshooting') return true;
    return page === key;
  };

  return (
    <div className={dark ? 'app dark' : 'app light'}>
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><Zap size={19} /></div>
          {!collapsed && <div><strong>Cluster</strong><span>Console</span></div>}
        </div>
        <button className="collapse" onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
        </button>
        <nav>
          {nav.map(({ key, label, icon: Icon }) => (
            <a
              className={isNavActive(key) ? 'active' : ''}
              href={`#${key}`}
              key={key}
              title={collapsed ? label : undefined}
            >
              <Icon size={18} />
              {!collapsed && <span>{label}</span>}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          {!collapsed && (
            <div className="connection">
              <span className={`pulse ${status.data?.kubernetes === 'connected' ? 'online' : ''}`} />
              <div>
                <strong>{status.data?.kubernetes === 'connected' ? 'Backend connected' : 'Checking backend'}</strong>
                <span>{api.url}</span>
              </div>
            </div>
          )}
          <button className="theme-button" onClick={() => setDark(!dark)}>
            {dark ? <Sun size={17} /> : <Moon size={17} />}
            {!collapsed && <span>{dark ? 'Light theme' : 'Dark theme'}</span>}
          </button>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setCollapsed(!collapsed)}>
            <Menu size={19} />
          </button>
          <div>
            <span className="topbar-kicker">KUBERNETES / {title.toUpperCase()}</span>
            <strong>{title}</strong>
          </div>
          <div className="top-actions">
            <ClusterSwitcher clusterId={currentCluster} onClusterChange={handleClusterChange} />
            <Badge tone={status.data?.kubernetes === 'connected' ? 'success' : 'warning'}>
              {status.data?.kubernetes || 'checking'}
            </Badge>
            <button className="icon-button" title="Settings">
              <Settings2 size={17} />
            </button>
          </div>
        </header>
        <div className="content">{content}</div>
      </main>
      {selected?.type === 'node' && <NodeDetail node={selected.value} onClose={() => setSelected(null)} />}
      {selected?.type === 'namespace' && <NamespaceDetail namespace={selected.value} onClose={() => setSelected(null)} />}
      {selected?.type === 'pod' && <PodDetail pod={selected.value} onClose={() => setSelected(null)} />}
      {selected?.type === 'deployment' && <DeploymentDetail deployment={selected.value} onClose={() => setSelected(null)} />}
      {selected?.type === 'service' && <ServiceDetail service={selected.value} onClose={() => setSelected(null)} />}
      {selected?.type === 'ingress' && <IngressDetail ingress={selected.value} onClose={() => setSelected(null)} />}
      {selected?.type === 'httproute' && <HttpRouteDetail route={selected.value} onClose={() => setSelected(null)} />}
      {selected?.type === 'gateway' && <GatewayDetail gateway={selected.value} onClose={() => setSelected(null)} />}
      {selected?.type === 'pv' && (
        <PVDetail
          pv={selected.value}
          onClose={() => setSelected(null)}
          onSelectPVC={(claim) => setSelected({ type: 'pvc', value: claim })}
          onSelectSC={(sc) => setSelected({ type: 'storageclass', value: { name: sc } })}
        />
      )}
      {selected?.type === 'pvc' && (
        <PVCDetail
          pvc={selected.value}
          onClose={() => setSelected(null)}
          onSelectPV={(pvName) => setSelected({ type: 'pv', value: { name: pvName } })}
          onSelectSC={(sc) => setSelected({ type: 'storageclass', value: { name: sc } })}
        />
      )}
      {selected?.type === 'storageclass' && (
        <StorageClassDetail
          storageClass={selected.value}
          onClose={() => setSelected(null)}
        />
      )}
      {selected?.type === 'csidriver' && (
        <CSIDriverDetail
          driver={selected.value}
          onClose={() => setSelected(null)}
        />
      )}
      {selected?.type === 'volumesnapshot' && (
        <VolumeSnapshotDetail
          snapshot={selected.value}
          onClose={() => setSelected(null)}
        />
      )}
      {selected?.type === 'serviceaccount' && (
        <ServiceAccountDetail
          serviceAccount={selected.value}
          onClose={() => setSelected(null)}
          onSelectRB={(rb) => setSelected({ type: 'rolebinding', value: rb })}
          onSelectCRB={(crb) => setSelected({ type: 'clusterrolebinding', value: crb })}
        />
      )}
      {selected?.type === 'role' && (
        <RoleDetail
          role={selected.value}
          onClose={() => setSelected(null)}
          onSelectSA={(sa) => setSelected({ type: 'serviceaccount', value: sa })}
        />
      )}
      {selected?.type === 'rolebinding' && (
        <RoleBindingDetail
          roleBinding={selected.value}
          onClose={() => setSelected(null)}
          onSelectSA={(sa) => setSelected({ type: 'serviceaccount', value: sa })}
          onSelectRole={(role) => setSelected({ type: 'role', value: role })}
        />
      )}
      {selected?.type === 'clusterrole' && (
        <ClusterRoleDetail
          clusterRole={selected.value}
          onClose={() => setSelected(null)}
          onSelectSA={(sa) => setSelected({ type: 'serviceaccount', value: sa })}
        />
      )}
      {selected?.type === 'clusterrolebinding' && (
        <ClusterRoleBindingDetail
          clusterRoleBinding={selected.value}
          onClose={() => setSelected(null)}
          onSelectSA={(sa) => setSelected({ type: 'serviceaccount', value: sa })}
          onSelectCR={(cr) => setSelected({ type: 'clusterrole', value: cr })}
        />
      )}
      {selected?.type === 'crd' && (
        <CRDDetail
          crd={selected.value}
          onClose={() => setSelected(null)}
          onSelectInstance={({ crd, instance }) => setSelected({ type: 'customresource', value: { crd, instance } })}
        />
      )}
      {selected?.type === 'customresource' && (
        <CustomResourceDetail
          crd={selected.value.crd}
          instance={selected.value.instance}
          onClose={() => setSelected({ type: 'crd', value: selected.value.crd })}
        />
      )}
    </div>
  );
}

export default App;

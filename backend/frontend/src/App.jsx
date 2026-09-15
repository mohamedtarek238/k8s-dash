import { useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowDown, Blocks, Box, Check, CheckCircle2, ChevronDown, ChevronRight, CircleDot, Copy, Cpu, Database,
  ExternalLink, FileCode, FileText, Gauge, Globe, HardDrive, Layers3, LayoutDashboard, Menu, Moon, Network,
  Package, PanelLeftClose, PanelLeftOpen, RefreshCw, Route, Search, Server, Settings2, Shield, Sun, Terminal,
  X, Zap
} from 'lucide-react';

import { api } from './api';
import { formatMemoryQuantity } from './formatters';

const nav = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'nodes', label: 'Nodes', icon: Server },
  { key: 'namespaces', label: 'Namespaces', icon: Layers3 },
  { key: 'pods', label: 'Pods', icon: Box },
  { key: 'deployments', label: 'Deployments', icon: Package },
  { key: 'services', label: 'Services', icon: Network },
  { key: 'ingresses', label: 'Ingress', icon: ExternalLink },
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
    setState({ loading: true, data: null, error: null });
    loader().then((data) => setState({ loading: false, data, error: null })).catch((error) => setState({ loading: false, data: null, error }));
  };
  useEffect(reload, dependencies);
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

function Overview({ cluster, health, events, loading, reload }) {
  const c = cluster?.data; const recentEvents = (events?.data?.data || []).slice(0, 6); const issues = health?.data?.issues || [];
  return <><PageHeader eyebrow="Cluster / telemetry" title="Operations overview" description="A live view of the resources returned by your Kubernetes control plane." action={<button className="button primary" onClick={reload}><RefreshCw size={16} /> Refresh data</button>} />
    {loading ? <Loading rows={4} /> : <><div className="metrics-grid"><Metric icon={Gauge} label="Cluster health" value={c?.health?.status || health?.data?.status || 'Unknown'} detail={c?.health?.message || `${health?.data?.score ?? '—'} / 100 score`} accent="teal" /><Metric icon={Server} label="Nodes" value={c?.nodes?.total} detail={`${c?.nodes?.ready || 0} ready · ${c?.nodes?.notReady || 0} not ready`} accent="blue" /><Metric icon={Box} label="Pods" value={c?.pods} detail="All namespaces" accent="amber" /><Metric icon={Layers3} label="Namespaces" value={c?.namespaces} detail={`${c?.deployments ?? 0} deployments`} accent="coral" /></div>
      <div className="split-grid"><section className="panel"><div className="panel-head"><div><span className="eyebrow">Control plane</span><h2>Cluster identity</h2></div><Badge tone="success">Connected</Badge></div><div className="identity-grid"><div><span>Context</span><strong>{display(c?.context)}</strong></div><div><span>Cluster</span><strong>{display(c?.cluster)}</strong></div><div><span>Server</span><strong>{display(c?.server)}</strong></div><div><span>Kubernetes</span><strong>{display(c?.version?.gitVersion || c?.version?.gitVersion)}</strong></div></div><div className="unsupported"><Gauge size={17} /><span>Live CPU and memory usage are not exposed by the backend. Capacity and allocatable values are available on the Nodes page.</span></div></section>
        <section className="panel"><div className="panel-head"><div><span className="eyebrow">Signal</span><h2>Health findings</h2></div><button className="text-button" onClick={() => window.location.hash = '#events'}>View events <ChevronRight size={15} /></button></div>{issues.length ? <div className="issue-list">{issues.slice(0, 5).map((issue, i) => <div className="issue" key={i}><Badge tone={issue.severity === 'critical' ? 'danger' : 'warning'}>{issue.severity}</Badge><div><strong>{issue.resourceName}</strong><span>{issue.message}</span></div></div>)}</div> : <Empty title="No active findings" text="Diagnostics returned a clean cluster signal." />}</section></div>
      <section className="panel"><div className="panel-head"><div><span className="eyebrow">Recent activity</span><h2>Cluster events</h2></div><span className="muted">Newest first</span></div><EventTable events={recentEvents} /></section></>}
  </>;
}

function EventTable({ events }) { return <Table rows={events} emptyTitle="No recent events" columns={[{ key: 'type', label: 'Type', render: (r) => <Badge tone={r.type === 'Warning' ? 'warning' : 'info'}>{r.type || 'Normal'}</Badge> }, { key: 'reason', label: 'Reason' }, { key: 'involvedObject', label: 'Object', render: (r) => <span className="mono">{r.involvedObject?.display || '—'}</span> }, { key: 'message', label: 'Message', render: (r) => <span className="truncate">{r.message}</span> }, { key: 'lastTimestamp', label: 'Last seen', render: (r) => formatDate(r.lastTimestamp || r.firstTimestamp) }]} />; }

function Nodes({ onSelect }) { const resource = useResource(api.nodes); const rows = resource.data?.data || []; return <><PageHeader eyebrow="Infrastructure" title="Nodes" description="Readiness, roles, capacity, and condition signals from every cluster node." action={<button className="button subtle" onClick={resource.reload}><RefreshCw size={16} /> Refresh</button>} />{resource.loading ? <Loading /> : resource.error ? <ErrorState error={resource.error} reload={resource.reload} /> : <Table rows={rows} onRow={onSelect} emptyTitle="No nodes returned" columns={[{ key: 'name', label: 'Node', render: (r) => <strong className="resource-name"><Server size={16} />{r.name}</strong> }, { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> }, { key: 'roles', label: 'Roles', render: (r) => r.roles?.join(', ') || '—' }, { key: 'kubernetesVersion', label: 'Version' }, { key: 'cpuCapacity', label: 'CPU capacity', render: (r) => <span className="mono">{display(r.cpuCapacity)}</span> }, { key: 'memoryCapacity', label: 'Memory capacity', render: (r) => <span className="mono">{formatMemoryQuantity(r.memoryCapacity)}</span> }, { key: 'creationTimestamp', label: 'Age', render: (r) => age(r.creationTimestamp) }]} />}</>; }

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
          <button className="button subtle" onClick={currentResource.reload}>
            <RefreshCw size={16} /> Refresh
          </button>
        }
      />

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

function YamlViewer({ resourceType, namespace, name }) {
  const [copied, setCopied] = useState(false);
  const resource = useResource(() => api.yaml(resourceType, namespace, name), [resourceType, namespace, name]);

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

function PodDetail({ pod, onClose }) { const detail = useResource(() => api.pod(pod.namespace, pod.name), [pod.namespace, pod.name]); const [showLogs, setShowLogs] = useState(false); return <DetailPanel key={`pod-${pod.namespace}-${pod.name}`} title={pod.name} resourceType="pods" namespace={pod.namespace} name={pod.name} onClose={onClose}>{detail.loading ? <Loading rows={3} /> : detail.error ? <ErrorState error={detail.error} reload={detail.reload} /> : <><Badge>{detail.data?.status?.phase || pod.status}</Badge><KeyValues values={{ Namespace: detail.data?.metadata?.namespace, Node: detail.data?.node, IP: detail.data?.ip, Restarts: detail.data?.restartCount, ServiceAccount: detail.data?.spec?.serviceAccountName, Created: formatDate(detail.data?.metadata?.creationTimestamp) }} /><div className="detail-actions"><button className="button primary" onClick={() => setShowLogs(true)}><Terminal size={16} /> View logs</button></div><h3>Containers</h3><div className="mini-list">{detail.data?.containers?.map((container) => <div key={container.name}><strong>{container.name}</strong><span>{container.image}</span></div>)}</div><h3>Related events</h3><EventTable events={detail.data?.events || []} /></>}{showLogs && <Logs pod={pod} onClose={() => setShowLogs(false)} />}</DetailPanel>; }

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

  const [copied, setCopied] = useState(false);
  const yamlResource = useResource(
    () => api.customResourceYaml(
      crd.group,
      crd.version,
      crd.plural,
      instance.namespace,
      instance.name,
      crd.scope
    ),
    [crd.group, crd.version, crd.plural, instance.namespace, instance.name, crd.scope]
  );

  const handleCopy = () => {
    if (yamlResource.data?.yaml) {
      navigator.clipboard.writeText(yamlResource.data.yaml);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

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
          <div className="yaml-viewer-wrapper">
            <div className="yaml-viewer-toolbar">
              <div className="yaml-info">
                <Badge tone="info">{crd.kind}</Badge>
                <span className="yaml-version mono">{data.apiVersion || `${crd.group}/${crd.version}`}</span>
              </div>
              <div className="yaml-actions">
                <button className="button subtle small" onClick={handleCopy} disabled={yamlResource.loading || !yamlResource.data?.yaml}>
                  {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                  <span>{copied ? 'Copied!' : 'Copy YAML'}</span>
                </button>
                <button className="button subtle small" onClick={yamlResource.reload} disabled={yamlResource.loading}>
                  <RefreshCw size={14} className={yamlResource.loading ? 'spin' : ''} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>
            {yamlResource.loading ? (
              <div className="terminal loading-terminal">Loading YAML manifest...</div>
            ) : yamlResource.error ? (
              <ErrorState error={yamlResource.error} reload={yamlResource.reload} />
            ) : (
              <div className="yaml-pre-container">
                <pre className="yaml-code mono"><code>{yamlResource.data?.yaml}</code></pre>
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}

function Logs({ pod, onClose }) { const [container, setContainer] = useState(''); const [previous, setPrevious] = useState(false); const [tailLines, setTailLines] = useState(200); const [auto, setAuto] = useState(false); const resource = useResource(() => api.logs(pod.namespace, pod.name, { container, tailLines, previous }), [pod.namespace, pod.name, container, tailLines, previous, auto ? Date.now() : 0]); return <div className="log-modal"><div className="log-head"><div><span className="eyebrow">Pod logs</span><h3>{pod.name}</h3></div><button className="close-button" onClick={onClose}><X size={18} /></button></div><div className="log-controls"><input className="select" value={container} onChange={(e) => setContainer(e.target.value)} placeholder="Container (optional)" /><input className="number-input" type="number" min="1" max="10000" value={tailLines} onChange={(e) => setTailLines(e.target.value)} /><label className="check"><input type="checkbox" checked={previous} onChange={(e) => setPrevious(e.target.checked)} /> Previous</label><label className="check"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Auto-refresh</label></div>{resource.loading ? <div className="terminal loading-terminal">Loading logs...</div> : resource.error ? <ErrorState error={resource.error} reload={resource.reload} /> : <pre className="terminal">{resource.data?.logs || 'No log output returned.'}</pre>}</div>; }

function App() {
  const [page, setPage] = useState(window.location.hash.slice(1) || 'overview');
  const [dark, setDark] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [selected, setSelected] = useState(null);
  const [currentCluster, setCurrentCluster] = useState(() => api.getCluster());

  useEffect(() => {
    const onHash = () => setPage(window.location.hash.slice(1) || 'overview');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const cluster = useResource(api.cluster, [currentCluster]);
  const health = useResource(api.health, [currentCluster]);
  const events = useResource(api.events, [currentCluster]);
  const status = useResource(api.status, [currentCluster]);
  const overviewReload = () => {
    cluster.reload();
    health.reload();
    events.reload();
    status.reload();
  };

  const handleClusterChange = (newClusterId) => {
    setCurrentCluster(newClusterId);
    setSelected(null);
  };

  const isIngress = page === 'ingresses' || page === 'ingress';
  const isServices = page === 'services' || page === 'service';
  const isPods = page === 'pods' || page === 'pod';
  const isDeployments = page === 'deployments' || page === 'deployment';
  const isNodes = page === 'nodes' || page === 'node';
  const isNamespaces = page === 'namespaces' || page === 'namespace';
  const isOperators = page === 'operators' || page === 'operator' || page === 'crds' || page === 'crd';

  const title = isIngress
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
    : isOperators
    ? 'Operators & CRDs'
    : nav.find((item) => item.key === page)?.label || (page === 'troubleshooting' ? 'Troubleshooting' : 'Overview');

  const content = page === 'overview'
    ? <Overview key={currentCluster} cluster={cluster} health={health} events={events} loading={cluster.loading} reload={overviewReload} />
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
    : isOperators
    ? <OperatorsView key={currentCluster} onSelectCRD={(crd) => setSelected({ type: 'crd', value: crd })} />
    : page === 'events'
    ? <Events key={currentCluster} />
    : <Troubleshooting key={currentCluster} />;

  const isNavActive = (key) => {
    if (page === key) return true;
    if (key === 'ingresses' && page === 'ingress') return true;
    if (key === 'services' && page === 'service') return true;
    if (key === 'pods' && page === 'pod') return true;
    if (key === 'deployments' && page === 'deployment') return true;
    if (key === 'nodes' && page === 'node') return true;
    if (key === 'namespaces' && page === 'namespace') return true;
    if (key === 'operators' && (page === 'operator' || page === 'crds' || page === 'crd')) return true;
    return false;
  };

  return (
    <div className={dark ? 'app dark' : 'app'}>
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

function Troubleshooting() { const resource = useResource(api.troubleshooting); const groups = resource.data || {}; return <><PageHeader eyebrow="Observability" title="Troubleshooting" description="Actionable issues grouped by severity from backend diagnostics." action={<button className="button subtle" onClick={resource.reload}><RefreshCw size={16} /> Refresh</button>} />{resource.loading ? <Loading /> : resource.error ? <ErrorState error={resource.error} reload={resource.reload} /> : <div className="diagnostic-grid">{['critical', 'warning', 'info'].map((severity) => <section className="panel" key={severity}><div className="panel-head"><h2>{severity}</h2><Badge tone={severity === 'critical' ? 'danger' : severity === 'warning' ? 'warning' : 'info'}>{groups[severity]?.length || 0}</Badge></div>{groups[severity]?.length ? <div className="issue-list">{groups[severity].map((issue, i) => <div className="issue" key={i}><div><strong>{issue.resourceName}</strong><span>{issue.message}</span><small>{issue.recommendation}</small></div></div>)}</div> : <Empty title={`No ${severity} issues`} text="No diagnostics were returned in this category." />}</section>)}</div>}</>; }

export default App;



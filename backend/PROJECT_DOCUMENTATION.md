# Kubernetes Dashboard Backend Documentation

## 1. Project Overview

This project is a Node.js and Express backend for a local Kubernetes dashboard. It reads the user's kubeconfig through `@kubernetes/client-node`, uses the active Kubernetes context, and exposes dashboard-oriented HTTP endpoints for cluster resources and diagnostics.

The backend does not store Kubernetes credentials in `.env`. Authentication and cluster selection come from kubeconfig.

### Main technologies

- Node.js 18 or newer
- Express 4
- `@kubernetes/client-node`
- Zod for request validation
- Helmet for security headers
- CORS for browser access
- Morgan for HTTP logging
- dotenv for environment configuration

## 2. Runtime Requirements

Before starting the backend, install:

- Node.js 18+
- npm
- `kubectl`
- A reachable Kubernetes cluster
- A valid kubeconfig with a current context and cluster server URL

The backend must be able to read the same kubeconfig that works with commands such as:

```bash
kubectl config current-context
kubectl cluster-info
kubectl get nodes
```

## 3. Installation and Running

From the project directory:

```bash
npm install
npm start
```

Development mode uses Node's watch mode:

```bash
npm run dev
```

The configured `.env` uses port `5100`, so the local URL is normally:

```text
http://localhost:5100
```

If `.env` is absent, the application defaults to port `5000`.

### Available npm scripts

| Script | Command | Purpose |
|---|---|---|
| `start` | `node src/server.js` | Start the production-style process |
| `dev` | `node --watch src/server.js` | Start with automatic restarts when files change |

There is currently no test, lint, build, or coverage script in `package.json`.

## 4. Configuration

### Environment variables

| Variable | Current/default value | Description |
|---|---|---|
| `PORT` | `5100` | HTTP listening port |
| `NODE_ENV` | `development` | Controls logging and whether error stacks are returned |
| `CORS_ORIGIN` | `http://localhost:3000` | Allowed browser origin |
| `KUBECONFIG` | Not required | Optional path to a kubeconfig file |

Both `.env` and `.env.example` use the frontend backend URL `http://localhost:5100`; the active `.env` value wins at runtime.

Do not commit private kubeconfig credentials or secret values. The repository's environment example is intended to document variable names only.

### Kubeconfig resolution

The Kubernetes configuration module resolves kubeconfig in this order:

1. The first path in `KUBECONFIG`, split using the operating system path delimiter.
2. The default user kubeconfig path: `~/.kube/config` on Linux/macOS or `%USERPROFILE%\\.kube\\config` on Windows.
3. `KubeConfig.loadFromDefault()` if no file was found by the custom resolver.

The loaded configuration must have:

- A current context
- A context that points to a known cluster
- A cluster with a server URL

The backend creates clients for Core, Apps, Batch, Networking, Custom Objects, and Version APIs. Batch and Custom Objects clients are initialized but are not currently used by the exposed services.

## 5. Startup Flow

1. `src/server.js` loads the app factory and reads `PORT`.
2. `src/app.js` loads dotenv and creates the Express application.
3. `createApp()` calls `initializeKubernetesClients()` before registering the app.
4. Kubeconfig is loaded and validated.
5. Express middleware is registered.
6. The root route and `/api` router are mounted.
7. 404 and global error handlers are registered last.
8. `app.listen()` starts the HTTP server and logs the active Kubernetes context and cluster server.

Because Kubernetes initialization happens during app creation, an invalid kubeconfig can cause `npm start` to exit before the HTTP server begins listening. In that situation, `/api/status` cannot be used to diagnose the problem; check kubeconfig and `kubectl` directly.

## 6. Architecture

```text
HTTP request
    |
    v
Express routes
    |
    v
Validation middleware and asyncHandler
    |
    v
Controllers
    |
    v
Kubernetes services
    |
    v
@kubernetes/client-node API clients
    |
    v
Kubernetes API server
```

### Responsibilities by layer

- **Routes**: Define HTTP methods and paths, attach validation, and forward requests to controllers.
- **Middleware**: Validate query and path parameters, handle unknown routes, and normalize errors.
- **Controllers**: Adapt Express requests to service calls and format responses.
- **Kubernetes services**: Call Kubernetes APIs and map raw Kubernetes objects into dashboard-friendly data.
- **Utilities**: Provide async error forwarding, Kubernetes object helpers, and response envelopes.
- **Configuration**: Load kubeconfig, validate the selected context, and create reusable API clients.

## 7. Express Middleware

The application registers middleware in this order:

1. `helmet()` adds common security headers.
2. `cors()` allows the configured `CORS_ORIGIN` and credentials.
3. `express.json({ limit: '1mb' })` parses JSON request bodies.
4. `morgan()` logs requests using `dev` format outside production and `combined` format in production.
5. The root route and `/api` routes are mounted.
6. The not-found handler handles unmatched routes.
7. The global error handler formats failures.

The API currently exposes read-only GET endpoints and does not define JSON body schemas for write operations.

## 8. HTTP API

The API base path is `/api`. All successful responses use JSON.

### Root endpoint

| Method | Path | Description |
|---|---|---|
| GET | `/` | Returns the backend name, version, and current Kubernetes context |

Example response:

```json
{
  "success": true,
  "data": {
    "name": "Kubernetes Dashboard Backend",
    "version": "1.0.0",
    "context": "your-context"
  }
}
```

### Status and diagnostics

| Method | Path | Description |
|---|---|---|
| GET | `/api/clusters` | Lists all registered Kubernetes clusters with safe metadata (id, name, context, server, isDefault) |
| GET | `/api/clusters/:clusterId` | Returns details for a specific registered cluster by ID |
| GET | `/api/status` | Reports backend status and whether a Kubernetes API call succeeds |
| GET | `/api/cluster` | Returns cluster version, context, server, resource counts, and node health |
| GET | `/api/health` | Returns a cluster health score, status, and detected issues |
| GET | `/api/troubleshooting` | Returns diagnostic issues grouped by severity |

Every resource and diagnostic endpoint accepts an optional `?cluster=<clusterId>` query parameter to target a specific cluster. When omitted, the default cluster is targeted.

`/api/status` intentionally returns an HTTP 200 response with `kubernetes: "disconnected"` when its connectivity check fails. This allows a frontend to distinguish a running backend from a connected cluster.

### Core resources

| Method | Path | Query/path parameters | Description |
|---|---|---|---|
| GET | `/api/nodes` | None | Lists all nodes with readiness, roles, capacity, allocatable resources, and conditions |
| GET | `/api/nodes/:name` | Path: `name`<br>Query: `includeRelated`, `includeEvents` | Returns detailed node information including roles, architecture, OS, versions, capacity, allocatable, conditions, addresses, taints, CIDRs, node health, and optionally scheduled pods and events |
| GET | `/api/namespaces` | None | Lists namespaces with status and labels |
| GET | `/api/namespaces/:name` | Path: `name`<br>Query: `includeRelated`, `includeEvents` | Returns detailed namespace view including phase, labels, annotations, finalizers, conditions, and optionally workload resource counts and events |
| GET | `/api/pods` | Optional `namespace` | Lists pods in one namespace or across all namespaces |
| GET | `/api/pods/:namespace/:podName` | Required path values | Returns pod details and related events |
| GET | `/api/pods/:namespace/:podName/logs` | Optional `container`, `tailLines`, `previous` | Returns logs for a pod container |
| GET | `/api/events` | Optional `namespace` | Lists Kubernetes events, newest first |

Pod log query values:

- `container`: non-empty container name
- `tailLines`: positive integer from `1` through `10000`
- `previous`: string `true` or `false`; converted to a boolean

### Workload and networking resources

| Method | Path | Query/path parameters | Description |
|---|---|---|---|
| GET | `/api/deployments` | Optional `namespace` | Lists deployments and replica status |
| GET | `/api/deployments/:namespace/:name` | Required path values | Returns deployment details |
| GET | `/api/services` | Optional `namespace` | Lists services, addresses, ports, and selectors |
| GET | `/api/services/:namespace/:name` | Path: `namespace`, `name`<br>Query: `includeRelated`, `includeEvents` | Returns detailed service information including type, clusterIPs, externalIPs, loadBalancer addresses (ip & hostname), formatted ports (e.g. `port:nodePort/protocol`), selectors, sessionAffinity, traffic policies, safe endpoints, and optionally selected pods and events |
| GET | `/api/ingresses` | Optional `namespace` | Lists ingresses, classes, hosts, paths, backends, controller type, and load-balancer addresses |
| GET | `/api/ingresses/:namespace/:name` | Path: `namespace`, `name`<br>Query: `includeRelated`, `includeEvents` | Returns detailed ingress information including Kong annotations, attached Kong plugins (with sanitized config), visual routing chain to backend pods, and optionally referenced services and events |
| GET | `/api/gateways` | Optional `namespace` | Lists Kubernetes Gateway API gateways (`gateway.networking.k8s.io/v1`) |
| GET | `/api/gateways/:namespace/:name` | Path: `namespace`, `name`<br>Query: `includeRelated`, `includeEvents` | Returns gateway details including listeners, addresses, conditions, and attached HTTPRoutes |
| GET | `/api/gateway-classes` | None | Lists GatewayClasses |
| GET | `/api/gateway-classes/:name` | Path: `name` | Returns GatewayClass details and controller name |
| GET | `/api/http-routes` | Optional `namespace` | Lists Gateway API HTTPRoutes with parent gateways, hostnames, and routing rules |
| GET | `/api/http-routes/:namespace/:name` | Path: `namespace`, `name`<br>Query: `includeRelated`, `includeEvents` | Returns HTTPRoute details, Kong plugin attachments, rules, matches, filters, backend refs, resolved pods, and visual routing chain |
| GET | `/api/statefulsets` | Optional `namespace` | Lists StatefulSets and readiness counts |
| GET | `/api/statefulsets/:namespace/:name` | Path: `namespace`, `name`<br>Query: `includeRelated`, `includeEvents` | Returns detailed StatefulSet information including replicas, selector, serviceName, updateStrategy, template metadata, containers, images, ports, volume information (volumes & volumeClaimTemplates), conditions, and optionally selected pods and events |
| GET | `/api/daemonsets` | Optional `namespace` | Lists DaemonSets and scheduling/readiness counts |
| GET | `/api/daemonsets/:namespace/:name` | Path: `namespace`, `name`<br>Query: `includeRelated`, `includeEvents` | Returns detailed DaemonSet information including desired, scheduled, ready, available, unavailable, misscheduled counts, selector, updateStrategy, containers, volumes, conditions, and optionally selected pods and events |

### Storage resources

| Method | Path | Query/path parameters | Description |
|---|---|---|---|
| GET | `/api/storage/overview` | `?cluster=` | Returns cluster storage summary: PV phase breakdown, PVC phase breakdown, StorageClasses (total, default class), CSI drivers, and VolumeSnapshot availability |
| GET | `/api/storage/persistentvolumes` | Query: `search`, `cluster` | Lists Persistent Volumes with capacity, access modes, reclaim policies, status, storage class, claim, and CSI driver |
| GET | `/api/storage/persistentvolumes/:name` | Path: `name`<br>Query: `includeEvents`, `cluster` | Returns PV details, capacity, mount options, claimRef, and related PVC |
| GET | `/api/storage/persistentvolumes/:name/yaml` | Path: `name`<br>Query: `cluster` | Returns live YAML manifest for Persistent Volume |
| GET | `/api/storage/persistentvolumeclaims` | Query: `namespace`, `search`, `cluster` | Lists Persistent Volume Claims with volume name, status, capacity, and storage class |
| GET | `/api/storage/persistentvolumeclaims/:namespace/:name` | Path: `namespace`, `name`<br>Query: `includeEvents`, `cluster` | Returns PVC details, requested capacity, volumeName, accessModes, storageClass, and related PV |
| GET | `/api/storage/persistentvolumeclaims/:namespace/:name/yaml` | Path: `namespace`, `name`<br>Query: `cluster` | Returns live YAML manifest for Persistent Volume Claim |
| GET | `/api/storage/storageclasses` | Query: `search`, `cluster` | Lists Storage Classes with provisioners, reclaim policies, volume binding modes, allow expansion flag, and default indicator |
| GET | `/api/storage/storageclasses/:name` | Path: `name`<br>Query: `cluster` | Returns Storage Class details, provisioner, parameters, mount options, and topologies |
| GET | `/api/storage/storageclasses/:name/yaml` | Path: `name`<br>Query: `cluster` | Returns live YAML manifest for Storage Class |
| GET | `/api/storage/csidrivers` | Query: `cluster` | Lists registered CSI Drivers with attach requirements and lifecycle modes |
| GET | `/api/storage/csidrivers/:name` | Path: `name`<br>Query: `cluster` | Returns CSI Driver details and capability flags |
| GET | `/api/storage/csidrivers/:name/yaml` | Path: `name`<br>Query: `cluster` | Returns live YAML manifest for CSI Driver |
| GET | `/api/storage/volumesnapshots` | Query: `namespace`, `cluster` | Lists Volume Snapshots (with graceful fallback if snapshot CRD is not installed) |
| GET | `/api/storage/volumesnapshots/:namespace/:name` | Path: `namespace`, `name`<br>Query: `cluster` | Returns Volume Snapshot details |
| GET | `/api/storage/volumesnapshots/:namespace/:name/yaml` | Path: `namespace`, `name`<br>Query: `cluster` | Returns live YAML manifest for Volume Snapshot |
| GET | `/api/storage/volumesnapshotclasses` | Query: `cluster` | Lists Volume Snapshot Classes |
| GET | `/api/storage/volumesnapshotclasses/:name` | Path: `name`<br>Query: `cluster` | Returns Volume Snapshot Class details |
| GET | `/api/storage/volumesnapshotclasses/:name/yaml` | Path: `name`<br>Query: `cluster` | Returns live YAML manifest for Volume Snapshot Class |
| GET | `/api/storage/volumesnapshotcontents` | Query: `cluster` | Lists Volume Snapshot Contents |
| GET | `/api/storage/volumesnapshotcontents/:name` | Path: `name`<br>Query: `cluster` | Returns Volume Snapshot Content details |
| GET | `/api/storage/volumesnapshotcontents/:name/yaml` | Path: `name`<br>Query: `cluster` | Returns live YAML manifest for Volume Snapshot Content |

### RBAC resources

The dashboard provides a dedicated, read-only RBAC explorer inspecting authentication, authorization, and permission grants across all namespaces and cluster-wide.

| Method | Path | Query/path parameters | Description |
|---|---|---|---|
| GET | `/api/rbac/overview` | `?cluster=` | Returns RBAC overview statistics: total ServiceAccounts, Roles, RoleBindings, ClusterRoles, ClusterRoleBindings, namespace distributions, subject breakdowns, and system vs user-created counts |
| GET | `/api/rbac/serviceaccounts` | Query: `namespace`, `search`, `cluster` | Lists Service Accounts with secrets count, image pull secrets count, automount token flag, creation timestamp, and age |
| GET | `/api/rbac/serviceaccounts/:namespace/:name` | Path: `namespace`, `name`<br>Query: `includeRelated`, `includeEvents`, `cluster` | Returns Service Account details, referenced secrets, bound RoleBindings, bound ClusterRoleBindings, and resolved inherited permission rules |
| GET | `/api/rbac/serviceaccounts/:namespace/:name/yaml` | Path: `namespace`, `name`<br>Query: `cluster` | Returns live YAML manifest for Service Account |
| GET | `/api/rbac/roles` | Query: `namespace`, `search`, `cluster` | Lists Namespaced Roles with rule counts, creation timestamp, and age |
| GET | `/api/rbac/roles/:namespace/:name` | Path: `namespace`, `name`<br>Query: `includeRelated`, `includeEvents`, `cluster` | Returns Role details, complete rule matrix (verbs, apiGroups, resources, resourceNames, nonResourceURLs), and bound subjects via RoleBindings |
| GET | `/api/rbac/roles/:namespace/:name/yaml` | Path: `namespace`, `name`<br>Query: `cluster` | Returns live YAML manifest for Role |
| GET | `/api/rbac/rolebindings` | Query: `namespace`, `search`, `cluster` | Lists Role Bindings with referenced role (Role or ClusterRole), bound subjects, creation timestamp, and age |
| GET | `/api/rbac/rolebindings/:namespace/:name` | Path: `namespace`, `name`<br>Query: `includeRelated`, `includeEvents`, `cluster` | Returns Role Binding details, subjects list, referenced role details, and inherited permission rules |
| GET | `/api/rbac/rolebindings/:namespace/:name/yaml` | Path: `namespace`, `name`<br>Query: `cluster` | Returns live YAML manifest for Role Binding |
| GET | `/api/rbac/clusterroles` | Query: `search`, `cluster` | Lists Cluster Roles with system vs user-created classification, rules count, aggregation rules, creation timestamp, and age |
| GET | `/api/rbac/clusterroles/:name` | Path: `name`<br>Query: `includeRelated`, `cluster` | Returns Cluster Role details, full rule matrix, aggregation details, and bound subjects across both ClusterRoleBindings and namespaced RoleBindings |
| GET | `/api/rbac/clusterroles/:name/yaml` | Path: `name`<br>Query: `cluster` | Returns live YAML manifest for Cluster Role |
| GET | `/api/rbac/clusterrolebindings` | Query: `search`, `cluster` | Lists Cluster Role Bindings with referenced ClusterRole, bound subjects, system vs user classification, creation timestamp, and age |
| GET | `/api/rbac/clusterrolebindings/:name` | Path: `name`<br>Query: `includeRelated`, `cluster` | Returns Cluster Role Binding details, subjects list, referenced ClusterRole details, and inherited permission rules |
| GET | `/api/rbac/clusterrolebindings/:name/yaml` | Path: `name`<br>Query: `cluster` | Returns live YAML manifest for Cluster Role Binding |

### RBAC Security and Permissions

RBAC operations in the dashboard are strictly **READ-ONLY**. The backend requires read-only permissions in the target Kubernetes clusters:
- `core`: `serviceaccounts` (`get`, `list`, `watch`)
- `rbac.authorization.k8s.io`: `roles`, `rolebindings`, `clusterroles`, `clusterrolebindings` (`get`, `list`, `watch`)


### Resource Details Query Options

The detail endpoints support optional query parameters:

- `includeRelated`: accepts `true` or `false` (default `false`). When `true`, queries and includes related Kubernetes resources without making N+1 API calls:
  - **Node**: Pods scheduled on this node (`spec.nodeName=name`).
  - **Service**: Pods matching the service's selector (`selector`).
  - **Ingress**: Backend Services referenced in the ingress rules.
  - **StatefulSet**: Pods matching the workload selector.
  - **DaemonSet**: Pods matching the workload selector.
  - **Namespace**: Workload counts for pods, services, deployments, statefulsets, and daemonsets in this namespace.
- `includeEvents`: accepts `true` or `false` (default `false`). When `true`, queries and includes related Kubernetes events mapped and sorted newest first.

### Namespace filtering

For list endpoints that accept `namespace`, omitting the query parameter requests all namespaces. Supplying a namespace requests namespaced resources only:

```text
GET /api/pods?namespace=default
GET /api/deployments?namespace=payments
GET /api/events?namespace=kube-system
```

## 9. Request Validation

Validation is implemented in `src/middleware/validate.js` with Zod.

- Namespace query values are optional but cannot be empty.
- Pod path values `namespace` and `podName` are required and cannot be empty.
- Deployment path values `namespace` and `name` are required and cannot be empty.
- Resource detail path values `name` and `namespace` are required, trimmed, and cannot be empty.
- Detail query parameters `includeRelated` and `includeEvents` accept only `true` or `false` and are strictly validated as boolean enums.
- Pod log `tailLines` is coerced to an integer and must be between `1` and `10000`.
- Pod log `previous` accepts only `true` or `false` and is converted to a boolean.
- Zod's object parsing strips unknown fields from validated query and parameter data.


Invalid input returns HTTP 400 with the standard error shape and an `issues` array in `details`.

## 10. Response Format

### Single-resource or status success

```json
{
  "success": true,
  "data": {}
}
```

### List success

```json
{
  "success": true,
  "data": [],
  "meta": {
    "count": 0
  }
}
```

List metadata always includes `count`. Namespace-filtered services may also include `namespace` in `meta`.

### Error

```json
{
  "success": false,
  "error": "Validation Error",
  "message": "Invalid request parameters",
  "details": {}
}
```

## 11. Error Handling

Errors flow from async controllers through `asyncHandler` to the global error middleware.

| Error type | HTTP status | Behavior |
|---|---:|---|
| Invalid Zod input | 400 | Returns validation issues |
| Kubernetes API error with a valid status | Kubernetes status | Preserves the API status and extracts message/details |
| Kubernetes API error without a valid status | 502 | Treats the failure as a bad gateway |
| Missing or invalid kubeconfig | 503 | Returns a Kubernetes configuration error |
| Unknown route | 404 | Reports the HTTP method and requested URL |
| Other application error | Error status or 500 | Includes stack details outside production |

In production, generic error responses omit stack traces. In development, stack details are included in `details` to aid debugging.

## 12. Source Tree

```text
backend/
├── package.json
├── README.md
├── PROJECT_DOCUMENTATION.md
├── .env.example
└── src/
    ├── app.js
    ├── server.js
    ├── config/
    │   └── kubernetes.js
    ├── controllers/
    │   ├── cluster.controller.js
    │   ├── daemonsets.controller.js
    │   ├── deployments.controller.js
    │   ├── events.controller.js
    │   ├── gateway.controller.js
    │   ├── health.controller.js
    │   ├── ingresses.controller.js
    │   ├── namespaces.controller.js
    │   ├── nodes.controller.js
    │   ├── pods.controller.js
    │   ├── services.controller.js
    │   ├── statefulsets.controller.js
    │   ├── status.controller.js
    │   ├── troubleshooting.controller.js
    │   └── yaml.controller.js
    ├── middleware/
    │   ├── errorHandler.js
    │   └── validate.js
    ├── routes/
    │   ├── cluster.routes.js
    │   ├── daemonsets.routes.js
    │   ├── deployments.routes.js
    │   ├── events.routes.js
    │   ├── gateway.routes.js
    │   ├── health.routes.js
    │   ├── index.js
    │   ├── ingresses.routes.js
    │   ├── namespaces.routes.js
    │   ├── nodes.routes.js
    │   ├── pods.routes.js
    │   ├── services.routes.js
    │   ├── statefulsets.routes.js
    │   ├── status.routes.js
    │   ├── troubleshooting.routes.js
    │   └── yaml.routes.js
    ├── services/kubernetes/
    │   ├── cluster.service.js
    │   ├── daemonsets.service.js
    │   ├── deployments.service.js
    │   ├── diagnostics.service.js
    │   ├── events.service.js
    │   ├── gateway.service.js
    │   ├── ingresses.service.js
    │   ├── kong.service.js
    │   ├── namespaces.service.js
    │   ├── nodes.service.js
    │   ├── pods.service.js
    │   ├── services.service.js
    │   ├── statefulsets.service.js
    │   └── yaml.service.js
    └── utils/
        ├── asyncHandler.js
        ├── k8sHelpers.js
        └── response.js
```

## 13. Module Responsibilities

### Application and configuration

- `src/server.js`: Reads the port, creates the app, starts the HTTP listener, and logs connection details.
- `src/app.js`: Loads environment variables, initializes Kubernetes clients, registers middleware, and mounts routes.
- `src/config/kubernetes.js`: Resolves kubeconfig, validates the active context, creates Kubernetes API clients, and exposes context/server helpers.

### Controllers

Controllers are thin adapters between Express and Kubernetes services:

- `cluster.controller.js`: Cluster overview.
- `nodes.controller.js`: Node list and details.
- `namespaces.controller.js`: Namespace list and details.
- `pods.controller.js`: Pod list, details, and logs.
- `events.controller.js`: Event list.
- `deployments.controller.js`: Deployment list and details.
- `services.controller.js`: Service list and details.
- `ingresses.controller.js`: Ingress list and details with Kong plugin and routing chain resolution.
- `gateway.controller.js`: Gateway, GatewayClass, and HTTPRoute list and detail endpoints.
- `statefulsets.controller.js`: StatefulSet list and details.
- `daemonsets.controller.js`: DaemonSet list and details.
- `yaml.controller.js`: Resource-specific and generic YAML manifest retrieval.
- `status.controller.js`: Backend and Kubernetes connectivity status.
- `health.controller.js`: Health score and detected issues.
- `troubleshooting.controller.js`: Severity-grouped diagnostic report.

### Kubernetes services

- `cluster.service.js`: Aggregates version, cluster metadata, and resource counts.
- `nodes.service.js`: Maps node metadata, roles, capacity, allocatable resources, and conditions.
- `namespaces.service.js`: Maps namespace metadata, status, and labels.
- `pods.service.js`: Maps pod summaries/details, fetches logs, and finds related events.
- `events.service.js`: Reads namespaced or all-namespace events and sorts them newest first.
- `deployments.service.js`: Maps deployment selectors, replica counts, and status.
- `services.service.js`: Maps service type, IPs, ports, and selectors.
- `ingresses.service.js`: Maps hosts, paths, backend services, ingress class, addresses, Kong annotations, attached plugins, and visual routing chain.
- `gateway.service.js`: Maps Kubernetes Gateway API resources (`Gateway`, `GatewayClass`, `HTTPRoute`, `ReferenceGrant`) via `@kubernetes/client-node` CustomObjectsApi.
- `kong.service.js`: Inspects Kong controller deployment, queries Kong CRDs (`KongPlugin`, `KongIngress`), extracts Kong annotations, sanitizes sensitive plugin configuration, and builds multi-tier visual routing graphs (`Client -> Gateway/Ingress -> Service -> Pods`).
- `yaml.service.js`: Generates clean, read-only YAML manifests directly from live Kubernetes objects for standard resources and Gateway/Kong CRDs.
- `statefulsets.service.js`: Maps replica and readiness information.
- `daemonsets.service.js`: Maps desired, scheduled, available, and ready counts.
- `diagnostics.service.js`: Detects node, pod, container, restart, image, OOM, and deployment availability issues.

### Utilities

- `asyncHandler.js`: Converts rejected async controller promises into Express `next()` calls.
- `k8sHelpers.js`: Shared helpers for extracting and formatting Kubernetes object data.
- `response.js`: Defines `sendSuccess`, `sendList`, and `sendError` response helpers.

## 14. Kubernetes Permissions

The backend uses read operations for Kubernetes resources. The kubeconfig identity should have permission to read the resources needed by the dashboard, including:

- Nodes
- Namespaces
- Pods and pod logs
- Events
- Deployments
- Services
- Ingresses
- Gateways and GatewayClasses (`gateway.networking.k8s.io`)
- HTTPRoutes and ReferenceGrants (`gateway.networking.k8s.io`)
- Kong CRDs (`configuration.konghq.com`, e.g., `KongPlugin`)
- StatefulSets
- DaemonSets
- Cluster version information

Check access with commands such as:

```bash
kubectl auth can-i list pods --all-namespaces
kubectl auth can-i get pods --all-namespaces
kubectl auth can-i get pods --subresource=log --all-namespaces
kubectl auth can-i list deployments --all-namespaces
kubectl auth can-i list httproutes.gateway.networking.k8s.io --all-namespaces
kubectl auth can-i list gateways.gateway.networking.k8s.io --all-namespaces
kubectl auth can-i list kongplugins.configuration.konghq.com --all-namespaces
```

A Kubernetes 403 response usually means the selected kubeconfig user or service account needs additional RBAC permissions.

## 15. Useful Requests

Replace port `5100` with the value in your `.env` if it differs.

```bash
curl http://localhost:5100/
curl http://localhost:5100/api/status
curl http://localhost:5100/api/cluster
curl http://localhost:5100/api/nodes
curl http://localhost:5100/api/nodes/my-node
curl "http://localhost:5100/api/nodes/my-node?includeRelated=true&includeEvents=true"
curl http://localhost:5100/api/namespaces
curl http://localhost:5100/api/namespaces/default
curl "http://localhost:5100/api/namespaces/default?includeRelated=true"
curl http://localhost:5100/api/pods
curl "http://localhost:5100/api/pods?namespace=default"
curl http://localhost:5100/api/pods/default/my-pod
curl "http://localhost:5100/api/pods/default/my-pod/logs?container=app&tailLines=200"
curl http://localhost:5100/api/events
curl "http://localhost:5100/api/deployments?namespace=default"
curl http://localhost:5100/api/deployments/default/my-deployment
curl http://localhost:5100/api/services
curl http://localhost:5100/api/services/default/my-service
curl "http://localhost:5100/api/services/default/my-service?includeRelated=true&includeEvents=true"
curl http://localhost:5100/api/ingresses
curl http://localhost:5100/api/ingresses/default/my-ingress
curl http://localhost:5100/api/http-routes
curl http://localhost:5100/api/http-routes/kong-system/my-route
curl "http://localhost:5100/api/http-routes/kong-system/my-route?includeRelated=true"
curl http://localhost:5100/api/gateways
curl http://localhost:5100/api/gateways/kong-system/kong-gateway
curl http://localhost:5100/api/gateway-classes
curl http://localhost:5100/api/gateway-classes/kong-class
curl http://localhost:5100/api/statefulsets
curl http://localhost:5100/api/statefulsets/default/my-statefulset
curl "http://localhost:5100/api/statefulsets/default/my-statefulset?includeRelated=true"
curl http://localhost:5100/api/daemonsets
curl http://localhost:5100/api/daemonsets/kube-system/my-daemonset
curl "http://localhost:5100/api/daemonsets/kube-system/my-daemonset?includeRelated=true"
curl http://localhost:5100/api/health
curl http://localhost:5100/api/troubleshooting
```

## 16. Troubleshooting

### `npm start` exits immediately

Check the terminal error and verify:

```bash
kubectl config current-context
kubectl config get-contexts
kubectl cluster-info
```

Confirm that the current context points to an existing cluster and that the cluster server is reachable. If using a custom kubeconfig, set `KUBECONFIG` before starting the backend.

PowerShell example:

```powershell
$env:KUBECONFIG = "$HOME\\.kube\\config"
npm start
```

### `/api/status` reports disconnected

The backend is running, but its Kubernetes connectivity check failed. Confirm that the cluster is running, the selected context is correct, and the kubeconfig credentials are still valid.

### HTTP 403

The Kubernetes identity lacks RBAC permission for the requested resource. Use `kubectl auth can-i` to identify the missing permission.

### HTTP 404

Verify the `/api` prefix and route spelling. Unknown routes return a JSON 404 response instead of an HTML page.

### HTTP 400

Check query and path values. In particular, `tailLines` must be an integer from `1` to `10000`, and `previous` must be exactly `true` or `false`.

### Connection timeout or certificate errors

Make sure the cluster API server is reachable from the local machine and that the kubeconfig contains valid certificate authority and client credentials.

## 17. Current Limitations and Follow-up Work

- No automated tests are currently configured.
- No request rate limiting or authentication layer is present; access control is currently delegated to kubeconfig and network exposure.
- The backend is read-only at present.
- Batch and Custom Objects clients are initialized but have no current endpoints.
- Port `5100` is used so browser clients can reach the backend without unsafe-port blocking or conflicts with other local processes.
- Kubeconfig initialization is eager, so a cluster configuration failure prevents the server from starting rather than allowing a degraded status endpoint.
- The API does not currently expose OpenAPI/Swagger metadata.

## 18. YAML Viewer Feature & Endpoints

### 18.1 Overview
The YAML Viewer provides developer inspection of live Kubernetes resources. Rather than returning trimmed or transformed dashboard summaries, it fetches the actual object from the control plane and serializes it to formatted YAML using `js-yaml`.

The feature is strictly **read-only**:
- No write, update, patch, delete, or apply endpoints exist.
- Secrets are explicitly excluded from the supported whitelist to prevent credential leakage.

### 18.2 Supported Resources
- `pods` (namespaced)
- `deployments` (namespaced)
- `services` (namespaced)
- `ingresses` (namespaced)
- `httproutes` (namespaced - Gateway API)
- `gateways` (namespaced - Gateway API)
- `gatewayclasses` (cluster-scoped - Gateway API)
- `kongplugins` (namespaced - Kong CRD)
- `statefulsets` (namespaced)
- `daemonsets` (namespaced)
- `namespaces` (cluster-scoped)
- `nodes` (cluster-scoped)

### 18.3 Endpoints
Both resource-specific and generic routes are mounted:
- **Resource-Specific**:
  - `GET /api/pods/:namespace/:podName/yaml`
  - `GET /api/deployments/:namespace/:name/yaml`
  - `GET /api/services/:namespace/:name/yaml`
  - `GET /api/ingresses/:namespace/:name/yaml`
  - `GET /api/http-routes/:namespace/:name/yaml`
  - `GET /api/gateways/:namespace/:name/yaml`
  - `GET /api/gateway-classes/:name/yaml`
  - `GET /api/statefulsets/:namespace/:name/yaml`
  - `GET /api/daemonsets/:namespace/:name/yaml`
  - `GET /api/namespaces/:name/yaml`
  - `GET /api/nodes/:name/yaml`
- **Generic**:
  - `GET /api/resources/:resourceType/:namespace/:name/yaml` (namespaced: `pods`, `deployments`, `services`, `ingresses`, `httproutes`, `gateways`, `kongplugins`, `statefulsets`, `daemonsets`)
  - `GET /api/resources/:resourceType/:name/yaml` (cluster-scoped: `nodes`, `namespaces`, `gatewayclasses`)

### 18.4 Serialization & Object Normalization
1. **Single API Call**: A single `@kubernetes/client-node` read request is dispatched (e.g., `readNamespacedPod`, `readNode`, or `getNamespacedCustomObject`). No related resources, events, or metrics are fetched.
2. **POJO Conversion**: The client model instance is converted to a plain JavaScript object via `JSON.parse(JSON.stringify(raw))` to prevent `js-yaml` constructor serialization exceptions.
3. **TypeMeta Normalization**: In `@kubernetes/client-node`, `apiVersion` and `kind` are guaranteed at the top of the object (`v1` / `Pod`, `apps/v1` / `Deployment`, `gateway.networking.k8s.io/v1` / `HTTPRoute`, etc.) followed by `metadata`, `spec`, `status`, and all other fields.
4. **Serialization**: Produced using `yaml.dump(normalized, { indent: 2, lineWidth: -1, noRefs: true, sortKeys: false })`.

### 18.5 Error Behaviors
- **400 Bad Request**: Invalid parameters, wrong scoping (e.g. providing a namespace for a cluster resource), or unsupported resource types (e.g. `secrets`).
- **404 Not Found**: Target resource does not exist in the cluster.
- **403 Forbidden**: Active kubeconfig user lacks RBAC permissions for the target resource.
- **502 Bad Gateway**: Kubernetes control plane API server is unreachable.

## 19. Kong Gateway & Gateway API Architecture

### 19.1 Background & Root Cause
In modern Kubernetes environments running Kong, ingress routing often transitions from legacy `networking.k8s.io/v1 Ingress` resources to the official **Kubernetes Gateway API** (`gateway.networking.k8s.io/v1`) using `Gateway` and `HTTPRoute` resources. On clusters where this transition has occurred, querying standard Ingresses might only reveal a few test resources or none at all, while production traffic is handled by dozens of `HTTPRoute` objects.

To solve this, the dashboard architecture includes first-class support for both Ingress and Gateway API routing paradigms, unified under an enriched networking view.

### 19.2 Safe CRD Discovery & Graceful Fallback
Clusters vary widely in the custom resource definitions (CRDs) installed:
- Some clusters have Kong Ingress Controller with standard Ingresses.
- Some have Gateway API CRDs (`gateways`, `httproutes`, `gatewayclasses`, `referencegrants`).
- Some have `KongPlugin` CRDs (`configuration.konghq.com/v1`).
- Some do not have `KongIngress` installed.

The backend never assumes CRDs exist and never crashes if an API group is missing:
- Requests to custom objects catch HTTP 404 / `NotFound` errors and return safe defaults (empty arrays or `{ installed: false }`).
- CRD presence checks are cached per session to optimize API server throughput.

### 19.3 Kong Plugin Resolution & Credential Sanitization
When an Ingress or HTTPRoute contains Kong plugin annotations (e.g., `konghq.com/plugins: rate-limit, port-header, sczone-cors`), the backend:
1. Parses comma-separated plugin names from annotations or HTTPRoute extension filters.
2. Resolves the corresponding `KongPlugin` custom resources from the target namespace or cluster scope.
3. Automatically sanitizes sensitive configuration values before returning JSON to the client. Any fields matching sensitive patterns (e.g., `password`, `token`, `secret`, `key`, `auth`, `cert`, `credential`) are masked as `[REDACTED]`.

### 19.4 Visual Routing Graph
For both Ingresses and HTTPRoutes, the backend builds a multi-tier routing topology representation:
```text
[ Client Traffic ]
       │
       ▼
[ Kong Gateway / Ingress Controller ]
  (Listeners: 80, 443 | Plugins: port-header, cors)
       │
       ▼
[ Ingress / HTTPRoute Rules & Matches ]
  (Hosts: grafana.example.com | Paths: /)
       │
       ▼
[ Backend Kubernetes Service ]
  (ClusterIP | TargetPort: 3000)
       │
       ▼
[ Target Pods & Readiness ]
  (Pod: grafana-785cbb8864-x7l5k | Ready: 1/1 | Node: k8s-worker-1)
```

The frontend renders this flow as an interactive, connected pipeline diagram with live pod indicators and plugin drawers.

## 20. Operators & CRDs Explorer Architecture

### 20.1 Dynamic Discovery & Heuristic Engine
The Kubernetes Operators & CRDs Explorer enables seamless inspection of all custom API extensions running in any connected cluster without hardcoded operator definitions:
1. **Dynamic CRD Discovery**: Uses `@kubernetes/client-node` `ApiextensionsV1Api` (`listCustomResourceDefinition`, `readCustomResourceDefinition`) to discover all installed CRDs dynamically.
2. **Safe Operator Heuristic Engine**:
   - Inspects explicit metadata labels/annotations (`app.kubernetes.io/part-of`, `operators.coreos.com/operator-name`, `olm.owner`, `operator.name`).
   - Checks well-known API group domains (`monitoring.coreos.com` -> Prometheus Operator, `k8s.keycloak.org` -> Keycloak Operator, `konghq.com` -> Kong Gateway, `platform.confluent.io` -> Confluent Operator, `aquasecurity.github.io` -> Trivy / Aqua Security, `cilium.io` -> Cilium, `gateway.networking.k8s.io` -> Kubernetes Gateway API, `cert-manager.io` -> cert-manager, etc.).
   - Safe Fallback: If no operator is detected, the resource is cleanly cataloged under its root API Group. Operator names are never fabricated.
3. **In-Memory Cluster Cache**: CRD discovery lists are cached in-memory per cluster (`Map<clusterId, { data, time }>`) with a 60-second TTL to ensure instantaneous UI response times while minimizing load on the Kubernetes API server.

### 20.2 Custom Resource (CR) Browsing & Lifecycle
1. **Scope-Aware Retrieval**: Supports both Namespaced (`customObjectsApi.listNamespacedCustomObject`) and Cluster-Scoped (`customObjectsApi.listClusterCustomObject`) custom resource instances.
2. **Instance Details**: Exposes full metadata, spec, and status objects with conditions and generation tracking.
3. **Dynamic Manifest Generation**: Live YAML manifest generation for both CRDs (`/api/crds/:name/yaml`) and individual custom resource instances (`/api/custom-resources/:group/:version/:plural/:namespace?/:name/yaml`).

### 20.3 Multi-Cluster Integration
Every request to `/api/crds`, `/api/operators`, and `/api/custom-resources` honors the `?cluster=<id>` query parameter, allowing instant switching between production, staging, and development cluster environments.

## 21. Storage Architecture

### 21.1 Storage Subsystem Overview
The Storage subsystem provides a centralized, read-only view of persistent storage infrastructure in the Kubernetes cluster:
- **PersistentVolumeClaims (PVC)**: Namespace-scoped claims mapped to phase (`Bound`, `Pending`, `Lost`), access modes, capacity, storage class, and bound volume references.
- **PersistentVolumes (PV)**: Cluster-wide storage volumes tracking reclaim policies, access modes, capacity, phase, storage class, and CSI plugin specifications.
- **StorageClasses (SC)**: Provisioner configuration, volume expansion flags, reclaim policies, and binding modes (`Immediate`, `WaitForFirstConsumer`).
- **VolumeAttachments & CSI Nodes**: CSI driver node mappings and real-time attachment state inspection.

### 21.2 Storage Endpoints
- `GET /api/storage/overview`: Aggregated cluster-wide storage metrics and resource distributions.
- `GET /api/storage/pvcs`: List persistent volume claims with optional `?namespace=` filter.
- `GET /api/storage/pvcs/:namespace/:name`: Detailed PVC spec, status, and related pod/PV bindings.
- `GET /api/storage/pvs`: List persistent volumes.
- `GET /api/storage/pvs/:name`: Detailed PV spec, status, source driver, and claim references.
- `GET /api/storage/storageclasses`: List storage classes with provisioners and parameters.
- `GET /api/storage/volumeattachments`: List CSI volume attachments with node and volume associations.
- `GET /api/storage/csinodes`: List CSI storage node driver registrations.

## 22. RBAC Management & Architecture

### 22.1 Independent Top-Level Navigation
RBAC is implemented as an independent, first-class top-level section in the dashboard (`/rbac`) with the following core views:
1. **Roles & RoleBindings**: Namespace-scoped access control rules and subject assignments.
2. **ClusterRoles & ClusterRoleBindings**: Cluster-scoped roles and system-wide privileges.
3. **ServiceAccounts**: Identity tokens and image pull secret bindings.
4. **Declarative Rule Breakdown**: Visual representation of API Groups, Resources, Resource Names, Non-Resource URLs, and Verbs.

### 22.2 RBAC Endpoints
- `GET /api/rbac/roles`: List namespace-scoped Roles.
- `GET /api/rbac/roles/:namespace/:name`: Detailed Role rules and bindings.
- `GET /api/rbac/clusterroles`: List ClusterRoles.
- `GET /api/rbac/clusterroles/:name`: Detailed ClusterRole rules and aggregation rules.
- `GET /api/rbac/rolebindings`: List RoleBindings.
- `GET /api/rbac/rolebindings/:namespace/:name`: Detailed RoleBinding subject references and roleRef.
- `GET /api/rbac/clusterrolebindings`: List ClusterRoleBindings.
- `GET /api/rbac/clusterrolebindings/:name`: Detailed ClusterRoleBinding subject mappings.
- `GET /api/rbac/serviceaccounts`: List ServiceAccounts.
- `GET /api/rbac/serviceaccounts/:namespace/:name`: Detailed ServiceAccount secrets and assigned bindings.

## 23. Advanced RBAC Analysis Architecture

### 23.1 High-Performance Batch Analysis Engine
The Advanced RBAC Analysis feature resolves complex multi-hop Kubernetes authorization models in a single server-side pass:
- **Unified Batch Endpoint**: `GET /api/rbac/analysis` fetches `ServiceAccounts`, `Roles`, `RoleBindings`, `ClusterRoles`, and `ClusterRoleBindings` in parallel across the active cluster in <150ms.
- **Permission Matrix Resolution**: Flattens all declared RBAC rules into an indexed, filterable matrix mapping `Subject -> Scope -> API Group -> Resource -> Resource Names -> Verbs -> Source Binding -> Source Role`.
- **Zero N+1 API Calls**: Complete client-side filtering and real-time search without additional network round-trips.

### 23.2 Analysis Capabilities
1. **Permission Matrix**: Multi-column matrix supporting instant search, verb badges, namespace scope filtering, and source binding provenance.
2. **Subject Access View**: User, Group, or ServiceAccount-centric view displaying all attached RoleBindings, ClusterRoleBindings, referenced Roles, and resolved permission rules.
3. **Resource Access View**: Reverse permission query allowing selection of Namespace, API Group, Resource, and Verb to instantly list all matching RBAC rules and authorized subjects.
4. **Effective Permissions View**: Deduplicated effective rule resolver for any selected subject, grouping permissions by API Group & Resource with explicit source binding attribution and factual disclaimers.
5. **Global RBAC Search**: High-speed search filtering across subjects, bindings, roles, API groups, resource names, and verbs.
6. **Configuration Indicators**: Factually surfaces Kubernetes configuration patterns (wildcard `*` API groups, resources, verbs, `cluster-admin` bindings, non-resource URLs, SA bindings, User/Group bindings) without arbitrary risk scores or rankings.
7. **Relationship Graph**: Interactive visual flow connecting `Subject` -> `Binding` -> `Role` -> `Rules`.

## 24. License

The project declares the MIT license in `package.json`.


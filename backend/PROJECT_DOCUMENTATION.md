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
| GET | `/api/status` | Reports backend status and whether a Kubernetes API call succeeds |
| GET | `/api/cluster` | Returns cluster version, context, server, resource counts, and node health |
| GET | `/api/health` | Returns a cluster health score, status, and detected issues |
| GET | `/api/troubleshooting` | Returns diagnostic issues grouped by severity |

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
| GET | `/api/ingresses` | Optional `namespace` | Lists ingresses, classes, hosts, paths, backends, and load-balancer addresses |
| GET | `/api/ingresses/:namespace/:name` | Path: `namespace`, `name`<br>Query: `includeRelated`, `includeEvents` | Returns detailed ingress information including ingressClassName, hosts, paths, pathType, backendServiceNames/Ports, TLS configuration, loadBalancer addresses, rules, defaultBackend, and optionally referenced services and events |
| GET | `/api/statefulsets` | Optional `namespace` | Lists StatefulSets and readiness counts |
| GET | `/api/statefulsets/:namespace/:name` | Path: `namespace`, `name`<br>Query: `includeRelated`, `includeEvents` | Returns detailed StatefulSet information including replicas, selector, serviceName, updateStrategy, template metadata, containers, images, ports, volume information (volumes & volumeClaimTemplates), conditions, and optionally selected pods and events |
| GET | `/api/daemonsets` | Optional `namespace` | Lists DaemonSets and scheduling/readiness counts |
| GET | `/api/daemonsets/:namespace/:name` | Path: `namespace`, `name`<br>Query: `includeRelated`, `includeEvents` | Returns detailed DaemonSet information including desired, scheduled, ready, available, unavailable, misscheduled counts, selector, updateStrategy, containers, volumes, conditions, and optionally selected pods and events |

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
    │   ├── health.controller.js
    │   ├── ingresses.controller.js
    │   ├── namespaces.controller.js
    │   ├── nodes.controller.js
    │   ├── pods.controller.js
    │   ├── services.controller.js
    │   ├── statefulsets.controller.js
    │   ├── status.controller.js
    │   └── troubleshooting.controller.js
    ├── middleware/
    │   ├── errorHandler.js
    │   └── validate.js
    ├── routes/
    │   ├── cluster.routes.js
    │   ├── daemonsets.routes.js
    │   ├── deployments.routes.js
    │   ├── events.routes.js
    │   ├── health.routes.js
    │   ├── index.js
    │   ├── ingresses.routes.js
    │   ├── namespaces.routes.js
    │   ├── nodes.routes.js
    │   ├── pods.routes.js
    │   ├── services.routes.js
    │   ├── statefulsets.routes.js
    │   ├── status.routes.js
    │   └── troubleshooting.routes.js
    ├── services/kubernetes/
    │   ├── cluster.service.js
    │   ├── daemonsets.service.js
    │   ├── deployments.service.js
    │   ├── diagnostics.service.js
    │   ├── events.service.js
    │   ├── ingresses.service.js
    │   ├── namespaces.service.js
    │   ├── nodes.service.js
    │   ├── pods.service.js
    │   ├── services.service.js
    │   └── statefulsets.service.js
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
- `nodes.controller.js`: Node list.
- `namespaces.controller.js`: Namespace list.
- `pods.controller.js`: Pod list, details, and logs.
- `events.controller.js`: Event list.
- `deployments.controller.js`: Deployment list and details.
- `services.controller.js`: Service list.
- `ingresses.controller.js`: Ingress list.
- `statefulsets.controller.js`: StatefulSet list.
- `daemonsets.controller.js`: DaemonSet list.
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
- `ingresses.service.js`: Maps hosts, paths, backend services, ingress class, and addresses.
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
- StatefulSets
- DaemonSets
- Cluster version information

Check access with commands such as:

```bash
kubectl auth can-i list pods --all-namespaces
kubectl auth can-i get pods --all-namespaces
kubectl auth can-i get pods --subresource=log --all-namespaces
kubectl auth can-i list deployments --all-namespaces
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

## 18. License

The project declares the MIT license in `package.json`.

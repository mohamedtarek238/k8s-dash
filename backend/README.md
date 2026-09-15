# Kubernetes Dashboard Backend

Node.js/Express backend for a local Kubernetes Dashboard. It connects to your **local cluster** using your existing kubeconfig and current context — no hardcoded credentials required.

## Prerequisites

- Node.js 18+
- kubectl configured with access to a cluster
- A valid kubeconfig (default: `~/.kube/config` on Linux/macOS, `%USERPROFILE%\.kube\config` on Windows)

## Installation

```bash
cd backend
npm install
```

## Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Available variables:

| Variable      | Default                  | Description                          |
|---------------|--------------------------|--------------------------------------|
| `PORT`        | `5000`                   | HTTP port for the backend            |
| `NODE_ENV`    | `development`            | Environment mode                     |
| `CORS_ORIGIN` | `http://localhost:3000`  | Allowed frontend origin for CORS     |

**Kubernetes credentials are not stored in `.env`.** The backend uses your local kubeconfig automatically.

## Using kubeconfig

The backend loads kubeconfig via `@kubernetes/client-node` using `KubeConfig.loadFromDefault()`, which reads:

1. `KUBECONFIG` environment variable (if set), or
2. The default kubeconfig path for your OS

### Check your active Kubernetes context

```bash
kubectl config current-context
```

### List available contexts

```bash
kubectl config get-contexts
```

### Switch context

```bash
kubectl config use-context <context-name>
```

Restart the backend after switching contexts so it picks up the new active context.

## Start the backend

```bash
npm start
```

Development mode with auto-reload:

```bash
npm run dev
```

The server starts on `http://localhost:5100` (or `5000` if `PORT` is omitted in `.env`).

## Quick health check

```bash
curl http://localhost:5100/api/status
# Or if running on default port 5000:
# curl http://localhost:5000/api/status
```

Example response:

```json
{
  "success": true,
  "data": {
    "backend": "ok",
    "kubernetes": "connected"
  }
}
```

## API Endpoints

All endpoints are prefixed with `/api`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/clusters` | List all available Kubernetes clusters |
| GET | `/api/clusters/:clusterId` | Get cluster metadata by ID |
| GET | `/api/status` | Backend and Kubernetes connectivity status |
| GET | `/api/cluster` | Cluster overview (version, counts, health) |
| GET | `/api/nodes` | List all nodes |
| GET | `/api/nodes/:name` | Node details (`?includeRelated=&includeEvents=`) |
| GET | `/api/namespaces` | List all namespaces |
| GET | `/api/namespaces/:name` | Namespace details (`?includeRelated=&includeEvents=`) |
| GET | `/api/pods` | List pods (`?namespace=default` optional) |
| GET | `/api/pods/:namespace/:podName` | Pod details with related events |
| GET | `/api/pods/:namespace/:podName/logs` | Pod logs (`?container=&tailLines=&previous=`) |
| GET | `/api/events` | Kubernetes events (`?namespace=default` optional) |
| GET | `/api/deployments` | List deployments (`?namespace=default` optional) |
| GET | `/api/deployments/:namespace/:name` | Deployment details |
| GET | `/api/services` | List services (`?namespace=default` optional) |
| GET | `/api/services/:namespace/:name` | Service details (`?includeRelated=&includeEvents=`) |
| GET | `/api/ingresses` | List ingresses with Kong controller detection (`?namespace=default` optional) |
| GET | `/api/ingresses/:namespace/:name` | Ingress details with Kong plugins & routing chain |
| GET | `/api/http-routes` | List Gateway API HTTPRoutes (`?namespace=kong-system` optional) |
| GET | `/api/http-routes/:namespace/:name` | HTTPRoute details with parent Gateways, plugins & backend pods |
| GET | `/api/gateways` | List Gateway API Gateways (`?namespace=` optional) |
| GET | `/api/gateways/:namespace/:name` | Gateway details with listeners, addresses & conditions |
| GET | `/api/gateway-classes` | List GatewayClasses |
| GET | `/api/gateway-classes/:name` | GatewayClass details and controller |
| GET | `/api/statefulsets` | List StatefulSets (`?namespace=default` optional) |
| GET | `/api/statefulsets/:namespace/:name` | StatefulSet details (`?includeRelated=&includeEvents=`) |
| GET | `/api/daemonsets` | List DaemonSets (`?namespace=default` optional) |
| GET | `/api/daemonsets/:namespace/:name` | DaemonSet details (`?includeRelated=&includeEvents=`) |
| GET | `/api/health` | Cluster health score and detected issues |
| GET | `/api/troubleshooting` | Issues grouped by severity |
| GET | `/api/pods/:namespace/:podName/yaml` | Pod raw YAML manifest |
| GET | `/api/deployments/:namespace/:name/yaml` | Deployment raw YAML manifest |
| GET | `/api/services/:namespace/:name/yaml` | Service raw YAML manifest |
| GET | `/api/ingresses/:namespace/:name/yaml` | Ingress raw YAML manifest |
| GET | `/api/http-routes/:namespace/:name/yaml` | Gateway API HTTPRoute raw YAML manifest |
| GET | `/api/gateways/:namespace/:name/yaml` | Gateway API Gateway raw YAML manifest |
| GET | `/api/gateway-classes/:name/yaml` | Gateway API GatewayClass raw YAML manifest |
| GET | `/api/statefulsets/:namespace/:name/yaml` | StatefulSet raw YAML manifest |
| GET | `/api/daemonsets/:namespace/:name/yaml` | DaemonSet raw YAML manifest |
| GET | `/api/namespaces/:name/yaml` | Namespace raw YAML manifest |
| GET | `/api/nodes/:name/yaml` | Node raw YAML manifest |
| GET | `/api/resources/:resourceType/:namespace/:name/yaml` | Generic YAML for namespaced resources (`pods`, `deployments`, `services`, `ingresses`, `httproutes`, `gateways`, `kongplugins`, `statefulsets`, `daemonsets`) |
| GET | `/api/resources/:resourceType/:name/yaml` | Generic YAML for cluster resources (`nodes`, `namespaces`, `gatewayclasses`) |

### Detail Query Parameters

Detail endpoints accept optional query parameters:
- `includeRelated=true|false` (default: `false`): Embeds linked resources (e.g., Pods scheduled on a Node, Pods selected by a Service, backend Services for an Ingress, workload counts for a Namespace).
- `includeEvents=true|false` (default: `false`): Embeds related Kubernetes events, sorted newest first.

### Kong Gateway & Ingress Integration

The backend features native inspection for clusters using **Kong as the API Gateway / Ingress Controller**:
- **Automatic Kong Controller Detection**: Detects whether routing is handled by Kong Ingress Controller or Kong Gateway Operator.
- **Gateway API Support**: First-class support for `gateway.networking.k8s.io/v1` resources (`Gateway`, `HTTPRoute`, `GatewayClass`, `ReferenceGrant`).
- **Kong Plugin Resolution**: Resolves attached `KongPlugin` CRDs (`konghq.com/plugins`) and automatically **masks sensitive credentials** (`password`, `token`, `key`, `secret`).
- **End-to-End Routing Flow**: Reconstructs the complete topology from `Client -> Gateway -> Ingress/HTTPRoute -> Service -> Pods` with live pod health status.

### YAML Manifests

YAML endpoints are 100% read-only and return dynamically generated manifests using `js-yaml` directly from the live control plane object. Supported types: `pods`, `deployments`, `services`, `ingresses`, `httproutes`, `gateways`, `gatewayclasses`, `kongplugins`, `statefulsets`, `daemonsets`, `namespaces`, `nodes`.

## Example curl commands


```bash
# Status
curl http://localhost:5000/api/status

# Cluster overview
curl http://localhost:5000/api/cluster

# Nodes
curl http://localhost:5000/api/nodes
curl http://localhost:5000/api/nodes/my-node
curl "http://localhost:5000/api/nodes/my-node?includeRelated=true&includeEvents=true"

# Namespaces
curl http://localhost:5000/api/namespaces
curl http://localhost:5000/api/namespaces/default?includeRelated=true

# Pods in all namespaces
curl http://localhost:5000/api/pods

# Pods in default namespace
curl "http://localhost:5000/api/pods?namespace=default"

# Pod details
curl http://localhost:5000/api/pods/default/my-pod

# Pod logs
curl "http://localhost:5000/api/pods/default/my-pod/logs?container=app&tailLines=200"

# Events
curl http://localhost:5000/api/events

# Deployments
curl "http://localhost:5000/api/deployments?namespace=default"
curl http://localhost:5000/api/deployments/default/my-deployment

# Services
curl http://localhost:5000/api/services
curl http://localhost:5000/api/services/default/my-service
curl "http://localhost:5000/api/services/default/my-service?includeRelated=true&includeEvents=true"

# Ingresses
curl http://localhost:5000/api/ingresses
curl http://localhost:5000/api/ingresses/default/my-ingress

# StatefulSets
curl http://localhost:5000/api/statefulsets
curl "http://localhost:5000/api/statefulsets/default/my-statefulset?includeRelated=true"

# DaemonSets
curl http://localhost:5000/api/daemonsets
curl "http://localhost:5000/api/daemonsets/kube-system/my-daemonset?includeRelated=true"

# Cluster health
curl http://localhost:5000/api/health

# Troubleshooting report
curl http://localhost:5000/api/troubleshooting
```

## Response format

Success:

```json
{
  "success": true,
  "data": {}
}
```

List responses include metadata:

```json
{
  "success": true,
  "data": [],
  "meta": {
    "count": 0
  }
}
```

Error:

```json
{
  "success": false,
  "error": "Kubernetes API error",
  "message": "...",
  "details": {}
}
```

## Architecture

```
Routes → Controllers → Kubernetes Services → Kubernetes Client
```

- **Routes**: HTTP routing and input validation
- **Controllers**: Request/response handling
- **Services**: Kubernetes business logic and data mapping
- **Config**: Kubeconfig and API client initialization

## Troubleshooting connection problems

### `kubernetes: disconnected` on `/api/status`

1. Verify kubectl works:
   ```bash
   kubectl cluster-info
   kubectl get nodes
   ```
2. Confirm the active context:
   ```bash
   kubectl config current-context
   ```
3. Check `KUBECONFIG` points to the correct file if you use a custom path.
4. Restart the backend after changing kubeconfig or context.

### Permission errors (403)

Your kubeconfig user may lack RBAC permissions. Test with:

```bash
kubectl auth can-i list pods --all-namespaces
```

### Connection refused / timeout

- Ensure the cluster API server is reachable from your machine.
- For local clusters (Docker Desktop, minikube, kind), confirm the cluster is running.

### Certificate errors

Ensure your kubeconfig contains valid CA/cert credentials for the cluster. Re-run your cluster setup or refresh credentials as needed.

## Project structure

```
backend/
├── src/
│   ├── config/
│   │   └── kubernetes.js
│   ├── controllers/
│   ├── routes/
│   ├── services/
│   │   └── kubernetes/
│   ├── middleware/
│   ├── utils/
│   ├── app.js
│   └── server.js
├── .env.example
├── package.json
└── README.md
```

## License

MIT

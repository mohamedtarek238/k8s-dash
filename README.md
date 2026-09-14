# ⎈ Kubernetes Dashboard (`k8s-dash`)

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![React Version](https://img.shields.io/badge/react-18.3.1-blue.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/vite-5.4.14-purple.svg)](https://vitejs.dev/)
[![Express](https://img.shields.io/badge/express-4.21.2-lightgrey.svg)](https://expressjs.com/)
[![Kubernetes Client](https://img.shields.io/badge/%40kubernetes%2Fclient--node-1.0.0-326ce5.svg)](https://github.com/kubernetes-client/javascript)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A lightweight, modern, and developer-friendly **Kubernetes Dashboard** for local and remote clusters. Built with **React 18 + Vite** on the frontend and **Node.js + Express** on the backend.

It connects directly to your active Kubernetes context using your local `kubeconfig`—**no hardcoded credentials, cluster tokens, or complex ingress installations required.**

---

## 📑 Table of Contents

- [Features](#-features)
- [System Architecture](#-system-architecture)
- [Prerequisites](#-prerequisites)
- [Quick Start Guide](#-quick-start-guide)
  - [1. Clone Repository](#1-clone-the-repository)
  - [2. Verify Cluster Access](#2-verify-cluster-access)
  - [3. Start Backend](#3-start-the-backend)
  - [4. Start Frontend](#4-start-the-frontend)
- [Configuration](#-configuration)
  - [Backend (.env)](#backend-configuration)
  - [Frontend (.env)](#frontend-configuration)
- [Working with Kubernetes Contexts](#-working-with-kubernetes-contexts)
- [API Reference](#-api-reference)
  - [Cluster & Diagnostics](#cluster--diagnostics)
  - [Resource Endpoints](#resource-endpoints)
  - [Query Parameters & Filters](#query-parameters--filters)
  - [Example Requests](#example-requests)
- [Project Directory Structure](#-project-directory-structure)
- [Troubleshooting](#-troubleshooting)
- [Contributing & Git Workflow](#-contributing)
- [License](#-license)

---

## ✨ Features

### 📊 Real-Time Operations Overview
- **Cluster Identity**: Control plane URL, active context, Kubernetes Git version.
- **Cluster Health Score**: Automated diagnostic score (0–100) assessing cluster-wide anomalies.
- **Telemetry Cards**: Total nodes, ready vs. not-ready counts, total pods, active namespaces, and deployments.
- **Issue Diagnostics**: Real-time warnings and critical issues categorized by severity (`critical`, `warning`, `info`) with recommendations.
- **Live Event Feed**: Unified event stream sorted newest first with condition tags.

### 🪵 Workload & Resource Management
- **Pods**:
  - Live pod status, container readiness (`x/y`), restart counts, assigned node, and IP.
  - Multi-namespace filter and instant search.
  - Slide-out resource detail panel with container specs and related events.
  - **Embedded Pod Logs Viewer**: View container stdout/stderr, tail lines (up to 10,000), toggle previous terminated container logs, and toggle auto-refresh.
- **Nodes**:
  - Node readiness, roles (control-plane/worker), Kubernetes version, CPU & memory capacity, allocatable resources, and node conditions.
- **Deployments**:
  - Replicas (desired, available, ready, updated), rollout status, update strategies.
- **Namespaces**:
  - Namespace lifecycle status, creation timestamps, and label counts.
- **Networking & Ingress / Kong Gateway**:
  - **Services**: Type (`ClusterIP`, `NodePort`, `LoadBalancer`), cluster IPs, external IPs, and mapped ports.
  - **Ingresses**: Host rules, load balancer addresses, ingress class, paths, and Kong controller metadata.
  - **Kubernetes Gateway API**: Full discovery and management of `Gateway`, `HTTPRoute`, and `GatewayClass` resources (`gateway.networking.k8s.io/v1`).
  - **Kong Gateway & Plugin Integration**: Automatic detection of Kong Ingress Controller and Kong Gateway Operator, resolution of attached `KongPlugin` CRDs, and automatic credential masking (`[REDACTED]`).
  - **Visual Routing Topology**: Real-time interactive pipeline diagrams displaying `Client -> Gateway -> Ingress/HTTPRoute -> Service -> Pods` with live pod health status.
- **Workloads (StatefulSets & DaemonSets)**:
  - Full API support for StatefulSets and DaemonSets with linked pods and events.

### 📄 Live YAML Viewer
- **Dynamic Manifest Generation**: View current Kubernetes objects directly from the control plane formatted as standard YAML via `js-yaml`.
- **Supported Resources**: Pods, Deployments, Nodes, Namespaces, Services, Ingresses, HTTPRoutes, Gateways, GatewayClasses, KongPlugins, StatefulSets, and DaemonSets.
- **Field Fidelity**: Complete manifest preservation including `metadata`, `spec`, `status`, `labels`, `annotations`, `ownerReferences`, `finalizers`, and `conditions`.
- **Developer Convenience**: Interactive slide-out drawer tab with one-click "Copy YAML" and live "Refresh" buttons.
- **Read-Only Security**: Strictly inspection-only with zero mutation endpoints (no apply, update, patch, or delete). Sensitive resources like `secrets` are blocked.

### 🔐 Security & Simplicity
- **Zero Hardcoded Secrets**: Uses official `@kubernetes/client-node` loader (`~/.kube/config` or `%USERPROFILE%\.kube\config`).
- **Strict Validation**: All route parameters and query arguments are strictly validated with [Zod](https://zod.dev/).
- **Safe CORS & Headers**: Configured with [Helmet](https://helmetjs.github.io/) and configurable CORS origin.


### 🎨 Clean, Responsive UI
- Dark and Light themes with persistent state.
- Collapsible sidebar with quick navigation.
- High-contrast badges, animated connection pulse, and responsive table views.

---

## 🏛 System Architecture

```text
┌────────────────────────────────────────────────────────┐
│                   Web Browser                          │
│          http://localhost:3000 (Vite Dev Server)       │
└───────────────────────────┬────────────────────────────┘
                            │ HTTP / REST
                            ▼
┌────────────────────────────────────────────────────────┐
│                 Express Backend API                    │
│            http://localhost:5100 (Node.js)             │
│                                                        │
│   Routes ──► Validation (Zod) ──► Controllers ──►      │
│   Services ──► @kubernetes/client-node                 │
└───────────────────────────┬────────────────────────────┘
                            │ Reads local kubeconfig
                            ▼
┌────────────────────────────────────────────────────────┐
│            Kubernetes API Server (Control Plane)       │
│           (Docker Desktop / Minikube / Kind / EKS)     │
└────────────────────────────────────────────────────────┘
```

- **Frontend (`backend/frontend`)**: Single-page application built with React 18, Vite, and Lucide-React icons.
- **Backend (`backend`)**: Layered Express architecture (`Routes` → `Controllers` → `Services` → `K8s Client`).

---

## 📋 Prerequisites

Ensure the following tools are installed on your workstation:

1. **Node.js**: `v18.0.0` or newer ([Download Node.js](https://nodejs.org/))
2. **npm**: `v9.0.0` or newer (bundled with Node.js)
3. **kubectl**: Kubernetes command-line tool ([Install kubectl](https://kubernetes.io/docs/tasks/tools/))
4. **Kubernetes Cluster**: Access to any running Kubernetes cluster, such as:
   - [Docker Desktop](https://www.docker.com/products/docker-desktop/) (built-in Kubernetes)
   - [Minikube](https://minikube.sigs.k8s.io/)
   - [Kind](https://kind.sigs.k8s.io/)
   - [k3s](https://k3s.io/) / [k3d](https://k3d.io/)
   - Cloud providers: AWS EKS, Google GKE, Azure AKS, DigitalOcean, etc.

---

## 🚀 Quick Start Guide

### 1. Clone the Repository

```bash
git clone https://github.com/mohamedtarek238/k8s-dash.git
cd k8s-dash
```

### 2. Verify Cluster Access

Make sure your active Kubernetes context is reachable before starting the backend:

```bash
kubectl cluster-info
kubectl get nodes
```

---

### 3. Start the Backend

Open a terminal and navigate to the `backend` directory:

#### Linux / macOS (bash):
```bash
cd backend

# Install dependencies
npm install

# Create local environment configuration
cp .env.example .env

# Start in development mode (with auto-reload)
npm run dev
```

#### Windows (PowerShell):
```powershell
cd backend

# Install dependencies
npm install

# Create local environment configuration
Copy-Item .env.example .env

# Start in development mode (with auto-reload)
npm run dev
```

The backend will start and log:
```text
[server] Listening on port 5100
[kubernetes] Connected to https://<your-cluster-ip>:6443 (context: <your-context>)
```

Test backend connectivity:
```bash
curl http://localhost:5100/api/status
```

---

### 4. Start the Frontend

Open a **second terminal** and navigate to `backend/frontend`:

#### Linux / macOS (bash):
```bash
cd backend/frontend

# Install dependencies
npm install

# Create local environment configuration
cp .env.example .env

# Start the Vite development server
npm run dev
```

#### Windows (PowerShell):
```powershell
cd backend/frontend

# Install dependencies
npm install

# Create local environment configuration
Copy-Item .env.example .env

# Start the Vite development server
npm run dev
```

Open your browser and visit:
👉 **`http://localhost:3000`**

---

## ⚙️ Configuration

### Backend Configuration

The backend reads settings from `backend/.env`. A template is provided in `backend/.env.example`:

| Environment Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `5100` | Port for the Express backend server (fallback is 5000 if not set) |
| `NODE_ENV` | `development` | Environment mode (`development` or `production`) |
| `CORS_ORIGIN` | `http://localhost:3000` | Allowed origin for frontend requests |
| `KUBECONFIG` | *(optional)* | Custom path to a kubeconfig file (defaults to `~/.kube/config`) |

> **Note**: Kubernetes credentials are never stored in `.env`. Authentication is managed transparently through your kubeconfig.

### Frontend Configuration

The frontend reads settings from `backend/frontend/.env`. A template is provided in `backend/frontend/.env.example`:

| Environment Variable | Default | Description |
| :--- | :--- | :--- |
| `VITE_API_URL` | `http://localhost:5100` | Base URL of the backend Express API |

---

## 🔄 Working with Kubernetes Contexts

The dashboard automatically loads the **current active context** from your default kubeconfig.

### View Active Context
```bash
kubectl config current-context
```

### List Available Contexts
```bash
kubectl config get-contexts
```

### Switch to a Different Context
```bash
kubectl config use-context <context-name>
```

> **Tip**: After switching context, restart the backend server so `@kubernetes/client-node` reloads the active context.

---

## 📡 API Reference

All backend API routes are prefixed with `/api`.

### Cluster & Diagnostics

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/status` | Connectivity status for backend and Kubernetes cluster |
| `GET` | `/api/cluster` | Cluster summary (version, node/pod/namespace counts, server URL) |
| `GET` | `/api/health` | Automated health score (0–100) and detected issues |
| `GET` | `/api/troubleshooting` | Diagnostic issues grouped by severity (`critical`, `warning`, `info`) |
| `GET` | `/api/events` | Cluster events stream (`?namespace=` optional) |

### Resource Endpoints

| Method | Endpoint | Query Parameters | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/nodes` | — | List all nodes with capacity & readiness |
| `GET` | `/api/nodes/:name` | `?includeRelated=&includeEvents=` | Node details, conditions, capacity, and linked pods |
| `GET` | `/api/namespaces` | — | List all namespaces and metadata |
| `GET` | `/api/namespaces/:name` | `?includeRelated=&includeEvents=` | Namespace details and resource counts |
| `GET` | `/api/pods` | `?namespace=` | List pods (scoped to namespace or cluster-wide) |
| `GET` | `/api/pods/:namespace/:podName` | — | Pod details, containers, and related events |
| `GET` | `/api/pods/:namespace/:podName/logs` | `?container=&tailLines=&previous=` | Pod container logs |
| `GET` | `/api/deployments` | `?namespace=` | List deployments and replica counts |
| `GET` | `/api/deployments/:namespace/:name`| — | Deployment rollout details and update strategy |
| `GET` | `/api/services` | `?namespace=` | List services and exposed ports |
| `GET` | `/api/services/:namespace/:name` | `?includeRelated=&includeEvents=` | Service details, target pods, and endpoints |
| `GET` | `/api/ingresses` | `?namespace=` | List ingress resources, hosts, and Kong controller info |
| `GET` | `/api/ingresses/:namespace/:name` | `?includeRelated=&includeEvents=` | Ingress rules, attached Kong plugins, routing flow, and backends |
| `GET` | `/api/http-routes` | `?namespace=` | List Gateway API HTTPRoutes (`gateway.networking.k8s.io/v1`) |
| `GET` | `/api/http-routes/:namespace/:name` | `?includeRelated=&includeEvents=` | HTTPRoute rules, matches, Kong plugins, and backend pods |
| `GET` | `/api/gateways` | `?namespace=` | List Gateway API Gateways |
| `GET` | `/api/gateways/:namespace/:name` | `?includeRelated=&includeEvents=` | Gateway listeners, addresses, status, and attached HTTPRoutes |
| `GET` | `/api/gateway-classes` | — | List GatewayClasses |
| `GET` | `/api/gateway-classes/:name` | — | GatewayClass details and controller |
| `GET` | `/api/statefulsets` | `?namespace=` | List StatefulSets |
| `GET` | `/api/statefulsets/:namespace/:name` | `?includeRelated=&includeEvents=` | StatefulSet details and managed pods |
| `GET` | `/api/daemonsets` | `?namespace=` | List DaemonSets |
| `GET` | `/api/daemonsets/:namespace/:name` | `?includeRelated=&includeEvents=` | DaemonSet details and scheduled pods |

### YAML Viewer Endpoints

Both **resource-specific** and **generic** YAML endpoints are provided. They are 100% read-only and return dynamically generated YAML manifests directly from the live Kubernetes control plane.

| Method | Endpoint | Scope | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/pods/:namespace/:podName/yaml` | Namespaced | Pod raw YAML manifest |
| `GET` | `/api/deployments/:namespace/:name/yaml` | Namespaced | Deployment raw YAML manifest |
| `GET` | `/api/services/:namespace/:name/yaml` | Namespaced | Service raw YAML manifest |
| `GET` | `/api/ingresses/:namespace/:name/yaml` | Namespaced | Ingress raw YAML manifest |
| `GET` | `/api/http-routes/:namespace/:name/yaml` | Namespaced | Gateway API HTTPRoute raw YAML manifest |
| `GET` | `/api/gateways/:namespace/:name/yaml` | Namespaced | Gateway API Gateway raw YAML manifest |
| `GET` | `/api/gateway-classes/:name/yaml` | Cluster | Gateway API GatewayClass raw YAML manifest |
| `GET` | `/api/statefulsets/:namespace/:name/yaml` | Namespaced | StatefulSet raw YAML manifest |
| `GET` | `/api/daemonsets/:namespace/:name/yaml` | Namespaced | DaemonSet raw YAML manifest |
| `GET` | `/api/namespaces/:name/yaml` | Cluster | Namespace raw YAML manifest |
| `GET` | `/api/nodes/:name/yaml` | Cluster | Node raw YAML manifest |
| `GET` | `/api/resources/:resourceType/:namespace/:name/yaml` | Namespaced | Generic YAML for namespaced resources (`pods`, `deployments`, `services`, `ingresses`, `httproutes`, `gateways`, `kongplugins`, `statefulsets`, `daemonsets`) |
| `GET` | `/api/resources/:resourceType/:name/yaml` | Cluster | Generic YAML for cluster resources (`nodes`, `namespaces`, `gatewayclasses`) |

> **Security & Validation**: Supported resource types are strictly whitelisted: `pods`, `deployments`, `services`, `ingresses`, `httproutes`, `gateways`, `gatewayclasses`, `kongplugins`, `statefulsets`, `daemonsets`, `namespaces`, and `nodes`. Requests for sensitive types like `secrets` or unrecognized names return `400 Bad Request`.

### Query Parameters & Filters

- **`includeRelated=true|false`** *(default: false)*: Enriches the resource detail response with associated resources (e.g., pods scheduled on a node, pods targeted by a service selector, services routed by an ingress).
- **`includeEvents=true|false`** *(default: false)*: Attaches real-time Kubernetes events related to this specific resource, sorted newest first.
- **`namespace=<name>`**: Filters list queries to a specific namespace. If omitted, returns resources across all namespaces.
- **Pod Logs parameters**:
  - `container`: Specify container name for multi-container pods.
  - `tailLines`: Number of log lines to retrieve (1 to 10000, default: 200).
  - `previous=true`: Fetch logs for the previous terminated container instance.

### Example Requests

```bash
# 1. Check cluster connectivity
curl http://localhost:5100/api/status

# 2. Get cluster overview
curl http://localhost:5100/api/cluster

# 3. Get node details with related pods and events
curl "http://localhost:5100/api/nodes/minikube?includeRelated=true&includeEvents=true"

# 4. Stream pod logs
curl "http://localhost:5100/api/pods/default/my-app/logs?tailLines=50"

# 5. Get service details with linked pods
curl "http://localhost:5100/api/services/default/my-service?includeRelated=true"

# 6. Fetch raw YAML for a Pod (resource-specific route)
curl http://localhost:5100/api/pods/default/my-pod/yaml

# 7. Fetch raw YAML via generic route (namespaced)
curl http://localhost:5100/api/resources/deployments/default/my-deployment/yaml

# 8. Fetch raw YAML via generic route (cluster-scoped)
curl http://localhost:5100/api/resources/nodes/minikube/yaml
```

#### YAML API Response Envelope

```json
{
  "success": true,
  "data": {
    "yaml": "apiVersion: v1\nkind: Pod\nmetadata:\n  name: my-pod\n  namespace: default\n...",
    "kind": "Pod",
    "apiVersion": "v1",
    "name": "my-pod",
    "namespace": "default"
  }
}
```


#### Standard API Response Envelope

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "count": 12
  }
}
```

---

## 📁 Project Directory Structure

```text
k8s-dash/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── kubernetes.js          # Kubeconfig loader & client initialization
│   │   ├── controllers/               # Express route handlers
│   │   │   ├── cluster.controller.js
│   │   │   ├── nodes.controller.js
│   │   │   ├── pods.controller.js
│   │   │   ├── services.controller.js
│   │   │   └── ...
│   │   ├── middleware/
│   │   │   ├── errorHandler.js        # Centralized HTTP error handling
│   │   │   └── validateRequest.js     # Zod schema validation middleware
│   │   ├── routes/                    # API route definitions
│   │   │   └── api.routes.js
│   │   ├── services/
│   │   │   └── kubernetes/            # Kubernetes business logic & mapping
│   │   │       ├── cluster.service.js
│   │   │       ├── events.service.js
│   │   │       ├── health.service.js
│   │   │       ├── nodes.service.js
│   │   │       ├── pods.service.js
│   │   │       └── ...
│   │   ├── utils/
│   │   │   ├── k8sHelpers.js          # Shared date, age, & port helpers
│   │   │   └── response.js            # Standard JSON response envelopes
│   │   ├── app.js                     # Express app setup (CORS, Helmet, Morgan)
│   │   └── server.js                  # Entry point (reads PORT, starts listener)
│   ├── frontend/                      # React 18 + Vite dashboard
│   │   ├── src/
│   │   │   ├── App.jsx                # Main dashboard component & views
│   │   │   ├── api.js                 # Frontend API client
│   │   │   ├── main.jsx               # React DOM entry
│   │   │   └── styles.css             # Dashboard stylesheet & themes
│   │   ├── index.html
│   │   ├── package.json
│   │   ├── vite.config.js
│   │   └── .env.example
│   ├── .env.example
│   ├── package.json
│   ├── PROJECT_DOCUMENTATION.md       # In-depth architectural documentation
│   └── README.md
├── .gitignore
└── README.md                          # Repository root documentation (this file)
```

---

## 🛠 Troubleshooting

### 1. `kubernetes: disconnected` on `/api/status`
- Confirm `kubectl` commands work in your terminal:
  ```bash
  kubectl get nodes
  ```
- Ensure the API server is reachable and running (e.g., start Docker Desktop or run `minikube start`).
- Check if your active context points to an old or unreachable IP:
  ```bash
  kubectl config current-context
  kubectl cluster-info
  ```
- Restart the backend server after fixing the context.

### 2. Port Conflict (EADDRINUSE)
- If port `5100` or `3000` is already occupied, modify `PORT` in `backend/.env` and update `VITE_API_URL` in `backend/frontend/.env`.

### 3. Permission Denied (RBAC 403)
- If the backend returns 403 Forbidden on certain resources, verify your user has RBAC permissions to list them:
  ```bash
  kubectl auth can-i get pods --all-namespaces
  kubectl auth can-i get nodes
  ```

### 4. CORS Errors in the Browser
- Ensure `CORS_ORIGIN` in `backend/.env` matches your frontend origin (default: `http://localhost:3000`).

---

## 🤝 Contributing

Contributions are welcome! Follow these steps to contribute:

1. **Fork the Repository** on GitHub.
2. **Create a Feature Branch**:
   ```bash
   git checkout -b feature/my-new-feature
   ```
3. **Commit your changes**:
   ```bash
   git commit -m "feat: add support for persistent volume claims"
   ```
4. **Push to the branch**:
   ```bash
   git push origin feature/my-new-feature
   ```
5. **Open a Pull Request** against the `main` branch.

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

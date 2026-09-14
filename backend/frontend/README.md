# 🖥️ Kubernetes Dashboard Frontend

The React 18 + Vite web console for the Kubernetes Dashboard. It connects to the Express backend API to visualize cluster telemetry, health diagnostics, workload statuses, and live container logs.

## 🛠 Tech Stack

- **React 18** (`react`, `react-dom`)
- **Vite 5** (Fast HMR development server & production bundler)
- **Lucide React** (Clean, modern iconography)
- **Native CSS** (Custom responsive dark/light dashboard theme)

## 📋 Prerequisites

- Node.js `18.0.0` or later
- Running Kubernetes Dashboard Backend (default: `http://localhost:5100`)

## 🚀 Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy the example environment file:

```bash
# Linux/macOS
cp .env.example .env

# Windows PowerShell
Copy-Item .env.example .env
```

Available environment variables:

| Variable | Default | Description |
| :--- | :--- | :--- |
| `VITE_API_URL` | `http://localhost:5100` | URL of the Express backend API server |

### 3. Start Development Server

```bash
npm run dev
```

The frontend will start at:
👉 **`http://localhost:3000`**

### 4. Build for Production

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

## 🎨 UI Features

- **Operations Overview**: Cluster identity, control plane endpoint, context name, cluster health score, and node/pod summary metrics.
- **Diagnostics & Findings**: Real-time warnings and critical findings surfaced by control plane telemetry.
- **Live Pod Log Viewer**: Embedded modal for streaming stdout/stderr with custom line limits (up to 10,000), previous instance retrieval, and container switching.
- **Slide-out Detail Panels**: Deep-dive views for Nodes, Namespaces, Pods, and Deployments.
- **Resource Tables**: Searchable and namespace-filtered lists for Pods, Deployments, Services, Ingresses, and Events.
- **Dark / Light Mode**: Seamless theme switcher with persistent styling.

## 📄 License

MIT

const fs = require('fs');
const path = require('path');
const { getClusterMeta, listClusters, getDefaultClusterId } = require('../../config/kubernetes');

// In-memory cache for parsed audit logs: cacheKey -> { mtime, size, events, timestamp }
const auditLogCache = new Map();
const CACHE_TTL_MS = 5000;

/**
 * Standard reasons for audit logging capability
 */
const AUDIT_REASONS = {
  NOT_CONFIGURED: 'NOT_CONFIGURED',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  INVALID_LOG_FORMAT: 'INVALID_LOG_FORMAT',
  EMPTY_LOG: 'EMPTY_LOG',
  CLUSTER_NOT_SUPPORTED: 'CLUSTER_NOT_SUPPORTED',
};

/**
 * Safely get list of registered clusters without throwing if not yet initialized
 */
function getRegisteredClusters() {
  try {
    return listClusters();
  } catch (err) {
    return [];
  }
}

/**
 * Safely resolve cluster metadata without throwing if cluster is unknown
 */
function resolveClusterMeta(clusterId) {
  try {
    return getClusterMeta(clusterId);
  } catch (err) {
    return null;
  }
}

/**
 * Sanitize sensitive keys and values from objects, query strings, and headers
 */
function sanitizeSensitiveData(obj) {
  if (!obj) return obj;
  if (typeof obj === 'string') {
    return obj
      .replace(/(bearer\s+)[a-zA-Z0-9_\-\.]+/gi, '$1[REDACTED]')
      .replace(/(token=)[^&]+/gi, '$1[REDACTED]')
      .replace(/(password=)[^&]+/gi, '$1[REDACTED]')
      .replace(/(secret=)[^&]+/gi, '$1[REDACTED]')
      .replace(/(key=)[^&]+/gi, '$1[REDACTED]')
      .replace(/(authorization:\s*)[^\r\n]+/gi, '$1[REDACTED]');
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeSensitiveData(item));
  }

  if (typeof obj === 'object') {
    const sanitized = {};
    const SENSITIVE_KEYS = [
      'token', 'password', 'secret', 'authorization', 'bearer',
      'client-key-data', 'client-certificate-data', 'tls.key', 'private-key'
    ];

    for (const [key, value] of Object.entries(obj)) {
      if (SENSITIVE_KEYS.some((k) => key.toLowerCase().includes(k))) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeSensitiveData(value);
      }
    }
    return sanitized;
  }

  return obj;
}

/**
 * Canonical cluster ID extraction: guarantees val is a single string ID
 */
function toCanonicalClusterId(val) {
  if (!val) return null;
  if (Array.isArray(val)) return toCanonicalClusterId(val[0]);
  if (typeof val === 'object' && val !== null) return toCanonicalClusterId(val.id);
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed.includes(',')) return trimmed.split(',')[0].trim();
    return trimmed || null;
  }
  return null;
}

/**
 * Resolves the audit log configuration specifically assigned to the given cluster.
 * Ensures TRUE cluster isolation by refusing to fall back to a shared file unless
 * there is only one cluster or KUBERNETES_AUDIT_SHARED_ALL_CLUSTERS=true is set.
 */
function resolveAuditLogConfig(clusterId) {
  const canonicalRequested = toCanonicalClusterId(clusterId);
  let configuredPath = null;
  let source = null;

  const clusters = getRegisteredClusters();
  const defaultId = (clusters[0] && clusters[0].id) || 'default';
  const targetClusterId = canonicalRequested || defaultId;
  const clusterMeta = targetClusterId ? resolveClusterMeta(targetClusterId) : null;

  // If clusterId is specified and cluster registry is initialized, verify cluster exists
  if (canonicalRequested && clusters.length > 0 && !clusterMeta) {
    console.log(`[AUDIT] Requested cluster: ${clusterId || '<none>'}`);
    console.log(`[AUDIT] Resolved cluster: ${targetClusterId}`);
    console.log(`[AUDIT] Audit log path: none`);
    return {
      configured: false,
      clusterId: targetClusterId,
      path: null,
      source: null,
      reason: AUDIT_REASONS.CLUSTER_NOT_SUPPORTED,
      message: `Cluster "${canonicalRequested}" is not recognized by the cluster registry`,
    };
  }

  // 1. Check cluster-specific environment variable by Cluster ID: KUBERNETES_AUDIT_LOG_PATH_<CLUSTER_ID>
  if (targetClusterId) {
    const sanitizedId = targetClusterId.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
    const clusterEnvVar = `KUBERNETES_AUDIT_LOG_PATH_${sanitizedId}`;
    if (process.env[clusterEnvVar]) {
      configuredPath = process.env[clusterEnvVar].trim();
      source = `cluster (${clusterEnvVar})`;
    }

    // Only check context name if UNIQUE across all registered clusters (to prevent cross-cluster collisions)
    if (!configuredPath && clusterMeta?.context) {
      const matchingContexts = clusters.filter((c) => c.context === clusterMeta.context);
      if (matchingContexts.length === 1) {
        const sanitizedContext = clusterMeta.context.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
        const contextEnvVar = `KUBERNETES_AUDIT_LOG_PATH_${sanitizedContext}`;
        if (process.env[contextEnvVar]) {
          configuredPath = process.env[contextEnvVar].trim();
          source = `cluster (${contextEnvVar})`;
        }
      }
    }
  }

  // 2. Global fallback ONLY if single cluster OR explicitly declared shared
  if (!configuredPath && process.env.KUBERNETES_AUDIT_LOG_PATH) {
    const isSingleCluster = clusters.length <= 1;
    const isExplicitlyShared = process.env.KUBERNETES_AUDIT_SHARED_ALL_CLUSTERS === 'true';

    if (isSingleCluster || isExplicitlyShared) {
      configuredPath = process.env.KUBERNETES_AUDIT_LOG_PATH.trim();
      source = isSingleCluster ? 'global (single-cluster fallback)' : 'global (shared across all clusters)';
    }
  }

  if (!configuredPath) {
    const displayName = clusterMeta?.name || targetClusterId;
    console.log(`[AUDIT] Requested cluster: ${clusterId || '<none>'}`);
    console.log(`[AUDIT] Resolved cluster: ${targetClusterId}`);
    console.log(`[AUDIT] Audit log path: none`);
    return {
      configured: false,
      clusterId: targetClusterId,
      path: null,
      source: null,
      reason: AUDIT_REASONS.NOT_CONFIGURED,
      message: `Audit logs are not configured for this cluster (${displayName})`,
    };
  }

  // Resolve relative paths from current working directory
  const resolvedPath = path.isAbsolute(configuredPath)
    ? configuredPath
    : path.resolve(process.cwd(), configuredPath);

  console.log(`[AUDIT] Requested cluster: ${clusterId || '<none>'}`);
  console.log(`[AUDIT] Resolved cluster: ${targetClusterId}`);
  console.log(`[AUDIT] Audit log path: ${resolvedPath}`);

  return {
    configured: true,
    clusterId: targetClusterId,
    rawPath: configuredPath,
    path: resolvedPath,
    source,
  };
}

/**
 * Returns the maximum megabytes to read from the audit log tail
 */
function getMaxReadBytes() {
  const maxMb = parseInt(process.env.KUBERNETES_AUDIT_LOG_MAX_MB, 10) || 20;
  return Math.max(1, maxMb) * 1024 * 1024;
}

/**
 * Checks readiness and capability of the audit log source for a cluster
 */
function inspectAuditCapability(clusterId) {
  const config = resolveAuditLogConfig(clusterId);
  const targetClusterId = config.clusterId || toCanonicalClusterId(clusterId) || 'default';

  if (!config.configured) {
    return {
      available: false,
      configured: false,
      readable: false,
      pathConfigured: false,
      reason: config.reason || AUDIT_REASONS.NOT_CONFIGURED,
      message: config.message || 'Audit logs are not configured for this cluster',
      clusterId: targetClusterId,
      recordsDetected: 0,
      filePath: null,
    };
  }

  const { path: filePath } = config;

  if (!fs.existsSync(filePath)) {
    return {
      available: false,
      configured: true,
      readable: false,
      pathConfigured: true,
      reason: AUDIT_REASONS.FILE_NOT_FOUND,
      message: `Audit log file not found at configured path (${config.source})`,
      clusterId: targetClusterId,
      recordsDetected: 0,
      filePath,
    };
  }

  try {
    fs.accessSync(filePath, fs.constants.R_OK);
  } catch (err) {
    return {
      available: false,
      configured: true,
      readable: false,
      pathConfigured: true,
      reason: AUDIT_REASONS.PERMISSION_DENIED,
      message: 'Permission denied reading audit log file',
      clusterId: targetClusterId,
      recordsDetected: 0,
      filePath,
    };
  }

  let stats;
  try {
    stats = fs.statSync(filePath);
  } catch (err) {
    return {
      available: false,
      configured: true,
      readable: false,
      pathConfigured: true,
      reason: AUDIT_REASONS.PERMISSION_DENIED,
      message: err.message,
      clusterId: targetClusterId,
      recordsDetected: 0,
      filePath,
    };
  }

  if (stats.size === 0) {
    return {
      available: true,
      configured: true,
      readable: true,
      pathConfigured: true,
      reason: AUDIT_REASONS.EMPTY_LOG,
      message: 'Audit log file is empty',
      clusterId: targetClusterId,
      recordsDetected: 0,
      filePath,
      fileSize: 0,
      mtime: stats.mtimeMs,
    };
  }

  return {
    available: true,
    configured: true,
    readable: true,
    pathConfigured: true,
    reason: null,
    message: 'Audit logging active',
    clusterId: targetClusterId,
    filePath,
    fileSize: stats.size,
    mtime: stats.mtimeMs,
  };
}

/**
 * Normalizes a Kubernetes audit.k8s.io/v1 Event record into dashboard format
 */
function normalizeAuditEvent(item, index) {
  const objectRef = item.objectRef || {};
  const user = item.user || {};
  const responseStatus = item.responseStatus || {};
  const statusCode = responseStatus.code || (item.responseObject?.code) || 200;

  const isDenied = statusCode >= 400 ||
    (responseStatus.status && responseStatus.status.toLowerCase() === 'failure') ||
    (responseStatus.reason && ['forbidden', 'unauthorized'].includes(responseStatus.reason.toLowerCase()));

  const verb = (item.verb || '').toLowerCase();
  const rawTimestamp = item.stageTimestamp || item.requestReceivedTimestamp || item.metadata?.creationTimestamp;

  const firstIp = Array.isArray(item.sourceIPs) && item.sourceIPs.length > 0 ? item.sourceIPs[0] : '';

  return {
    timestamp: rawTimestamp || new Date().toISOString(),
    auditID: item.auditID || `audit-${index}-${Date.now()}`,
    id: item.auditID || `audit-${index}-${Date.now()}`,
    stage: item.stage || '',
    level: item.level || '',
    user: user.username || 'unknown',
    groups: Array.isArray(user.groups) ? user.groups : [],
    verb: verb,
    apiGroup: objectRef.apiGroup || '',
    resource: objectRef.resource || '',
    namespace: objectRef.namespace || '',
    resourceName: objectRef.name || '',
    requestURI: sanitizeSensitiveData(item.requestURI || ''),
    statusCode: statusCode,
    responseStatus: statusCode,
    sourceIP: firstIp,
    sourceIPs: Array.isArray(item.sourceIPs) ? item.sourceIPs : (firstIp ? [firstIp] : []),
    userAgent: item.userAgent || '',
    allowed: !isDenied,
    status: isDenied ? 'denied' : 'allowed',
    annotations: sanitizeSensitiveData(item.annotations || {}),
    rawEvent: sanitizeSensitiveData(item),
  };
}

/**
 * Bounded tail reader: Reads up to maxBytes from the end of filePath,
 * plus recent rotated files (e.g. .1, .2) if budget remains.
 */
function readTailAuditRecords(primaryFilePath, maxBytes) {
  const targetFiles = [primaryFilePath];

  // Also check for rotated files: primaryFilePath.1, primaryFilePath.2
  for (let r = 1; r <= 3; r++) {
    const rotatedPath = `${primaryFilePath}.${r}`;
    if (fs.existsSync(rotatedPath)) {
      targetFiles.push(rotatedPath);
    }
  }

  let remainingBytes = maxBytes;
  const rawLines = [];

  for (const fPath of targetFiles) {
    if (remainingBytes <= 0) break;
    try {
      const stats = fs.statSync(fPath);
      if (stats.size === 0) continue;

      const bytesToRead = Math.min(stats.size, remainingBytes);
      const startPosition = stats.size - bytesToRead;
      const buffer = Buffer.alloc(bytesToRead);

      const fd = fs.openSync(fPath, 'r');
      fs.readSync(fd, buffer, 0, bytesToRead, startPosition);
      fs.closeSync(fd);

      remainingBytes -= bytesToRead;

      let chunk = buffer.toString('utf-8');

      // If we didn't read from the very beginning of the file, discard partial first line
      if (startPosition > 0) {
        const firstNewline = chunk.indexOf('\n');
        if (firstNewline !== -1) {
          chunk = chunk.slice(firstNewline + 1);
        } else {
          chunk = '';
        }
      }

      const lines = chunk.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) rawLines.push(trimmed);
      }
    } catch (err) {
      console.warn(`[AuditService] Warning reading file ${fPath}:`, err.message);
    }
  }

  // Parse lines into normalized events
  const events = [];
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    try {
      const parsed = JSON.parse(line);
      if (Array.isArray(parsed)) {
        parsed.forEach((item, idx) => events.push(normalizeAuditEvent(item, `${i}_${idx}`)));
      } else if (parsed && typeof parsed === 'object') {
        events.push(normalizeAuditEvent(parsed, i));
      }
    } catch (err) {
      // Ignore malformed line safely without failing the whole request
    }
  }

  // Sort newest first
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return events;
}

/**
 * Diagnostics endpoint: GET /api/audit/status?cluster=<clusterId>
 */
async function getAuditStatus(clusterId) {
  const capability = inspectAuditCapability(clusterId);
  const maxMb = parseInt(process.env.KUBERNETES_AUDIT_LOG_MAX_MB, 10) || 20;

  let recordsDetected = 0;
  if (capability.available && capability.fileSize > 0) {
    try {
      const events = await getParsedEvents(capability.clusterId, capability);
      recordsDetected = events.length;
    } catch (err) {
      recordsDetected = 0;
    }
  }

  return {
    available: capability.available && capability.reason !== AUDIT_REASONS.FILE_NOT_FOUND && capability.reason !== AUDIT_REASONS.PERMISSION_DENIED,
    configured: capability.configured,
    readable: capability.readable,
    pathConfigured: capability.pathConfigured,
    reason: capability.reason,
    message: capability.message,
    clusterId: capability.clusterId,
    recordsDetected,
    recordCount: recordsDetected,
    maxMb,
  };
}

/**
 * In-memory cached getter for parsed audit events, strictly isolated by cluster ID
 */
async function getParsedEvents(clusterId, capability) {
  const cId = capability.clusterId || clusterId || 'default';
  const cacheKey = `audit-events:${cId}:${capability.filePath}:${capability.mtime}:${capability.fileSize}`;
  const now = Date.now();
  const cached = auditLogCache.get(cacheKey);

  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.events;
  }

  const maxBytes = getMaxReadBytes();
  const events = readTailAuditRecords(capability.filePath, maxBytes);

  auditLogCache.set(cacheKey, {
    events,
    timestamp: now,
  });

  return events;
}

/**
 * Fetches audit events with capability detection, filtering, and summary statistics
 */
async function getAuditEvents(clusterId, query = {}) {
  const capability = inspectAuditCapability(clusterId);

  // If not configured, file missing, or permission denied, return capability explanation
  if (!capability.available || !capability.readable) {
    return {
      available: false,
      reason: capability.reason || AUDIT_REASONS.NOT_CONFIGURED,
      message: capability.message,
      clusterId: capability.clusterId,
      summary: {
        total: 0,
        creates: 0,
        updates: 0,
        deletes: 0,
        denied: 0,
      },
      total: 0,
      events: [],
    };
  }

  // Handle empty log file
  if (capability.fileSize === 0) {
    return {
      available: true,
      clusterId: capability.clusterId,
      total: 0,
      limit: query.limit || 50,
      offset: query.offset || 0,
      summary: {
        total: 0,
        creates: 0,
        updates: 0,
        deletes: 0,
        denied: 0,
      },
      events: [],
    };
  }

  const allEvents = await getParsedEvents(clusterId, capability);

  // Filter events according to query parameters
  const {
    namespace,
    search,
    verb,
    resource,
    apiGroup,
    user,
    status,
    limit = 50,
    offset = 0,
  } = query;

  let filtered = allEvents;

  if (namespace && namespace !== 'all') {
    const nsLower = namespace.toLowerCase();
    filtered = filtered.filter((e) => e.namespace && e.namespace.toLowerCase() === nsLower);
  }

  if (verb && verb !== 'all') {
    const verbLower = verb.toLowerCase();
    filtered = filtered.filter((e) => e.verb === verbLower);
  }

  if (resource && resource !== 'all') {
    const resLower = resource.toLowerCase();
    filtered = filtered.filter((e) => e.resource && e.resource.toLowerCase() === resLower);
  }

  if (apiGroup && apiGroup !== 'all') {
    const groupLower = apiGroup.toLowerCase();
    filtered = filtered.filter((e) => e.apiGroup && e.apiGroup.toLowerCase() === groupLower);
  }

  if (user) {
    const userLower = user.toLowerCase();
    filtered = filtered.filter((e) => e.user && e.user.toLowerCase().includes(userLower));
  }

  if (status && status !== 'all') {
    const statusLower = status.toLowerCase();
    if (statusLower === 'allowed') {
      filtered = filtered.filter((e) => e.allowed === true || e.status === 'allowed');
    } else if (statusLower === 'denied') {
      filtered = filtered.filter((e) => e.allowed === false || e.status === 'denied');
    }
  }

  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(
      (e) =>
        (e.user && e.user.toLowerCase().includes(s)) ||
        (e.resource && e.resource.toLowerCase().includes(s)) ||
        (e.resourceName && e.resourceName.toLowerCase().includes(s)) ||
        (e.verb && e.verb.toLowerCase().includes(s)) ||
        (e.namespace && e.namespace.toLowerCase().includes(s)) ||
        (e.requestURI && e.requestURI.toLowerCase().includes(s))
    );
  }

  // Summary counts calculated from the filtered collection
  const summary = {
    total: filtered.length,
    creates: filtered.filter((e) => e.verb === 'create').length,
    updates: filtered.filter((e) => ['update', 'patch'].includes(e.verb)).length,
    deletes: filtered.filter((e) => e.verb === 'delete').length,
    denied: filtered.filter((e) => !e.allowed || e.status === 'denied').length,
  };

  // Paginate
  const pageLimit = Math.max(1, parseInt(limit, 10) || 50);
  const pageOffset = Math.max(0, parseInt(offset, 10) || 0);
  const paginatedEvents = filtered.slice(pageOffset, pageOffset + pageLimit);

  return {
    available: true,
    clusterId: clusterId || 'default',
    total: filtered.length,
    limit: pageLimit,
    offset: pageOffset,
    summary,
    events: paginatedEvents,
  };
}

module.exports = {
  AUDIT_REASONS,
  getAuditEvents,
  getAuditStatus,
  inspectAuditCapability,
  resolveAuditLogConfig,
  readTailAuditRecords,
  normalizeAuditEvent,
  sanitizeSensitiveData,
};

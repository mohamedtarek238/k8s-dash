const { getClusterClients, getClusterMeta, getDefaultClusterId } = require('../config/kubernetes');

function extractCanonicalClusterId(val) {
  if (!val) return null;
  if (Array.isArray(val)) return extractCanonicalClusterId(val[0]);
  if (typeof val === 'object' && val !== null) return extractCanonicalClusterId(val.id);
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed.includes(',')) return trimmed.split(',')[0].trim();
    return trimmed || null;
  }
  return null;
}

/**
 * Express middleware that resolves the target cluster from `?cluster=<id>`.
 * Attaches `req.k8sClients` and `req.clusterMeta` to every request.
 *
 * If `?cluster` is absent, the default cluster is used.
 * If `?cluster` is invalid, responds with 400.
 */
function clusterMiddleware(req, res, next) {
  try {
    const canonicalId = extractCanonicalClusterId(req.query.cluster);
    const clusterId = canonicalId || getDefaultClusterId();

    req.clusterId = clusterId;
    req.k8sClients = getClusterClients(clusterId);
    req.clusterMeta = getClusterMeta(clusterId);

    return next();
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Cluster',
        message: err.message,
      });
    }
    return next(err);
  }
}

module.exports = { clusterMiddleware };

const { getClusterClients, getClusterMeta, getDefaultClusterId } = require('../config/kubernetes');

/**
 * Express middleware that resolves the target cluster from `?cluster=<id>`.
 * Attaches `req.k8sClients` and `req.clusterMeta` to every request.
 *
 * If `?cluster` is absent, the default cluster is used.
 * If `?cluster` is invalid, responds with 400.
 */
function clusterMiddleware(req, res, next) {
  try {
    const clusterId = req.query.cluster || getDefaultClusterId();

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

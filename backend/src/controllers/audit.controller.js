const auditService = require('../services/kubernetes/audit.service');
const { sendSuccess } = require('../utils/response');

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

async function getAuditStatus(req, res) {
  const queryCluster = extractCanonicalClusterId(req.query.cluster);
  const clusterId = queryCluster || req.clusterId || (req.k8sClients && req.k8sClients.clusterId);
  const data = await auditService.getAuditStatus(clusterId);
  return sendSuccess(res, data);
}

async function getAuditEvents(req, res) {
  const query = req.validatedQuery || req.query || {};
  const queryCluster = extractCanonicalClusterId(query.cluster) || extractCanonicalClusterId(req.query.cluster);
  const clusterId = queryCluster || req.clusterId || (req.k8sClients && req.k8sClients.clusterId);
  const data = await auditService.getAuditEvents(clusterId, query);
  return sendSuccess(res, data, 200, { count: (data.events || []).length });
}

module.exports = {
  getAuditStatus,
  getAuditEvents,
};

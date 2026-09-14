const express = require('express');

const statusRoutes = require('./status.routes');
const clusterRoutes = require('./cluster.routes');
const nodesRoutes = require('./nodes.routes');
const namespacesRoutes = require('./namespaces.routes');
const podsRoutes = require('./pods.routes');
const eventsRoutes = require('./events.routes');
const deploymentsRoutes = require('./deployments.routes');
const servicesRoutes = require('./services.routes');
const ingressesRoutes = require('./ingresses.routes');
const statefulSetsRoutes = require('./statefulsets.routes');
const daemonSetsRoutes = require('./daemonsets.routes');
const healthRoutes = require('./health.routes');
const troubleshootingRoutes = require('./troubleshooting.routes');

const router = express.Router();

router.use('/status', statusRoutes);
router.use('/cluster', clusterRoutes);
router.use('/nodes', nodesRoutes);
router.use('/namespaces', namespacesRoutes);
router.use('/pods', podsRoutes);
router.use('/events', eventsRoutes);
router.use('/deployments', deploymentsRoutes);
router.use('/services', servicesRoutes);
router.use('/ingresses', ingressesRoutes);
router.use('/statefulsets', statefulSetsRoutes);
router.use('/daemonsets', daemonSetsRoutes);
router.use('/health', healthRoutes);
router.use('/troubleshooting', troubleshootingRoutes);

module.exports = router;

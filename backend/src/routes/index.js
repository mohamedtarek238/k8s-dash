const express = require('express');

const statusRoutes = require('./status.routes');
const clusterRoutes = require('./cluster.routes');
const clustersRoutes = require('./clusters.routes');
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
const resourcesRoutes = require('./resources.routes');
const gatewaysRoutes = require('./gateways.routes');
const gatewayClassesRoutes = require('./gatewayclasses.routes');
const httpRoutesRoutes = require('./httproutes.routes');
const crdsRoutes = require('./crds.routes');
const operatorsRoutes = require('./operators.routes');
const customResourcesRoutes = require('./customResources.routes');
const storageRoutes = require('./storage.routes');

const router = express.Router();

router.use('/clusters', clustersRoutes);
router.use('/status', statusRoutes);
router.use('/cluster', clusterRoutes);
router.use('/nodes', nodesRoutes);
router.use('/node', nodesRoutes);
router.use('/namespaces', namespacesRoutes);
router.use('/namespace', namespacesRoutes);
router.use('/pods', podsRoutes);
router.use('/pod', podsRoutes);
router.use('/events', eventsRoutes);
router.use('/deployments', deploymentsRoutes);
router.use('/deployment', deploymentsRoutes);
router.use('/services', servicesRoutes);
router.use('/service', servicesRoutes);
router.use('/ingresses', ingressesRoutes);
router.use('/ingress', ingressesRoutes);
router.use('/gateways', gatewaysRoutes);
router.use('/gateway', gatewaysRoutes);
router.use('/gateway-classes', gatewayClassesRoutes);
router.use('/gateway-class', gatewayClassesRoutes);
router.use('/http-routes', httpRoutesRoutes);
router.use('/http-route', httpRoutesRoutes);
router.use('/crds', crdsRoutes);
router.use('/crd', crdsRoutes);
router.use('/operators', operatorsRoutes);
router.use('/operator', operatorsRoutes);
router.use('/custom-resources', customResourcesRoutes);
router.use('/custom-resource', customResourcesRoutes);
router.use('/storage', storageRoutes);
router.use('/statefulsets', statefulSetsRoutes);
router.use('/statefulset', statefulSetsRoutes);
router.use('/daemonsets', daemonSetsRoutes);
router.use('/daemonset', daemonSetsRoutes);
router.use('/health', healthRoutes);
router.use('/troubleshooting', troubleshootingRoutes);
router.use('/resources', resourcesRoutes);

module.exports = router;



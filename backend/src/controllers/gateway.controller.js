const gatewayService = require('../services/kubernetes/gateway.service');
const yamlService = require('../services/kubernetes/yaml.service');
const { sendSuccess, sendList } = require('../utils/response');

async function getGateways(req, res) {
  const { namespace } = req.validatedQuery || {};
  const data = await gatewayService.listGateways(namespace, req.k8sClients);
  return sendList(res, data, namespace ? { namespace } : {});
}

async function getGatewayDetails(req, res) {
  const { namespace, name } = req.validatedParams;
  const data = await gatewayService.getGatewayDetails(namespace, name, req.k8sClients);
  return sendSuccess(res, data);
}

async function getGatewayYaml(req, res) {
  const { namespace, name } = req.validatedParams;
  const data = await yamlService.getResourceYaml('gateways', { namespace, name }, req.k8sClients);
  return sendSuccess(res, data);
}

async function getGatewayClasses(req, res) {
  const data = await gatewayService.listGatewayClasses(req.k8sClients);
  return sendList(res, data);
}

async function getGatewayClassDetails(req, res) {
  const { name } = req.validatedParams;
  const data = await gatewayService.getGatewayClassDetails(name, req.k8sClients);
  return sendSuccess(res, data);
}

async function getGatewayClassYaml(req, res) {
  const { name } = req.validatedParams;
  const data = await yamlService.getResourceYaml('gatewayclasses', { name }, req.k8sClients);
  return sendSuccess(res, data);
}

async function getHttpRoutes(req, res) {
  const { namespace } = req.validatedQuery || {};
  const data = await gatewayService.listHttpRoutes(namespace, req.k8sClients);
  return sendList(res, data, namespace ? { namespace } : {});
}

async function getHttpRouteDetails(req, res) {
  const { namespace, name } = req.validatedParams;
  const data = await gatewayService.getHttpRouteDetails(namespace, name, req.k8sClients);
  return sendSuccess(res, data);
}

async function getHttpRouteYaml(req, res) {
  const { namespace, name } = req.validatedParams;
  const data = await yamlService.getResourceYaml('httproutes', { namespace, name }, req.k8sClients);
  return sendSuccess(res, data);
}

async function getReferenceGrants(req, res) {
  const { namespace } = req.validatedQuery || {};
  const data = await gatewayService.listReferenceGrants(namespace, req.k8sClients);
  return sendList(res, data, namespace ? { namespace } : {});
}

module.exports = {
  getGateways,
  getGatewayDetails,
  getGatewayYaml,
  getGatewayClasses,
  getGatewayClassDetails,
  getGatewayClassYaml,
  getHttpRoutes,
  getHttpRouteDetails,
  getHttpRouteYaml,
  getReferenceGrants,
};

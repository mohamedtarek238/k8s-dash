const gatewayService = require('../services/kubernetes/gateway.service');
const yamlService = require('../services/kubernetes/yaml.service');
const { sendSuccess, sendList } = require('../utils/response');

async function getGateways(req, res) {
  const { namespace } = req.validatedQuery || {};
  const data = await gatewayService.listGateways(namespace);
  return sendList(res, data, namespace ? { namespace } : {});
}

async function getGatewayDetails(req, res) {
  const { namespace, name } = req.validatedParams;
  const data = await gatewayService.getGatewayDetails(namespace, name);
  return sendSuccess(res, data);
}

async function getGatewayYaml(req, res) {
  const { namespace, name } = req.validatedParams;
  const data = await yamlService.getResourceYaml('gateways', { namespace, name });
  return sendSuccess(res, data);
}

async function getGatewayClasses(_req, res) {
  const data = await gatewayService.listGatewayClasses();
  return sendList(res, data);
}

async function getGatewayClassDetails(req, res) {
  const { name } = req.validatedParams;
  const data = await gatewayService.getGatewayClassDetails(name);
  return sendSuccess(res, data);
}

async function getGatewayClassYaml(req, res) {
  const { name } = req.validatedParams;
  const data = await yamlService.getResourceYaml('gatewayclasses', { name });
  return sendSuccess(res, data);
}

async function getHttpRoutes(req, res) {
  const { namespace } = req.validatedQuery || {};
  const data = await gatewayService.listHttpRoutes(namespace);
  return sendList(res, data, namespace ? { namespace } : {});
}

async function getHttpRouteDetails(req, res) {
  const { namespace, name } = req.validatedParams;
  const data = await gatewayService.getHttpRouteDetails(namespace, name);
  return sendSuccess(res, data);
}

async function getHttpRouteYaml(req, res) {
  const { namespace, name } = req.validatedParams;
  const data = await yamlService.getResourceYaml('httproutes', { namespace, name });
  return sendSuccess(res, data);
}

async function getReferenceGrants(req, res) {
  const { namespace } = req.validatedQuery || {};
  const data = await gatewayService.listReferenceGrants(namespace);
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

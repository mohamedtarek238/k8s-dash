const crdsService = require('../services/kubernetes/crds.service');
const yamlService = require('../services/kubernetes/yaml.service');
const { sendSuccess, sendList } = require('../utils/response');

async function getCRDs(req, res) {
  const { group, search } = req.validatedQuery || {};
  let data = await crdsService.listCRDs(req.k8sClients, req.clusterId);

  if (group) {
    data = data.filter((c) => c.group.toLowerCase() === group.toLowerCase());
  }

  if (search) {
    const q = search.toLowerCase();
    data = data.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.kind.toLowerCase().includes(q) ||
        c.group.toLowerCase().includes(q) ||
        (c.operator?.name && c.operator.name.toLowerCase().includes(q)) ||
        c.shortNames.some((sn) => sn.toLowerCase().includes(q))
    );
  }

  return sendList(res, data, {
    total: data.length,
    ...(group ? { group } : {}),
  });
}

async function getCRDByName(req, res) {
  const { name } = req.validatedParams;
  const data = await crdsService.getCRDDetails(name, req.k8sClients);
  return sendSuccess(res, data);
}

async function getCRDByCoordinates(req, res) {
  const { group, version, plural } = req.validatedParams;
  const data = await crdsService.getCRDByGroupVersionPlural(group, version, plural, req.k8sClients);
  return sendSuccess(res, data);
}

async function getCRDYaml(req, res) {
  const { name } = req.validatedParams;
  const data = await yamlService.getResourceYaml('crd', { name }, req.k8sClients);
  return sendSuccess(res, data);
}

async function getOperatorsSummary(req, res) {
  const data = await crdsService.getOperatorsSummary(req.k8sClients, req.clusterId);
  return sendList(res, data, { total: data.length });
}

async function getCustomResources(req, res) {
  const { group, version, plural } = req.validatedParams;
  const { namespace, scope } = req.validatedQuery || {};

  const data = await crdsService.listCustomResources(
    { group, version, plural, scope, namespace },
    req.k8sClients
  );

  return sendList(res, data, {
    group,
    version,
    plural,
    ...(namespace ? { namespace } : {}),
  });
}

async function getNamespacedCustomResourceDetails(req, res) {
  const { group, version, plural, namespace, name } = req.validatedParams;
  const data = await crdsService.getCustomResourceDetails(
    { group, version, plural, scope: 'Namespaced', namespace, name },
    req.k8sClients
  );
  return sendSuccess(res, data);
}

async function getClusterCustomResourceDetails(req, res) {
  const { group, version, plural, name } = req.validatedParams;
  const data = await crdsService.getCustomResourceDetails(
    { group, version, plural, scope: 'Cluster', name },
    req.k8sClients
  );
  return sendSuccess(res, data);
}

async function getNamespacedCustomResourceYaml(req, res) {
  const { group, version, plural, namespace, name } = req.validatedParams;
  const data = await yamlService.getCustomResourceYaml(
    { group, version, plural, scope: 'Namespaced', namespace, name },
    req.k8sClients
  );
  return sendSuccess(res, data);
}

async function getClusterCustomResourceYaml(req, res) {
  const { group, version, plural, name } = req.validatedParams;
  const data = await yamlService.getCustomResourceYaml(
    { group, version, plural, scope: 'Cluster', name },
    req.k8sClients
  );
  return sendSuccess(res, data);
}

module.exports = {
  getCRDs,
  getCRDByName,
  getCRDByCoordinates,
  getCRDYaml,
  getOperatorsSummary,
  getCustomResources,
  getNamespacedCustomResourceDetails,
  getClusterCustomResourceDetails,
  getNamespacedCustomResourceYaml,
  getClusterCustomResourceYaml,
};

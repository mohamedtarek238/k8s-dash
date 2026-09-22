const rbacService = require('../services/kubernetes/rbac.service');
const yamlService = require('../services/kubernetes/yaml.service');
const { sendSuccess, sendList } = require('../utils/response');

async function getRBACOverview(req, res) {
  const data = await rbacService.getRBACOverview(req.k8sClients);
  return sendSuccess(res, data);
}

async function getRBACAnalysis(req, res) {
  const data = await rbacService.getRBACAnalysis(req.k8sClients);
  return sendSuccess(res, data);
}

// ---------------------------------------------------------------------------
// Service Accounts
// ---------------------------------------------------------------------------

async function getServiceAccounts(req, res) {
  const { namespace, search } = req.validatedQuery || {};
  let data = await rbacService.listServiceAccounts(namespace, req.k8sClients);

  if (search) {
    const q = search.toLowerCase();
    data = data.filter(
      (sa) => sa.name.toLowerCase().includes(q) || sa.namespace.toLowerCase().includes(q)
    );
  }

  return sendList(res, data, {
    total: data.length,
    ...(namespace ? { namespace } : {}),
  });
}

async function getServiceAccountDetails(req, res) {
  const { namespace, name } = req.validatedParams;
  const { includeRelated, includeEvents } = req.validatedQuery || {};
  const data = await rbacService.getServiceAccountDetails(namespace, name, req.k8sClients, {
    includeRelated,
    includeEvents,
  });
  return sendSuccess(res, data);
}

async function getServiceAccountYaml(req, res) {
  const { namespace, name } = req.validatedParams;
  const data = await yamlService.getResourceYaml('serviceaccounts', { namespace, name }, req.k8sClients);
  return sendSuccess(res, data);
}

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

async function getRoles(req, res) {
  const { namespace, search } = req.validatedQuery || {};
  let data = await rbacService.listRoles(namespace, req.k8sClients);

  if (search) {
    const q = search.toLowerCase();
    data = data.filter(
      (role) => role.name.toLowerCase().includes(q) || role.namespace.toLowerCase().includes(q)
    );
  }

  return sendList(res, data, {
    total: data.length,
    ...(namespace ? { namespace } : {}),
  });
}

async function getRoleDetails(req, res) {
  const { namespace, name } = req.validatedParams;
  const { includeRelated, includeEvents } = req.validatedQuery || {};
  const data = await rbacService.getRoleDetails(namespace, name, req.k8sClients, {
    includeRelated,
    includeEvents,
  });
  return sendSuccess(res, data);
}

async function getRoleYaml(req, res) {
  const { namespace, name } = req.validatedParams;
  const data = await yamlService.getResourceYaml('roles', { namespace, name }, req.k8sClients);
  return sendSuccess(res, data);
}

// ---------------------------------------------------------------------------
// Role Bindings
// ---------------------------------------------------------------------------

async function getRoleBindings(req, res) {
  const { namespace, search } = req.validatedQuery || {};
  let data = await rbacService.listRoleBindings(namespace, req.k8sClients);

  if (search) {
    const q = search.toLowerCase();
    data = data.filter(
      (rb) =>
        rb.name.toLowerCase().includes(q) ||
        rb.namespace.toLowerCase().includes(q) ||
        rb.roleRef.name.toLowerCase().includes(q) ||
        rb.subjects.some((s) => s.name.toLowerCase().includes(q))
    );
  }

  return sendList(res, data, {
    total: data.length,
    ...(namespace ? { namespace } : {}),
  });
}

async function getRoleBindingDetails(req, res) {
  const { namespace, name } = req.validatedParams;
  const { includeRelated, includeEvents } = req.validatedQuery || {};
  const data = await rbacService.getRoleBindingDetails(namespace, name, req.k8sClients, {
    includeRelated,
    includeEvents,
  });
  return sendSuccess(res, data);
}

async function getRoleBindingYaml(req, res) {
  const { namespace, name } = req.validatedParams;
  const data = await yamlService.getResourceYaml('rolebindings', { namespace, name }, req.k8sClients);
  return sendSuccess(res, data);
}

// ---------------------------------------------------------------------------
// Cluster Roles
// ---------------------------------------------------------------------------

async function getClusterRoles(req, res) {
  const { search } = req.validatedQuery || {};
  let data = await rbacService.listClusterRoles(req.k8sClients);

  if (search) {
    const q = search.toLowerCase();
    data = data.filter((cr) => cr.name.toLowerCase().includes(q));
  }

  return sendList(res, data, { total: data.length });
}

async function getClusterRoleDetails(req, res) {
  const { name } = req.validatedParams;
  const { includeRelated } = req.validatedQuery || {};
  const data = await rbacService.getClusterRoleDetails(name, req.k8sClients, { includeRelated });
  return sendSuccess(res, data);
}

async function getClusterRoleYaml(req, res) {
  const { name } = req.validatedParams;
  const data = await yamlService.getResourceYaml('clusterroles', { name }, req.k8sClients);
  return sendSuccess(res, data);
}

// ---------------------------------------------------------------------------
// Cluster Role Bindings
// ---------------------------------------------------------------------------

async function getClusterRoleBindings(req, res) {
  const { search } = req.validatedQuery || {};
  let data = await rbacService.listClusterRoleBindings(req.k8sClients);

  if (search) {
    const q = search.toLowerCase();
    data = data.filter(
      (crb) =>
        crb.name.toLowerCase().includes(q) ||
        crb.roleRef.name.toLowerCase().includes(q) ||
        crb.subjects.some((s) => s.name.toLowerCase().includes(q))
    );
  }

  return sendList(res, data, { total: data.length });
}

async function getClusterRoleBindingDetails(req, res) {
  const { name } = req.validatedParams;
  const { includeRelated } = req.validatedQuery || {};
  const data = await rbacService.getClusterRoleBindingDetails(name, req.k8sClients, {
    includeRelated,
  });
  return sendSuccess(res, data);
}

async function getClusterRoleBindingYaml(req, res) {
  const { name } = req.validatedParams;
  const data = await yamlService.getResourceYaml('clusterrolebindings', { name }, req.k8sClients);
  return sendSuccess(res, data);
}

module.exports = {
  getRBACOverview,
  getRBACAnalysis,
  getServiceAccounts,
  getServiceAccountDetails,
  getServiceAccountYaml,
  getRoles,
  getRoleDetails,
  getRoleYaml,
  getRoleBindings,
  getRoleBindingDetails,
  getRoleBindingYaml,
  getClusterRoles,
  getClusterRoleDetails,
  getClusterRoleYaml,
  getClusterRoleBindings,
  getClusterRoleBindingDetails,
  getClusterRoleBindingYaml,
};

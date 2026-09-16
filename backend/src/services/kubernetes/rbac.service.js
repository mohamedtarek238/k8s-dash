const { getResponseBody, calculateAge } = require('../../utils/k8sHelpers');
const eventsService = require('./events.service');

// ---------------------------------------------------------------------------
// Mapping Helpers
// ---------------------------------------------------------------------------

function mapServiceAccountSummary(sa) {
  return {
    name: sa.metadata?.name || '',
    namespace: sa.metadata?.namespace || 'default',
    secretsCount: (sa.secrets || []).length,
    imagePullSecretsCount: (sa.imagePullSecrets || []).length,
    automountServiceAccountToken: sa.automountServiceAccountToken !== false,
    creationTimestamp: sa.metadata?.creationTimestamp || null,
    age: calculateAge(sa.metadata?.creationTimestamp),
    labels: sa.metadata?.labels || {},
    annotations: sa.metadata?.annotations || {},
  };
}

function mapRule(rule) {
  return {
    verbs: rule.verbs || [],
    apiGroups: rule.apiGroups || [],
    resources: rule.resources || [],
    resourceNames: rule.resourceNames || [],
    nonResourceURLs: rule.nonResourceURLs || [],
  };
}

function mapRoleSummary(role) {
  const rules = (role.rules || []).map(mapRule);
  return {
    name: role.metadata?.name || '',
    namespace: role.metadata?.namespace || 'default',
    rulesCount: rules.length,
    rules,
    creationTimestamp: role.metadata?.creationTimestamp || null,
    age: calculateAge(role.metadata?.creationTimestamp),
    labels: role.metadata?.labels || {},
    annotations: role.metadata?.annotations || {},
  };
}

function mapClusterRoleSummary(cr) {
  const rules = (cr.rules || []).map(mapRule);
  const isSystem = Boolean(cr.metadata?.name && cr.metadata.name.startsWith('system:'));
  return {
    name: cr.metadata?.name || '',
    rulesCount: rules.length,
    rules,
    aggregationRule: cr.aggregationRule || null,
    isSystem,
    creationTimestamp: cr.metadata?.creationTimestamp || null,
    age: calculateAge(cr.metadata?.creationTimestamp),
    labels: cr.metadata?.labels || {},
    annotations: cr.metadata?.annotations || {},
  };
}

function mapSubject(sub) {
  return {
    kind: sub.kind || 'Unknown',
    name: sub.name || '',
    namespace: sub.namespace || null,
    apiGroup: sub.apiGroup || '',
  };
}

function mapRoleRef(ref) {
  return {
    kind: ref?.kind || 'Role',
    name: ref?.name || '',
    apiGroup: ref?.apiGroup || 'rbac.authorization.k8s.io',
  };
}

function mapRoleBindingSummary(rb) {
  return {
    name: rb.metadata?.name || '',
    namespace: rb.metadata?.namespace || 'default',
    roleRef: mapRoleRef(rb.roleRef),
    subjects: (rb.subjects || []).map(mapSubject),
    subjectsCount: (rb.subjects || []).length,
    creationTimestamp: rb.metadata?.creationTimestamp || null,
    age: calculateAge(rb.metadata?.creationTimestamp),
    labels: rb.metadata?.labels || {},
    annotations: rb.metadata?.annotations || {},
  };
}

function mapClusterRoleBindingSummary(crb) {
  return {
    name: crb.metadata?.name || '',
    roleRef: mapRoleRef(crb.roleRef),
    subjects: (crb.subjects || []).map(mapSubject),
    subjectsCount: (crb.subjects || []).length,
    creationTimestamp: crb.metadata?.creationTimestamp || null,
    age: calculateAge(crb.metadata?.creationTimestamp),
    labels: crb.metadata?.labels || {},
    annotations: crb.metadata?.annotations || {},
  };
}

// ---------------------------------------------------------------------------
// RBAC Overview Service
// ---------------------------------------------------------------------------

async function getRBACOverview(clients) {
  const { coreV1Api, rbacAuthorizationV1Api } = clients;

  const [saRes, rolesRes, rbRes, crRes, crbRes] = await Promise.allSettled([
    coreV1Api.listServiceAccountForAllNamespaces(),
    rbacAuthorizationV1Api.listRoleForAllNamespaces(),
    rbacAuthorizationV1Api.listRoleBindingForAllNamespaces(),
    rbacAuthorizationV1Api.listClusterRole(),
    rbacAuthorizationV1Api.listClusterRoleBinding(),
  ]);

  const sas = saRes.status === 'fulfilled' ? (getResponseBody(saRes.value).items || []).map(mapServiceAccountSummary) : [];
  const roles = rolesRes.status === 'fulfilled' ? (getResponseBody(rolesRes.value).items || []).map(mapRoleSummary) : [];
  const rbs = rbRes.status === 'fulfilled' ? (getResponseBody(rbRes.value).items || []).map(mapRoleBindingSummary) : [];
  const crs = crRes.status === 'fulfilled' ? (getResponseBody(crRes.value).items || []).map(mapClusterRoleSummary) : [];
  const crbs = crbRes.status === 'fulfilled' ? (getResponseBody(crbRes.value).items || []).map(mapClusterRoleBindingSummary) : [];

  // Namespaces with RBAC
  const namespacesWithRoles = new Set(roles.map((r) => r.namespace));
  const namespacesWithBindings = new Set(rbs.map((r) => r.namespace));
  const namespacesWithSAs = new Set(sas.map((s) => s.namespace));
  const allNamespaces = new Set([...namespacesWithRoles, ...namespacesWithBindings, ...namespacesWithSAs]);

  // System vs User breakdown
  const systemClusterRoles = crs.filter((c) => c.isSystem).length;
  const userClusterRoles = crs.length - systemClusterRoles;

  const systemClusterRoleBindings = crbs.filter((c) => c.name.startsWith('system:')).length;
  const userClusterRoleBindings = crbs.length - systemClusterRoleBindings;

  // Subjects breakdown
  let totalSASubjects = 0;
  let totalUserSubjects = 0;
  let totalGroupSubjects = 0;

  const countSubjects = (list) => {
    for (const item of list) {
      for (const sub of item.subjects) {
        if (sub.kind === 'ServiceAccount') totalSASubjects++;
        else if (sub.kind === 'User') totalUserSubjects++;
        else if (sub.kind === 'Group') totalGroupSubjects++;
      }
    }
  };

  countSubjects(rbs);
  countSubjects(crbs);

  return {
    serviceAccounts: {
      total: sas.length,
      namespacesCount: namespacesWithSAs.size,
    },
    roles: {
      total: roles.length,
      namespacesCount: namespacesWithRoles.size,
    },
    roleBindings: {
      total: rbs.length,
      namespacesCount: namespacesWithBindings.size,
      referencingRoles: rbs.filter((r) => r.roleRef.kind === 'Role').length,
      referencingClusterRoles: rbs.filter((r) => r.roleRef.kind === 'ClusterRole').length,
    },
    clusterRoles: {
      total: crs.length,
      system: systemClusterRoles,
      userCreated: userClusterRoles,
    },
    clusterRoleBindings: {
      total: crbs.length,
      system: systemClusterRoleBindings,
      userCreated: userClusterRoleBindings,
    },
    subjectsBreakdown: {
      serviceAccounts: totalSASubjects,
      users: totalUserSubjects,
      groups: totalGroupSubjects,
    },
    namespacesCount: allNamespaces.size,
  };
}

// ---------------------------------------------------------------------------
// Service Accounts
// ---------------------------------------------------------------------------

async function listServiceAccounts(namespace, clients) {
  const { coreV1Api } = clients;
  let res;
  if (namespace) {
    res = await coreV1Api.listNamespacedServiceAccount({ namespace });
  } else {
    res = await coreV1Api.listServiceAccountForAllNamespaces();
  }
  const items = getResponseBody(res).items || [];
  return items.map(mapServiceAccountSummary);
}

async function getServiceAccountDetails(namespace, name, clients, { includeRelated = false, includeEvents = false } = {}) {
  const { coreV1Api, rbacAuthorizationV1Api } = clients;
  const res = await coreV1Api.readNamespacedServiceAccount({ namespace, name });
  const raw = getResponseBody(res);
  const summary = mapServiceAccountSummary(raw);

  let related = null;
  let events = [];

  if (includeRelated) {
    related = {
      roleBindings: [],
      clusterRoleBindings: [],
      resolvedRoles: [],
    };

    try {
      const [rbsRes, crbsRes] = await Promise.all([
        rbacAuthorizationV1Api.listNamespacedRoleBinding({ namespace }),
        rbacAuthorizationV1Api.listClusterRoleBinding(),
      ]);

      const allRBs = (getResponseBody(rbsRes).items || []).map(mapRoleBindingSummary);
      const allCRBs = (getResponseBody(crbsRes).items || []).map(mapClusterRoleBindingSummary);

      // RoleBindings binding this ServiceAccount
      related.roleBindings = allRBs.filter((rb) =>
        rb.subjects.some(
          (s) =>
            s.kind === 'ServiceAccount' &&
            s.name === name &&
            (s.namespace === namespace || !s.namespace)
        )
      );

      // ClusterRoleBindings binding this ServiceAccount
      related.clusterRoleBindings = allCRBs.filter((crb) =>
        crb.subjects.some(
          (s) =>
            s.kind === 'ServiceAccount' &&
            s.name === name &&
            (s.namespace === namespace || !s.namespace)
        )
      );

      // Fetch referenced roles details where possible
      const rolePromises = [];
      const roleRefKeys = new Set();

      for (const rb of related.roleBindings) {
        const key = `${rb.roleRef.kind}:${rb.roleRef.name}`;
        if (!roleRefKeys.has(key)) {
          roleRefKeys.add(key);
          if (rb.roleRef.kind === 'Role') {
            rolePromises.push(
              rbacAuthorizationV1Api
                .readNamespacedRole({ namespace, name: rb.roleRef.name })
                .then((r) => ({ bindingType: 'RoleBinding', bindingName: rb.name, ...mapRoleSummary(getResponseBody(r)) }))
                .catch(() => null)
            );
          } else if (rb.roleRef.kind === 'ClusterRole') {
            rolePromises.push(
              rbacAuthorizationV1Api
                .readClusterRole({ name: rb.roleRef.name })
                .then((r) => ({ bindingType: 'RoleBinding (ClusterRole)', bindingName: rb.name, ...mapClusterRoleSummary(getResponseBody(r)) }))
                .catch(() => null)
            );
          }
        }
      }

      for (const crb of related.clusterRoleBindings) {
        const key = `ClusterRole:${crb.roleRef.name}`;
        if (!roleRefKeys.has(key)) {
          roleRefKeys.add(key);
          rolePromises.push(
            rbacAuthorizationV1Api
              .readClusterRole({ name: crb.roleRef.name })
              .then((r) => ({ bindingType: 'ClusterRoleBinding', bindingName: crb.name, ...mapClusterRoleSummary(getResponseBody(r)) }))
              .catch(() => null)
          );
        }
      }

      const resolved = await Promise.all(rolePromises);
      related.resolvedRoles = resolved.filter(Boolean);
    } catch (_err) {}
  }

  if (includeEvents) {
    try {
      events = await eventsService.getResourceEvents(
        { kind: 'ServiceAccount', namespace, name, uid: raw.metadata?.uid },
        clients
      );
    } catch (_err) {}
  }

  return {
    ...summary,
    secrets: raw.secrets || [],
    imagePullSecrets: raw.imagePullSecrets || [],
    related,
    events,
  };
}

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

async function listRoles(namespace, clients) {
  const { rbacAuthorizationV1Api } = clients;
  let res;
  if (namespace) {
    res = await rbacAuthorizationV1Api.listNamespacedRole({ namespace });
  } else {
    res = await rbacAuthorizationV1Api.listRoleForAllNamespaces();
  }
  const items = getResponseBody(res).items || [];
  return items.map(mapRoleSummary);
}

async function getRoleDetails(namespace, name, clients, { includeRelated = false, includeEvents = false } = {}) {
  const { rbacAuthorizationV1Api } = clients;
  const res = await rbacAuthorizationV1Api.readNamespacedRole({ namespace, name });
  const raw = getResponseBody(res);
  const summary = mapRoleSummary(raw);

  let related = null;
  let events = [];

  if (includeRelated) {
    related = {
      roleBindings: [],
      boundSubjects: [],
    };

    try {
      const rbsRes = await rbacAuthorizationV1Api.listNamespacedRoleBinding({ namespace });
      const allRBs = (getResponseBody(rbsRes).items || []).map(mapRoleBindingSummary);

      related.roleBindings = allRBs.filter(
        (rb) => rb.roleRef.kind === 'Role' && rb.roleRef.name === name
      );

      const subjectsMap = new Map();
      for (const rb of related.roleBindings) {
        for (const sub of rb.subjects) {
          const key = `${sub.kind}:${sub.namespace || ''}:${sub.name}`;
          if (!subjectsMap.has(key)) {
            subjectsMap.set(key, { ...sub, viaRoleBinding: rb.name });
          }
        }
      }
      related.boundSubjects = Array.from(subjectsMap.values());
    } catch (_err) {}
  }

  if (includeEvents) {
    try {
      events = await eventsService.getResourceEvents(
        { kind: 'Role', namespace, name, uid: raw.metadata?.uid },
        clients
      );
    } catch (_err) {}
  }

  return {
    ...summary,
    related,
    events,
  };
}

// ---------------------------------------------------------------------------
// Role Bindings
// ---------------------------------------------------------------------------

async function listRoleBindings(namespace, clients) {
  const { rbacAuthorizationV1Api } = clients;
  let res;
  if (namespace) {
    res = await rbacAuthorizationV1Api.listNamespacedRoleBinding({ namespace });
  } else {
    res = await rbacAuthorizationV1Api.listRoleBindingForAllNamespaces();
  }
  const items = getResponseBody(res).items || [];
  return items.map(mapRoleBindingSummary);
}

async function getRoleBindingDetails(namespace, name, clients, { includeRelated = false, includeEvents = false } = {}) {
  const { rbacAuthorizationV1Api } = clients;
  const res = await rbacAuthorizationV1Api.readNamespacedRoleBinding({ namespace, name });
  const raw = getResponseBody(res);
  const summary = mapRoleBindingSummary(raw);

  let related = null;
  let events = [];

  if (includeRelated) {
    related = {
      referencedRole: null,
      rules: [],
    };

    try {
      if (summary.roleRef.kind === 'Role') {
        const roleRes = await rbacAuthorizationV1Api.readNamespacedRole({
          namespace,
          name: summary.roleRef.name,
        });
        const roleData = mapRoleSummary(getResponseBody(roleRes));
        related.referencedRole = roleData;
        related.rules = roleData.rules;
      } else if (summary.roleRef.kind === 'ClusterRole') {
        const crRes = await rbacAuthorizationV1Api.readClusterRole({
          name: summary.roleRef.name,
        });
        const crData = mapClusterRoleSummary(getResponseBody(crRes));
        related.referencedRole = crData;
        related.rules = crData.rules;
      }
    } catch (_err) {}
  }

  if (includeEvents) {
    try {
      events = await eventsService.getResourceEvents(
        { kind: 'RoleBinding', namespace, name, uid: raw.metadata?.uid },
        clients
      );
    } catch (_err) {}
  }

  return {
    ...summary,
    related,
    events,
  };
}

// ---------------------------------------------------------------------------
// Cluster Roles
// ---------------------------------------------------------------------------

async function listClusterRoles(clients) {
  const { rbacAuthorizationV1Api } = clients;
  const res = await rbacAuthorizationV1Api.listClusterRole();
  const items = getResponseBody(res).items || [];
  return items.map(mapClusterRoleSummary);
}

async function getClusterRoleDetails(name, clients, { includeRelated = false } = {}) {
  const { rbacAuthorizationV1Api } = clients;
  const res = await rbacAuthorizationV1Api.readClusterRole({ name });
  const raw = getResponseBody(res);
  const summary = mapClusterRoleSummary(raw);

  let related = null;

  if (includeRelated) {
    related = {
      clusterRoleBindings: [],
      namespacedRoleBindings: [],
      boundSubjects: [],
    };

    try {
      const [crbsRes, rbsRes] = await Promise.all([
        rbacAuthorizationV1Api.listClusterRoleBinding(),
        rbacAuthorizationV1Api.listRoleBindingForAllNamespaces(),
      ]);

      const allCRBs = (getResponseBody(crbsRes).items || []).map(mapClusterRoleBindingSummary);
      const allRBs = (getResponseBody(rbsRes).items || []).map(mapRoleBindingSummary);

      related.clusterRoleBindings = allCRBs.filter(
        (crb) => crb.roleRef.kind === 'ClusterRole' && crb.roleRef.name === name
      );

      related.namespacedRoleBindings = allRBs.filter(
        (rb) => rb.roleRef.kind === 'ClusterRole' && rb.roleRef.name === name
      );

      const subjectsMap = new Map();
      for (const crb of related.clusterRoleBindings) {
        for (const sub of crb.subjects) {
          const key = `ClusterRoleBinding:${sub.kind}:${sub.namespace || ''}:${sub.name}`;
          if (!subjectsMap.has(key)) {
            subjectsMap.set(key, { ...sub, bindingType: 'ClusterRoleBinding', bindingName: crb.name });
          }
        }
      }
      for (const rb of related.namespacedRoleBindings) {
        for (const sub of rb.subjects) {
          const key = `RoleBinding:${rb.namespace}:${sub.kind}:${sub.namespace || ''}:${sub.name}`;
          if (!subjectsMap.has(key)) {
            subjectsMap.set(key, { ...sub, bindingType: `RoleBinding (${rb.namespace})`, bindingName: rb.name });
          }
        }
      }
      related.boundSubjects = Array.from(subjectsMap.values());
    } catch (_err) {}
  }

  return {
    ...summary,
    related,
  };
}

// ---------------------------------------------------------------------------
// Cluster Role Bindings
// ---------------------------------------------------------------------------

async function listClusterRoleBindings(clients) {
  const { rbacAuthorizationV1Api } = clients;
  const res = await rbacAuthorizationV1Api.listClusterRoleBinding();
  const items = getResponseBody(res).items || [];
  return items.map(mapClusterRoleBindingSummary);
}

async function getClusterRoleBindingDetails(name, clients, { includeRelated = false } = {}) {
  const { rbacAuthorizationV1Api } = clients;
  const res = await rbacAuthorizationV1Api.readClusterRoleBinding({ name });
  const raw = getResponseBody(res);
  const summary = mapClusterRoleBindingSummary(raw);

  let related = null;

  if (includeRelated) {
    related = {
      referencedClusterRole: null,
      rules: [],
    };

    try {
      if (summary.roleRef.name) {
        const crRes = await rbacAuthorizationV1Api.readClusterRole({
          name: summary.roleRef.name,
        });
        const crData = mapClusterRoleSummary(getResponseBody(crRes));
        related.referencedClusterRole = crData;
        related.rules = crData.rules;
      }
    } catch (_err) {}
  }

  return {
    ...summary,
    related,
  };
}

module.exports = {
  getRBACOverview,
  listServiceAccounts,
  getServiceAccountDetails,
  listRoles,
  getRoleDetails,
  listRoleBindings,
  getRoleBindingDetails,
  listClusterRoles,
  getClusterRoleDetails,
  listClusterRoleBindings,
  getClusterRoleBindingDetails,
};

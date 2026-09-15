const { z } = require('zod');

const namespaceQuerySchema = z.object({
  namespace: z.string().min(1).optional(),
});

const podLogsQuerySchema = z.object({
  container: z.string().min(1).optional(),
  tailLines: z.coerce.number().int().positive().max(10000).optional(),
  previous: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) => val === 'true'),
});

const podParamsSchema = z.object({
  namespace: z.string().min(1),
  podName: z.string().min(1),
});

const deploymentParamsSchema = z.object({
  namespace: z.string().trim().min(1),
  name: z.string().trim().min(1),
});

const nameParamSchema = z.object({
  name: z.string().trim().min(1),
});

const namespacedNameParamsSchema = deploymentParamsSchema;

const detailQuerySchema = z.object({
  includeRelated: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) => val === 'true'),
  includeEvents: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) => val === 'true'),
});

function validate(schema, source = 'query') {
  return (req, res, next) => {
    const data = source === 'params' ? req.params : req.query;
    const result = schema.safeParse(data);

    if (!result.success) {
      result.error.name = 'ZodError';
      return next(result.error);
    }

    if (source === 'params') {
      req.validatedParams = result.data;
    } else {
      req.validatedQuery = result.data;
    }

    return next();
  };
}

const ingressQuerySchema = z.object({
  namespace: z.string().min(1).optional(),
  includeKong: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) => val === 'true'),
});

const ingressDetailQuerySchema = z.object({
  includeRelated: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) => val === 'true'),
  includeEvents: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) => val === 'true'),
  includeKong: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) => val !== 'false'),
});

const resourceTypeSchema = z.enum([
  'pods', 'pod',
  'deployments', 'deployment',
  'services', 'service',
  'ingresses', 'ingress',
  'statefulsets', 'statefulset',
  'daemonsets', 'daemonset',
  'namespaces', 'namespace',
  'nodes', 'node',
  'httproutes', 'httproute',
  'gateways', 'gateway',
  'gatewayclasses', 'gatewayclass',
  'kongplugins', 'kongplugin',
  'crds', 'crd',
  'customresourcedefinition', 'customresourcedefinitions',
  'persistentvolumes', 'persistentvolume', 'pvs', 'pv',
  'persistentvolumeclaims', 'persistentvolumeclaim', 'pvcs', 'pvc',
  'storageclasses', 'storageclass', 'scs', 'sc',
  'csidrivers', 'csidriver',
  'volumesnapshots', 'volumesnapshot',
  'volumesnapshotclasses', 'volumesnapshotclass',
  'volumesnapshotcontents', 'volumesnapshotcontent',
]);

const genericNamespacedResourceParamsSchema = z.object({
  resourceType: resourceTypeSchema,
  namespace: z.string().trim().min(1),
  name: z.string().trim().min(1),
});

const genericClusterResourceParamsSchema = z.object({
  resourceType: resourceTypeSchema,
  name: z.string().trim().min(1),
});

const storageQuerySchema = z.object({
  namespace: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).optional(),
});

const crdQuerySchema = z.object({
  group: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).optional(),
});

const crdCoordinatesParamsSchema = z.object({
  group: z.string().trim().min(1),
  version: z.string().trim().min(1),
  plural: z.string().trim().min(1),
});

const customResourceListQuerySchema = z.object({
  namespace: z.string().trim().min(1).optional(),
  scope: z.enum(['Namespaced', 'Cluster', 'namespaced', 'cluster']).optional(),
});

const customResourceNamespacedParamsSchema = z.object({
  group: z.string().trim().min(1),
  version: z.string().trim().min(1),
  plural: z.string().trim().min(1),
  namespace: z.string().trim().min(1),
  name: z.string().trim().min(1),
});

const customResourceClusterParamsSchema = z.object({
  group: z.string().trim().min(1),
  version: z.string().trim().min(1),
  plural: z.string().trim().min(1),
  name: z.string().trim().min(1),
});

module.exports = {
  namespaceQuerySchema,
  podLogsQuerySchema,
  podParamsSchema,
  deploymentParamsSchema,
  nameParamSchema,
  namespacedNameParamsSchema,
  detailQuerySchema,
  ingressQuerySchema,
  ingressDetailQuerySchema,
  resourceTypeSchema,
  genericNamespacedResourceParamsSchema,
  genericClusterResourceParamsSchema,
  storageQuerySchema,
  crdQuerySchema,
  crdCoordinatesParamsSchema,
  customResourceListQuerySchema,
  customResourceNamespacedParamsSchema,
  customResourceClusterParamsSchema,
  validate,
};


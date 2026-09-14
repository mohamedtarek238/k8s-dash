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

module.exports = {
  namespaceQuerySchema,
  podLogsQuerySchema,
  podParamsSchema,
  deploymentParamsSchema,
  nameParamSchema,
  namespacedNameParamsSchema,
  detailQuerySchema,
  validate,
};


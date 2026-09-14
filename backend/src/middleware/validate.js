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
  namespace: z.string().min(1),
  name: z.string().min(1),
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
  validate,
};

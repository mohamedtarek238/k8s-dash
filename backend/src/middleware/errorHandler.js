const { sendError } = require('../utils/response');

function isKubernetesApiError(err) {
  return (
    err &&
    (err.statusCode !== undefined ||
      err.response?.statusCode !== undefined ||
      err.body !== undefined ||
      err.response?.body !== undefined)
  );
}

function extractKubernetesError(err) {
  const statusCode = err.statusCode || err.response?.statusCode || 500;
  const body = err.body || err.response?.body || {};

  let message = err.message || 'Unknown Kubernetes API error';
  if (typeof body === 'string') {
    message = body;
  } else if (body.message) {
    message = body.message;
  } else if (body.reason) {
    message = body.reason;
  }

  return {
    statusCode,
    message,
    details: typeof body === 'object' ? body : { raw: body },
  };
}

function notFoundHandler(req, res) {
  return sendError(res, 404, 'Not Found', `Route ${req.method} ${req.originalUrl} not found`);
}

function errorHandler(err, req, res, _next) {
  if (err.name === 'ZodError') {
    return sendError(res, 400, 'Validation Error', 'Invalid request parameters', {
      issues: err.errors,
    });
  }

  if (isKubernetesApiError(err)) {
    const { statusCode, message, details } = extractKubernetesError(err);
    const httpStatus = statusCode >= 400 && statusCode < 600 ? statusCode : 502;
    return sendError(res, httpStatus, 'Kubernetes API error', message, details);
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const isConfigError =
    err.message?.includes('kubeconfig') ||
    err.message?.includes('Kubeconfig') ||
    err.message?.includes('No active cluster');

  if (isConfigError) {
    return sendError(res, 503, 'Kubernetes configuration error', err.message);
  }

  const statusCode = err.statusCode || 500;

  return sendError(
    res,
    statusCode,
    err.name || 'Internal Server Error',
    err.message || 'An unexpected error occurred',
    isProduction ? {} : { stack: err.stack }
  );
}

module.exports = {
  notFoundHandler,
  errorHandler,
};

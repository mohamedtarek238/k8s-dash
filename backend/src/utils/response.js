function sendSuccess(res, data, statusCode = 200, meta = null) {
  const payload = {
    success: true,
    data,
  };
  if (meta && typeof meta === 'object') {
    payload.meta = meta;
  }
  return res.status(statusCode).json(payload);
}

function sendList(res, data, meta = {}) {
  return res.status(200).json({
    success: true,
    data,
    meta: {
      count: data.length,
      ...meta,
    },
  });
}

function sendError(res, statusCode, error, message, details = {}) {
  return res.status(statusCode).json({
    success: false,
    error,
    message,
    details,
  });
}

module.exports = {
  sendSuccess,
  sendList,
  sendError,
};

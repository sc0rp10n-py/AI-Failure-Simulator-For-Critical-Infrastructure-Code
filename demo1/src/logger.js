const { randomUUID } = require('crypto');

function createLogger(service) {
  function log(level, message, meta = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      service,
      level,
      requestId: meta.requestId ?? null,
      message,
      ...meta,
    };

    delete entry.body;
    process.stdout.write(`${JSON.stringify(entry)}\n`);
  }

  return {
    info: (message, meta) => log('info', message, meta),
    warn: (message, meta) => log('warn', message, meta),
    error: (message, meta) => log('error', message, meta),
    child: (extraMeta = {}) => ({
      info: (message, meta = {}) => log('info', message, { ...extraMeta, ...meta }),
      warn: (message, meta = {}) => log('warn', message, { ...extraMeta, ...meta }),
      error: (message, meta = {}) => log('error', message, { ...extraMeta, ...meta }),
    }),
  };
}

function createRequestContext(req, res, next) {
  const requestId = req.header('x-request-id') || randomUUID();
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  next();
}

module.exports = {
  createLogger,
  createRequestContext,
};
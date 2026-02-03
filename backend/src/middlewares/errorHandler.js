module.exports = (err, req, res, next) => {
  console.error('Unhandled error:', err);
  const code = err && err.code ? String(err.code) : undefined;
  const isProd = String(process.env.NODE_ENV || '').toLowerCase() === 'production';

  // Avoid leaking internal errors in production.
  // Still allow a small set of safe configuration errors to bubble up for operability.
  const safeProdMessageCodes = new Set(['ENV_VALIDATION_ERROR']);
  const includeMessage = !isProd || (code && safeProdMessageCodes.has(code));

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    code,
    ...(includeMessage ? { message: err && err.message ? err.message : 'Unknown error' } : {})
  });
};

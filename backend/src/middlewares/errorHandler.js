module.exports = (err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err && err.message ? err.message : 'Unknown error'
  });
};

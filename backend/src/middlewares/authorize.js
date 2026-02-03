function authorize(roles = []) {
  const allowed = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, error: 'Unauthorized' });
    if (allowed.length && !allowed.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Forbidden', userRole: req.user.role, allowedRoles: allowed });
    }
    return next();
  };
}

module.exports = authorize;

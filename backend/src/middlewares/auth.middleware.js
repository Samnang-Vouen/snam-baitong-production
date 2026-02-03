const jwt = require("jsonwebtoken");
const { isTokenBlacklisted } = require('../services/jwtBlacklist.service');
const { getJwtConfig } = require('../services/auth.service');

async function authenticate(req, res, next) {
  // Try to get token from cookie first, then fall back to Authorization header
  let token = req.cookies.token;
  
  if (!token) {
    const authHeader = req.headers.authorization || "";
    token = authHeader.startsWith("Bearer ")
      ? authHeader.substring("Bearer ".length)
      : null;
  }

  if (!token) {
    return res
      .status(401)
      .json({ success: false, error: "Missing authorization token" });
  }

  try {
    const { secret } = getJwtConfig();
    const payload = jwt.verify(token, secret);
    
    // Check if token is blacklisted
    if (payload.jti) {
      const blacklisted = await isTokenBlacklisted(payload.jti);
      if (blacklisted) {
        return res.status(401).json({ success: false, error: "Token has been revoked" });
      }
    }
    
    req.user = {
      id: Number(payload.sub),
      email: payload.email,
      role: payload.role,
      jti: payload.jti
    };
    next();
  } catch (err) {
    res
      .status(401)
      .json({
        success: false,
        error: "Invalid or expired token",
        message: err.message,
      });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    if (roles.length === 0 || roles.includes(req.user.role)) {
      return next();
    }
    return res
      .status(403)
      .json({ success: false, error: "Forbidden for this role" });
  };
}

module.exports = { authenticate, requireRole };

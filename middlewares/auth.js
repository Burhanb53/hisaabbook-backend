const mongoose = require('mongoose');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const { verifyAccessToken } = require('../utils/tokens');
const { runWithTenant } = require('../utils/tenantContext');

// Authenticates the request and binds every downstream DB query to the user's tenant.
exports.protect = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch (err) {
      const expired = err.name === 'TokenExpiredError';
      return res.status(401).json({
        success: false,
        error: expired ? 'Token expired' : 'Invalid token',
        code: expired ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID'
      });
    }

    const user = await User.findById(payload.sub);
    if (!user || !user.is_active) {
      return res.status(401).json({ success: false, error: 'Account not found or disabled' });
    }

    const tenant = await Tenant.findById(user.tenant);
    if (!tenant || tenant.status !== 'active') {
      return res.status(403).json({ success: false, error: 'Business account is suspended' });
    }

    req.user = user;
    req.tenant = tenant;
    runWithTenant(new mongoose.Types.ObjectId(user.tenant), () => next());
  } catch (error) {
    next(error);
  }
};

exports.requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, error: 'You do not have permission to do this' });
  }
  next();
};

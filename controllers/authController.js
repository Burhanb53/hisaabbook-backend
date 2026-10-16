const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const RefreshToken = require('../models/RefreshToken');
const tokens = require('../utils/tokens');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCRYPT_ROUNDS = 12;

const issueSession = async (user, req) => ({
  access_token: tokens.signAccessToken(user),
  refresh_token: await tokens.issueRefreshToken(user, req.get('user-agent')),
  token_type: 'Bearer'
});

const str = (v) => (typeof v === 'string' ? v.trim() : '');

// POST /api/auth/register  — creates a new business (tenant) and its owner
exports.register = async (req, res, next) => {
  try {
    const name = str(req.body.name);
    const email = str(req.body.email).toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const business_name = str(req.body.business_name);

    if (!name || !email || !password || !business_name) {
      return res.status(400).json({
        success: false,
        error: 'name, email, password and business_name are required'
      });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email address' });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
    }
    if (await User.exists({ email })) {
      return res.status(409).json({ success: false, error: 'Email is already registered' });
    }

    const tenant = await Tenant.create({
      name: business_name,
      owner_name: name,
      phone: str(req.body.phone),
      address: str(req.body.address)
    });

    let user;
    try {
      user = await User.create({
        tenant: tenant._id,
        name,
        email,
        phone: str(req.body.phone),
        password: await bcrypt.hash(password, BCRYPT_ROUNDS),
        role: 'owner'
      });
    } catch (err) {
      await Tenant.deleteOne({ _id: tenant._id }); // don't leave an orphan business
      throw err;
    }

    res.status(201).json({
      success: true,
      data: { user, business: tenant, ...(await issueSession(user, req)) }
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/login
exports.login = async (req, res, next) => {
  try {
    const email = str(req.body.email).toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'email and password are required' });
    }

    const user = await User.findOne({ email }).select('+password');
    // Same response for unknown email and wrong password
    const ok = user && (await bcrypt.compare(password, user.password));
    if (!ok || !user.is_active) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const business = await Tenant.findById(user.tenant);
    if (!business || business.status !== 'active') {
      return res.status(403).json({ success: false, error: 'Business account is suspended' });
    }

    user.last_login_at = new Date();
    await user.save();

    res.json({ success: true, data: { user, business, ...(await issueSession(user, req)) } });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/refresh  — exchanges a refresh token for a new pair (rotation)
exports.refresh = async (req, res, next) => {
  try {
    const { refresh_token } = req.body;
    if (typeof refresh_token !== 'string' || !refresh_token) {
      return res.status(400).json({ success: false, error: 'refresh_token is required' });
    }

    const stored = await tokens.consumeRefreshToken(refresh_token);
    if (!stored) {
      return res.status(401).json({ success: false, error: 'Invalid or expired refresh token' });
    }

    const user = await User.findById(stored.user);
    if (!user || !user.is_active) {
      return res.status(401).json({ success: false, error: 'Account not found or disabled' });
    }

    res.json({ success: true, data: await issueSession(user, req) });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/logout
exports.logout = async (req, res, next) => {
  try {
    if (typeof req.body.refresh_token === 'string') {
      await tokens.revokeRefreshToken(req.body.refresh_token);
    }
    res.json({ success: true, data: { message: 'Logged out' } });
  } catch (error) {
    next(error);
  }
};

// GET /api/auth/me
exports.me = (req, res) => {
  res.json({ success: true, data: { user: req.user, business: req.tenant } });
};

// POST /api/auth/change-password
exports.changePassword = async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;
    if (typeof current_password !== 'string' || typeof new_password !== 'string') {
      return res.status(400).json({ success: false, error: 'current_password and new_password are required' });
    }
    if (new_password.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!(await bcrypt.compare(current_password, user.password))) {
      return res.status(401).json({ success: false, error: 'Current password is incorrect' });
    }

    user.password = await bcrypt.hash(new_password, BCRYPT_ROUNDS);
    await user.save();
    await tokens.revokeAllForUser(user._id); // sign out every device

    res.json({ success: true, data: { message: 'Password updated. Please log in again.' } });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/auth/account  — owner permanently deletes the business and ALL its data
// (required by Google Play / App Store account-deletion policies)
exports.deleteAccount = async (req, res, next) => {
  try {
    const { password } = req.body;
    const user = await User.findById(req.user._id).select('+password');
    if (typeof password !== 'string' || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ success: false, error: 'Password is incorrect' });
    }

    const tenantId = req.user.tenant;
    const users = await User.find({ tenant: tenantId }).select('_id');
    await RefreshToken.deleteMany({ user: { $in: users.map((u) => u._id) } });

    // Business collections are scoped by the plugin to the current request's tenant.
    for (const name of ['Sale', 'Purchase', 'Transaction', 'Balance', 'Expense', 'Dealer']) {
      await mongoose.model(name).deleteMany({});
    }
    await User.deleteMany({ tenant: tenantId });
    await Tenant.deleteOne({ _id: tenantId });

    res.json({ success: true, data: { message: 'Account and all data deleted' } });
  } catch (error) {
    next(error);
  }
};

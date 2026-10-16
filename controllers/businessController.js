const bcrypt = require('bcryptjs');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const tokens = require('../utils/tokens');

const PROFILE_FIELDS = ['name', 'owner_name', 'phone', 'address', 'gstin', 'currency', 'timezone'];

// GET /api/business
exports.getBusiness = (req, res) => {
  res.json({ success: true, data: req.tenant });
};

// PUT /api/business  (owner)
exports.updateBusiness = async (req, res, next) => {
  try {
    const updates = {};
    for (const f of PROFILE_FIELDS) {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    }
    if (updates.name !== undefined && !String(updates.name).trim()) {
      return res.status(400).json({ success: false, error: 'Business name cannot be empty' });
    }
    const business = await Tenant.findByIdAndUpdate(req.user.tenant, updates, { new: true, runValidators: true });
    res.json({ success: true, data: business });
  } catch (error) {
    next(error);
  }
};

// GET /api/business/staff  (owner)
exports.listStaff = async (req, res, next) => {
  try {
    const users = await User.find({ tenant: req.user.tenant }).sort({ createdAt: 1 });
    res.json({ success: true, count: users.length, data: users });
  } catch (error) {
    next(error);
  }
};

// POST /api/business/staff  (owner) — add an employee login to this business
exports.addStaff = async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'name, email and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
    }
    if (await User.exists({ email })) {
      return res.status(409).json({ success: false, error: 'Email is already registered' });
    }

    const user = await User.create({
      tenant: req.user.tenant,
      name,
      email,
      phone: req.body.phone,
      password: await bcrypt.hash(password, 12),
      role: 'staff'
    });
    res.status(201).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/business/staff/:id  (owner) — enable/disable a staff login
exports.setStaffActive = async (req, res, next) => {
  try {
    const { is_active } = req.body;
    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ success: false, error: 'is_active (boolean) is required' });
    }
    const user = await User.findOne({ _id: req.params.id, tenant: req.user.tenant, role: 'staff' });
    if (!user) return res.status(404).json({ success: false, error: 'Staff member not found' });

    user.is_active = is_active;
    await user.save();
    if (!is_active) await tokens.revokeAllForUser(user._id);
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/business/staff/:id  (owner)
exports.removeStaff = async (req, res, next) => {
  try {
    const user = await User.findOneAndDelete({ _id: req.params.id, tenant: req.user.tenant, role: 'staff' });
    if (!user) return res.status(404).json({ success: false, error: 'Staff member not found' });
    await tokens.revokeAllForUser(user._id);
    res.json({ success: true, data: { message: 'Staff member removed' } });
  } catch (error) {
    next(error);
  }
};

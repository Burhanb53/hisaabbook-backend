const mongoose = require('mongoose');

// A tenant is one business (shop). All business data belongs to exactly one tenant.
const tenantSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  owner_name: { type: String, trim: true },
  phone: { type: String, trim: true },
  address: { type: String, trim: true },
  gstin: { type: String, trim: true },
  currency: { type: String, default: 'INR' },
  timezone: { type: String, default: 'Asia/Kolkata' },
  plan: { type: String, enum: ['free', 'pro'], default: 'free' },
  status: { type: String, enum: ['active', 'suspended'], default: 'active' }
}, { timestamps: true });

module.exports = mongoose.model('Tenant', tenantSchema);

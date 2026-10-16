/**
 * One-off migration: single-user data -> multi-tenant.
 *
 *   node scripts/migrate-to-multitenant.js <owner-email> <owner-password> "<Business Name>" ["<Owner Name>"]
 *
 * Creates a business + owner login, stamps every existing document with that
 * tenant, and replaces the old global-unique indexes with per-tenant ones.
 * Safe to re-run: only documents without a tenant are touched.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Tenant = require('../models/Tenant');
const User = require('../models/User');

const MODELS = ['Sale', 'Purchase', 'Transaction', 'Balance', 'Expense', 'Dealer'];
MODELS.forEach((m) => require(`../models/${m}`));

(async () => {
  const [email, password, businessName, ownerName] = process.argv.slice(2);
  if (!email || !password || !businessName) {
    console.error('Usage: node scripts/migrate-to-multitenant.js <email> <password> "<Business Name>" ["<Owner Name>"]');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);

  let user = await User.findOne({ email: email.toLowerCase() });
  let tenant;
  if (user) {
    tenant = await Tenant.findById(user.tenant);
    console.log(`Using existing owner ${email}`);
  } else {
    tenant = await Tenant.create({ name: businessName, owner_name: ownerName || businessName });
    user = await User.create({
      tenant: tenant._id,
      name: ownerName || businessName,
      email: email.toLowerCase(),
      password: await bcrypt.hash(password, 12),
      role: 'owner'
    });
    console.log(`Created business "${tenant.name}" and owner ${email}`);
  }

  for (const name of MODELS) {
    const Model = mongoose.model(name);
    // skipTenant: this script is the only place allowed to run unscoped
    const res = await Model.updateMany(
      { tenant: { $exists: false } },
      { $set: { tenant: tenant._id } },
      { skipTenant: true, strict: false }
    );
    console.log(`${name}: ${res.modifiedCount} document(s) assigned`);

    // Drops the old global unique indexes (e.g. bill_id_1) and builds tenant-scoped ones
    await Model.syncIndexes();
  }

  console.log('Done.');
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

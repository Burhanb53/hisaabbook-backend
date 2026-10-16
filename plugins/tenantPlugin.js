const mongoose = require('mongoose');
const { getTenantId } = require('../utils/tenantContext');

const QUERY_OPS = [
  'find', 'findOne', 'findOneAndUpdate', 'findOneAndDelete', 'findOneAndReplace',
  'updateOne', 'updateMany', 'replaceOne', 'deleteOne', 'deleteMany',
  'countDocuments', 'distinct'
];

const requireTenant = () => {
  const tenantId = getTenantId();
  if (!tenantId) {
    // Fail closed: never run an unscoped query by accident.
    throw new Error('Tenant context missing: refusing to run unscoped query');
  }
  return tenantId;
};

/**
 * Adds a `tenant` field to a schema and automatically scopes every query,
 * aggregation and new document to the tenant of the current request.
 * Bypass explicitly with `.setOptions({ skipTenant: true })` (scripts only).
 */
module.exports = function tenantPlugin(schema) {
  schema.add({
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true
    }
  });

  schema.pre('validate', function () {
    if (this.isNew && !this.tenant) this.tenant = requireTenant();
  });

  schema.pre(QUERY_OPS, function () {
    if (this.getOptions().skipTenant) return;
    this.where({ tenant: requireTenant() });

    // A tenant can never be re-assigned through an update body.
    const update = this.getUpdate && this.getUpdate();
    if (update) {
      delete update.tenant;
      if (update.$set) delete update.$set.tenant;
    }
  });

  schema.pre('aggregate', function () {
    if (this.options && this.options.skipTenant) return;
    this.pipeline().unshift({ $match: { tenant: requireTenant() } });
  });
};

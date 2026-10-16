const { AsyncLocalStorage } = require('async_hooks');

// Holds the tenant for the lifetime of a request so the tenant plugin
// can scope every query without each controller passing it around.
const storage = new AsyncLocalStorage();

exports.runWithTenant = (tenantId, fn) => storage.run({ tenantId }, fn);
exports.getTenantId = () => storage.getStore()?.tenantId;

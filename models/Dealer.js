const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const dealerSchema = new mongoose.Schema({
  dealer_id: {
    type: String,
    required: true
  },
  name: String,
  contact: String,
  address: String
}, { timestamps: true });


dealerSchema.plugin(tenantPlugin);
// IDs are unique per business, not globally
dealerSchema.index({ tenant: 1, dealer_id: 1 }, { unique: true });

module.exports = mongoose.model('Dealer', dealerSchema);
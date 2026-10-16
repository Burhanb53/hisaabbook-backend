const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const transactionSchema = new mongoose.Schema({
  transaction_id: {
    type: String,
    required: true
  },
  reference_id: String,
  type: String,
  transaction_type: String,
  reason: String,
  mode: String,
  amount: Number,
  date_time: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });


transactionSchema.plugin(tenantPlugin);
// IDs are unique per business, not globally
transactionSchema.index({ tenant: 1, transaction_id: 1 }, { unique: true });

module.exports = mongoose.model('Transaction', transactionSchema);
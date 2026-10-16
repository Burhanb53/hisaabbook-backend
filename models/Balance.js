const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const balanceSchema = new mongoose.Schema({
  balance_id: {
    type: String,
    required: true
  },
  mode: String,
  reason: String,
  amount: Number,
  date: {
    type: Date,
    default: Date.now
  },
  transaction: String  // Changed from ObjectId reference to simple String
}, { timestamps: true });


balanceSchema.plugin(tenantPlugin);
// IDs are unique per business, not globally
balanceSchema.index({ tenant: 1, balance_id: 1 }, { unique: true });

module.exports = mongoose.model('Balance', balanceSchema);
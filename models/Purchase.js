const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const purchaseSchema = new mongoose.Schema({
  purchase_id: {
    type: String,
    required: true
  },
  dealer_id: String,
  pdf: String,
  amount: Number,
  date: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['paid', 'unpaid', 'partial'],
    default: 'unpaid'
  },
  transactions: [String]
}, { timestamps: true });


purchaseSchema.plugin(tenantPlugin);
// IDs are unique per business, not globally
purchaseSchema.index({ tenant: 1, purchase_id: 1 }, { unique: true });

module.exports = mongoose.model('Purchase', purchaseSchema);
const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const saleSchema = new mongoose.Schema({
  bill_id: {
    type: String,
    required: true
  },
  status: String,
  name: String,
  contact: String,
  products: String,
  date: Date,
  total_amount: Number,
  transactions: [String]
}, { timestamps: true });


saleSchema.plugin(tenantPlugin);
// IDs are unique per business, not globally
saleSchema.index({ tenant: 1, bill_id: 1 }, { unique: true });

module.exports = mongoose.model('Sale', saleSchema);
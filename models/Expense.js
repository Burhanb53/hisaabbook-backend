const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const expenseSchema = new mongoose.Schema({
  expense_id: {
    type: String,
    required: true
  },
  amount: Number,
  mode: String,
  reason: String,
  date: {
    type: Date,
    default: Date.now
  },
  transaction: String
}, { timestamps: true });


expenseSchema.plugin(tenantPlugin);
// IDs are unique per business, not globally
expenseSchema.index({ tenant: 1, expense_id: 1 }, { unique: true });

module.exports = mongoose.model('Expense', expenseSchema);
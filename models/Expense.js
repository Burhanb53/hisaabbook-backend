const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  expense_id: {
    type: String,
    unique: true
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

module.exports = mongoose.model('Expense', expenseSchema);
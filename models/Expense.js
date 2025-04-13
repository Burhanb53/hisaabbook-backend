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
    default: () => {
      const now = new Date();
      const ISTOffset = 5.5 * 60 * 60 * 1000; // IST = UTC+5:30 (in milliseconds)
      return new Date(now.getTime() + ISTOffset); // Applies offset before storage
    }
  },
  transaction: String
}, { timestamps: true });

module.exports = mongoose.model('Expense', expenseSchema);
const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  transaction_id: {
    type: String,
    unique: true
  },
  reference_id: String,
  type: String,
  transaction_type: String,
  reason: String,
  mode: String,
  amount: Number,
  date_time: {
    type: Date,
    default: () => {
      const now = new Date();
      const ISTOffset = 5.5 * 60 * 60 * 1000; // IST = UTC+5:30 (in milliseconds)
      return new Date(now.getTime() + ISTOffset); // Applies offset before storage
    }
  }
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);
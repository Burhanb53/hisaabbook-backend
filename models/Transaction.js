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
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);
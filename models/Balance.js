const mongoose = require('mongoose');

const balanceSchema = new mongoose.Schema({
  balance_id: {
    type: String,
    unique: true
  },
  mode: String,
  reason: String,
  amount: Number,
  date: {
    type: Date,
    default: () => {
      // Create date in Indian timezone
      const now = new Date();
      const offset = 5.5 * 60 * 60 * 1000; // IST offset (UTC+5:30) in milliseconds
      return new Date(now.getTime() + offset);
    }
  },
  transaction: String
}, { timestamps: true });

module.exports = mongoose.model('Balance', balanceSchema);
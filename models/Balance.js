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
    default: Date.now
  },
  transaction: String  // Changed from ObjectId reference to simple String
}, { timestamps: true });

module.exports = mongoose.model('Balance', balanceSchema);
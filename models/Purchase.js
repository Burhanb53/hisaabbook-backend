const mongoose = require('mongoose');

const purchaseSchema = new mongoose.Schema({
  purchase_id: {
    type: String,
    unique: true
  },
  dealer_id: String,
  pdf: String,
  amount: Number,
  date: {
    type: Date,
    required: true,
    default: () => {
      const now = new Date();
      const ISTOffset = 5.5 * 60 * 60 * 1000; // IST = UTC+5:30 (in milliseconds)
      return new Date(now.getTime() + ISTOffset); // Applies offset before storage
    }
  },
  status: {
    type: String,
    enum: ['paid', 'unpaid', 'partial'],
    default: 'unpaid'
  },
  transactions: [String]
}, { timestamps: true });

module.exports = mongoose.model('Purchase', purchaseSchema);
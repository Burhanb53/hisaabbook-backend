const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema({
  bill_id: {
    type: String,
    unique: true
  },
  status: String,
  name: String,
  contact: String,
  products: String,
  date: {
    type: Date,
    default: () => {
      const now = new Date();
      const ISTOffset = 5.5 * 60 * 60 * 1000; // IST = UTC+5:30 (in milliseconds)
      return new Date(now.getTime() + ISTOffset); // Applies offset before storage
    }
  },
  total_amount: Number,
  transactions: [String]
}, { timestamps: true });

module.exports = mongoose.model('Sale', saleSchema);
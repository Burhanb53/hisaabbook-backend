const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema({
  bill_id: {
    type: String,
    unique: true  // Only constraint kept
  },
  status: String,
  name: String,
  contact: String,
  products: String,
  date: Date,
  total_amount: Number,
  transactions: [String]
}, { timestamps: true });

module.exports = mongoose.model('Sale', saleSchema);
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
    required: true
  },
  status: {
    type: String,
    enum: ['paid', 'unpaid', 'partial'],
    default: 'unpaid'
  },
  transactions: [String]
}, { timestamps: true });

module.exports = mongoose.model('Purchase', purchaseSchema);
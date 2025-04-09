const mongoose = require('mongoose');

const dealerSchema = new mongoose.Schema({
  dealer_id: {
    type: String,
    unique: true
  },
  name: String,
  contact: String,
  address: String
}, { timestamps: true });

module.exports = mongoose.model('Dealer', dealerSchema);
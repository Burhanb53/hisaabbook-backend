const express = require('express');
const {
  getAllTransactions,
  getTransactionSummary
} = require('../controllers/transactionController');

const router = express.Router();

// Get all transactions (newest first)
router.get('/', getAllTransactions);


module.exports = router;
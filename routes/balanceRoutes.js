const express = require('express');
const {
  createBalance,
  getPaymentModeTotals,
  getAllBalances
} = require('../controllers/balanceController');

const router = express.Router();

router.post('/', createBalance); // Create new balance
router.get('/totals', getPaymentModeTotals); // Get cash/online totals
router.get('/', getAllBalances); // Get all balances

module.exports = router;
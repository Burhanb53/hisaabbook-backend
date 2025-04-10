const express = require('express');
const {
  createBalance,
  getPaymentModeTotals,
  getAllBalances,
  deleteBalance
} = require('../controllers/balanceController');

const router = express.Router();

router.post('/', createBalance); // Create new balance
router.get('/totals', getPaymentModeTotals); // Get cash/online totals
router.get('/', getAllBalances); // Get all balances
router.delete('/:balance_id', deleteBalance);


module.exports = router;
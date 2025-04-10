const express = require('express');
const {
  createExpense,
  getAllExpenses,
  getExpenseDetails,
  deleteExpense,
  getExpenseSummaryByMode,
  getDailyExpenses,
  getMonthlyExpenses,
  getYearlyExpenses,
  getExpenseSummaryByCategory,
  getAvailableYears
} = require('../controllers/expenseController');

const router = express.Router();

// Basic CRUD routes
router.post('/', createExpense);
router.get('/', getAllExpenses);
router.get('/:id', getExpenseDetails);
router.delete('/:expense_id', deleteExpense);

// Visualization routes
router.get('/summary/mode', getExpenseSummaryByMode);
router.get('/summary/daily', getDailyExpenses);
router.get('/summary/monthly', getMonthlyExpenses);
router.get('/summary/yearly', getYearlyExpenses);
router.get('/summary/category', getExpenseSummaryByCategory);
router.get('/available-years', getAvailableYears);


// Keep the old summary endpoint for backward compatibility
router.get('/summary', getExpenseSummaryByMode);

module.exports = router;
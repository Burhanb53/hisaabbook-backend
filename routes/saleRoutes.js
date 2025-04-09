const express = require('express');
const {
  createSale,
  getTodaySummary,
  getSaleDetails,
  getAllSales,
  deleteSale,
  addSalePayment,
  getDailySales,
  getMonthlySales,
  getYearlySales,
  getSalesByStatus,
  getSalesByPaymentMethod,
  getTopCustomers,
  getSalesStatusTrend
} = require('../controllers/saleController');

const router = express.Router();

// Sales Analytics Routes 
router.get('/analytics/daily', getDailySales);
router.get('/analytics/monthly', getMonthlySales);
router.get('/analytics/yearly', getYearlySales);
router.get('/analytics/by-status', getSalesByStatus);
router.get('/analytics/payment-methods', getSalesByPaymentMethod);
router.get('/analytics/top-customers', getTopCustomers);
router.get('/analytics/status-trend', getSalesStatusTrend);

// Core sale routes
router.post('/', createSale);
router.post('/:bill_id/payments', addSalePayment);
router.get('/today-summary', getTodaySummary);
router.get('/', getAllSales);
router.get('/:bill_id', getSaleDetails);
router.delete('/:bill_id', deleteSale);

module.exports = router;

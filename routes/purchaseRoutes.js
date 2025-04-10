const express = require('express');
const {
  uploadPDF,
  createPurchase,
  getPurchasesByDealer,
  getPurchaseBill,
  getPurchaseDetails,
  addPurchasePayment,
  deletePurchase,
  getDailyPurchases,
  getMonthlyPurchases,
  getYearlyPurchases,
  getPurchasesByStatus,
  getTopDealers,
  getPaymentMethodsAnalysis,
  getPurchaseStatusTrend,

} = require('../controllers/purchaseController');

const router = express.Router();

// Create purchase (with PDF upload)
router.post('/', uploadPDF, createPurchase);

// Get all purchases by dealer (without PDF)
router.get('/dealer/:dealer_id', getPurchasesByDealer);

// Get only bill PDF
router.get('/:purchase_id/bill', getPurchaseBill);

// Get complete purchase with transactions
router.get('/:purchase_id', getPurchaseDetails);

// Add payment transaction
router.post('/:purchase_id/payments', addPurchasePayment);

// Delete purchase
router.delete('/:purchase_id', deletePurchase);



// Purchase Analytics Routes
router.get('/analytics/daily', getDailyPurchases);
router.get('/analytics/monthly', getMonthlyPurchases);
router.get('/analytics/yearly', getYearlyPurchases);
router.get('/analytics/by-status', getPurchasesByStatus);
router.get('/analytics/top-dealers', getTopDealers);
router.get('/analytics/payment-methods', getPaymentMethodsAnalysis);
router.get('/analytics/status-trend', getPurchaseStatusTrend);

module.exports = router;
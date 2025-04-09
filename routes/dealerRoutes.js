const express = require('express');
const {
  createDealer,
  getAllDealers,
  getDealerById,
  updateDealer,
  deleteDealer
} = require('../controllers/dealerController');

const router = express.Router();

router.post('/', createDealer);
router.get('/', getAllDealers);
router.get('/:id', getDealerById);
router.put('/:id', updateDealer);
router.delete('/:id', deleteDealer);

module.exports = router;
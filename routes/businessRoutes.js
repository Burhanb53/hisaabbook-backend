const express = require('express');
const biz = require('../controllers/businessController');
const { requireRole } = require('../middlewares/auth');

const router = express.Router();
// `protect` is applied in server.js

router.get('/', biz.getBusiness);
router.put('/', requireRole('owner'), biz.updateBusiness);

router.get('/staff', requireRole('owner'), biz.listStaff);
router.post('/staff', requireRole('owner'), biz.addStaff);
router.patch('/staff/:id', requireRole('owner'), biz.setStaffActive);
router.delete('/staff/:id', requireRole('owner'), biz.removeStaff);

module.exports = router;

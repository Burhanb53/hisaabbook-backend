const express = require('express');
const rateLimit = require('express-rate-limit');
const auth = require('../controllers/authController');
const { protect, requireRole } = require('../middlewares/auth');

const router = express.Router();

// Brute-force protection on credential endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many attempts, please try again later' }
});

router.post('/register', authLimiter, auth.register);
router.post('/login', authLimiter, auth.login);
router.post('/refresh', authLimiter, auth.refresh);
router.post('/logout', auth.logout);

router.get('/me', protect, auth.me);
router.post('/change-password', protect, auth.changePassword);
router.delete('/account', protect, requireRole('owner'), auth.deleteAccount);

module.exports = router;

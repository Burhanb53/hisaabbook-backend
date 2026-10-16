require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Fail fast on missing configuration
for (const key of ['MONGO_URI', 'JWT_SECRET']) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}
if (process.env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET must be at least 32 characters');
  process.exit(1);
}

// Import routes
const authRoutes = require('./routes/authRoutes');
const businessRoutes = require('./routes/businessRoutes');
const saleRoutes = require('./routes/saleRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const balanceRoutes = require('./routes/balanceRoutes');
const dealerRoutes = require('./routes/dealerRoutes');
const purchaseRoutes = require('./routes/purchaseRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const { protect } = require('./middlewares/auth');
const { notFound, errorHandler } = require('./middlewares/errorMiddleware');

// Initialize Express
const app = express();
app.set('trust proxy', 1); // behind a reverse proxy / PaaS load balancer

// Middleware
app.use(helmet());
// Native mobile apps send no Origin header; CORS_ORIGINS only matters for web clients.
const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean);
app.use(cors(allowedOrigins.length ? { origin: allowedOrigins } : {}));
app.use(express.json({ limit: '1mb' }));
app.use('/api', rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, slow down' }
}));

// Database connection (cached so serverless invocations reuse it)
let connecting;
const connectDB = () => {
  if (!connecting) {
    connecting = mongoose.connect(process.env.MONGO_URI).then(() => console.log('MongoDB connected'));
    connecting.catch(() => { connecting = null; });
  }
  return connecting;
};
app.use('/api', async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error('Database connection failed:', error.message);
    res.status(503).json({ success: false, error: 'Database unavailable' });
  }
});

// Public routes
app.use('/api/auth', authRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
  });
});

// Everything below requires a logged-in user and is scoped to that user's business
app.use('/api', protect);
app.use('/api/business', businessRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/balances', balanceRoutes);
app.use('/api/dealers', dealerRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/expenses', expenseRoutes);

// Error handling
app.use(notFound);
app.use(errorHandler);

// Start server (skipped when imported by the Vercel serverless entry)
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  connectDB()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`Indian Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
      });
    })
    .catch((error) => {
      console.error('Database connection failed:', error.message);
      process.exit(1);
    });
}

module.exports = app;

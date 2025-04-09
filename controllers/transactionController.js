const Transaction = require('../models/Transaction');

// @desc    Get all transactions (newest first)
// @route   GET /api/transactions
exports.getAllTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find()
      .sort({ createdAt: -1 }) // Sort by creation date (newest first)
      .lean(); // Convert to plain JavaScript objects

    res.status(200).json({
      success: true,
      count: transactions.length,
      data: transactions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};


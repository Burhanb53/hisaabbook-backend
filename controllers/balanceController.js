const Balance = require('../models/Balance');
const Transaction = require('../models/Transaction');

// Helper function to generate IDs
const generateId = (prefix) => {
  const now = new Date();
  return `${prefix}${now.getFullYear().toString().slice(-2)}` +
    `${(now.getMonth() + 1).toString().padStart(2, '0')}` +
    `${now.getDate().toString().padStart(2, '0')}` +
    `${Math.floor(1000 + Math.random() * 9000)}`;
};

// 1. Create new balance entry
exports.createBalance = async (req, res) => {
  try {
    const { mode, reason, amount } = req.body;

    // Validate required fields
    if (!mode || !reason || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Mode, reason and amount are required'
      });
    }

    // Generate IDs
    const balance_id = generateId('BAL');
    const transaction_id = generateId('TXN');

    // Get current time with IST offset (UTC+5:30)
    const now = new Date();
    const ISTOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + ISTOffset);

    // Create balance record
    const balance = await Balance.create({
      balance_id,
      mode,
      reason,
      amount,
      transaction: transaction_id,
      date: istDate // Using IST-adjusted date
    });

    // Create associated transaction
    await Transaction.create({
      transaction_id,
      reference_id: balance_id,
      type: 'In',
      transaction_type: 'Balance Update',
      reason,
      mode,
      amount,
      date_time: istDate // Using same IST-adjusted date
    });

    res.status(201).json({
      success: true,
      data: {
        ...balance.toObject(),
        date_ist: balance.date.toLocaleString('en-IN', { 
          timeZone: 'Asia/Kolkata',
          hour12: false
        })
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// 2. Get cash/online totals (In - Out)
exports.getPaymentModeTotals = async (req, res) => {
  try {
    const result = await Transaction.aggregate([
      {
        $group: {
          _id: {
            type: "$type",
            mode: "$mode"
          },
          totalAmount: { $sum: "$amount" }
        }
      },
      {
        $group: {
          _id: {
            mode: "$_id.mode"
          },
          in: {
            $sum: {
              $cond: [{ $eq: ["$_id.type", "In"] }, "$totalAmount", 0]
            }
          },
          out: {
            $sum: {
              $cond: [{ $eq: ["$_id.type", "Out"] }, "$totalAmount", 0]
            }
          }
        }
      },
      {
        $project: {
          mode: "$_id.mode",
          netAmount: { $subtract: ["$in", "$out"] },
          _id: 0
        }
      }
    ]);

    // Format response
    const formattedResult = {
      cash: 0,
      online: 0
    };

    result.forEach(item => {
      const key = ['cash', 'Cash', 'CASH'].includes(item.mode) ? 'cash' : 'online';
      formattedResult[key] += item.netAmount;
    });

    res.json({
      success: true,
      data: formattedResult
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// 3. Get all balance records (newest first)
exports.getAllBalances = async (req, res) => {
  try {
    const balances = await Balance.find().sort({ createdAt: -1 });
    res.json({
      success: true,
      count: balances.length,
      data: balances
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

exports.deleteBalance = async (req, res) => {
  try {
    const balance = await Balance.findOne({ balance_id: req.params.balance_id });
    
    if (!balance) {
      return res.status(404).json({
        success: false,
        error: 'Balance entry not found'
      });
    }

    // Delete associated transaction if it exists
    if (balance.transaction) {
      await Transaction.deleteOne({ 
        transaction_id: balance.transaction 
      });
    }

    // Delete the balance entry
    await Balance.deleteOne({ balance_id: req.params.balance_id });

    res.json({
      success: true,
      data: {
        message: 'Balance entry and associated transaction deleted successfully'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
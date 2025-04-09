const mongoose = require('mongoose');
const Purchase = require('../models/Purchase');
const Dealer = require('../models/Dealer');
const Transaction = require('../models/Transaction');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Helper function to generate purchase ID
const generatePurchaseId = () => {
  const now = new Date();
  return `PUR${now.getFullYear().toString().slice(-2)}` +
    `${(now.getMonth() + 1).toString().padStart(2, '0')}` +
    `${now.getDate().toString().padStart(2, '0')}` +
    `${Math.floor(1000 + Math.random() * 9000)}`;
};

// Middleware for file upload
exports.uploadPDF = upload.single('pdf');

// 1. Create new purchase
exports.createPurchase = async (req, res) => {
  try {
    const { dealer_id, amount, date } = req.body;
    const pdfBuffer = req.file ? req.file.buffer : null;
    const pdfBase64 = pdfBuffer ? pdfBuffer.toString('base64') : null;

    // Validate required fields
    if (!dealer_id || !amount || !date) {
      return res.status(400).json({
        success: false,
        error: 'Dealer ID, amount and date are required'
      });
    }

    // Validate date format
    const purchaseDate = new Date(date);
    if (isNaN(purchaseDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format'
      });
    }

    const purchase = await Purchase.create({
      purchase_id: generatePurchaseId(),
      dealer_id,
      pdf: pdfBase64,
      amount,
      date: purchaseDate,
      status: 'unpaid',
      transactions: []
    });

    res.status(201).json({
      success: true,
      data: purchase
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// 2. Get all purchases by dealer_id (without PDF)
exports.getPurchasesByDealer = async (req, res) => {
  try {
    // First get all purchases for the dealer
    const purchases = await Purchase.find(
      { dealer_id: req.params.dealer_id },
      { pdf: 0 } // Exclude PDF field
    ).sort({ date: -1 }).lean(); // Use lean() for better performance

    // Get all transaction IDs from all purchases
    const allTransactionIds = purchases.flatMap(p => p.transactions || []);

    // Fetch all transactions in a single query
    const transactions = await Transaction.find(
      { transaction_id: { $in: allTransactionIds } },
      { transaction_id: 1, amount: 1, _id: 0 }
    );

    // Create a map of transaction_id to amount for quick lookup
    const transactionMap = transactions.reduce((map, tx) => {
      map[tx.transaction_id] = tx.amount;
      return map;
    }, {});

    // Enhance each purchase with payment calculations
    const purchasesWithPayments = purchases.map(purchase => {
      const totalPaid = (purchase.transactions || []).reduce((sum, txId) => {
        return sum + (transactionMap[txId] || 0);
      }, 0);

      return {
        ...purchase,
        total_paid: totalPaid,
        balance: purchase.amount - totalPaid,
        payment_status: totalPaid >= purchase.amount ? 'paid' : 
                       totalPaid > 0 ? 'partial' : 'unpaid'
      };
    });

    res.status(200).json({
      success: true,
      count: purchasesWithPayments.length,
      data: purchasesWithPayments
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// 3. Get only bill PDF by purchase_id
exports.getPurchaseBill = async (req, res) => {
  try {
    const purchase = await Purchase.findOne(
      { purchase_id: req.params.purchase_id },
      { pdf: 1 } // Only include PDF field
    );

    if (!purchase || !purchase.pdf) {
      return res.status(404).json({
        success: false,
        error: 'Bill not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        purchase_id: req.params.purchase_id,
        pdf: purchase.pdf
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// 4. Get complete purchase with transactions
exports.getPurchaseDetails = async (req, res) => {
  try {
    // Find purchase and exclude the PDF field
    const purchase = await Purchase.findOne(
      { purchase_id: req.params.purchase_id },
      { pdf: 0 } // This excludes the PDF field
    );
    
    if (!purchase) {
      return res.status(404).json({
        success: false,
        error: 'Purchase not found'
      });
    }

    const transactions = await Transaction.find({
      transaction_id: { $in: purchase.transactions }
    });

    // Calculate total paid amount
    const totalPaid = transactions.reduce((sum, tx) => sum + tx.amount, 0);

    // Convert purchase to object and remove pdf if it still exists
    const purchaseData = purchase.toObject();
    if (purchaseData.pdf) {
      delete purchaseData.pdf;
    }

    res.status(200).json({
      success: true,
      data: {
        ...purchaseData,
        transactions,
        total_paid: totalPaid,
        balance: purchase.amount - totalPaid
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// 5. Add payment transaction to purchase and update status
exports.addPurchasePayment = async (req, res) => {
  try {
    const { dealer_id, amount, mode, date } = req.body;
    const { purchase_id } = req.params;

    // Validate required fields
    if (!purchase_id || !dealer_id || !amount || !mode || !date) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required'
      });
    }

    // Validate transaction date
    const transactionDate = new Date(date);
    if (isNaN(transactionDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format'
      });
    }

    // Get purchase to validate amount
    const purchase = await Purchase.findOne({ purchase_id });
    if (!purchase) {
      return res.status(404).json({
        success: false,
        error: 'Purchase not found'
      });
    }

    // Get existing transactions
    const existingTransactions = await Transaction.find({
      transaction_id: { $in: purchase.transactions }
    });

    const totalPaid = existingTransactions.reduce((sum, tx) => sum + tx.amount, 0);
    const newTotalPaid = totalPaid + Number(amount);

    // Check if payment exceeds purchase amount
    if (newTotalPaid > purchase.amount) {
      return res.status(400).json({
        success: false,
        error: `Payment exceeds purchase amount. Maximum allowed: ${purchase.amount - totalPaid}`
      });
    }

    // Get dealer name
    const dealer = await Dealer.findOne({ dealer_id });
    const reason = dealer ? `Payment to ${dealer.name}` : 'Purchase payment';

    // Generate transaction ID
    const now = new Date();
    const transaction_id = `TXN${now.getFullYear().toString().slice(-2)}` +
      `${(now.getMonth() + 1).toString().padStart(2, '0')}` +
      `${now.getDate().toString().padStart(2, '0')}` +
      `${Math.floor(1000 + Math.random() * 9000)}`;

    // Create transaction
    const transaction = await Transaction.create({
      transaction_id,
      reference_id: purchase_id,
      type: 'Out',
      transaction_type: 'Purchase',
      reason,
      mode,
      amount,
      date_time: transactionDate
    });

    // Update purchase status
    const newStatus = newTotalPaid >= purchase.amount ? 'paid' : 'partial';
    await Purchase.updateOne(
      { purchase_id },
      { 
        $push: { transactions: transaction_id },
        $set: { status: newStatus }
      }
    );

    res.status(201).json({
      success: true,
      data: transaction,
      purchase_status: newStatus
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// 6. Update purchase status based on transactions (can be called periodically)
exports.updatePurchaseStatus = async (req, res) => {
  try {
    const purchases = await Purchase.find({ status: { $ne: 'paid' } });
    
    for (const purchase of purchases) {
      const transactions = await Transaction.find({
        transaction_id: { $in: purchase.transactions }
      });

      const totalPaid = transactions.reduce((sum, tx) => sum + tx.amount, 0);
      let newStatus = 'unpaid';
      
      if (totalPaid > 0) {
        newStatus = totalPaid >= purchase.amount ? 'paid' : 'partial';
      }

      if (purchase.status !== newStatus) {
        await Purchase.updateOne(
          { purchase_id: purchase.purchase_id },
          { $set: { status: newStatus } }
        );
      }
    }

    res.status(200).json({
      success: true,
      message: 'Purchase statuses updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};


// Helper function to get date ranges
const getDateRanges = (year, month) => {
  if (month) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    return { start, end };
  }
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);
  return { start, end };
};

// 1. Daily Purchases
exports.getDailyPurchases = async (req, res) => {
  try {
    const { year, month, compareYears, compareMonth } = req.query;
    const { start, end } = getDateRanges(year, month);

    // Main aggregation for current period
    const currentPipeline = [
      {
        $match: {
          date: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: { $dayOfMonth: "$date" },
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id": 1 } }
    ];

    const currentData = await Purchase.aggregate(currentPipeline);

    // Comparison data if requested
    let comparisonData = [];
    if (compareYears) {
      const years = compareYears.split(',').map(y => parseInt(y));
      const cm = compareMonth ? parseInt(compareMonth) : parseInt(month);

      comparisonData = await Promise.all(years.map(async (compareYear) => {
        const { start: compareStart, end: compareEnd } = getDateRanges(compareYear, cm);
        const result = await Purchase.aggregate([
          {
            $match: {
              date: { $gte: compareStart, $lte: compareEnd }
            }
          },
          {
            $group: {
              _id: { $dayOfMonth: "$date" },
              totalAmount: { $sum: "$amount" },
              count: { $sum: 1 }
            }
          },
          { $sort: { "_id": 1 } }
        ]);

        return {
          year: compareYear,
          data: result
        };
      }));
    }

    res.json({
      success: true,
      data: {
        currentPeriod: currentData.map(item => ({
          day: item._id,
          totalAmount: item.totalAmount,
          count: item.count
        })),
        comparisonPeriods: comparisonData
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// 2. Monthly Purchases
exports.getMonthlyPurchases = async (req, res) => {
  try {
    const { year, compareYears } = req.query;

    // Main aggregation for current period
    const currentPipeline = [
      {
        $match: {
          date: { 
            $gte: new Date(year, 0, 1),
            $lte: new Date(year, 11, 31)
          }
        }
      },
      {
        $group: {
          _id: { $month: "$date" },
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id": 1 } }
    ];

    const currentData = await Purchase.aggregate(currentPipeline);

    // Comparison data if requested
    let comparisonData = [];
    if (compareYears) {
      const years = compareYears.split(',').map(y => parseInt(y));

      comparisonData = await Promise.all(years.map(async (compareYear) => {
        const result = await Purchase.aggregate([
          {
            $match: {
              date: { 
                $gte: new Date(compareYear, 0, 1),
                $lte: new Date(compareYear, 11, 31)
              }
            }
          },
          {
            $group: {
              _id: { $month: "$date" },
              totalAmount: { $sum: "$amount" },
              count: { $sum: 1 }
            }
          },
          { $sort: { "_id": 1 } }
        ]);

        return {
          year: compareYear,
          data: result
        };
      }));
    }

    res.json({
      success: true,
      data: {
        currentPeriod: currentData.map(item => ({
          month: item._id,
          totalAmount: item.totalAmount,
          count: item.count
        })),
        comparisonPeriods: comparisonData
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// 3. Yearly Purchases Trend
exports.getYearlyPurchases = async (req, res) => {
  try {
    const pipeline = [
      {
        $group: {
          _id: { $year: "$date" },
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id": 1 } }
    ];

    const data = await Purchase.aggregate(pipeline);

    res.json({
      success: true,
      data: data.map(item => ({
        year: item._id,
        totalAmount: item.totalAmount,
        count: item.count
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// 4. Purchases by Status
exports.getPurchasesByStatus = async (req, res) => {
  try {
    const { year, compareYears } = req.query;

    // Current year pipeline
    const currentPipeline = [
      {
        $match: {
          ...(year && {
            date: {
              $gte: new Date(year, 0, 1),
              $lte: new Date(year, 11, 31),
            }
          })
        }
      },
      {
        $group: {
          _id: "$status",
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 }
        }
      }
    ];

    const currentData = await Purchase.aggregate(currentPipeline);

    // Compare with other years
    let comparisonData = [];
    if (compareYears) {
      const years = compareYears.split(',').map(y => parseInt(y));

      comparisonData = await Promise.all(years.map(async compareYear => {
        const data = await Purchase.aggregate([
          {
            $match: {
              date: {
                $gte: new Date(compareYear, 0, 1),
                $lte: new Date(compareYear, 11, 31)
              }
            }
          },
          {
            $group: {
              _id: "$status",
              totalAmount: { $sum: "$amount" },
              count: { $sum: 1 }
            }
          }
        ]);

        return { year: compareYear, data };
      }));
    }

    res.json({
      success: true,
      data: {
        currentPeriod: currentData.map(item => ({
          status: item._id,
          totalAmount: item.totalAmount,
          count: item.count
        })),
        comparisonPeriods: comparisonData
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};


// 5. Top Dealers by Purchase Amount
exports.getTopDealers = async (req, res) => {
  try {
    const { year, compareYears } = req.query;

    const buildPipeline = (targetYear) => [
      {
        $match: {
          ...(targetYear && {
            date: {
              $gte: new Date(targetYear, 0, 1),
              $lte: new Date(targetYear, 11, 31)
            }
          })
        }
      },
      {
        $group: {
          _id: "$dealer_id",
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 }
        }
      },
      { $sort: { totalAmount: -1 } }
    ];

    // Current year
    const currentData = await Purchase.aggregate(buildPipeline(year));
    const dealerIds = currentData.map(d => d._id);
    const dealers = await Dealer.find({ dealer_id: { $in: dealerIds } });
    const dealerMap = Object.fromEntries(dealers.map(d => [d.dealer_id, d.name]));

    const currentPeriod = currentData.map(item => ({
      dealer_id: item._id,
      dealer_name: dealerMap[item._id] || 'Unknown',
      totalAmount: item.totalAmount,
      count: item.count
    }));

    // Comparison
    let comparisonPeriods = [];
    if (compareYears) {
      const years = compareYears.split(',').map(Number);
      comparisonPeriods = await Promise.all(years.map(async y => {
        const data = await Purchase.aggregate(buildPipeline(y));
        return { year: y, data };
      }));
    }

    res.json({ success: true, data: { currentPeriod, comparisonPeriods } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};


// 6. Payment Methods Analysis
exports.getPaymentMethodsAnalysis = async (req, res) => {
  try {
    const { year, compareYears } = req.query;

    const buildPipeline = (targetYear) => [
      {
        $match: {
          type: 'Out',
          transaction_type: 'Purchase',
          ...(targetYear && {
            date_time: {
              $gte: new Date(targetYear, 0, 1),
              $lte: new Date(targetYear, 11, 31)
            }
          })
        }
      },
      {
        $project: {
          mode: { $toLower: "$mode" },
          amount: 1
        }
      },
      {
        $group: {
          _id: "$mode",
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 }
        }
      },
      { $sort: { totalAmount: -1 } }
    ];

    // Current
    const currentData = await Transaction.aggregate(buildPipeline(year));

    // Comparison
    let comparisonPeriods = [];
    if (compareYears) {
      const years = compareYears.split(',').map(Number);
      comparisonPeriods = await Promise.all(years.map(async y => {
        const data = await Transaction.aggregate(buildPipeline(y));
        return { year: y, data };
      }));
    }

    res.json({
      success: true,
      data: {
        currentPeriod: currentData.map(item => ({
          mode: item._id,
          totalAmount: item.totalAmount,
          count: item.count
        })),
        comparisonPeriods
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};


// 7. Purchase Status Over Time
exports.getPurchaseStatusTrend = async (req, res) => {
  try {
    const { year, groupBy = 'month' } = req.query; // groupBy: 'month' or 'quarter'
    const { start, end } = getDateRanges(year);

    let dateGroup;
    if (groupBy === 'quarter') {
      dateGroup = {
        $ceil: { $divide: [{ $month: "$date" }, 3] }
      };
    } else {
      dateGroup = { $month: "$date" };
    }

    const pipeline = [
      {
        $match: {
          date: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: {
            period: dateGroup,
            status: "$status"
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: "$_id.period",
          statuses: {
            $push: {
              status: "$_id.status",
              count: "$count"
            }
          },
          total: { $sum: "$count" }
        }
      },
      { $sort: { "_id": 1 } }
    ];

    const data = await Purchase.aggregate(pipeline);

    res.json({
      success: true,
      data: data.map(item => ({
        period: item._id,
        statuses: item.statuses,
        total: item.total
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
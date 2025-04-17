const Sale = require('../models/Sale');
const Transaction = require('../models/Transaction');

// Helper function to generate transaction ID
const generateTransactionId = () => {
  const now = new Date();
  return `TXN${String(now.getFullYear()).slice(-2)}` + 
         `${String(now.getMonth() + 1).padStart(2, '0')}` +
         `${String(now.getDate()).padStart(2, '0')}` +
         `${Math.floor(1000 + Math.random() * 9000)}`; // 4-digit random
};

// Create new sale with transactions
exports.createSale = async (req, res) => {
  try {
    const { bill_id, status, name, contact, products, total_amount, payments, date } = req.body;

    // Validate required fields
    if (!bill_id || !total_amount) {
      return res.status(400).json({
        success: false,
        error: 'Bill ID and total amount are required'
      });
    }

    // Function to create date in Indian time (IST)
    const createIndianDate = (inputDate) => {
      const dateObj = inputDate ? new Date(inputDate) : new Date();
      
      // Convert to Indian time (UTC+5:30)
      const indianTimeOffset = 330 * 60 * 1000; // 5 hours 30 minutes in milliseconds
      const indianTime = new Date(dateObj.getTime() + indianTimeOffset);
      
      // Set to beginning of day in Indian time
      return new Date(Date.UTC(
        indianTime.getUTCFullYear(),
        indianTime.getUTCMonth(),
        indianTime.getUTCDate(),
        0, 0, 0, 0
      ));
    };

    // Create date in Indian time
    const saleDate = createIndianDate(date);

    // Validate the date
    if (isNaN(saleDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format'
      });
    }

    // Calculate total payments if any
    let totalPayments = 0;
    let finalStatus = status || 'unpaid';
    
    if (payments && payments.length > 0) {
      totalPayments = payments.reduce((sum, payment) => sum + payment.amount, 0);
      
      if (totalPayments >= total_amount) {
        finalStatus = 'paid';
      } else if (totalPayments > 0) {
        finalStatus = 'partial';
      }
    }

    // Create sale with Indian date
    const sale = await Sale.create({
      bill_id,
      status: finalStatus,
      name,
      contact,
      products,
      total_amount,
      date: saleDate
    });

    // Process payments if any
    if (payments && payments.length > 0) {
      const transactions = [];
      
      for (const payment of payments) {
        const transaction = await Transaction.create({
          transaction_id: generateTransactionId(),
          reference_id: bill_id,
          type: 'In',
          transaction_type: 'Sell',
          reason: 'Product Sales',
          mode: payment.mode,
          amount: payment.amount,
          date_time: saleDate
        });
        
        transactions.push(transaction.transaction_id);
      }

      sale.transactions = transactions;
      await sale.save();
    }

    // Format response date in Indian time (YYYY-MM-DD)
    const responseDate = saleDate.toISOString().split('T')[0];

    // Send WhatsApp notification if contact is provided
    if (contact) {
      await sendWhatsAppNotification({
        name: name || 'Customer',
        contact,
        bill_id,
        payments,
        total_amount,
        totalPayments,
        finalStatus,
        products,
        date: responseDate
      });
    }

    res.status(201).json({
      success: true,
      data: {
        ...sale.toObject(),
        date: responseDate
      }
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'Bill ID already exists'
      });
    }
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// WhatsApp Notification Function
async function sendWhatsAppNotification({ 
  name, 
  contact, 
  bill_id, 
  total_amount, 
  payments,  
  totalPayments, 
  finalStatus, 
  products, 
  date 
}) {
  // Don't send if no contact provided
  if (!contact) {
    // console.log('No contact provided, skipping WhatsApp notification');
    return;
  }

  try {
    const accountSid = 'AC6fc6d3371d0420d3980decc19048cd32';
    const authToken = '25e63b8a03e3be2bc33998627a763411';
    const client = require('twilio')(accountSid, authToken);

    // Format contact number with +91
    const formattedContact = contact.startsWith('+91') ? contact : `+91${contact}`;

    // Calculate pending amount
    const pendingAmount = total_amount - totalPayments;

    // Format date (Indian format)
    const formattedDate = new Date(date).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    // Create payment details section
    let paymentDetails = '';
    if (payments && payments.length > 0) {
      paymentDetails = `💳 *Payment Breakdown:*\n` +
        payments.map(payment => 
          `• ${(payment.mode || 'Cash').toUpperCase()}: ₹${payment.amount || 0}`
        ).join('\n') + `\n\n`;
    }

    // Determine payment status message
    let paymentStatusMessage = '';
    let paymentSummary = `💰 *Total Amount:* ₹${total_amount}\n`;
    
    if (finalStatus === 'paid') {
      paymentStatusMessage = `✅ *Payment Status:* FULLY PAID\n`;
    } 
    else if (finalStatus === 'partial') {
      paymentStatusMessage = `⚠️ *Payment Status:* PARTIALLY PAID\n`;
    } 
    else { // unpaid
      paymentStatusMessage = `❌ *Payment Status:* UNPAID\n`;
    }

    // Create the WhatsApp message
    let message = `🛍 *INVOICE NOTIFICATION* 🛍\n\n` +
                 `Dear ${name || 'Valued Customer'},\n\n` +
                 `Thank you for your purchase! Here's your order summary:\n\n` +
                 `📄 *Invoice No:* ${bill_id}\n` +
                 `📅 *Date:* ${formattedDate}\n\n` +
                 `📦 *Products Purchased:*\n${products || 'No products listed'}\n\n` +
                 paymentSummary +
                 paymentStatusMessage;

    // Add payment details if payments exist
    if (payments && payments.length > 0) {
      message += `\n${paymentDetails}`;
    }

    // Add the exact payment summary design you requested
    message += `✅ *Total Received:* ₹${totalPayments}\n`;

    // Add pending amount if applicable (exact as requested)
    if (pendingAmount > 0) {
      message += `\n⚠️ *Balance Due:* ₹${pendingAmount}\n` +
                 `Kindly complete your payment at the earliest.\n`;
    }

    message += `\nThank you for your trust in us!\n` +
               `For any queries, contact us.\n\n` +
               `Best Regards,\nMurtaza Bohra\n8890292583\nRajasthan Steel and Crockery`;

    // Send WhatsApp message
    await client.messages.create({
      from: 'whatsapp:+14155238886',
      body: message,
      to: `whatsapp:${formattedContact}`
    });

    // console.log(`WhatsApp notification sent to ${formattedContact}`);
  } catch (error) {
    // console.error('Error sending WhatsApp notification:', error.message);
  }
}

// Get today's sales summary with sorted sales data
exports.getTodaySummary = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get today's sales sorted by date (newest first)
    const sales = await Sale.find({
      date: { $gte: today }
    }).sort({ createdAt: -1 });  // Added sorting here

    const total_amount = sales.reduce((sum, sale) => sum + sale.total_amount, 0);
    const count = sales.length;

    res.json({
      success: true,
      data: {
        total_amount,
        count,
        date: today.toISOString().split('T')[0],
        sales  // Added today's sales data in response
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get sale by bill_id with transactions
exports.getSaleDetails = async (req, res) => {
  try {
    const sale = await Sale.findOne({ bill_id: req.params.bill_id });
    
    if (!sale) {
      return res.status(404).json({
        success: false,
        error: 'Sale not found'
      });
    }

    const transactions = await Transaction.find({ 
      transaction_id: { $in: sale.transactions } 
    });

    res.json({
      success: true,
      data: {
        ...sale.toObject(),
        transactions
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get all sales sorted by date (newest first)
exports.getAllSales = async (req, res) => {
  try {
    const sales = await Sale.find().sort({ date: -1 });
    
    res.json({
      success: true,
      count: sales.length,
      data: sales
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Delete sale and associated transactions
exports.deleteSale = async (req, res) => {
  try {
    const sale = await Sale.findOne({ bill_id: req.params.bill_id });
    
    if (!sale) {
      return res.status(404).json({
        success: false,
        error: 'Sale not found'
      });
    }

    // Delete associated transactions
    if (sale.transactions.length > 0) {
      await Transaction.deleteMany({ 
        transaction_id: { $in: sale.transactions } 
      });
    }

    // Delete the sale
    await Sale.deleteOne({ bill_id: req.params.bill_id });

    res.json({
      success: true,
      data: {
        message: 'Sale and associated transactions deleted successfully'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};


// Add new transaction to existing sale
// Store payments temporarily to combine them
let paymentBuffer = [];

exports.addSalePayment = async (req, res) => {
  try {
    const { bill_id } = req.params;
    const { amount, mode } = req.body;

    // Validate required fields
    if (!bill_id || !amount || !mode) {
      return res.status(400).json({
        success: false,
        error: 'Bill ID, amount and mode are required'
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be greater than 0'
      });
    }

    // Find the sale
    const sale = await Sale.findOne({ bill_id });
    if (!sale) {
      return res.status(404).json({
        success: false,
        error: 'Sale not found'
      });
    }

    // Create new transaction
    const transaction = await Transaction.create({
      transaction_id: generateTransactionId(),
      reference_id: bill_id,
      type: 'In',
      transaction_type: 'Sell',
      reason: 'Additional payment for sale',
      mode,
      amount,
      date_time: new Date()
    });

    // Add to payment buffer
    paymentBuffer.push({
      amount,
      mode,
      bill_id,
      sale,
      transaction
    });

    // Process if buffer has items
    if (paymentBuffer.length > 0) {
      // Group by bill_id
      const paymentsByBill = paymentBuffer.reduce((acc, payment) => {
        if (!acc[payment.bill_id]) {
          acc[payment.bill_id] = {
            payments: [],
            sale: payment.sale,
            transactions: []
          };
        }
        acc[payment.bill_id].payments.push({
          amount: payment.amount,
          mode: payment.mode
        });
        acc[payment.bill_id].transactions.push(payment.transaction);
        return acc;
      }, {});

      // Process each bill's payments
      for (const billId in paymentsByBill) {
        const { payments, sale, transactions } = paymentsByBill[billId];
        
        // Add all transactions to sale
        sale.transactions.push(...transactions.map(t => t.transaction_id));
        
        // Calculate totals
        const totalPaid = (await Transaction.find({
          transaction_id: { $in: sale.transactions }
        })).reduce((sum, txn) => sum + txn.amount, 0);
        
        const amountRemaining = sale.total_amount - totalPaid;
        const newStatus = totalPaid >= sale.total_amount ? 'paid' : 
                         totalPaid > 0 ? 'partial' : sale.status;
        sale.status = newStatus;
        await sale.save();

        // Send combined notification
        if (sale.contact) {
          await sendPaymentUpdateNotification({
            name: sale.name || 'Customer',
            contact: sale.contact,
            bill_id: sale.bill_id,
            payments, // Pass all payments as array
            total_amount: sale.total_amount,
            total_paid: totalPaid,
            amount_remaining: amountRemaining,
            status: newStatus,
            products: sale.products,
            date: new Date().toISOString().split('T')[0]
          });
        }
      }

      // Clear buffer
      paymentBuffer = [];
    }

    res.status(201).json({
      success: true,
      data: {
        sale,
        transaction,
        payment_status: totalPaid >= sale.total_amount ? 'fully_paid' : 'partially_paid',
        amount_remaining: amountRemaining,
        new_status: newStatus
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Updated notification function
async function sendPaymentUpdateNotification({
  name,
  contact,
  bill_id,
  payments, // Now receives array of payments
  total_amount,
  total_paid,
  amount_remaining,
  status,
  products,
  date
}) {
  if (!contact) return;

  try {
    const accountSid = 'AC6fc6d3371d0420d3980decc19048cd32';
    const authToken = '25e63b8a03e3be2bc33998627a763411';
    const client = require('twilio')(accountSid, authToken);

    const formattedContact = contact.startsWith('+91') ? contact : `+91${contact}`;
    const formattedDate = new Date(date).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    // Build payments section
    const paymentsText = payments.length > 1 
      ? `💸 *Latest Payments:*\n${payments.map(p => `• ${p.mode.toUpperCase()}: ₹${p.amount}`).join('\n')}\n\n`
      : `💸 *Latest Payment:*\n• ${payments[0].mode.toUpperCase()}: ₹${payments[0].amount}\n\n`;

    let message = `💳 *PAYMENT RECEIVED* 💳\n\n` +
                 `Dear ${name || 'Customer'},\n\n` +
                 `Thank you for your payment. Here's the update:\n\n` +
                 `📄 *Invoice No:* ${bill_id}\n` +
                 `📅 *Date:* ${formattedDate}\n\n` +
                 `📦 *Products:*\n${products || 'No products listed'}\n\n` +
                 `💰 *Total Amount:* ₹${total_amount}\n\n` +
                 paymentsText +
                 `✅ *Total Paid Now:* ₹${total_paid}\n`;

    if (status === 'paid') {
      message += `\n🎉 *Payment Status:* FULLY PAID\n`;
    } else {
      message += `\n⚠️ *Balance Due:* ₹${amount_remaining}\n` +
                 `Kindly complete your payment at the earliest.\n`;
    }

    message += `\nThank you for your trust in us!\n` +
               `For any queries, contact us.\n\n` +
               `Best Regards,\nMurtaza Bohra\n8890292583\nRajasthan Steel and Crockery`;

    await client.messages.create({
      from: 'whatsapp:+14155238886',
      body: message,
      to: `whatsapp:${formattedContact}`
    });

  } catch (error) {
    console.error('Failed to send payment notification:', error.message);
  }
}

// GET /analytics/sales/daily
exports.getDailySales = async (req, res) => {
  try {
    const { year, month, compareYears, compareMonth } = req.query;
    
    const currentYear = parseInt(year) || new Date().getFullYear();
    const currentMonth = parseInt(month) || new Date().getMonth() + 1;
    
    // Current period aggregation
    const currentMatch = {
      $match: {
        date: {
          $gte: new Date(currentYear, currentMonth - 1, 1),
          $lt: new Date(currentYear, currentMonth, 1)
        }
      }
    };
    
    const currentGroup = {
      $group: {
        _id: { $dayOfMonth: "$date" },
        totalAmount: { $sum: "$total_amount" },
        count: { $sum: 1 }
      }
    };
    
    const currentProject = {
      $project: {
        day: "$_id",
        totalAmount: 1,
        count: 1,
        _id: 0
      }
    };
    
    const currentPeriod = await Sale.aggregate([
      currentMatch,
      currentGroup,
      currentProject,
      { $sort: { day: 1 } }
    ]);
    
    // Comparison periods
    const comparisonPeriods = [];
    
    if (compareYears) {
      const years = compareYears.split(',').map(y => parseInt(y));
      const compareMonthInt = parseInt(compareMonth) || currentMonth;
      
      for (const year of years) {
        const compareMatch = {
          $match: {
            date: {
              $gte: new Date(year, compareMonthInt - 1, 1),
              $lt: new Date(year, compareMonthInt, 1)
            }
          }
        };
        
        const compareData = await Sale.aggregate([
          compareMatch,
          currentGroup,
          currentProject,
          { $sort: { day: 1 } }
        ]);
        
        comparisonPeriods.push({
          year,
          data: compareData
        });
      }
    }
    
    res.json({
      success: true,
      data: {
        currentPeriod,
        comparisonPeriods
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET /analytics/sales/monthly
exports.getMonthlySales = async (req, res) => {
  try {
    const { year, compareYears } = req.query;
    const currentYear = parseInt(year) || new Date().getFullYear();
    
    // Current period
    const currentMatch = {
      $match: {
        date: {
          $gte: new Date(currentYear, 0, 1),
          $lt: new Date(currentYear + 1, 0, 1)
        }
      }
    };
    
    const currentGroup = {
      $group: {
        _id: { $month: "$date" },
        totalAmount: { $sum: "$total_amount" },
        count: { $sum: 1 }
      }
    };
    
    const currentProject = {
      $project: {
        month: "$_id",
        totalAmount: 1,
        count: 1,
        _id: 0
      }
    };
    
    const currentPeriod = await Sale.aggregate([
      currentMatch,
      currentGroup,
      currentProject,
      { $sort: { month: 1 } }
    ]);
    
    // Comparison periods
    const comparisonPeriods = [];
    
    if (compareYears) {
      const years = compareYears.split(',').map(y => parseInt(y));
      
      for (const year of years) {
        const compareMatch = {
          $match: {
            date: {
              $gte: new Date(year, 0, 1),
              $lt: new Date(year + 1, 0, 1)
            }
          }
        };
        
        const compareData = await Sale.aggregate([
          compareMatch,
          currentGroup,
          currentProject,
          { $sort: { month: 1 } }
        ]);
        
        comparisonPeriods.push({
          year,
          data: compareData
        });
      }
    }
    
    res.json({
      success: true,
      data: {
        currentPeriod,
        comparisonPeriods
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET /analytics/sales/yearly
exports.getYearlySales = async (req, res) => {
  try {
    const group = {
      $group: {
        _id: { $year: "$date" },
        totalAmount: { $sum: "$total_amount" },
        count: { $sum: 1 }
      }
    };
    
    const project = {
      $project: {
        year: "$_id",
        totalAmount: 1,
        count: 1,
        _id: 0
      }
    };
    
    const data = await Sale.aggregate([
      group,
      project,
      { $sort: { year: 1 } }
    ]);
    
    res.json({
      success: true,
      data
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET /analytics/sales/by-status
exports.getSalesByStatus = async (req, res) => {
  try {
    const { year, month, compareYears } = req.query;
    
    const currentYear = parseInt(year) || new Date().getFullYear();
    const currentMonth = month ? parseInt(month) : null;
    
    // Current period match
    const currentMatch = {
      date: {
        $gte: new Date(currentYear, currentMonth ? currentMonth - 1 : 0, 1),
        $lt: new Date(
          currentYear, 
          currentMonth ? currentMonth : 12, 
          currentMonth ? 1 : 31
        )
      }
    };
    
    // Current period aggregation
    const currentGroup = {
      $group: {
        _id: "$status",
        totalAmount: { $sum: "$total_amount" },
        count: { $sum: 1 }
      }
    };
    
    const currentProject = {
      $project: {
        status: "$_id",
        totalAmount: 1,
        count: 1,
        _id: 0
      }
    };
    
    const currentPeriod = await Sale.aggregate([
      { $match: currentMatch },
      currentGroup,
      currentProject
    ]);
    
    // Comparison periods
    const comparisonPeriods = [];
    
    if (compareYears) {
      const years = compareYears.split(',').map(y => parseInt(y));
      
      for (const year of years) {
        const compareMatch = {
          date: {
            $gte: new Date(year, currentMonth ? currentMonth - 1 : 0, 1),
            $lt: new Date(
              year, 
              currentMonth ? currentMonth : 12, 
              currentMonth ? 1 : 31
            )
          }
        };
        
        const compareData = await Sale.aggregate([
          { $match: compareMatch },
          currentGroup,
          currentProject
        ]);
        
        comparisonPeriods.push({
          year,
          data: compareData
        });
      }
    }
    
    res.json({
      success: true,
      data: {
        currentPeriod,
        comparisonPeriods
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET /analytics/sales/payment-methods
exports.getSalesByPaymentMethod = async (req, res) => {
  try {
    const { year, compareYears } = req.query;

    const buildPipeline = (targetYear) => [
      {
        $match: {
          type: 'In',
          transaction_type: 'Sell',
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

// GET /analytics/sales/top-customers
exports.getTopCustomers = async (req, res) => {
  try {
    const { year, month, limit = 5 } = req.query;
    
    const currentYear = parseInt(year) || new Date().getFullYear();
    const currentMonth = month ? parseInt(month) : null;
    
    // Current period match
    const currentMatch = {
      date: {
        $gte: new Date(currentYear, currentMonth ? currentMonth - 1 : 0, 1),
        $lt: new Date(
          currentYear, 
          currentMonth ? currentMonth : 12, 
          currentMonth ? 1 : 31
        )
      }
    };
    
    // Current period aggregation
    const currentGroup = {
      $group: {
        _id: { 
          name: "$name",
          contact: "$contact"
        },
        totalAmount: { $sum: "$total_amount" },
        count: { $sum: 1 }
      }
    };
    
    const currentProject = {
      $project: {
        customerName: "$_id.name",
        contact: "$_id.contact",
        totalAmount: 1,
        count: 1,
        _id: 0
      }
    };
    
    const currentPeriod = await Sale.aggregate([
      { $match: currentMatch },
      currentGroup,
      currentProject,
      { $sort: { totalAmount: -1 } },
      { $limit: parseInt(limit) }
    ]);
    
    res.json({
      success: true,
      data: {
        currentPeriod
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET /analytics/sales/status-trend
exports.getSalesStatusTrend = async (req, res) => {
  try {
    const { year } = req.query;
    const currentYear = parseInt(year) || new Date().getFullYear();
    
    const group = {
      $group: {
        _id: {
          month: { $month: "$date" },
          status: "$status"
        },
        totalAmount: { $sum: "$total_amount" },
        count: { $sum: 1 }
      }
    };
    
    const project = {
      $project: {
        month: "$_id.month",
        status: "$_id.status",
        totalAmount: 1,
        count: 1,
        _id: 0
      }
    };
    
    const data = await Sale.aggregate([
      { 
        $match: {
          date: {
            $gte: new Date(currentYear, 0, 1),
            $lt: new Date(currentYear + 1, 0, 1)
          }
        }
      },
      group,
      project,
      { $sort: { month: 1 } }
    ]);
    
    res.json({
      success: true,
      data
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
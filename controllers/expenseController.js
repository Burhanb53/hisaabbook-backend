const Expense = require('../models/Expense');
const Transaction = require('../models/Transaction');

// Helper function to generate IDs
const generateId = (prefix) => {
  const now = new Date();
  return `${prefix}${now.getFullYear().toString().slice(-2)}` +
    `${(now.getMonth() + 1).toString().padStart(2, '0')}` +
    `${now.getDate().toString().padStart(2, '0')}` +
    `${Math.floor(1000 + Math.random() * 9000)}`;
};

// @desc    Create new expense with transaction
// @route   POST /api/expenses
exports.createExpense = async (req, res) => {
  try {
    const { amount, mode, reason, date } = req.body;

    // Validate required fields
    if (!amount || !mode || !reason) {
      return res.status(400).json({
        success: false,
        error: 'Amount, mode and reason are required'
      });
    }

    // Generate IDs
    const expense_id = generateId('EXP');
    const transaction_id = generateId('TXN');

    // Parse the date (use current date if not provided)
    const expenseDate = date ? new Date(date) : new Date();

    // Create expense record
    const expense = await Expense.create({
      expense_id,
      amount,
      mode,
      reason,
      date: expenseDate,
      transaction: transaction_id
    });

    // Create associated transaction
    await Transaction.create({
      transaction_id,
      reference_id: expense_id,
      type: 'Out',
      transaction_type: 'Expense',
      reason,
      mode,
      amount,
      date_time: expenseDate
    });

    res.status(201).json({
      success: true,
      data: expense
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get all expenses (newest first)
// @route   GET /api/expenses
exports.getAllExpenses = async (req, res) => {
  try {
    const expenses = await Expense.find().sort({ createdAt: -1 });
    res.json({
      success: true,
      count: expenses.length,
      data: expenses
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get expense by ID with transaction details
// @route   GET /api/expenses/:id
exports.getExpenseDetails = async (req, res) => {
  try {
    const expense = await Expense.findOne({ expense_id: req.params.id });
    
    if (!expense) {
      return res.status(404).json({
        success: false,
        error: 'Expense not found'
      });
    }

    const transaction = await Transaction.findOne({ 
      transaction_id: expense.transaction 
    });

    res.json({
      success: true,
      data: {
        ...expense.toObject(),
        transaction_details: transaction
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get expenses summary by payment mode (for pie chart)
// @route   GET /api/expenses/summary/mode
// @query   year=YYYY&month=MM&compareYear=YYYY&compareMonth=MM
exports.getExpenseSummaryByMode = async (req, res) => {
  try {
    const { year, month, compareYear, compareMonth } = req.query;
    
    // Validate required parameters
    if (!year) {
      return res.status(400).json({
        success: false,
        error: 'Year parameter is required'
      });
    }

    // Base match conditions
    const matchConditions = {};
    const compareMatchConditions = {};
    
    // Set up current period filters
    const y = parseInt(year);
    const m = month ? parseInt(month) - 1 : null;
    
    matchConditions.date = {
      $gte: m !== null ? new Date(y, m, 1) : new Date(y, 0, 1),
      $lte: m !== null ? new Date(y, m + 1, 0) : new Date(y, 11, 31)
    };
    
    // Set up comparison period filters if requested
    if (compareYear) {
      const cy = parseInt(compareYear);
      const cm = compareMonth ? parseInt(compareMonth) - 1 : null;
      
      compareMatchConditions.date = {
        $gte: cm !== null ? new Date(cy, cm, 1) : new Date(cy, 0, 1),
        $lte: cm !== null ? new Date(cy, cm + 1, 0) : new Date(cy, 11, 31)
      };
    }
    
    // Main aggregation pipeline for current period
    const summaryPipeline = [
      { $match: matchConditions },
      {
        $group: {
          _id: "$mode",
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
          average: { $avg: "$amount" }
        }
      },
      {
        $project: {
          paymentMode: "$_id",
          totalAmount: 1,
          count: 1,
          average: { $round: ["$average", 2] },
          _id: 0
        }
      },
      { $sort: { totalAmount: -1 } }
    ];
    
    const summary = await Expense.aggregate(summaryPipeline);
    
    // Get comparison data if requested
    let comparison = null;
    if (compareYear) {
      const comparePipeline = [
        { $match: compareMatchConditions },
        {
          $group: {
            _id: "$mode",
            totalAmount: { $sum: "$amount" },
            count: { $sum: 1 },
            average: { $avg: "$amount" }
          }
        },
        {
          $project: {
            paymentMode: "$_id",
            totalAmount: 1,
            count: 1,
            average: { $round: ["$average", 2] },
            _id: 0
          }
        },
        { $sort: { totalAmount: -1 } }
      ];
      
      comparison = await Expense.aggregate(comparePipeline);
      
      // Calculate changes between periods for each payment mode
      const summaryWithChanges = summary.map(currentMode => {
        const compareMode = comparison.find(c => c.paymentMode === currentMode.paymentMode);
        if (!compareMode) return currentMode;
        
        const amountChange = currentMode.totalAmount - compareMode.totalAmount;
        const percentChange = compareMode.totalAmount > 0 
          ? (amountChange / compareMode.totalAmount) * 100 
          : 0;
        
        return {
          ...currentMode,
          changeFromComparison: {
            amount: amountChange,
            percent: parseFloat(percentChange.toFixed(2))
          }
        };
      });
    }
    
    res.json({
      success: true,
      data: {
        currentPeriod: summary,
        comparisonPeriod: comparison
      },
      meta: {
        period: {
          year,
          month,
          description: month 
            ? `${new Date(y, m, 1).toLocaleString('default', { month: 'long' })} ${year}`
            : `Year ${year}`
        },
        comparisonPeriod: compareYear 
          ? {
              year: compareYear,
              month: compareMonth,
              description: compareMonth
                ? `${new Date(parseInt(compareYear), parseInt(compareMonth)-1, 1).toLocaleString('default', { month: 'long' })} ${compareYear}`
                : `Year ${compareYear}`
            }
          : null
      }
    });
  } catch (error) {
    console.error('Error in getExpenseSummaryByMode:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while processing payment mode summary'
    });
  }
};

// @desc    Get expenses by category with comparison support
// @route   GET /api/expenses/summary/category
// @query   year=YYYY&month=MM&compareYear=YYYY&compareMonth=MM
exports.getExpenseSummaryByCategory = async (req, res) => {
  try {
    const { year, month, compareYear, compareMonth } = req.query;
    
    // Validate required parameters
    if (!year) {
      return res.status(400).json({
        success: false,
        error: 'Year parameter is required'
      });
    }

    // Base match conditions
    const matchConditions = {};
    const compareMatchConditions = {};
    
    // Set up current period filters
    const y = parseInt(year);
    const m = month ? parseInt(month) - 1 : null;
    
    matchConditions.date = {
      $gte: m !== null ? new Date(y, m, 1) : new Date(y, 0, 1),
      $lte: m !== null ? new Date(y, m + 1, 0) : new Date(y, 11, 31)
    };
    
    // Set up comparison period filters if requested
    if (compareYear) {
      const cy = parseInt(compareYear);
      const cm = compareMonth ? parseInt(compareMonth) - 1 : null;
      
      compareMatchConditions.date = {
        $gte: cm !== null ? new Date(cy, cm, 1) : new Date(cy, 0, 1),
        $lte: cm !== null ? new Date(cy, cm + 1, 0) : new Date(cy, 11, 31)
      };
    }
    
    // Main aggregation pipeline for current period
    const summaryPipeline = [
      { $match: matchConditions },
      {
        $group: {
          _id: "$reason",
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
          average: { $avg: "$amount" }
        }
      },
      {
        $project: {
          categoryName: "$_id",
          totalAmount: 1,
          count: 1,
          average: { $round: ["$average", 2] },
          _id: 0
        }
      },
      { $sort: { totalAmount: -1 } }
    ];
    
    const summary = await Expense.aggregate(summaryPipeline);
    
    // Get comparison data if requested
    let comparison = null;
    if (compareYear) {
      const comparePipeline = [
        { $match: compareMatchConditions },
        {
          $group: {
            _id: "$reason",
            totalAmount: { $sum: "$amount" },
            count: { $sum: 1 },
            average: { $avg: "$amount" }
          }
        },
        {
          $project: {
            categoryName: "$_id",
            totalAmount: 1,
            count: 1,
            average: { $round: ["$average", 2] },
            _id: 0
          }
        },
        { $sort: { totalAmount: -1 } }
      ];
      
      comparison = await Expense.aggregate(comparePipeline);
      
      // Calculate changes between periods for each category
      const summaryWithChanges = summary.map(currentCat => {
        const compareCat = comparison.find(c => c.categoryName === currentCat.categoryName);
        if (!compareCat) return currentCat;
        
        const amountChange = currentCat.totalAmount - compareCat.totalAmount;
        const percentChange = compareCat.totalAmount > 0 
          ? (amountChange / compareCat.totalAmount) * 100 
          : 0;
        
        return {
          ...currentCat,
          changeFromComparison: {
            amount: amountChange,
            percent: parseFloat(percentChange.toFixed(2))
          }
        };
      });
    }
    
    res.json({
      success: true,
      data: {
        currentPeriod: summary,
        comparisonPeriod: comparison
      },
      meta: {
        period: {
          year,
          month,
          description: month 
            ? `${new Date(y, m, 1).toLocaleString('default', { month: 'long' })} ${year}`
            : `Year ${year}`
        },
        comparisonPeriod: compareYear 
          ? {
              year: compareYear,
              month: compareMonth,
              description: compareMonth
                ? `${new Date(parseInt(compareYear), parseInt(compareMonth)-1, 1).toLocaleString('default', { month: 'long' })} ${compareYear}`
                : `Year ${compareYear}`
            }
          : null
      }
    });
  } catch (error) {
    console.error('Error in getExpenseSummaryByCategory:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while processing category summary'
    });
  }
};

// @desc    Get daily expenses with comparison support
// @route   GET /api/expenses/summary/daily
// @query   year=YYYY&month=MM&compareYear=YYYY&compareMonth=MM
exports.getDailyExpenses = async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const compareYear = parseInt(req.query.compareYear);
    const compareMonth = parseInt(req.query.compareMonth);
    
    // Main period processing
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    const daysInMonth = endDate.getDate();
    
    const dailyExpenses = await Expense.aggregate([
      {
        $match: {
          date: {
            $gte: startDate,
            $lte: endDate
          }
        }
      },
      {
        $group: {
          _id: { $dayOfMonth: "$date" },
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          day: "$_id",
          totalAmount: 1,
          count: 1,
          _id: 0
        }
      },
      { $sort: { day: 1 } }
    ]);
    
    // Fill in missing days
    const filledDailyExpenses = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const foundDay = dailyExpenses.find(d => d.day === day);
      return foundDay || { day, totalAmount: 0, count: 0 };
    });
    
    // Comparison period processing if requested
    let comparisonData = null;
    let comparisonDaysInMonth = 0;
    
    if (compareYear && compareMonth) {
      const compareStartDate = new Date(compareYear, compareMonth - 1, 1);
      const compareEndDate = new Date(compareYear, compareMonth, 0);
      comparisonDaysInMonth = compareEndDate.getDate();
      
      const compareDailyExpenses = await Expense.aggregate([
        {
          $match: {
            date: {
              $gte: compareStartDate,
              $lte: compareEndDate
            }
          }
        },
        {
          $group: {
            _id: { $dayOfMonth: "$date" },
            totalAmount: { $sum: "$amount" },
            count: { $sum: 1 }
          }
        },
        {
          $project: {
            day: "$_id",
            totalAmount: 1,
            count: 1,
            _id: 0
          }
        },
        { $sort: { day: 1 } }
      ]);
      
      // Fill in missing days for comparison
      comparisonData = Array.from({ length: comparisonDaysInMonth }, (_, i) => {
        const day = i + 1;
        const foundDay = compareDailyExpenses.find(d => d.day === day);
        return foundDay || { day, totalAmount: 0, count: 0 };
      });
    }
    
    res.json({
      success: true,
      data: {
        currentPeriod: filledDailyExpenses,
        comparisonPeriod: comparisonData
      },
      meta: {
        period: {
          year,
          month,
          monthName: startDate.toLocaleString('default', { month: 'long' }),
          daysInMonth
        },
        comparisonPeriod: comparisonData ? {
          year: compareYear,
          month: compareMonth,
          monthName: new Date(compareYear, compareMonth-1, 1).toLocaleString('default', { month: 'long' }),
          daysInMonth: comparisonDaysInMonth
        } : null
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get monthly expenses with comparison support
// @route   GET /api/expenses/summary/monthly
// @query   year=YYYY&compareYear=YYYY
exports.getMonthlyExpenses = async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const compareYear = parseInt(req.query.compareYear);
    
    // Main year processing
    const monthlyExpenses = await Expense.aggregate([
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
      {
        $project: {
          month: "$_id",
          totalAmount: 1,
          count: 1,
          _id: 0
        }
      },
      { $sort: { month: 1 } }
    ]);
    
    // Fill in missing months
    const filledMonthlyExpenses = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const foundMonth = monthlyExpenses.find(m => m.month === month);
      return foundMonth || { month, totalAmount: 0, count: 0 };
    });
    
    // Comparison year processing if requested
    let comparisonData = null;
    
    if (compareYear) {
      const compareMonthlyExpenses = await Expense.aggregate([
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
        {
          $project: {
            month: "$_id",
            totalAmount: 1,
            count: 1,
            _id: 0
          }
        },
        { $sort: { month: 1 } }
      ]);
      
      // Fill in missing months for comparison
      comparisonData = Array.from({ length: 12 }, (_, i) => {
        const month = i + 1;
        const foundMonth = compareMonthlyExpenses.find(m => m.month === month);
        return foundMonth || { month, totalAmount: 0, count: 0 };
      });
    }
    
    res.json({
      success: true,
      data: {
        currentPeriod: filledMonthlyExpenses,
        comparisonPeriod: comparisonData
      },
      meta: {
        period: {
          year,
          description: `Year ${year}`
        },
        comparisonPeriod: compareYear ? {
          year: compareYear,
          description: `Year ${compareYear}`
        } : null
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get yearly expenses with trend analysis
// @route   GET /api/expenses/summary/yearly
// @query   years=5 (number of years to include)
exports.getYearlyExpenses = async (req, res) => {
  try {
    const yearsBack = parseInt(req.query.years) || 5;
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - yearsBack + 1;
    
    const yearlyExpenses = await Expense.aggregate([
      {
        $match: {
          date: {
            $gte: new Date(startYear, 0, 1),
            $lte: new Date(currentYear, 11, 31)
          }
        }
      },
      {
        $group: {
          _id: { $year: "$date" },
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
          average: { $avg: "$amount" }
        }
      },
      {
        $project: {
          year: "$_id",
          totalAmount: 1,
          count: 1,
          average: { $round: ["$average", 2] },
          _id: 0
        }
      },
      { $sort: { year: 1 } }
    ]);
    
    // Calculate year-over-year changes
    const expensesWithChanges = yearlyExpenses.map((yearData, index, array) => {
      if (index === 0) return yearData;
      
      const prevYear = array[index - 1];
      const amountChange = yearData.totalAmount - prevYear.totalAmount;
      const percentChange = (amountChange / prevYear.totalAmount) * 100;
      
      return {
        ...yearData,
        changeFromPrevious: {
          amount: amountChange,
          percent: parseFloat(percentChange.toFixed(2))
        }
      };
    });
    
    res.json({
      success: true,
      data: expensesWithChanges,
      meta: {
        period: `${startYear}-${currentYear}`,
        yearsIncluded: yearsBack
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};



// @desc    Get expense trends by time period (weekday, month, hour)
// @route   GET /api/expenses/summary/trends
// @query   year=YYYY&month=MM
exports.getExpenseTrends = async (req, res) => {
  try {
    const year = parseInt(req.query.year);
    const month = parseInt(req.query.month);
    
    const matchConditions = {};
    if (year) {
      const y = parseInt(year);
      const m = month ? parseInt(month) - 1 : null;
      
      matchConditions.date = {
        $gte: m !== null ? new Date(y, m, 1) : new Date(y, 0, 1),
        $lte: m !== null ? new Date(y, m + 1, 0) : new Date(y, 11, 31)
      };
    }
    
    const trends = await Expense.aggregate([
      { $match: matchConditions },
      {
        $facet: {
          byWeekday: [
            {
              $group: {
                _id: { $dayOfWeek: "$date" },
                totalAmount: { $sum: "$amount" },
                count: { $sum: 1 },
                average: { $avg: "$amount" }
              }
            },
            { $sort: { _id: 1 } },
            {
              $project: {
                weekday: "$_id",
                totalAmount: 1,
                count: 1,
                average: { $round: ["$average", 2] },
                _id: 0
              }
            }
          ],
          byMonth: [
            {
              $group: {
                _id: { $month: "$date" },
                totalAmount: { $sum: "$amount" },
                count: { $sum: 1 },
                average: { $avg: "$amount" }
              }
            },
            { $sort: { _id: 1 } },
            {
              $project: {
                month: "$_id",
                totalAmount: 1,
                count: 1,
                average: { $round: ["$average", 2] },
                _id: 0
              }
            }
          ],
          byHour: [
            {
              $group: {
                _id: { $hour: "$date" },
                totalAmount: { $sum: "$amount" },
                count: { $sum: 1 },
                average: { $avg: "$amount" }
              }
            },
            { $sort: { _id: 1 } },
            {
              $project: {
                hour: "$_id",
                totalAmount: 1,
                count: 1,
                average: { $round: ["$average", 2] },
                _id: 0
              }
            }
          ]
        }
      }
    ]);
    
    // Convert weekday numbers to names
    const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const byWeekday = trends[0].byWeekday.map(w => ({
      ...w,
      weekdayName: weekdayNames[w.weekday - 1]
    }));
    
    // Convert month numbers to names
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December'];
    const byMonth = trends[0].byMonth.map(m => ({
      ...m,
      monthName: monthNames[m.month - 1]
    }));
    
    res.json({
      success: true,
      data: {
        byWeekday,
        byMonth,
        byHour: trends[0].byHour
      },
      meta: {
        period: {
          year,
          month,
          description: month 
            ? `${new Date(year, month-1, 1).toLocaleString('default', { month: 'long' })} ${year}`
            : year ? `Year ${year}` : 'All time'
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Delete expense and associated transaction
// @route   DELETE /api/expenses/:id
exports.deleteExpense = async (req, res) => {
  try {
    const expense = await Expense.findOne({ expense_id: req.params.expense_id });
    
    if (!expense) {
      return res.status(404).json({
        success: false,
        error: 'Expense not found'
      });
    }

    // Delete associated transaction
    await Transaction.deleteOne({ 
      transaction_id: expense.transaction 
    });

    // Delete the expense
    await Expense.deleteOne({ expense_id: req.params.id });

    res.json({
      success: true,
      data: {
        message: 'Expense and associated transaction deleted successfully'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};


// @desc    Get available years with expense data
// @route   GET /api/expenses/available-years
// @access  Private
exports.getAvailableYears = async (req, res) => {
  try {
    const result = await Expense.aggregate([
      {
        $group: {
          _id: null,
          years: { $addToSet: { $year: "$date" } }
        }
      },
      { $project: { _id: 0, years: 1 } }
    ]);
    
    const years = result.length > 0 ? result[0].years.sort((a, b) => b - a) : [];
    res.json({ success: true, data: years });
  } catch (error) {
    console.error('Error fetching available years:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error while fetching available years' 
    });
  }
};
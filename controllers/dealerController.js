const Dealer = require('../models/Dealer');
const { v4: uuidv4 } = require('uuid');

// Helper function to generate dealer ID
const generateDealerId = () => {
  return 'DLR-' + uuidv4().substring(0, 8).toUpperCase();
};

// @desc    Create new dealer
// @route   POST /api/dealers
exports.createDealer = async (req, res) => {
  try {
    const { name, contact, address } = req.body;

    // Basic validation
    if (!name || !contact) {
      return res.status(400).json({
        success: false,
        error: 'Name and contact are required fields'
      });
    }

    const dealer = await Dealer.create({
      dealer_id: generateDealerId(),
      name,
      contact,
      address: address || '' // Optional field
    });

    res.status(201).json({
      success: true,
      data: dealer
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get all dealers
// @route   GET /api/dealers
exports.getAllDealers = async (req, res) => {
  try {
    const dealers = await Dealer.find().sort({ createdAt: -1 }); // Newest first
    res.status(200).json({
      success: true,
      count: dealers.length,
      data: dealers
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get single dealer by ID
// @route   GET /api/dealers/:id
exports.getDealerById = async (req, res) => {
  try {
    const dealer = await Dealer.findOne({ dealer_id: req.params.id });
    
    if (!dealer) {
      return res.status(404).json({
        success: false,
        error: 'Dealer not found'
      });
    }

    res.status(200).json({
      success: true,
      data: dealer
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Update dealer
// @route   PUT /api/dealers/:id
exports.updateDealer = async (req, res) => {
  try {
    const { name, contact, address } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (contact !== undefined) updates.contact = contact;
    if (address !== undefined) updates.address = address;

    const dealer = await Dealer.findOneAndUpdate(
      { dealer_id: req.params.id },
      updates,
      { new: true, runValidators: true }
    );

    if (!dealer) {
      return res.status(404).json({
        success: false,
        error: 'Dealer not found'
      });
    }

    res.status(200).json({
      success: true,
      data: dealer
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Delete dealer
// @route   DELETE /api/dealers/:id
exports.deleteDealer = async (req, res) => {
  try {
    const dealer = await Dealer.findOneAndDelete({ dealer_id: req.params.id });

    if (!dealer) {
      return res.status(404).json({
        success: false,
        error: 'Dealer not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
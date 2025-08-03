const { successResponse, errorResponse } = require('../utils/apiResponse');
const asyncHandler = require('express-async-handler');
const Organizer = require('../models/Organizer');

const createOrganizer = asyncHandler(async (req, res) => {
  const organizer = new Organizer(req.body);
  await organizer.save();
  successResponse(res, organizer, 201);
});

const getOrganizers = asyncHandler(async (req, res) => {
  const organizers = await Organizer.find({});
  successResponse(res, organizers);
});

const getOrganizerById = asyncHandler(async (req, res) => {
  const { id } = req.body;
  const organizer = await Organizer.findById(id);
  if (!organizer) return errorResponse(res, 'Organizer not found', 404);
  successResponse(res, organizer);
});

const updateOrganizer = asyncHandler(async (req, res) => {
  const { id, ...updateData } = req.body;
  const organizer = await Organizer.findByIdAndUpdate(id, updateData, { new: true });
  if (!organizer) return errorResponse(res, 'Organizer not found', 404);
  successResponse(res, organizer);
});

const deleteOrganizer = asyncHandler(async (req, res) => {
  const { id } = req.body;
  const organizer = await Organizer.findById(id);
  if (!organizer) return errorResponse(res, 'Organizer not found', 404);
  organizer.isDeleted = true;
  await organizer.save();
  successResponse(res, { message: 'Organizer deleted' });
});

// Get organizer statistics
const getOrganizerStats = asyncHandler(async (req, res) => {
  const totalOrganizers = await Organizer.countDocuments({ isDeleted: false });
  const activeOrganizers = await Organizer.countDocuments({ isDeleted: false, isActive: true });
  const premiumOrganizers = await Organizer.countDocuments({ isDeleted: false, subscription: 'premium' });
  
  const stats = {
    totalOrganizers,
    activeOrganizers,
    premiumOrganizers,
    inactiveOrganizers: totalOrganizers - activeOrganizers
  };
  
  successResponse(res, stats);
});

// Change organizer status
const changeOrganizerStatus = asyncHandler(async (req, res) => {
  const { id, status } = req.body;
  const organizer = await Organizer.findByIdAndUpdate(
    id, 
    { isActive: status === 'active' }, 
    { new: true }
  );
  
  if (!organizer) return errorResponse(res, 'Organizer not found', 404);
  successResponse(res, organizer);
});

// Update subscription
const updateSubscription = asyncHandler(async (req, res) => {
  const { id, subscription, expiryDate } = req.body;
  const organizer = await Organizer.findByIdAndUpdate(
    id, 
    { 
      subscription, 
      subscriptionExpiry: new Date(expiryDate) 
    }, 
    { new: true }
  );
  
  if (!organizer) return errorResponse(res, 'Organizer not found', 404);
  successResponse(res, organizer);
});

module.exports = { 
  createOrganizer, 
  getOrganizers, 
  getOrganizerById, 
  updateOrganizer, 
  deleteOrganizer,
  getOrganizerStats,
  changeOrganizerStatus,
  updateSubscription
};
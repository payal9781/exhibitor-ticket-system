const { successResponse, errorResponse } = require('../utils/apiResponse');
const asyncHandler = require('express-async-handler');
const Organizer = require('../models/Organizer');

const createOrganizer = asyncHandler(async (req, res) => {
  const { firstName, lastName, company, ...rest } = req.body;
  
  // Combine firstName and lastName into name field
  const name = firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName || '';
  
  // Map company to organizationName if provided
  const organizationName = company || rest.organizationName || '';
  
  const organizerData = {
    ...rest,
    name,
    organizationName
  };
  
  const organizer = new Organizer(organizerData);
  await organizer.save();
  
  // Return organizer with firstName and lastName for frontend compatibility
  const response = {
    ...organizer.toObject(),
    firstName: firstName || '',
    lastName: lastName || ''
  };
  
  successResponse(res, response, 201);
});

const getOrganizers = asyncHandler(async (req, res) => {
  const { search, page = 1, limit = 10 } = req.body;
  let query = { isDeleted: false };
  
  // Add search functionality
  if (search && search.trim()) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
      { organizationName: { $regex: search, $options: 'i' } }
    ];
  }
  
  // Calculate pagination
  const skip = (page - 1) * limit;
  const total = await Organizer.countDocuments(query);
  
  const organizers = await Organizer.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));
  
  const response = {
    organizers,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      itemsPerPage: parseInt(limit)
    }
  };
  
  successResponse(res, response);
});

const getOrganizerById = asyncHandler(async (req, res) => {
  const { id } = req.body;
  const organizer = await Organizer.findById(id);
  if (!organizer) return errorResponse(res, 'Organizer not found', 404);
  successResponse(res, organizer);
});

const updateOrganizer = asyncHandler(async (req, res) => {
  const { _id, ...updateData } = req.body;

  if(updateData.firstName && updateData.lastName){
    const name = updateData.firstName && updateData.lastName ? `${updateData.firstName} ${updateData.lastName}` : updateData.firstName || updateData.lastName || '';
    updateData.name = name;
  }

  const organizer = await Organizer.findByIdAndUpdate(_id, updateData, { new: true });
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
  
  const stats = {
    totalOrganizers,
    activeOrganizers,
    inactiveOrganizers: totalOrganizers - activeOrganizers
  };
  
  successResponse(res, stats);
});





module.exports = { 
  createOrganizer, 
  getOrganizers, 
  getOrganizerById, 
  updateOrganizer, 
  deleteOrganizer,
  getOrganizerStats
};
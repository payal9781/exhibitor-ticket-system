const { successResponse, errorResponse } = require('../utils/apiResponse');
const asyncHandler = require('express-async-handler');
const Exhibitor = require('../models/Exhibitor');
const Event = require('../models/Event');
const Organizer = require('../models/Organizer');
const Visitor = require('../models/Visitor');

const createExhibitor = asyncHandler(async (req, res) => {
  const exhibitor = new Exhibitor(req.body);
  const isExists = await Exhibitor.findOne({ email: exhibitor.email });
  if(isExists && !isExists?.isDeleted && isExists?.isActive){
     return errorResponse(res,'Email already exists',409)
  }
  if(isExists && isExists?.isDeleted && !isExists?.isActive){
    return errorResponse(res,'contact to adminitrator',409)
  }
  await exhibitor.save();
  successResponse(res, exhibitor, 201);
});

const getExhibitors = asyncHandler(async (req, res) => {
  const exhibitors = await Exhibitor.find({isActive:true ,isDeleted: false});
  successResponse(res, exhibitors);
});

const getExhibitorById = asyncHandler(async (req, res) => {
  const { id } = req.body; // Changed from params to body
  const exhibitor = await Exhibitor.findById(id);
  if (!exhibitor) return errorResponse(res, 'Exhibitor not found', 404);
  successResponse(res, exhibitor);
});

const updateExhibitor = asyncHandler(async (req, res) => {
  const { id, ...updateData } = req.body; // Changed from params to body
  const exhibitor = await Exhibitor.findByIdAndUpdate(id, updateData, { new: true });
  if (!exhibitor) return errorResponse(res, 'Exhibitor not found', 404);
  successResponse(res, exhibitor);
});

const deleteExhibitor = asyncHandler(async (req, res) => {
  const { id } = req.body; // Changed from params to body
  const exhibitor = await Exhibitor.findById(id);
  if (!exhibitor) return errorResponse(res, 'Exhibitor not found', 404);
  exhibitor.isDeleted = true;
  await exhibitor.save();
  successResponse(res, { message: 'Exhibitor deleted' });
});

const getOrganizersEventWise = asyncHandler(async (req, res) => {
  const events = await Event.aggregate([
    { $group: { _id: '$organizerId', events: { $push: '$$ROOT' } } },
    { $lookup: { from: 'organizers', localField: '_id', foreignField: '_id', as: 'organizer' } },
    { $unwind: '$organizer' }
  ]);
  successResponse(res, events);
});

const getEventsOrganizerWise = asyncHandler(async (req, res) => {
  const { organizerId } = req.body; // Changed from query to body
  const events = await Event.find({ organizerId });
  successResponse(res, events);
});

const getParticipantsEventWise = asyncHandler(async (req, res) => {
  const { eventId, type } = req.body; // Changed from query to body
  const event = await Event.findById(eventId).populate(type === 'visitor' ? 'visitor' : 'exhibitor');
  successResponse(res, event ? event[type] : []);
});

const getUserDetails = asyncHandler(async (req, res) => {
  const { userId, userType } = req.body; // Changed from params to body
  const Model = userType === 'visitor' ? Visitor : Exhibitor;
  const user = await Model.findById(userId);
  if (!user) return errorResponse(res, 'User not found', 404);
  successResponse(res, user);
});

// Get exhibitor statistics
const getExhibitorStats = asyncHandler(async (req, res) => {
  const totalExhibitors = await Exhibitor.countDocuments({ isDeleted: false });
  const activeExhibitors = await Exhibitor.countDocuments({ isDeleted: false, isActive: true });
  const checkedInExhibitors = await Exhibitor.countDocuments({ isDeleted: false, isCheckedIn: true });
  
  const stats = {
    totalExhibitors,
    activeExhibitors,
    checkedInExhibitors,
    inactiveExhibitors: totalExhibitors - activeExhibitors
  };
  
  successResponse(res, stats);
});

// Get available booths for an event
const getAvailableBooths = asyncHandler(async (req, res) => {
  const { eventId } = req.body;
  
  // Mock booth data - in real implementation, this would come from a Booth model
  const booths = [
    { id: 'A1', name: 'Booth A1', size: 'Large', price: 5000, available: true },
    { id: 'A2', name: 'Booth A2', size: 'Medium', price: 3000, available: true },
    { id: 'A3', name: 'Booth A3', size: 'Small', price: 2000, available: false },
    { id: 'B1', name: 'Booth B1', size: 'Large', price: 5000, available: true },
    { id: 'B2', name: 'Booth B2', size: 'Medium', price: 3000, available: true }
  ];
  
  const availableBooths = booths.filter(booth => booth.available);
  successResponse(res, availableBooths);
});

// Check in exhibitor
const checkInExhibitor = asyncHandler(async (req, res) => {
  const { id } = req.body;
  const exhibitor = await Exhibitor.findByIdAndUpdate(
    id, 
    { 
      isCheckedIn: true, 
      checkInTime: new Date() 
    }, 
    { new: true }
  );
  
  if (!exhibitor) return errorResponse(res, 'Exhibitor not found', 404);
  successResponse(res, exhibitor);
});

// Check out exhibitor
const checkOutExhibitor = asyncHandler(async (req, res) => {
  const { id } = req.body;
  const exhibitor = await Exhibitor.findByIdAndUpdate(
    id, 
    { 
      isCheckedIn: false, 
      checkOutTime: new Date() 
    }, 
    { new: true }
  );
  
  if (!exhibitor) return errorResponse(res, 'Exhibitor not found', 404);
  successResponse(res, exhibitor);
});

module.exports = { 
  createExhibitor, 
  getExhibitors, 
  getExhibitorById, 
  updateExhibitor, 
  deleteExhibitor, 
  getOrganizersEventWise, 
  getEventsOrganizerWise, 
  getParticipantsEventWise, 
  getUserDetails,
  getExhibitorStats,
  getAvailableBooths,
  checkInExhibitor,
  checkOutExhibitor
};
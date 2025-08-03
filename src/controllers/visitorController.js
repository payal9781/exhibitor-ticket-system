const { successResponse, errorResponse } = require('../utils/apiResponse');
const asyncHandler = require('express-async-handler');
const Visitor = require('../models/Visitor');
const Event = require('../models/Event');
const Organizer = require('../models/Organizer');
const Exhibitor = require('../models/Exhibitor');

const createVisitor = asyncHandler(async (req, res) => {
  const visitor = new Visitor(req.body);
  const isExists = await Visitor.findOne({ email: visitor.email });
  if(isExists && isExists?.isActive && !isExists?.isDeleted){
    return errorResponse(res,'Email already exists');
  }
  if(isExists && !isExists?.isActive && isExists?.isDeleted){
    return errorResponse(res,'contact to adminitrator');
  }
  await visitor.save();
  successResponse(res, visitor, 201);
});

const getVisitors = asyncHandler(async (req, res) => {
  const visitors = await Visitor.find({isActive:true ,isDeleted: false});
  successResponse(res, visitors);
});

const getVisitorById = asyncHandler(async (req, res) => {
  const { id } = req.body; // Changed from params to body
  const visitor = await Visitor.findById(id);
  if (!visitor) return errorResponse(res, 'Visitor not found', 404);
  successResponse(res, visitor);
});

const updateVisitor = asyncHandler(async (req, res) => {
  const { id, ...updateData } = req.body; // Changed from params to body
  const visitor = await Visitor.findByIdAndUpdate(id, updateData, { new: true });
  if (!visitor) return errorResponse(res, 'Visitor not found', 404);
  successResponse(res, visitor);
});

const deleteVisitor = asyncHandler(async (req, res) => {
  const { id } = req.body; // Changed from params to body
  const visitor = await Visitor.findById(id);
  if (!visitor) return errorResponse(res, 'Visitor not found', 404);
  visitor.isDeleted = true;
  await visitor.save();
  successResponse(res, { message: 'Visitor deleted' });
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

// Get visitor statistics
const getVisitorStats = asyncHandler(async (req, res) => {
  const totalVisitors = await Visitor.countDocuments({ isDeleted: false });
  const activeVisitors = await Visitor.countDocuments({ isDeleted: false, isActive: true });
  const checkedInVisitors = await Visitor.countDocuments({ isDeleted: false, isCheckedIn: true });
  
  const stats = {
    totalVisitors,
    activeVisitors,
    checkedInVisitors,
    inactiveVisitors: totalVisitors - activeVisitors
  };
  
  successResponse(res, stats);
});

// Check in visitor
const checkInVisitor = asyncHandler(async (req, res) => {
  const { id } = req.body;
  const visitor = await Visitor.findByIdAndUpdate(
    id, 
    { 
      isCheckedIn: true, 
      checkInTime: new Date() 
    }, 
    { new: true }
  );
  
  if (!visitor) return errorResponse(res, 'Visitor not found', 404);
  successResponse(res, visitor);
});

// Check out visitor
const checkOutVisitor = asyncHandler(async (req, res) => {
  const { id } = req.body;
  const visitor = await Visitor.findByIdAndUpdate(
    id, 
    { 
      isCheckedIn: false, 
      checkOutTime: new Date() 
    }, 
    { new: true }
  );
  
  if (!visitor) return errorResponse(res, 'Visitor not found', 404);
  successResponse(res, visitor);
});

// Bulk check in visitors
const bulkCheckIn = asyncHandler(async (req, res) => {
  const { visitorIds } = req.body;
  const visitors = await Visitor.updateMany(
    { _id: { $in: visitorIds }, isDeleted: false },
    { 
      isCheckedIn: true, 
      checkInTime: new Date() 
    },
    { new: true }
  );
  
  const updatedVisitors = await Visitor.find({ _id: { $in: visitorIds }, isDeleted: false });
  successResponse(res, updatedVisitors);
});

module.exports = { 
  createVisitor, 
  getVisitors, 
  getVisitorById, 
  updateVisitor, 
  deleteVisitor, 
  getOrganizersEventWise, 
  getEventsOrganizerWise, 
  getParticipantsEventWise, 
  getUserDetails,
  getVisitorStats,
  checkInVisitor,
  checkOutVisitor,
  bulkCheckIn
};
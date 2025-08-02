const { successResponse, errorResponse } = require('../utils/apiResponse');
const asyncHandler = require('express-async-handler');
const Visitor = require('../models/Visitor');
const Event = require('../models/Event');
const Organizer = require('../models/Organizer');
const Exhibitor = require('../models/Exhibitor');

const createVisitor = asyncHandler(async (req, res) => {
  const visitor = new Visitor(req.body);
  await visitor.save();
  successResponse(res, visitor, 201);
});

const getVisitors = asyncHandler(async (req, res) => {
  const visitors = await Visitor.find({});
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

module.exports = { createVisitor, getVisitors, getVisitorById, updateVisitor, deleteVisitor, getOrganizersEventWise, getEventsOrganizerWise, getParticipantsEventWise, getUserDetails };
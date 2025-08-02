const { successResponse, errorResponse } = require('../utils/apiResponse');
const asyncHandler = require('express-async-handler');
const Exhibitor = require('../models/Exhibitor');
const Event = require('../models/Event');
const Organizer = require('../models/Organizer');
const Visitor = require('../models/Visitor');

const createExhibitor = asyncHandler(async (req, res) => {
  const exhibitor = new Exhibitor(req.body);
  await exhibitor.save();
  successResponse(res, exhibitor, 201);
});

const getExhibitors = asyncHandler(async (req, res) => {
  const exhibitors = await Exhibitor.find({});
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

module.exports = { createExhibitor, getExhibitors, getExhibitorById, updateExhibitor, deleteExhibitor, getOrganizersEventWise, getEventsOrganizerWise, getParticipantsEventWise, getUserDetails };
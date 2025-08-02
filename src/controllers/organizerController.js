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
  const organizer = await Organizer.findById(req.params.id);
  if (!organizer) return errorResponse(res, 'Organizer not found', 404);
  successResponse(res, organizer);
});

const updateOrganizer = asyncHandler(async (req, res) => {
  const organizer = await Organizer.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!organizer) return errorResponse(res, 'Organizer not found', 404);
  successResponse(res, organizer);
});

const deleteOrganizer = asyncHandler(async (req, res) => {
  const organizer = await Organizer.findById(req.params.id);
  if (!organizer) return errorResponse(res, 'Organizer not found', 404);
  organizer.isDeleted = true;
  await organizer.save();
  successResponse(res, { message: 'Organizer deleted' });
});

module.exports = { createOrganizer, getOrganizers, getOrganizerById, updateOrganizer, deleteOrganizer };
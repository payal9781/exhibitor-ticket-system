
const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const Leads = require('../models/leads');
const Event = require('../models/Event');
const Exhibitor = require('../models/Exhibitor');
const Visitor = require('../models/Visitor');
const authMiddleware = require('../middleware/authMiddleware');
const { successResponse, errorResponse } =  require('../utils/apiResponse');


const createLead = asyncHandler(async (req, res) => {
    const { eventId, data } = req.body;
    const userId = req.user.id;
    const userType = req.user.type;

    // Validate eventId
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return errorResponse(res, 'Invalid event ID', 400);
    }

    // Check if event exists and is active
    const event = await Event.findOne({ _id: eventId, isActive: true, isDeleted: false });
    if (!event) {
      return errorResponse(res, 'Event not found or inactive', 404);
    }

    // Check if user exists
    const userModel = userType === 'exhibitor' ? Exhibitor : Visitor;
    const user = await userModel.findById(userId);
    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }

    // Create lead
    const lead = await Leads.create({
      eventId,
      userId,
      userType,
      data: data || {},
    });

    // Populate user details
    const populatedLead = await Leads.findById(lead._id)
      .populate({
        path: 'userId',
        select: '-otp -otpExpires',
        model: userType === 'exhibitor' ? 'Exhibitor' : 'Visitor',
      })
      .populate('eventId', 'title');

    successResponse(res, { lead: populatedLead });
  });
// Get all leads for the authenticated user

const getLeads = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const userType = req.user.type;
    const { eventId } = req.body;

    const query = { userId, userType };
    if (eventId) {
      if (!mongoose.Types.ObjectId.isValid(eventId)) {
        return errorResponse(res, 'Invalid event ID', 400);
      }
      query.eventId = eventId;
    }

    const leads = await Leads.find(query)
      .populate({
        path: 'userId',
        select: '-otp -otpExpires',
        model: userType === 'exhibitor' ? 'Exhibitor' : 'Visitor',
      })
      .populate('eventId', 'title location fromDate toDate');

    successResponse(res, { leads });
  });


const updateLead = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const userType = req.user.type;
    const { leadId ,data } = req.body;

    if (!mongoose.Types.ObjectId.isValid(leadId)) {
      return errorResponse(res, 'Invalid lead ID', 400);
    }

    const lead = await Leads.findOne({ _id: leadId, userId, userType });
    if (!lead) {
      return errorResponse(res, 'Lead not found', 404);
    }

    lead.data = data || lead.data;
    await lead.save();

    const populatedLead = await Leads.findById(lead._id)
      .populate({
        path: 'userId',
        select: '-otp -otpExpires',
        model: userType === 'exhibitor' ? 'Exhibitor' : 'Visitor',
      })
      .populate('eventId', 'title location fromDate toDate');

    successResponse(res, { lead: populatedLead });
  })

// Delete a lead by ID
const deleteLead =   asyncHandler(async (req, res) => {
    const {leadId }= req.body;
    const userId = req.user.id;
    const userType = req.user.type;

    if (!mongoose.Types.ObjectId.isValid(leadId)) {
      return errorResponse(res, 'Invalid lead ID', 400);
    }

    const lead = await Leads.findOneAndDelete({ _id: leadId, userId, userType });
    if (!lead) {
      return errorResponse(res, 'Lead not found', 404);
    }

    successResponse(res, { message: 'Lead deleted successfully' });
  })

module.exports = {
    createLead,
    getLeads,
    updateLead,
    deleteLead
};

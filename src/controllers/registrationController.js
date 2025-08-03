const { successResponse, errorResponse } = require('../utils/apiResponse');
const asyncHandler = require('express-async-handler');
const Event = require('../models/Event');
const Exhibitor = require('../models/Exhibitor');
const Visitor = require('../models/Visitor');
const UserEventSlot = require('../models/UserEventSlot');
const generateSlots = require('../utils/slotGenerator');

// Get event registration details by registration link
const getEventByRegistrationLink = asyncHandler(async (req, res) => {
  const { registrationLink } = req.params;
  
  const event = await Event.findOne({ 
    registrationLink, 
    isDeleted: false 
  }).populate('organizerId', 'name email companyName');
  
  if (!event) {
    return errorResponse(res, 'Event not found or registration link is invalid', 404);
  }
  
  // Check if event registration is still valid (before event start date)
  const currentDate = new Date();
  const eventStartDate = new Date(event.fromDate);
  
  if (currentDate > eventStartDate) {
    return errorResponse(res, 'Registration for this event has closed. The event has already started.', 400);
  }
  
  // Return event details for registration page
  successResponse(res, {
    event: {
      _id: event._id,
      title: event.title,
      description: event.description,
      fromDate: event.fromDate,
      toDate: event.toDate,
      startTime: event.startTime,
      endTime: event.endTime,
      location: event.location,
      media: event.media,
      organizer: event.organizerId,
      extraDetails: event.extraDetails
    }
  });
});

// Register exhibitor for event
const registerExhibitorForEvent = asyncHandler(async (req, res) => {
  const { registrationLink } = req.params;
  const exhibitorData = req.body;
  
  // Find event by registration link
  const event = await Event.findOne({ 
    registrationLink, 
    isDeleted: false 
  });
  
  if (!event) {
    return errorResponse(res, 'Event not found or registration link is invalid', 404);
  }
  
  // Check if event registration is still valid (before event start date)
  const currentDate = new Date();
  const eventStartDate = new Date(event.fromDate);
  
  if (currentDate > eventStartDate) {
    return errorResponse(res, 'Registration for this event has closed. The event has already started.', 400);
  }
  
  let exhibitor;
  let isNewExhibitor = false;
  
  // Check if exhibitor already exists by phone or email
  if (exhibitorData.phone) {
    exhibitor = await Exhibitor.findOne({ 
      phone: exhibitorData.phone, 
      isDeleted: false 
    });
  }
  
  if (!exhibitor && exhibitorData.email) {
    exhibitor = await Exhibitor.findOne({ 
      email: exhibitorData.email, 
      isDeleted: false 
    });
  }
  
  if (exhibitor) {
    // Update existing exhibitor with new data if provided
    Object.keys(exhibitorData).forEach(key => {
      if (exhibitorData[key] && exhibitorData[key] !== '') {
        exhibitor[key] = exhibitorData[key];
      }
    });
    await exhibitor.save();
  } else {
    // Create new exhibitor
    exhibitor = new Exhibitor({
      ...exhibitorData,
      isActive: true
    });
    await exhibitor.save();
    isNewExhibitor = true;
  }
  
  // Check if exhibitor is already registered for this event
  if (event.exhibitor.includes(exhibitor._id)) {
    return successResponse(res, {
      message: 'Exhibitor is already registered for this event',
      exhibitor: {
        _id: exhibitor._id,
        companyName: exhibitor.companyName,
        email: exhibitor.email,
        phone: exhibitor.phone
      },
      isNewExhibitor: false,
      alreadyRegistered: true
    });
  }
  
  // Add exhibitor to event
  event.exhibitor.push(exhibitor._id);
  await event.save();
  
  // Generate slots for the exhibitor
  const rawSlots = generateSlots(event.fromDate, event.toDate, event.startTime, event.endTime);
  const slots = rawSlots.map(s => ({ ...s, status: 'available' }));
  
  const userSlot = new UserEventSlot({ 
    userId: exhibitor._id, 
    userType: 'exhibitor', 
    eventId: event._id, 
    slots 
  });
  await userSlot.save();
  
  // Generate QR code
  const qrData = { 
    eventId: event._id, 
    userId: exhibitor._id, 
    role: 'exhibitor', 
    startDate: event.fromDate, 
    endDate: event.toDate 
  };
  const qrCode = await require('../utils/qrGenerator')(qrData);
  
  successResponse(res, {
    message: 'Exhibitor registered successfully for the event',
    exhibitor: {
      _id: exhibitor._id,
      companyName: exhibitor.companyName,
      email: exhibitor.email,
      phone: exhibitor.phone
    },
    isNewExhibitor,
    qrCode,
    event: {
      _id: event._id,
      title: event.title,
      fromDate: event.fromDate,
      toDate: event.toDate
    }
  });
});

// Register visitor for event
const registerVisitorForEvent = asyncHandler(async (req, res) => {
  const { registrationLink } = req.params;
  const visitorData = req.body;
  
  // Find event by registration link
  const event = await Event.findOne({ 
    registrationLink, 
    isDeleted: false 
  });
  
  if (!event) {
    return errorResponse(res, 'Event not found or registration link is invalid', 404);
  }
  
  // Check if event registration is still valid (before event start date)
  const currentDate = new Date();
  const eventStartDate = new Date(event.fromDate);
  
  if (currentDate > eventStartDate) {
    return errorResponse(res, 'Registration for this event has closed. The event has already started.', 400);
  }
  
  let visitor;
  let isNewVisitor = false;
  
  // Check if visitor already exists by phone or email
  if (visitorData.phone) {
    visitor = await Visitor.findOne({ 
      phone: visitorData.phone, 
      isDeleted: false 
    });
  }
  
  if (!visitor && visitorData.email) {
    visitor = await Visitor.findOne({ 
      email: visitorData.email, 
      isDeleted: false 
    });
  }
  
  if (visitor) {
    // Update existing visitor with new data if provided
    Object.keys(visitorData).forEach(key => {
      if (visitorData[key] && visitorData[key] !== '') {
        visitor[key] = visitorData[key];
      }
    });
    await visitor.save();
  } else {
    // Create new visitor
    visitor = new Visitor({
      ...visitorData,
      isActive: true
    });
    await visitor.save();
    isNewVisitor = true;
  }
  
  // Check if visitor is already registered for this event
  if (event.visitor.includes(visitor._id)) {
    return successResponse(res, {
      message: 'Visitor is already registered for this event',
      visitor: {
        _id: visitor._id,
        name: visitor.name,
        email: visitor.email,
        phone: visitor.phone
      },
      isNewVisitor: false,
      alreadyRegistered: true
    });
  }
  
  // Add visitor to event
  event.visitor.push(visitor._id);
  await event.save();
  
  // Generate slots for the visitor
  const rawSlots = generateSlots(event.fromDate, event.toDate, event.startTime, event.endTime);
  const slots = rawSlots.map(s => ({ ...s, status: 'available' }));
  
  const userSlot = new UserEventSlot({ 
    userId: visitor._id, 
    userType: 'visitor', 
    eventId: event._id, 
    slots 
  });
  await userSlot.save();
  
  // Generate QR code
  const qrData = { 
    eventId: event._id, 
    userId: visitor._id, 
    role: 'visitor', 
    startDate: event.fromDate, 
    endDate: event.toDate 
  };
  const qrCode = await require('../utils/qrGenerator')(qrData);
  
  successResponse(res, {
    message: 'Visitor registered successfully for the event',
    visitor: {
      _id: visitor._id,
      name: visitor.name,
      email: visitor.email,
      phone: visitor.phone
    },
    isNewVisitor,
    qrCode,
    event: {
      _id: event._id,
      title: event.title,
      fromDate: event.fromDate,
      toDate: event.toDate
    }
  });
});

// Get event registration statistics
const getEventRegistrationStats = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  
  const event = await Event.findById(eventId)
    .populate('exhibitor', 'companyName email phone createdAt')
    .populate('visitor', 'name email phone createdAt');
  
  if (!event) {
    return errorResponse(res, 'Event not found', 404);
  }
  
  const stats = {
    totalExhibitors: event.exhibitor.length,
    totalVisitors: event.visitor.length,
    totalRegistrations: event.exhibitor.length + event.visitor.length,
    exhibitors: event.exhibitor,
    visitors: event.visitor
  };
  
  successResponse(res, stats);
});

module.exports = {
  getEventByRegistrationLink,
  registerExhibitorForEvent,
  registerVisitorForEvent,
  getEventRegistrationStats
};
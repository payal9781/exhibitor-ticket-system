const { successResponse, errorResponse } = require('../utils/apiResponse');
const asyncHandler = require('express-async-handler');
const Event = require('../models/Event');
const Exhibitor = require('../models/Exhibitor');
const Visitor = require('../models/Visitor');
const axios = require('axios');
const UserEventSlot = require('../models/UserEventSlot');
const generateSlots = require('../utils/slotGenerator');

// Get event registration details by registration link
const getEventByRegistrationLink = asyncHandler(async (req, res) => {
  const { registrationLink } = req.params;

  const event = await Event.findOne({
    registrationLink,
    isDeleted: false
  }).populate('organizerId', 'name email organizationName');

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


    let digitalCardLink = "";
    try {
      const payload = {
        name: String(exhibitor.companyName).trim(),
        email: exhibitor.email,
        mobile: exhibitor.phone,
        businessKeyword: "Event Exhibitor",
        originId: "67ca6934c15747af04fff36c",
        countryCode: "91"
      };
      console.log(payload);
      const DIGITAL_CARD_URL = "https://digitalcard.co.in/web/create-account/mobile";
      var result = await axios.post(DIGITAL_CARD_URL, payload, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      if (result.data != null && result.data.data!=null) { exhibitor.digitalProfile = result.data.data.path; }
      else { console.log(`Something went wrong while creating digital card: ${result.data}`); }
    } catch (err) {
      console.log(`Error in creating digital card: ${err}`);
    }

    await exhibitor.save();
    isNewExhibitor = true;
  }

  // Check if exhibitor is already registered for this event
  const existingExhibitor = event.exhibitor.find(ex => ex.userId.toString() === exhibitor._id.toString());
  if (existingExhibitor) {
    return successResponse(res, {
      message: 'Exhibitor is already registered for this event',
      exhibitor: {
        _id: exhibitor._id,
        companyName: exhibitor.companyName,
        email: exhibitor.email,
        phone: exhibitor.phone
      },
      isNewExhibitor: false,
      alreadyRegistered: true,
      qrCode: existingExhibitor.qrCode
    });
  }

  // Generate QR code
  const qrData = {
    eventId: event._id,
    userId: exhibitor._id,
    userType: 'exhibitor',
    startDate: event.fromDate,
    endDate: event.toDate,
    eventTitle: event.title
  };
  const qrCode = await require('../utils/qrGenerator')(qrData);

  // Add exhibitor to event with QR code
  event.exhibitor.push({
    userId: exhibitor._id,
    qrCode,
    registeredAt: new Date()
  });
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

    try {
      const payload = {
        name: String(visitor.name).trim(),
        email: visitor.email,
        mobile: visitor.phone,
        businessKeyword: "Event Visitor",
        originId: "67ca6934c15747af04fff36c",
        countryCode: "91"
      };
      const DIGITAL_CARD_URL = "https://digitalcard.co.in/web/create-account/mobile";
      var result = await axios.post(DIGITAL_CARD_URL, payload, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      if (result.data != null && result.data.data!=null) { visitor.digitalProfile = result.data.data.path; }
      else { console.log(`Something went wrong while creating digital card: ${result.data}`); }
    } catch (err) {
      console.log(`Error in creating digital card: ${err}`);
    }

    await visitor.save();
    isNewVisitor = true;
  }

  // Check if visitor is already registered for this event
  const existingVisitor = event.visitor.find(vis => vis.userId.toString() === visitor._id.toString());
  if (existingVisitor) {
    return successResponse(res, {
      message: 'Visitor is already registered for this event',
      visitor: {
        _id: visitor._id,
        name: visitor.name,
        email: visitor.email,
        phone: visitor.phone
      },
      isNewVisitor: false,
      alreadyRegistered: true,
      qrCode: existingVisitor.qrCode
    });
  }

  // Generate QR code
  const qrData = {
    eventId: event._id,
    userId: visitor._id,
    userType: 'visitor',
    startDate: event.fromDate,
    endDate: event.toDate,
    eventTitle: event.title
  };
  const qrCode = await require('../utils/qrGenerator')(qrData);

  // Add visitor to event with QR code
  event.visitor.push({
    userId: visitor._id,
    qrCode,
    registeredAt: new Date()
  });
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
    .populate('exhibitor.userId', 'companyName email phone createdAt')
    .populate('visitor.userId', 'name email phone createdAt');

  if (!event) {
    return errorResponse(res, 'Event not found', 404);
  }

  const stats = {
    totalExhibitors: event.exhibitor.length,
    totalVisitors: event.visitor.length,
    totalRegistrations: event.exhibitor.length + event.visitor.length,
    exhibitors: event.exhibitor.map(ex => ({
      ...ex.userId.toObject(),
      qrCode: ex.qrCode,
      registeredAt: ex.registeredAt
    })),
    visitors: event.visitor.map(vis => ({
      ...vis.userId.toObject(),
      qrCode: vis.qrCode,
      registeredAt: vis.registeredAt
    }))
  };

  successResponse(res, stats);
});

// Get upcoming events for registration dropdown
const getUpcomingEventsForRegistration = asyncHandler(async (req, res) => {
  const currentDate = new Date();
  const upcomingEvents = await Event.find({
    isDeleted: false,
    isActive: true, // Only active events
    fromDate: { $gte: currentDate } // Only upcoming events
  })
    .select('_id title fromDate toDate location registrationLink')
    .populate('organizerId', 'name organizationName')
    .sort({ fromDate: 1 })
    .limit(20);

  const formattedEvents = upcomingEvents.map(event => ({
    _id: event._id,
    title: event.title,
    fromDate: event.fromDate,
    toDate: event.toDate,
    location: event.location,
    registrationLink: event.registrationLink,
    organizer: event.organizerId,
    displayName: `${event.title} - ${new Date(event.fromDate).toLocaleDateString()}`
  }));

  successResponse(res, {
    events: formattedEvents,
    totalEvents: formattedEvents.length
  });
});

// Register for multiple events (bulk registration)
const registerForMultipleEvents = asyncHandler(async (req, res) => {
  const { eventIds, participantData, participantType } = req.body;

  if (!eventIds || !Array.isArray(eventIds) || eventIds.length === 0) {
    return errorResponse(res, 'Event IDs array is required', 400);
  }

  if (!participantData || !participantType) {
    return errorResponse(res, 'Participant data and type are required', 400);
  }

  if (!['exhibitor', 'visitor'].includes(participantType)) {
    return errorResponse(res, 'Invalid participant type', 400);
  }

  // Find all events
  const events = await Event.find({
    _id: { $in: eventIds },
    isDeleted: false
  });

  if (events.length !== eventIds.length) {
    return errorResponse(res, 'Some events not found', 404);
  }

  // Check if all events are still open for registration
  const currentDate = new Date();
  const closedEvents = events.filter(event => new Date(event.fromDate) <= currentDate);
  if (closedEvents.length > 0) {
    return errorResponse(res, `Registration closed for ${closedEvents.length} event(s)`, 400);
  }

  let participant;
  let isNewParticipant = false;

  const Model = participantType === 'exhibitor' ?
    require('../models/Exhibitor') :
    require('../models/Visitor');

  // Check if participant already exists
  let existingParticipant = null;
  if (participantData.phone) {
    existingParticipant = await Model.findOne({
      phone: participantData.phone,
      isDeleted: false
    });
  }

  if (!existingParticipant && participantData.email) {
    existingParticipant = await Model.findOne({
      email: participantData.email,
      isDeleted: false
    });
  }

  if (existingParticipant) {
    // Update existing participant
    Object.keys(participantData).forEach(key => {
      if (participantData[key] && participantData[key] !== '') {
        existingParticipant[key] = participantData[key];
      }
    });
    participant = await existingParticipant.save();
  } else {
    // Create new participant
    participant = new Model({
      ...participantData,
      isActive: true
    });
    await participant.save();
    isNewParticipant = true;
  }

  const registrationResults = [];

  // Register for each event
  for (const event of events) {
    // Check if already registered
    const isAlreadyRegistered = participantType === 'exhibitor' ?
      event.exhibitor.some(ex => ex.userId.toString() === participant._id.toString()) :
      event.visitor.some(vis => vis.userId.toString() === participant._id.toString());

    if (!isAlreadyRegistered) {
      // Generate QR code
      const qrData = {
        eventId: event._id,
        userId: participant._id,
        userType: participantType,
        startDate: event.fromDate,
        endDate: event.toDate,
        eventTitle: event.title
      };
      const qrCode = await require('../utils/qrGenerator')(qrData);

      // Add to event
      if (participantType === 'exhibitor') {
        event.exhibitor.push({ userId: participant._id, qrCode });
      } else {
        event.visitor.push({ userId: participant._id, qrCode });
      }
      await event.save();

      // Generate slots
      const rawSlots = generateSlots(event.fromDate, event.toDate, event.startTime, event.endTime);
      const slots = rawSlots.map(s => ({ ...s, status: 'available' }));

      const userSlot = new UserEventSlot({
        userId: participant._id,
        userType: participantType,
        eventId: event._id,
        slots
      });
      await userSlot.save();

      registrationResults.push({
        eventId: event._id,
        eventTitle: event.title,
        qrCode,
        registered: true
      });
    } else {
      registrationResults.push({
        eventId: event._id,
        eventTitle: event.title,
        registered: false,
        message: 'Already registered'
      });
    }
  }

  successResponse(res, {
    message: `Registration completed for ${registrationResults.filter(r => r.registered).length} events`,
    participant: {
      _id: participant._id,
      name: participant.name || participant.companyName,
      email: participant.email,
      phone: participant.phone
    },
    isNewParticipant,
    registrationResults,
    totalEventsRegistered: registrationResults.filter(r => r.registered).length
  });
});

module.exports = {
  getEventByRegistrationLink,
  registerExhibitorForEvent,
  registerVisitorForEvent,
  getEventRegistrationStats,
  getUpcomingEventsForRegistration,
  registerForMultipleEvents
};
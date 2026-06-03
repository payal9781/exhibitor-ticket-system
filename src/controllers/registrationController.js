const { successResponse, errorResponse } = require('../utils/apiResponse');
const asyncHandler = require('express-async-handler');
const Event = require('../models/Event');
const Exhibitor = require('../models/Exhibitor');
const Visitor = require('../models/Visitor');
const axios = require('axios');
const UserEventSlot = require('../models/UserEventSlot');
const generateSlots = require('../utils/slotGenerator');
const {
  getEventEndDate,
  isEventRegistrationClosed,
  requiresRegistrationApproval,
} = require('../utils/eventDateUtils');
const {
  parseIndustrySectorInput,
  validateIndustrySectorIds,
  applyIndustrySectorsToUser,
} = require('../utils/industrySectorHelper');

const REGISTRATION_PROFILE_KEYS = new Set([
  'name',
  'email',
  'phone',
  'companyName',
  'bio',
  'website',
  'location',
  'profileImage',
  'coverImage',
  'socialMediaLinks',
  'keyWords',
  'address',
  'Sector',
]);

const applyRegistrationProfile = async (user, body) => {
  const industrySectorInput = parseIndustrySectorInput(body);

  Object.keys(body).forEach((key) => {
    if (
      !REGISTRATION_PROFILE_KEYS.has(key) ||
      body[key] === undefined ||
      body[key] === '' ||
      key === 'keyWords'
    ) {
      return;
    }
    user[key] = body[key];
  });

  if (body.keyWords !== undefined) {
    user.keyWords = Array.isArray(body.keyWords)
      ? body.keyWords
      : String(body.keyWords)
          .split(',')
          .map((k) => k.trim())
          .filter(Boolean);
  }

  if (industrySectorInput !== undefined) {
    const validation = await validateIndustrySectorIds(industrySectorInput);
    if (!validation.valid) {
      return { error: validation.error };
    }
    await applyIndustrySectorsToUser(user, validation.sectorIds, validation.sectors);
  } else if (body.Sector) {
    user.Sector = body.Sector;
  }

  if (body.location !== undefined && body.location !== '') {
    user.location = body.location;
    if (!user.address || typeof user.address !== 'object') {
      user.address = {};
    }
    user.address.city = body.location;
    user.markModified?.('address');
  }

  if (body.address !== undefined && body.address !== null && typeof body.address === 'object') {
    if (!user.address || typeof user.address !== 'object') {
      user.address = {};
    }
    Object.assign(user.address, body.address);
    user.markModified?.('address');
    const cityCountry = [user.address.city, user.address.country].filter(Boolean).join(', ');
    if (cityCountry && !user.location) {
      user.location = cityCountry;
    }
  }

  return { error: null };
};

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const normalizePhone = (phone) => String(phone || '').replace(/\D/g, '').slice(-10);

const getEventParticipantContacts = async (event, userType) => {
  const entries = userType === 'exhibitor' ? event.exhibitor : event.visitor;
  const ids = entries.map((entry) => entry.userId).filter(Boolean);
  if (!ids.length) {
    return { entries, byId: new Map() };
  }

  const Model = userType === 'exhibitor' ? Exhibitor : Visitor;
  const users = await Model.find({ _id: { $in: ids }, isDeleted: false })
    .select('email phone')
    .lean();
  const byId = new Map(users.map((user) => [user._id.toString(), user]));
  return { entries, byId };
};

const isEmailTakenOnEvent = (byId, entries, email, excludeUserId = null) => {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;

  return entries.some((entry) => {
    const userId = entry.userId.toString();
    if (excludeUserId && userId === excludeUserId.toString()) return false;
    const user = byId.get(userId);
    return user && normalizeEmail(user.email) === normalized;
  });
};

const isPhoneTakenOnEvent = (byId, entries, phone, excludeUserId = null) => {
  const normalized = normalizePhone(phone);
  if (normalized.length !== 10) return false;

  return entries.some((entry) => {
    const userId = entry.userId.toString();
    if (excludeUserId && userId === excludeUserId.toString()) return false;
    const user = byId.get(userId);
    return user && normalizePhone(user.phone) === normalized;
  });
};

const getEventContactConflict = async (event, userType, email, phone, excludeUserId = null) => {
  const { entries, byId } = await getEventParticipantContacts(event, userType);
  const roleLabel = userType === 'exhibitor' ? 'exhibitor' : 'visitor';

  if (email && isEmailTakenOnEvent(byId, entries, email, excludeUserId)) {
    return `This email is already registered for this event as a ${roleLabel}.`;
  }

  if (phone && isPhoneTakenOnEvent(byId, entries, phone, excludeUserId)) {
    return `This phone number is already registered for this event as a ${roleLabel}.`;
  }

  return null;
};

// Get event registration details by registration link
const getEventByRegistrationLink = asyncHandler(async (req, res) => {
  const { registrationLink } = req.params;

  const event = await Event.findOne({
    registrationLink,
    isDeleted: false
  }).populate('organizerId', 'name email organizationName')
    .populate('createdByAdminId', 'name email');

  if (!event) {
    return errorResponse(res, 'Event not found or registration link is invalid', 404);
  }

  if (isEventRegistrationClosed(event)) {
    return errorResponse(res, 'Registration for this event has closed. The event has ended.', 400);
  }

  const organizer = event.organizerId
    ? {
        name: event.organizerId.name,
        email: event.organizerId.email,
        organizationName: event.organizerId.organizationName,
      }
    : event.createdByAdminId
      ? {
          name: event.createdByAdminId.name,
          email: event.createdByAdminId.email,
          organizationName: 'Platform Admin',
        }
      : null;

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
      organizer,
      extraDetails: event.extraDetails
    }
  });
});

// Register exhibitor for event
const registerExhibitorForEvent = asyncHandler(async (req, res) => {
  const { registrationLink } = req.params;
  const exhibitorData = req.body;

  const event = await Event.findOne({
    registrationLink,
    isDeleted: false
  });

  if (!event) {
    return errorResponse(res, 'Event not found or registration link is invalid', 404);
  }

  const eventEndDate = getEventEndDate(event.toDate);

  if (new Date() > eventEndDate) {
    return errorResponse(res, 'Registration for this event has closed. The event has already ended.', 400);
  }

  // Public self-registration always requires organizer/admin approval
  const needsApproval = requiresRegistrationApproval();
  const isVerified = !needsApproval;
  const approvalStatus = needsApproval ? 'pending' : 'approved';

  let exhibitor;
  let isNewExhibitor = false;

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
    const profileResult = await applyRegistrationProfile(exhibitor, exhibitorData);
    if (profileResult.error) {
      return errorResponse(res, profileResult.error, 400);
    }
    await exhibitor.save();
  } else {
    exhibitor = new Exhibitor({
      name: exhibitorData.name,
      email: exhibitorData.email,
      phone: exhibitorData.phone,
      companyName: exhibitorData.companyName,
      isActive: true,
    });
    const profileResult = await applyRegistrationProfile(exhibitor, exhibitorData);
    if (profileResult.error) {
      return errorResponse(res, profileResult.error, 400);
    }

    try {
      const payload = {
        name: String(exhibitor.companyName).trim(),
        email: exhibitor.email,
        mobile: exhibitor.phone,
        businessKeyword: "Event Exhibitor",
        originId: "67ca6934c15747af04fff36c",
        countryCode: "91"
      };
      const DIGITAL_CARD_URL = "https://digitalcard.co.in/web/create-account/mobile";
      const result = await axios.post(DIGITAL_CARD_URL, payload, {
        headers: { 'Content-Type': 'application/json' }
      });
      if (result.data?.data?.path) {
        exhibitor.digitalProfile = result.data.data.path;
      } else {
        console.log(`Something went wrong while creating digital card: ${JSON.stringify(result.data)}`);
      }
    } catch (err) {
      console.log(`Error in creating digital card: ${err}`);
    }

    await exhibitor.save();
    isNewExhibitor = true;
  }

  const existingExhibitor = event.exhibitor.find(ex => ex.userId.toString() === exhibitor._id.toString());
  if (!existingExhibitor) {
    const contactConflict = await getEventContactConflict(
      event,
      'exhibitor',
      exhibitorData.email,
      exhibitorData.phone
    );
    if (contactConflict) {
      return errorResponse(res, contactConflict, 400);
    }
  }

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
      qrCode: existingExhibitor.qrCode,
      isVerified: existingExhibitor.isVerified
    });
  }

  const qrData = {
    eventId: event._id,
    userId: exhibitor._id,
    userType: 'exhibitor',
    startDate: event.fromDate,
    endDate: event.toDate,
    eventTitle: event.title
  };
  const qrCode = await require('../utils/qrGenerator')(qrData);

  event.exhibitor.push({
    userId: exhibitor._id,
    qrCode,
    registeredAt: new Date(),
    isVerified,
    approvalStatus,
    addedBy: {
      userId: exhibitor._id,
      userType: 'Exhibitor',
      name: exhibitor.companyName || 'Self',
      addedAt: new Date()
    }
  });

  try {
    const existingSlots = await UserEventSlot.findOne({
      userId: exhibitor._id,
      userType: 'exhibitor',
      eventId: event._id
    });

    if (!existingSlots) {
      const rawSlots = generateSlots(
        event.fromDate,
        event.toDate,
        event.meetingStartTime || event.startTime,
        event.meetingEndTime || event.endTime,
        event.timeInterval || 30
      );
      const slots = rawSlots.map(s => ({
        start: s.start,
        end: s.end,
        status: 'available'
      }));
      const userSlot = new UserEventSlot({
        userId: exhibitor._id,
        userType: 'exhibitor',
        eventId: event._id,
        slots
      });
      await userSlot.save();
    }
  } catch (slotError) {
    console.error('Error generating slots:', slotError);
  }

  await event.save();

  successResponse(res, {
    message: isVerified ? 'Exhibitor registered successfully for the event' : 'Exhibitor registered successfully but requires organizer approval',
    exhibitor: {
      _id: exhibitor._id,
      companyName: exhibitor.companyName,
      email: exhibitor.email,
      phone: exhibitor.phone
    },
    isNewExhibitor,
    qrCode,
    isVerified,
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

  const event = await Event.findOne({
    registrationLink,
    isDeleted: false
  });

  if (!event) {
    return errorResponse(res, 'Event not found or registration link is invalid', 404);
  }

  const eventEndDate = getEventEndDate(event.toDate);

  if (new Date() > eventEndDate) {
    return errorResponse(res, 'Registration for this event has closed. The event has already ended.', 400);
  }

  // Public self-registration always requires organizer/admin approval
  const needsApproval = requiresRegistrationApproval();
  const isVerified = !needsApproval;
  const approvalStatus = needsApproval ? 'pending' : 'approved';

  let visitor;
  let isNewVisitor = false;

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
    const profileResult = await applyRegistrationProfile(visitor, visitorData);
    if (profileResult.error) {
      return errorResponse(res, profileResult.error, 400);
    }
  } else {
    if (visitorData.email) {
      const deletedVisitor = await Visitor.findOne({
        email: visitorData.email,
        isDeleted: true
      });
      if (deletedVisitor) {
        return errorResponse(res, 'Contact administrator', 409);
      }
    }
    visitor = new Visitor({
      name: visitorData.name,
      email: visitorData.email,
      phone: visitorData.phone,
      companyName: visitorData.companyName,
      isActive: true,
    });

    const profileResult = await applyRegistrationProfile(visitor, visitorData);
    if (profileResult.error) {
      return errorResponse(res, profileResult.error, 400);
    }

    try {
      const payload = {
        name: String(visitor.name || '').trim(),
        email: visitor.email || '',
        mobile: visitor.phone,
        businessKeyword: 'Event Visitor',
        originId: '67ca6934c15747af04fff36c',
        countryCode: '91'
      };
      const DIGITAL_CARD_URL = 'https://digitalcard.co.in/web/create-account/mobile';
      const result = await axios.post(DIGITAL_CARD_URL, payload, {
        headers: { 'Content-Type': 'application/json' }
      });
      if (result.data?.data?.path) {
        visitor.digitalProfile = result.data.data.path;
      } else {
        console.log(`Something went wrong while creating digital card: ${JSON.stringify(result.data)}`);
      }
    } catch (err) {
      console.log(`Error in creating digital card: ${err}`);
    }

    isNewVisitor = true;
  }

  await visitor.save();

  const existingVisitor = event.visitor.find(vis => vis.userId.toString() === visitor._id.toString());
  if (!existingVisitor) {
    const contactConflict = await getEventContactConflict(
      event,
      'visitor',
      visitorData.email,
      visitorData.phone
    );
    if (contactConflict) {
      return errorResponse(res, contactConflict, 400);
    }
  }

  if (existingVisitor) {
    return successResponse(res, {
      message: 'Visitor is already registered for this event',
      visitor: {
        _id: visitor._id,
        name: visitor.name,
        email: visitor.email,
        phone: visitor.phone
      },
      isNewVisitor,
      alreadyRegistered: true,
      qrCode: existingVisitor.qrCode,
      isVerified: existingVisitor.isVerified,
      event: {
        _id: event._id,
        title: event.title,
        fromDate: event.fromDate,
        toDate: event.toDate
      }
    });
  }

  const qrData = {
    eventId: event._id,
    userId: visitor._id,
    userType: 'visitor',
    startDate: event.fromDate,
    endDate: event.toDate,
    eventTitle: event.title
  };
  const qrCode = await require('../utils/qrGenerator')(qrData);

  event.visitor.push({
    userId: visitor._id,
    qrCode,
    registeredAt: new Date(),
    isVerified,
    approvalStatus,
    addedBy: {
      userId: visitor._id,
      userType: 'Visitor',
      name: visitor.name || 'Self',
      addedAt: new Date()
    }
  });

  try {
    const existingSlots = await UserEventSlot.findOne({
      userId: visitor._id,
      userType: 'visitor',
      eventId: event._id
    });

    if (!existingSlots) {
      const rawSlots = generateSlots(
        event.fromDate,
        event.toDate,
        event.meetingStartTime || event.startTime,
        event.meetingEndTime || event.endTime,
        event.timeInterval || 30
      );
      const slots = rawSlots.map(s => ({
        start: s.start,
        end: s.end,
        status: 'available',
        showSlots: false
      }));
      const userSlot = new UserEventSlot({
        userId: visitor._id,
        userType: 'visitor',
        eventId: event._id,
        slots
      });
      await userSlot.save();
    }
  } catch (slotError) {
    console.error('Error generating slots:', slotError);
  }

  await event.save();

  successResponse(res, {
    message: isVerified ? 'Visitor registered successfully for the event' : 'Visitor registered successfully but requires organizer approval',
    visitor: {
      _id: visitor._id,
      name: visitor.name,
      email: visitor.email,
      phone: visitor.phone
    },
    isNewVisitor,
    qrCode,
    isVerified,
    event: {
      _id: event._id,
      title: event.title,
      fromDate: event.fromDate,
      toDate: event.toDate
    }
  });
});
// Check whether email/phone is already used on this event (public registration)
const checkEventRegistrationContact = asyncHandler(async (req, res) => {
  const { registrationLink } = req.params;
  const { userType, email, phone } = req.body;

  if (!['exhibitor', 'visitor'].includes(userType)) {
    return errorResponse(res, 'Invalid registration type', 400);
  }

  const event = await Event.findOne({
    registrationLink,
    isDeleted: false,
  });

  if (!event) {
    return errorResponse(res, 'Event not found or registration link is invalid', 404);
  }

  const { entries, byId } = await getEventParticipantContacts(event, userType);
  const roleLabel = userType === 'exhibitor' ? 'exhibitor' : 'visitor';

  const emailTaken = email ? isEmailTakenOnEvent(byId, entries, email) : false;
  const phoneTaken =
    phone && normalizePhone(phone).length === 10
      ? isPhoneTakenOnEvent(byId, entries, phone)
      : false;

  successResponse(res, {
    emailAvailable: !emailTaken,
    phoneAvailable: !phoneTaken,
    emailMessage: emailTaken
      ? `This email is already registered for this event as a ${roleLabel}.`
      : null,
    phoneMessage: phoneTaken
      ? `This phone number is already registered for this event as a ${roleLabel}.`
      : null,
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
      const pendingEntry = {
        userId: participant._id,
        qrCode,
        registeredAt: new Date(),
        isVerified: false,
      };
      if (participantType === 'exhibitor') {
        event.exhibitor.push(pendingEntry);
      } else {
        event.visitor.push(pendingEntry);
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
  checkEventRegistrationContact,
  registerExhibitorForEvent,
  registerVisitorForEvent,
  getEventRegistrationStats,
  getUpcomingEventsForRegistration,
  registerForMultipleEvents,
};
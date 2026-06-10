const { successResponse, errorResponse } = require('../utils/apiResponse');
const asyncHandler = require('express-async-handler');
const UserEventSlot = require('../models/UserEventSlot');
const Meeting = require("../models/meeting");
const { profileIndustrySectorSelect } = require('../utils/industrySectorHelper');
const { shouldShowInEventBookings } = require('../utils/participantApproval');

const formatIndustryLabel = (user) => {
  if (user?.industrySectors?.length) {
    const names = user.industrySectors
      .map((sector) => (sector && typeof sector === 'object' ? sector.name || sector.value : null))
      .filter(Boolean);
    if (names.length) return names.join(', ');
  }
  return user?.Sector || '';
};

const formatLocationLabel = (user) => {
  const location = user?.location?.trim();
  if (location) return location;
  const parts = [user?.address?.city, user?.address?.state, user?.address?.country].filter(Boolean);
  return parts.length ? parts.join(', ') : '';
};

const participantPopulateOptions = (path) => ({
  path,
  select: 'name companyName email phone profileImage bio Sector location address industrySectors',
  populate: { path: 'industrySectors', select: profileIndustrySectorSelect },
});

const toggleShowSlots = asyncHandler(async (req, res) => {
  const { eventId, show } = req.body;
  const userSlot = await UserEventSlot.findOne({ userId: req.user.id, userType: req.user.type, eventId });
  if (!userSlot) return errorResponse(res, 'Slots not found', 404);
  userSlot.showSlots = show;
  await userSlot.save();
  successResponse(res, { message: 'Toggle updated' });
});

const getUserSlots = asyncHandler(async (req, res) => {
  const { eventId, targetUserId, targetUserType } = req.body; // Changed from params to body
  const userSlot = await UserEventSlot.findOne({ userId: targetUserId, userType: targetUserType, eventId });
  if (!userSlot || !userSlot.showSlots) return errorResponse(res, 'Slots not available or hidden', 403);
  const availableSlots = userSlot.slots.filter(s => s.status === 'available');
  successResponse(res, availableSlots);
});

const requestMeeting = asyncHandler(async (req, res) => {
  const { eventId, requestedId, requestedType, slotStart, slotEnd } = req.body;
  const userSlot = await UserEventSlot.findOne({ userId: requestedId, userType: requestedType, eventId });
  if (!userSlot) return errorResponse(res, 'Slots not found', 404);
  const slotIndex = userSlot.slots.findIndex(s => s.start.getTime() === new Date(slotStart).getTime() && s.status === 'available');
  if (slotIndex === -1) return errorResponse(res, 'Slot not available', 400);

  const meeting = new Meeting({
    eventId,
    requesterId: req.user.id,
    requesterType: req.user.type,
    requestedId,
    requestedType,
    slotStart: new Date(slotStart),
    slotEnd: new Date(slotEnd)
  });
  await meeting.save();

  userSlot.slots[slotIndex].status = 'requested';
  userSlot.slots[slotIndex].meetingId = meeting._id;
  await userSlot.save();
  successResponse(res, meeting, 201);
});

const respondToMeeting = asyncHandler(async (req, res) => {
  const { meetingId, status } = req.body;
  const meeting = await Meeting.findById(meetingId);
  if (!meeting || meeting.requestedId.toString() !== req.user.id) return errorResponse(res, 'Invalid meeting', 404);
  meeting.status = status;
  await meeting.save();

  const userSlot = await UserEventSlot.findOne({ userId: req.user.id, userType: req.user.type, eventId: meeting.eventId });
  const slotIndex = userSlot.slots.findIndex(s => s.meetingId.toString() === meetingId);
  if (slotIndex !== -1) {
    userSlot.slots[slotIndex].status = status === 'accepted' ? 'booked' : 'available';
    if (status !== 'accepted') userSlot.slots[slotIndex].meetingId = null;
    await userSlot.save();
  }
  successResponse(res, meeting);
});

// Get user's meetings grouped by date
const getUserMeetingsByDate = asyncHandler(async (req, res) => {
  const { eventId } = req.body;
  const userId = req.user.id;
  const userType = req.user.type;

  let query = {
    $or: [
      { requesterId: userId, requesterType: userType },
      { requestedId: userId, requestedType: userType }
    ]
  };

  if (eventId) {
    query.eventId = eventId;
  }

  const meetings = await Meeting.find(query)
    .populate('eventId', 'title fromDate toDate location')
    .sort({ slotStart: 1 });

  // Group meetings by date and status
  const meetingsByDate = {};
  const statusCounts = {
    pending: 0,
    accepted: 0,
    rejected: 0,
    cancelled: 0
  };

  for (const meeting of meetings) {
    const dateKey = meeting.slotStart.toISOString().split('T')[0];
    
    if (!meetingsByDate[dateKey]) {
      meetingsByDate[dateKey] = {
        pending: [],
        accepted: [],
        rejected: [],
        cancelled: []
      };
    }

    // Get other participant details
    let otherParticipant;
    let otherParticipantType;
    let isRequester = false;

    if (meeting.requesterId.toString() === userId.toString()) {
      isRequester = true;
      otherParticipantType = meeting.requestedType;
      if (meeting.requestedType === 'exhibitor') {
        otherParticipant = await require('../models/Exhibitor').findById(meeting.requestedId)
          .select('companyName email phone profileImage bio Sector location');
      } else {
        otherParticipant = await require('../models/Visitor').findById(meeting.requestedId)
          .select('name email phone profileImage bio Sector location companyName');
      }
    } else {
      otherParticipantType = meeting.requesterType;
      if (meeting.requesterType === 'exhibitor') {
        otherParticipant = await require('../models/Exhibitor').findById(meeting.requesterId)
          .select('companyName email phone profileImage bio Sector location');
      } else {
        otherParticipant = await require('../models/Visitor').findById(meeting.requesterId)
          .select('name email phone profileImage bio Sector location companyName');
      }
    }

    const meetingData = {
      _id: meeting._id,
      eventId: meeting.eventId._id,
      eventTitle: meeting.eventId.title,
      eventLocation: meeting.eventId.location,
      slotStart: meeting.slotStart,
      slotEnd: meeting.slotEnd,
      status: meeting.status,
      createdAt: meeting.createdAt,
      otherParticipant,
      otherParticipantType,
      isRequester
    };

    meetingsByDate[dateKey][meeting.status].push(meetingData);
    statusCounts[meeting.status]++;
  }

  successResponse(res, {
    totalMeetings: meetings.length,
    statusCounts,
    meetingsByDate
  });
});

// Cancel a meeting
const cancelMeeting = asyncHandler(async (req, res) => {
  const { meetingId } = req.body;
  const userId = req.user.id;

  if (!meetingId) {
    return errorResponse(res, 'Meeting ID is required', 400);
  }

  const meeting = await Meeting.findById(meetingId);
  if (!meeting) {
    return errorResponse(res, 'Meeting not found', 404);
  }

  // Check if user is part of this meeting
  if (meeting.requesterId.toString() !== userId.toString() && 
      meeting.requestedId.toString() !== userId.toString()) {
    return errorResponse(res, 'You are not authorized to cancel this meeting', 403);
  }

  // Only allow cancellation of pending or accepted meetings
  if (!['pending', 'accepted'].includes(meeting.status)) {
    return errorResponse(res, 'Cannot cancel this meeting', 400);
  }

  // Update meeting status
  meeting.status = 'cancelled';
  await meeting.save();

  // Free up the slot if it was booked
  if (meeting.status === 'accepted') {
    const userSlot = await UserEventSlot.findOne({
      userId: meeting.requestedId,
      userType: meeting.requestedType,
      eventId: meeting.eventId
    });

    if (userSlot) {
      const slotIndex = userSlot.slots.findIndex(s => 
        s.meetingId && s.meetingId.toString() === meetingId
      );

      if (slotIndex !== -1) {
        userSlot.slots[slotIndex].status = 'available';
        userSlot.slots[slotIndex].meetingId = null;
        await userSlot.save();
      }
    }
  }

  successResponse(res, {
    message: 'Meeting cancelled successfully',
    meeting: {
      _id: meeting._id,
      status: meeting.status
    }
  });
});

module.exports = { 
  toggleShowSlots, 
  getUserSlots, 
  requestMeeting, 
  respondToMeeting,
  getUserMeetingsByDate,
  cancelMeeting
};


// Admin: Get all meetings with full details
const getAllMeetingsAdmin = asyncHandler(async (req, res) => {
  const { eventId, status, page = 1, limit = 50, search = '' } = req.body;

  let query = {};
  
  if (eventId) {
    query.eventId = eventId;
  }
  
  if (status && status !== 'all') {
    query.status = status;
  }

  const skip = (page - 1) * limit;

  const [meetings, totalCount] = await Promise.all([
    Meeting.find(query)
      .populate('eventId', 'title fromDate toDate location')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Meeting.countDocuments(query)
  ]);

  // Get full details for each meeting
  const meetingsWithDetails = await Promise.all(
    meetings.map(async (meeting) => {
      // Get requester details
      let requesterDetails;
      if (meeting.requesterType === 'exhibitor') {
        requesterDetails = await require('../models/Exhibitor').findById(meeting.requesterId)
          .select('companyName email phone profileImage bio Sector location');
      } else {
        requesterDetails = await require('../models/Visitor').findById(meeting.requesterId)
          .select('name email phone profileImage bio Sector location companyName');
      }

      // Get requested details
      let requestedDetails;
      if (meeting.requestedType === 'exhibitor') {
        requestedDetails = await require('../models/Exhibitor').findById(meeting.requestedId)
          .select('companyName email phone profileImage bio Sector location');
      } else {
        requestedDetails = await require('../models/Visitor').findById(meeting.requestedId)
          .select('name email phone profileImage bio Sector location companyName');
      }

      return {
        _id: meeting._id,
        event: {
          _id: meeting.eventId._id,
          title: meeting.eventId.title,
          fromDate: meeting.eventId.fromDate,
          toDate: meeting.eventId.toDate,
          location: meeting.eventId.location
        },
        requester: {
          ...requesterDetails?.toObject(),
          type: meeting.requesterType,
          displayName: requesterDetails?.companyName || requesterDetails?.name || 'Unknown'
        },
        requested: {
          ...requestedDetails?.toObject(),
          type: meeting.requestedType,
          displayName: requestedDetails?.companyName || requestedDetails?.name || 'Unknown'
        },
        slotStart: meeting.slotStart,
        slotEnd: meeting.slotEnd,
        status: meeting.status,
        createdAt: meeting.createdAt,
        updatedAt: meeting.updatedAt
      };
    })
  );

  // Filter by search if provided
  let filteredMeetings = meetingsWithDetails;
  if (search) {
    const searchLower = search.toLowerCase();
    filteredMeetings = meetingsWithDetails.filter(meeting => 
      meeting.event.title.toLowerCase().includes(searchLower) ||
      meeting.requester.displayName.toLowerCase().includes(searchLower) ||
      meeting.requested.displayName.toLowerCase().includes(searchLower) ||
      meeting.requester.email?.toLowerCase().includes(searchLower) ||
      meeting.requested.email?.toLowerCase().includes(searchLower)
    );
  }

  // Get status counts
  const statusCounts = await Meeting.aggregate([
    ...(eventId ? [{ $match: { eventId: require('mongoose').Types.ObjectId(eventId) } }] : []),
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  const counts = {
    all: totalCount,
    pending: 0,
    accepted: 0,
    rejected: 0,
    cancelled: 0
  };

  statusCounts.forEach(item => {
    counts[item._id] = item.count;
  });

  successResponse(res, {
    meetings: filteredMeetings,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      totalItems: totalCount,
      itemsPerPage: limit
    },
    statusCounts: counts
  });
});

module.exports = { 
  toggleShowSlots, 
  getUserSlots, 
  requestMeeting, 
  respondToMeeting,
  getUserMeetingsByDate,
  cancelMeeting,
  getAllMeetingsAdmin
};


// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * Resolve a participant's display name + details from the DB.
 * Returns { displayName, email, phone, type }
 */
async function resolveParticipant(id, type) {
  const Exhibitor = require('../models/Exhibitor');
  const Visitor   = require('../models/Visitor');
  if (type === 'exhibitor') {
    const doc = await Exhibitor.findById(id).select('companyName email phone profileImage Sector');
    return {
      _id: id,
      displayName: doc?.companyName || 'Unknown',
      email: doc?.email,
      phone: doc?.phone,
      profileImage: doc?.profileImage,
      Sector: doc?.Sector,
      type: 'exhibitor',
    };
  } else {
    const doc = await Visitor.findById(id).select('name companyName email phone profileImage Sector');
    return {
      _id: id,
      displayName: doc?.name || doc?.companyName || 'Unknown',
      email: doc?.email,
      phone: doc?.phone,
      profileImage: doc?.profileImage,
      Sector: doc?.Sector,
      type: 'visitor',
    };
  }
}

/**
 * Build the incoming / outgoing meeting breakdown for one participant.
 *
 * incoming  = someone else requested a slot ON this user's calendar
 * outgoing  = this user sent a request to someone else's calendar
 *
 * Also flags exhibitor→exhibitor meetings explicitly.
 */
async function buildMeetingBreakdown(userId, userType, meetings) {
  const allMeetings = [];

  for (const m of meetings) {
    const isRequester  = m.requesterId.toString() === userId.toString();
    const otherId      = isRequester ? m.requestedId  : m.requesterId;
    const otherType    = isRequester ? m.requestedType : m.requesterType;
    const other        = await resolveParticipant(otherId, otherType);

    const entry = {
      _id:                m._id,
      slotStart:          m.slotStart,
      slotEnd:            m.slotEnd,
      status:             m.status,
      isRequester:        isRequester,
      otherParticipant: {
        name:  other.displayName,
        type:  other.type,
        email: other.email,
        phone: other.phone,
      },
    };

    allMeetings.push(entry);
  }

  // Sort by slot time
  allMeetings.sort((a, b) => new Date(a.slotStart) - new Date(b.slotStart));

  return allMeetings;
}

// ─── Admin: Get event slot bookings overview ─────────────────────────────────
const getEventSlotBookings = asyncHandler(async (req, res) => {
  const { eventId } = req.body;

  if (!eventId) {
    return errorResponse(res, 'Event ID is required', 400);
  }

  const Event    = require('../models/Event');
  const Exhibitor = require('../models/Exhibitor');
  const Visitor   = require('../models/Visitor');
  const UserEventSlot = require('../models/UserEventSlot');

  // Event details
  const event = await Event.findById(eventId).select('title fromDate toDate location organizerId isDeleted');
  if (!event || event.isDeleted) return errorResponse(res, 'Event not found', 404);
  if (req.user.type === 'organizer' && event.organizerId?.toString() !== req.user.id) {
    return errorResponse(res, 'Access denied', 403);
  }

  // All meetings for this event (all statuses)
  const meetings = await Meeting.find({ eventId }).sort({ slotStart: 1 });

  // All slot documents for this event
  const userSlots = await UserEventSlot.find({ eventId });

  // Registered participants (populated)
  const [regExhibitors, regVisitors] = await Promise.all([
    Event.findById(eventId)
      .populate(participantPopulateOptions('exhibitor.userId'))
      .select('exhibitor'),
    Event.findById(eventId)
      .populate(participantPopulateOptions('visitor.userId'))
      .select('visitor'),
  ]);

  const now = new Date();

  // ── helper: count future slots ──────────────────────────────────────────
  function countFutureSlots(userSlot) {
    if (!userSlot) return { total: 0, available: 0, requested: 0, booked: 0 };
    const future = userSlot.slots.filter(s => new Date(s.start) >= now);
    const counts = { total: future.length, available: 0, requested: 0, booked: 0 };
    future.forEach(s => { if (counts.hasOwnProperty(s.status)) counts[s.status]++; });
    return counts;
  }

  // ── helper: get all booked slot times for a user ────────────────────────
  function getBookedSlotTimes(userSlot) {
    if (!userSlot) return [];
    return userSlot.slots
      .filter(s => s.status === 'booked')
      .map(s => ({ start: s.start, end: s.end, meetingId: s.meetingId }))
      .sort((a, b) => new Date(a.start) - new Date(b.start));
  }

  const Attendance = require('../models/z-index').models.Attendance;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // ── helper: get attendance status ──────────────────────────────────────
  async function getAttendanceStatus(userId, userType, eventId) {
    const record = await Attendance.findOne({
      userId,
      eventId,
      userModel: userType.charAt(0).toUpperCase() + userType.slice(1),
      attendanceDate: today
    });
    
    if (!record) return 'not-marked';
    
    const latest = record.attendanceDetails?.[record.attendanceDetails.length - 1];
    if (latest && !latest.exitTime) return 'checked-in';
    if (latest && latest.exitTime) return 'checked-out';
    return 'not-marked';
  }

  const approvedExhibitors = (regExhibitors?.exhibitor || []).filter(shouldShowInEventBookings);
  const approvedVisitors = (regVisitors?.visitor || []).filter(shouldShowInEventBookings);

  // ── process exhibitors ──────────────────────────────────────────────────
  const exhibitorsWithSlots = (await Promise.all(
    approvedExhibitors.map(async (ex) => {
      if (!ex.userId || typeof ex.userId !== 'object') return null;

      const userId   = ex.userId._id || ex.userId;
      const userSlot = userSlots.find(
        s => s.userId.toString() === userId.toString() && s.userType === 'exhibitor'
      );
      const userMeetings = meetings.filter(
        m => m.requesterId.toString() === userId.toString() ||
             m.requestedId.toString()  === userId.toString()
      );

      const meetingsList = await buildMeetingBreakdown(userId, 'exhibitor', userMeetings);
      const attendanceStatus = await getAttendanceStatus(userId, 'exhibitor', eventId);

      return {
        _id:          userId,
        name:         ex.userId.companyName || 'Unknown',
        email:        ex.userId.email,
        phone:        ex.userId.phone,
        profileImage: ex.userId.profileImage,
        bio:          ex.userId.bio || '',
        Sector:       formatIndustryLabel(ex.userId),
        location:     formatLocationLabel(ex.userId),
        type:         'exhibitor',
        registeredAt: ex.registeredAt,
        isVerified:   ex.isVerified,
        showSlots:    userSlot?.showSlots || false,
        slotCounts:   countFutureSlots(userSlot),
        bookedSlotTimes: getBookedSlotTimes(userSlot),
        meetings:     meetingsList,
        attendanceStatus,
        addedBy: ex.addedBy
          ? { name: ex.addedBy.name || 'Unknown', userType: ex.addedBy.userType || 'Unknown', addedAt: ex.addedBy.addedAt || ex.registeredAt }
          : { name: 'Self-Registered', userType: 'Self', addedAt: ex.registeredAt },
      };
    })
  )).filter(Boolean);

  // ── process visitors ────────────────────────────────────────────────────
  const visitorsWithSlots = (await Promise.all(
    approvedVisitors.map(async (vis) => {
      if (!vis.userId || typeof vis.userId !== 'object') return null;

      const userId   = vis.userId._id || vis.userId;
      const userSlot = userSlots.find(
        s => s.userId.toString() === userId.toString() && s.userType === 'visitor'
      );
      const userMeetings = meetings.filter(
        m => m.requesterId.toString() === userId.toString() ||
             m.requestedId.toString()  === userId.toString()
      );

      const meetingsList = await buildMeetingBreakdown(userId, 'visitor', userMeetings);
      const attendanceStatus = await getAttendanceStatus(userId, 'visitor', eventId);

      return {
        _id:          userId,
        name:         vis.userId.name || vis.userId.companyName || 'Unknown',
        companyName:  vis.userId.companyName || '',
        email:        vis.userId.email,
        phone:        vis.userId.phone,
        profileImage: vis.userId.profileImage,
        bio:          vis.userId.bio || '',
        Sector:       formatIndustryLabel(vis.userId),
        location:     formatLocationLabel(vis.userId),
        type:         'visitor',
        registeredAt: vis.registeredAt,
        isVerified:   vis.isVerified,
        showSlots:    userSlot?.showSlots || false,
        slotCounts:   countFutureSlots(userSlot),
        bookedSlotTimes: getBookedSlotTimes(userSlot),
        meetings:     meetingsList,
        attendanceStatus,
        addedBy: vis.addedBy
          ? { name: vis.addedBy.name || 'Unknown', userType: vis.addedBy.userType || 'Unknown', addedAt: vis.addedBy.addedAt || vis.registeredAt }
          : { name: 'Self-Registered', userType: 'Self', addedAt: vis.registeredAt },
      };
    })
  )).filter(Boolean);

  // ── exhibitor-to-exhibitor meetings (special list) ──────────────────────
  const exhibitorToExhibitorMeetings = await Promise.all(
    meetings
      .filter(m => m.requesterType === 'exhibitor' && m.requestedType === 'exhibitor')
      .map(async (m) => {
        const [requester, requested] = await Promise.all([
          resolveParticipant(m.requesterId, 'exhibitor'),
          resolveParticipant(m.requestedId, 'exhibitor'),
        ]);
        return {
          meetingId: m._id,
          status:    m.status,
          slotStart: m.slotStart,
          slotEnd:   m.slotEnd,
          requester,
          requested,
        };
      })
  );

  // ── summary ─────────────────────────────────────────────────────────────
  const summary = {
    totalExhibitors: exhibitorsWithSlots.length,
    totalVisitors:   visitorsWithSlots.length,
    totalMeetings:   meetings.length,
    exhibitorToExhibitorMeetings: exhibitorToExhibitorMeetings.length,
    meetingsByStatus: {
      pending:   meetings.filter(m => m.status === 'pending').length,
      accepted:  meetings.filter(m => m.status === 'accepted').length,
      rejected:  meetings.filter(m => m.status === 'rejected').length,
      cancelled: meetings.filter(m => m.status === 'cancelled').length,
    },
    totalSlotsAvailable: userSlots.reduce((sum, us) => sum + us.slots.filter(s => s.status === 'available').length, 0),
    totalSlotsBooked:    userSlots.reduce((sum, us) => sum + us.slots.filter(s => s.status === 'booked').length, 0),
    totalSlotsRequested: userSlots.reduce((sum, us) => sum + us.slots.filter(s => s.status === 'requested').length, 0),
  };

  successResponse(res, {
    event: {
      _id:      event._id,
      title:    event.title,
      fromDate: event.fromDate,
      toDate:   event.toDate,
      location: event.location,
    },
    summary,
    exhibitors: exhibitorsWithSlots,
    visitors:   visitorsWithSlots,
    exhibitorToExhibitorMeetings,
  });
});

module.exports = { 
  toggleShowSlots, 
  getUserSlots, 
  requestMeeting, 
  respondToMeeting,
  getUserMeetingsByDate,
  cancelMeeting,
  getAllMeetingsAdmin,
  getEventSlotBookings
};

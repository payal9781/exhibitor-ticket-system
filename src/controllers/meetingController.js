const { successResponse, errorResponse } = require('../utils/apiResponse');
const asyncHandler = require('express-async-handler');
const UserEventSlot = require('../models/UserEventSlot');
const Meeting = require("../models/meeting");

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
  const { eventId, requesteeId, requesteeType, slotStart, slotEnd } = req.body;
  const userSlot = await UserEventSlot.findOne({ userId: requesteeId, userType: requesteeType, eventId });
  if (!userSlot) return errorResponse(res, 'Slots not found', 404);
  const slotIndex = userSlot.slots.findIndex(s => s.start.getTime() === new Date(slotStart).getTime() && s.status === 'available');
  if (slotIndex === -1) return errorResponse(res, 'Slot not available', 400);

  const meeting = new Meeting({
    eventId,
    requesterId: req.user.id,
    requesterType: req.user.type,
    requesteeId,
    requesteeType,
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
  if (!meeting || meeting.requesteeId.toString() !== req.user.id) return errorResponse(res, 'Invalid meeting', 404);
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
      { requesteeId: userId, requesteeType: userType }
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
      otherParticipantType = meeting.requesteeType;
      if (meeting.requesteeType === 'exhibitor') {
        otherParticipant = await require('../models/Exhibitor').findById(meeting.requesteeId)
          .select('companyName email phone profileImage bio Sector location');
      } else {
        otherParticipant = await require('../models/Visitor').findById(meeting.requesteeId)
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
      meeting.requesteeId.toString() !== userId.toString()) {
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
      userId: meeting.requesteeId,
      userType: meeting.requesteeType,
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

      // Get requestee details
      let requesteeDetails;
      if (meeting.requesteeType === 'exhibitor') {
        requesteeDetails = await require('../models/Exhibitor').findById(meeting.requesteeId)
          .select('companyName email phone profileImage bio Sector location');
      } else {
        requesteeDetails = await require('../models/Visitor').findById(meeting.requesteeId)
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
        requestee: {
          ...requesteeDetails?.toObject(),
          type: meeting.requesteeType,
          displayName: requesteeDetails?.companyName || requesteeDetails?.name || 'Unknown'
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
      meeting.requestee.displayName.toLowerCase().includes(searchLower) ||
      meeting.requester.email?.toLowerCase().includes(searchLower) ||
      meeting.requestee.email?.toLowerCase().includes(searchLower)
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


// Admin: Get event slot bookings overview
const getEventSlotBookings = asyncHandler(async (req, res) => {
  const { eventId } = req.body;

  if (!eventId) {
    return errorResponse(res, 'Event ID is required', 400);
  }

  const Event = require('../models/Event');
  const Exhibitor = require('../models/Exhibitor');
  const Visitor = require('../models/Visitor');
  const UserEventSlot = require('../models/UserEventSlot');

  // Get event details
  const event = await Event.findById(eventId).select('title fromDate toDate location');
  if (!event) {
    return errorResponse(res, 'Event not found', 404);
  }

  // Get all meetings for this event
  const meetings = await Meeting.find({ eventId })
    .sort({ slotStart: 1 });

  // Get all user slots for this event
  const userSlots = await UserEventSlot.find({ eventId });

  // Get registered exhibitors and visitors
  const registeredExhibitors = await Event.findById(eventId)
    .populate('exhibitor.userId', 'companyName email phone profileImage')
    .select('exhibitor');
  
  const registeredVisitors = await Event.findById(eventId)
    .populate('visitor.userId', 'name email phone profileImage companyName')
    .select('visitor');

  // Process exhibitors with their slots and bookings
  const exhibitorsWithSlots = await Promise.all(
    (registeredExhibitors?.exhibitor || [])
      // Show ALL exhibitors, not just verified ones
      .map(async (exhibitor) => {
        const userId = exhibitor.userId._id || exhibitor.userId;
        
        // Get user's slots
        const userSlot = userSlots.find(
          s => s.userId.toString() === userId.toString() && s.userType === 'exhibitor'
        );

        // Get meetings where this user is involved
        const userMeetings = meetings.filter(
          m => m.requesterId.toString() === userId.toString() || 
               m.requestedId.toString() === userId.toString()
        );

        // Count slot statuses
        const slotCounts = {
          total: userSlot?.slots.length || 0,
          available: 0,
          requested: 0,
          booked: 0,
        };

        if (userSlot) {
          userSlot.slots.forEach(slot => {
            if (slotCounts.hasOwnProperty(slot.status)) {
              slotCounts[slot.status]++;
            }
          });
        }

        // Get meeting details
        const meetingDetails = await Promise.all(
          userMeetings.map(async (meeting) => {
            let otherParticipant;
            let otherParticipantType;
            const isRequester = meeting.requesterId.toString() === userId.toString();

            if (isRequester) {
              otherParticipantType = meeting.requestedType;
              if (meeting.requestedType === 'exhibitor') {
                otherParticipant = await Exhibitor.findById(meeting.requestedId)
                  .select('companyName email phone');
              } else {
                otherParticipant = await Visitor.findById(meeting.requestedId)
                  .select('name email phone companyName');
              }
            } else {
              otherParticipantType = meeting.requesterType;
              if (meeting.requesterType === 'exhibitor') {
                otherParticipant = await Exhibitor.findById(meeting.requesterId)
                  .select('companyName email phone');
              } else {
                otherParticipant = await Visitor.findById(meeting.requesterId)
                  .select('name email phone companyName');
              }
            }

            return {
              _id: meeting._id,
              slotStart: meeting.slotStart,
              slotEnd: meeting.slotEnd,
              status: meeting.status,
              isRequester,
              otherParticipant: {
                name: otherParticipant?.companyName || otherParticipant?.name || 'Unknown',
                type: otherParticipantType,
                email: otherParticipant?.email,
                phone: otherParticipant?.phone,
              },
            };
          })
        );

        return {
          _id: userId,
          name: exhibitor.userId.companyName || 'Unknown',
          email: exhibitor.userId.email,
          phone: exhibitor.userId.phone,
          profileImage: exhibitor.userId.profileImage,
          type: 'exhibitor',
          registeredAt: exhibitor.registeredAt,
          qrCode: exhibitor.qrCode,
          isVerified: exhibitor.isVerified, // Add verification status
          showSlots: userSlot?.showSlots || false,
          slotCounts,
          meetings: meetingDetails,
          addedBy: exhibitor.addedBy ? {
            name: exhibitor.addedBy.name || 'Unknown',
            userType: exhibitor.addedBy.userType || 'Unknown',
            addedAt: exhibitor.addedBy.addedAt || exhibitor.registeredAt
          } : {
            name: 'Self-Registered',
            userType: 'Self',
            addedAt: exhibitor.registeredAt
          }
        };
      })
  );

  // Process visitors with their slots and bookings
  const visitorsWithSlots = await Promise.all(
    (registeredVisitors?.visitor || [])
      // Show ALL visitors, not just verified ones
      .map(async (visitor) => {
        const userId = visitor.userId._id || visitor.userId;
        
        // Get user's slots
        const userSlot = userSlots.find(
          s => s.userId.toString() === userId.toString() && s.userType === 'visitor'
        );

        // Get meetings where this user is involved
        const userMeetings = meetings.filter(
          m => m.requesterId.toString() === userId.toString() || 
               m.requestedId.toString() === userId.toString()
        );

        // Count slot statuses
        const slotCounts = {
          total: userSlot?.slots.length || 0,
          available: 0,
          requested: 0,
          booked: 0,
        };

        if (userSlot) {
          userSlot.slots.forEach(slot => {
            if (slotCounts.hasOwnProperty(slot.status)) {
              slotCounts[slot.status]++;
            }
          });
        }

        // Get meeting details
        const meetingDetails = await Promise.all(
          userMeetings.map(async (meeting) => {
            let otherParticipant;
            let otherParticipantType;
            const isRequester = meeting.requesterId.toString() === userId.toString();

            if (isRequester) {
              otherParticipantType = meeting.requestedType;
              if (meeting.requestedType === 'exhibitor') {
                otherParticipant = await Exhibitor.findById(meeting.requestedId)
                  .select('companyName email phone');
              } else {
                otherParticipant = await Visitor.findById(meeting.requestedId)
                  .select('name email phone companyName');
              }
            } else {
              otherParticipantType = meeting.requesterType;
              if (meeting.requesterType === 'exhibitor') {
                otherParticipant = await Exhibitor.findById(meeting.requesterId)
                  .select('companyName email phone');
              } else {
                otherParticipant = await Visitor.findById(meeting.requesterId)
                  .select('name email phone companyName');
              }
            }

            return {
              _id: meeting._id,
              slotStart: meeting.slotStart,
              slotEnd: meeting.slotEnd,
              status: meeting.status,
              isRequester,
              otherParticipant: {
                name: otherParticipant?.companyName || otherParticipant?.name || 'Unknown',
                type: otherParticipantType,
                email: otherParticipant?.email,
                phone: otherParticipant?.phone,
              },
            };
          })
        );

        return {
          _id: userId,
          name: visitor.userId.name || visitor.userId.companyName || 'Unknown',
          email: visitor.userId.email,
          phone: visitor.userId.phone,
          profileImage: visitor.userId.profileImage,
          type: 'visitor',
          registeredAt: visitor.registeredAt,
          qrCode: visitor.qrCode,
          isVerified: visitor.isVerified, // Add verification status
          showSlots: userSlot?.showSlots || false,
          slotCounts,
          meetings: meetingDetails,
          addedBy: visitor.addedBy ? {
            name: visitor.addedBy.name || 'Unknown',
            userType: visitor.addedBy.userType || 'Unknown',
            addedAt: visitor.addedBy.addedAt || visitor.registeredAt
          } : {
            name: 'Self-Registered',
            userType: 'Self',
            addedAt: visitor.registeredAt
          }
        };
      })
  );

  // Calculate summary statistics
  const summary = {
    totalExhibitors: exhibitorsWithSlots.length,
    totalVisitors: visitorsWithSlots.length,
    totalMeetings: meetings.length,
    meetingsByStatus: {
      pending: meetings.filter(m => m.status === 'pending').length,
      accepted: meetings.filter(m => m.status === 'accepted').length,
      rejected: meetings.filter(m => m.status === 'rejected').length,
      cancelled: meetings.filter(m => m.status === 'cancelled').length,
    },
    totalSlotsAvailable: userSlots.reduce((sum, us) => sum + us.slots.filter(s => s.status === 'available').length, 0),
    totalSlotsBooked: userSlots.reduce((sum, us) => sum + us.slots.filter(s => s.status === 'booked').length, 0),
  };

  successResponse(res, {
    event: {
      _id: event._id,
      title: event.title,
      fromDate: event.fromDate,
      toDate: event.toDate,
      location: event.location,
    },
    summary,
    exhibitors: exhibitorsWithSlots,
    visitors: visitorsWithSlots,
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

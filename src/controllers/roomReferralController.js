// src/controllers/roomReferralController.js
const asyncHandler = require('../utils/asyncHandler');
const { response } = require('../utils/apiResponse');
const { models } = require('../models/z-index');
const XLSX = require('xlsx');
const { sendNotification } = require('../utils/fcmToken_notification');

const {
  RoomReferralRoom,
  RoomReferralRound,
  RoomReferralEntry,
  Event,
  Exhibitor,
  Visitor,
  Notification
} = models;

const isSuperAdminUser = (user) =>
  user?.type === 'superAdmin' || user?.type === 'superadmin';

const getOrganizerEventIds = async (organizerId) =>
  Event.find({ organizerId, isDeleted: false }).distinct('_id');

const organizerOwnsEvent = (event, organizerId) =>
  !!(event && !event.isDeleted && event.organizerId?.toString() === organizerId);

const assertOrganizerRoomAccess = async (req, res, room) => {
  if (!room || room.isDeleted) {
    return response.notFound('Room not found', res);
  }
  if (isSuperAdminUser(req.user)) {
    return null;
  }
  if (req.user.type !== 'organizer') {
    return null;
  }
  const event = await Event.findById(room.eventId).select('organizerId isDeleted');
  if (!organizerOwnsEvent(event, req.user.id)) {
    return response.forbidden('You do not have access to this room', res);
  }
  return null;
};

const assertOrganizerRoundAccess = async (req, res, roundId) => {
  const round = await RoomReferralRound.findById(roundId);
  if (!round) {
    return { error: response.notFound('Round not found', res) };
  }
  const room = await RoomReferralRoom.findOne({ _id: round.roomId, isDeleted: false });
  const accessError = await assertOrganizerRoomAccess(req, res, room);
  if (accessError) {
    return { error: accessError };
  }
  return { round, room };
};

const applyOrganizerRoomListFilter = async (req, eventId) => {
  if (req.user.type !== 'organizer') {
    return eventId ? { eventId } : {};
  }

  const eventIds = await getOrganizerEventIds(req.user.id);
  if (eventId) {
    const ownsEvent = eventIds.some((id) => id.toString() === eventId.toString());
    return ownsEvent ? { eventId } : { eventId: { $in: [] } };
  }
  return { eventId: { $in: eventIds } };
};

// ==========================================
// ADMIN CONTROLLERS
// ==========================================

/**
 * Create a new Room Referral Room linked to an Event
 */
const createRoom = asyncHandler(async (req, res) => {
  const { name, details, date, startTime, endTime, location, mapURL, eventId, chapter_name } = req.body;
  
  const existingRoom = await RoomReferralRoom.findOne({ eventId, isDeleted: false });
  if (existingRoom) {
    return response.badRequest('A referral room for this event already exists', res);
  }
  const event = await Event.findById(eventId);
  if (!event || event.isDeleted) {
    return response.notFound('Event not found or deleted', res);
  }
  if (req.user.type === 'organizer' && !organizerOwnsEvent(event, req.user.id)) {
    return response.forbidden('You can only create rooms for your own events', res);
  }

  let banner = '';
  if (req.file) {
    banner = `uploads/${req.file.filename}`;
  }

  const room = await RoomReferralRoom.create({
    name: name || event.title,
    details: details || '',
    date: date || event.fromDate,
    startTime: startTime || event.startTime,
    endTime: endTime || event.endTime,
    location: location || event.location,
    mapURL: mapURL || '',
    banner,
    eventId,
    eventName: event.title,
    chapter_name: chapter_name || '',
    createdBy: req.user.id,
    createdByType: req.user.type === 'superAdmin' ? 'Superadmin' : 'Organizer'
  });

  return response.success('Room created successfully', room, res, 201); // Status 201 Created
});

/**
 * Update an existing Room
 */
const updateRoom = asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const updateData = { ...req.body };

  const room = await RoomReferralRoom.findOne({ _id: roomId, isDeleted: false });
  const accessError = await assertOrganizerRoomAccess(req, res, room);
  if (accessError) return accessError;

  if (req.file) {
    updateData.banner = `uploads/${req.file.filename}`;
  }

  if (updateData.eventId && updateData.eventId !== room.eventId.toString()) {
    const event = await Event.findById(updateData.eventId);
    if (!event || event.isDeleted) {
      return response.notFound('Event not found', res);
    }
    if (req.user.type === 'organizer' && !organizerOwnsEvent(event, req.user.id)) {
      return response.forbidden('You can only assign rooms to your own events', res);
    }
    updateData.eventName = event.title;
  }

  const updatedRoom = await RoomReferralRoom.findByIdAndUpdate(roomId, updateData, { new: true });
  return response.success('Room updated successfully', updatedRoom, res);
});

/**
 * Soft Delete a Room
 */
const deleteRoom = asyncHandler(async (req, res) => {
  const { roomId } = req.params;

  const room = await RoomReferralRoom.findOne({ _id: roomId, isDeleted: false });
  const accessError = await assertOrganizerRoomAccess(req, res, room);
  if (accessError) return accessError;

  room.isDeleted = true;
  await room.save();

  return response.success('Room deleted successfully', {}, res);
});

/**
 * Create a new networking Round inside a Room
 */
const createRound = asyncHandler(async (req, res) => {
  const { roomId, name, roundNumber } = req.body;

  const room = await RoomReferralRoom.findOne({ _id: roomId, isDeleted: false });
  const accessError = await assertOrganizerRoomAccess(req, res, room);
  if (accessError) return accessError;

  // Check if round number already exists for this room
  const existingRound = await RoomReferralRound.findOne({ roomId, roundNumber });
  if (existingRound) {
    return response.badRequest('Round number already exists in this room', res);
  }

  const round = await RoomReferralRound.create({
    roomId,
    name,
    roundNumber,
    participants: []
  });

  return response.success('Round created successfully', round, res, 201);
});

/**
 * Update an existing Round name/number
 */
const updateRound = asyncHandler(async (req, res) => {
  const { roundId } = req.params;
  const { name, roundNumber } = req.body;

  const roundAccess = await assertOrganizerRoundAccess(req, res, roundId);
  if (roundAccess.error) return roundAccess.error;
  const { round } = roundAccess;

  if (roundNumber !== undefined && roundNumber !== round.roundNumber) {
    const existingRound = await RoomReferralRound.findOne({ roomId: round.roomId, roundNumber });
    if (existingRound) {
      return response.badRequest('Round number already exists in this room', res);
    }
    round.roundNumber = roundNumber;
  }

  if (name !== undefined) {
    round.name = name;
  }

  await round.save();
  return response.success('Round updated successfully', round, res);
});

/**
 * Delete a Round from a Room
 */
const deleteRound = asyncHandler(async (req, res) => {
  const { roundId } = req.params;

  const roundAccess = await assertOrganizerRoundAccess(req, res, roundId);
  if (roundAccess.error) return roundAccess.error;
  const { round } = roundAccess;

  await RoomReferralRound.findByIdAndDelete(roundId);
  // Also clean up any referral entries made in this round
  await RoomReferralEntry.deleteMany({ roundId });

  return response.success('Round deleted successfully', {}, res);
});

/**
 * Add specific Participants manually to a Round
 */
const addUsersToRound = asyncHandler(async (req, res) => {
  const { roundId, participants } = req.body; // participants: [{ userId, userModel }]

  const roundAccess = await assertOrganizerRoundAccess(req, res, roundId);
  if (roundAccess.error) return roundAccess.error;
  const { round } = roundAccess;

  // Validate each user and add if not already in participants
  const updatedParticipants = [...round.participants];
  const errors = [];

  for (const part of participants) {
    const Model = part.userModel === 'Exhibitor' ? Exhibitor : Visitor;
    const user = await Model.findOne({ _id: part.userId, isDeleted: false });

    if (!user) {
      errors.push(`User ${part.userId} (${part.userModel}) not found`);
      continue;
    }

    const isDuplicate = updatedParticipants.some(
      p => p.userId.toString() === part.userId.toString() && p.userModel === part.userModel
    );

    if (!isDuplicate) {
      updatedParticipants.push({
        userId: part.userId,
        userModel: part.userModel
      });
    }
  }

  round.participants = updatedParticipants;
  await round.save();

  const populatedRound = await RoomReferralRound.findById(roundId).populate('participants.userId');

  return response.success('Participants updated', {
    round: populatedRound,
    errors: errors.length > 0 ? errors : undefined
  }, res);
});

/**
 * Batch add Participants to a Round using filters
 */
const addUsersToRoundByFilter = asyncHandler(async (req, res) => {
  const { roundId, filters } = req.body; // filters: { sector, category, userType }

  const roundAccess = await assertOrganizerRoundAccess(req, res, roundId);
  if (roundAccess.error) return roundAccess.error;
  const { round } = roundAccess;

  // Build query
  const query = { isDeleted: false, isActive: true };

  // Filter by Sector (industry sector / category)
  const sectorVal = filters.sector || filters.category;
  if (sectorVal && sectorVal.trim() !== '') {
    query.Sector = { $regex: new RegExp(sectorVal.trim(), 'i') };
  }

  const matchingExhibitors = [];
  const matchingVisitors = [];

  // Query collections based on userType filter
  const targetType = filters.userType || 'all';

  if (targetType === 'Exhibitor' || targetType === 'all') {
    const exhs = await Exhibitor.find(query).select('_id');
    matchingExhibitors.push(...exhs.map(e => ({ userId: e._id, userModel: 'Exhibitor' })));
  }

  if (targetType === 'Visitor' || targetType === 'all') {
    const vists = await Visitor.find(query).select('_id');
    matchingVisitors.push(...vists.map(v => ({ userId: v._id, userModel: 'Visitor' })));
  }

  const allMatching = [...matchingExhibitors, ...matchingVisitors];
  if (allMatching.length === 0) {
    return response.success('No matching users found for filters', { count: 0, round }, res);
  }

  // Add to round.participants avoiding duplicates
  const updatedParticipants = [...round.participants];
  let addedCount = 0;

  for (const part of allMatching) {
    const isDuplicate = updatedParticipants.some(
      p => p.userId.toString() === part.userId.toString() && p.userModel === part.userModel
    );
    if (!isDuplicate) {
      updatedParticipants.push(part);
      addedCount++;
    }
  }

  round.participants = updatedParticipants;
  await round.save();

  const populatedRound = await RoomReferralRound.findById(roundId).populate('participants.userId');

  return response.success(`${addedCount} participants added dynamically`, {
    count: addedCount,
    round: populatedRound
  }, res);
});

/**
 * Remove a user from a round
 */
const removeUserFromRound = asyncHandler(async (req, res) => {
  const { roundId, userId } = req.body;

  const roundAccess = await assertOrganizerRoundAccess(req, res, roundId);
  if (roundAccess.error) return roundAccess.error;
  const { round } = roundAccess;

  const index = round.participants.findIndex(p => p.userId.toString() === userId.toString());
  if (index === -1) {
    return response.badRequest('User is not a participant in this round', res);
  }

  round.participants.splice(index, 1);
  await round.save();

  // Clean up references to referrals if needed (usually we keep entries for stats history)
  const populatedRound = await RoomReferralRound.findById(roundId).populate('participants.userId');
  return response.success('User removed from round', populatedRound, res);
});

/**
 * Get Room Details, Rounds list with populated participants, and total stats
 */
const getRoomDetails = asyncHandler(async (req, res) => {
  const { roomId } = req.params;

  const room = await RoomReferralRoom.findOne({ _id: roomId, isDeleted: false });
  if (!room) {
    return response.notFound('Room not found', res);
  }
  if (req.user.type === 'organizer') {
    const accessError = await assertOrganizerRoomAccess(req, res, room);
    if (accessError) return accessError;
  }

  // Find rounds
  const rounds = await RoomReferralRound.find({ roomId })
    .populate('participants.userId')
    .sort({ roundNumber: 1 });

  // Find referrals passed in this room
  const referrals = await RoomReferralEntry.find({ roomId })
    .populate('roundId')
    .populate('giverId')
    .populate('receiverId');

  // Compute unique participants count across all rounds
  const uniqueParticipants = new Set();
  rounds.forEach(r => {
    r.participants.forEach(p => {
      uniqueParticipants.add(`${p.userId?._id || p.userId}-${p.userModel}`);
    });
  });

  const stats = {
    totalRounds: rounds.length,
    totalParticipants: uniqueParticipants.size,
    totalReferrals: referrals.length
  };

  return response.success('Room details retrieved successfully', {
    room,
    rounds,
    referrals,
    stats
  }, res);
});

/**
 * Paginated list of Rooms with counts and filters
 */
const listRooms = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search = '', eventId } = req.body;

  const query = { isDeleted: false, ...(await applyOrganizerRoomListFilter(req, eventId)) };
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { eventName: { $regex: search, $options: 'i' } },
      { chapter_name: { $regex: search, $options: 'i' } }
    ];
  }

  const skip = (page - 1) * limit;
  const total = await RoomReferralRoom.countDocuments(query);
  const rooms = await RoomReferralRoom.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  // For each room, load stats
  const enrichedRooms = [];
  for (const rm of rooms) {
    const roundsCount = await RoomReferralRound.countDocuments({ roomId: rm._id });
    const referralsCount = await RoomReferralEntry.countDocuments({ roomId: rm._id });
    
    // Total unique participants
    const rounds = await RoomReferralRound.find({ roomId: rm._id }).select('participants');
    const participantsSet = new Set();
    rounds.forEach(r => {
      r.participants.forEach(p => {
        participantsSet.add(p.userId.toString());
      });
    });

    enrichedRooms.push({
      ...rm,
      roundsCount,
      referralsCount,
      participantsCount: participantsSet.size
    });
  }

  return response.success('Rooms list retrieved successfully', {
    rooms: enrichedRooms,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      itemsPerPage: parseInt(limit)
    }
  }, res);
});

/**
 * Export Room referrals into Excel worksheet
 */
const exportRoomReferralsToExcel = asyncHandler(async (req, res) => {
  const { roomId } = req.params;

  const room = await RoomReferralRoom.findOne({ _id: roomId, isDeleted: false });
  const accessError = await assertOrganizerRoomAccess(req, res, room);
  if (accessError) return accessError;

  const referrals = await RoomReferralEntry.find({ roomId })
    .populate('roundId')
    .populate('giverId')
    .populate('receiverId');

  // Convert schema documents to JSON worksheet data
  const data = referrals.map((ref, index) => {
    const giverName = ref.giverId ? (ref.giverId.name || ref.giverId.companyName || 'N/A') : 'N/A';
    const receiverName = ref.receiverId ? (ref.receiverId.name || ref.receiverId.companyName || 'N/A') : 'N/A';
    
    return {
      'S.No': index + 1,
      'Room Name': room.name,
      'Event Name': room.eventName || 'N/A',
      'Chapter': room.chapter_name || 'N/A',
      'Round': ref.roundId ? ref.roundId.name : 'N/A',
      'Giver Name': giverName,
      'Giver Email': ref.giverId ? (ref.giverId.email || 'N/A') : 'N/A',
      'Giver Phone': ref.giverId ? (ref.giverId.phone || 'N/A') : 'N/A',
      'Giver Type': ref.giverModel,
      'Receiver Name': receiverName,
      'Receiver Email': ref.receiverId ? (ref.receiverId.email || 'N/A') : 'N/A',
      'Receiver Phone': ref.receiverId ? (ref.receiverId.phone || 'N/A') : 'N/A',
      'Receiver Type': ref.receiverModel,
      'Referred Lead Contact': ref.referredName || 'N/A',
      'Referred Lead Email': ref.referredEmail || 'N/A',
      'Referred Lead Mobile': ref.referredMobile || 'N/A',
      'Comment/Notes': ref.comment || ''
    };
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);

  // Set column widths for readability
  const colWidths = [
    { wch: 6 },   // S.No
    { wch: 20 },  // Room Name
    { wch: 20 },  // Event Name
    { wch: 15 },  // Chapter
    { wch: 15 },  // Round
    { wch: 20 },  // Giver Name
    { wch: 25 },  // Giver Email
    { wch: 15 },  // Giver Phone
    { wch: 10 },  // Giver Type
    { wch: 20 },  // Receiver Name
    { wch: 25 },  // Receiver Email
    { wch: 15 },  // Receiver Phone
    { wch: 10 },  // Receiver Type
    { wch: 22 },  // Referred Contact
    { wch: 25 },  // Referred Email
    { wch: 15 },  // Referred Mobile
    { wch: 30 }   // Notes
  ];
  ws['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, 'Room Referrals');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="RoomReferrals_${room.name.replace(/\s+/g, '_')}.xlsx"`);
  return res.send(buffer);
});


// ==========================================
// MOBILE CLIENT APIs
// ==========================================

/**
 * Fetch active rooms where the user is a round participant
 */
const getMyRooms = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Find all rounds containing this user
  const rounds = await RoomReferralRound.find({
    'participants.userId': userId
  }).select('roomId');

  const roomIds = rounds.map(r => r.roomId);
  
  const rooms = await RoomReferralRoom.find({
    _id: { $in: roomIds },
    isActive: true,
    isDeleted: false
  }).sort({ date: -1 });

  return response.success('User active rooms retrieved', rooms, res);
});

/**
 * Fetch rounds inside a room where the user is added, populating other participants and stats
 */
const getMyRoundsByRoom = asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const userId = req.user.id;

  // Find room
  const room = await RoomReferralRoom.findOne({ _id: roomId, isDeleted: false });
  if (!room) {
    return response.notFound('Room not found', res);
  }

  // Find rounds where current user is participant
  const rounds = await RoomReferralRound.find({
    roomId,
    'participants.userId': userId
  }).lean();

  const formattedRounds = [];

  for (const round of rounds) {
    const otherParticipants = [];

    for (const part of round.participants) {
      // Exclude the logged-in user
      if (part.userId.toString() === userId.toString()) continue;

      const Model = part.userModel === 'Exhibitor' ? Exhibitor : Visitor;
      const profile = await Model.findOne({ _id: part.userId, isDeleted: false })
        .select('name companyName email phone profileImage Sector')
        .lean();

      if (!profile) continue;

      // Stats: Giver is current user, Receiver is participant
      const referralsGave = await RoomReferralEntry.countDocuments({
        roomId,
        roundId: round._id,
        giverId: userId,
        receiverId: part.userId
      });

      // Stats: Giver is participant, Receiver is current user
      const referralsReceived = await RoomReferralEntry.countDocuments({
        roomId,
        roundId: round._id,
        giverId: part.userId,
        receiverId: userId
      });

      otherParticipants.push({
        userId: part.userId,
        name: profile.name || profile.companyName || 'N/A',
        companyName: profile.companyName || 'N/A',
        email: profile.email || '',
        phone: profile.phone || '',
        profileImage: profile.profileImage || '',
        Sector: profile.Sector || 'N/A',
        userModel: part.userModel,
        stats: {
          referralsGave,
          referralsReceived
        }
      });
    }

    formattedRounds.push({
      _id: round._id,
      name: round.name,
      roundNumber: round.roundNumber,
      participants: otherParticipants
    });
  }

  return response.success('Rounds details retrieved', formattedRounds, res);
});

/**
 * Submit a business referral lead to a fellow participant in a round
 */
const createRoundReferral = asyncHandler(async (req, res) => {
  const { roomId, roundId, receiverId, receiverModel, referredName, referredEmail, referredMobile, comment } = req.body;
  const giverId = req.user.id;
  const giverModel = req.user.type === 'exhibitor' ? 'Exhibitor' : 'Visitor';

  if (giverId.toString() === receiverId.toString()) {
    return response.badRequest('You cannot refer a lead to yourself', res);
  }

  // Ensure both are in the round
  const round = await RoomReferralRound.findById(roundId);
  if (!round) {
    return response.notFound('Round not found', res);
  }

  const isGiverInRound = round.participants.some(p => p.userId.toString() === giverId.toString());
  const isReceiverInRound = round.participants.some(p => p.userId.toString() === receiverId.toString());

  if (!isGiverInRound || !isReceiverInRound) {
    return response.badRequest('Both Giver and Receiver must be assigned to this round', res);
  }

  // Create referral entry
  const entry = await RoomReferralEntry.create({
    roomId,
    roundId,
    giverId,
    giverModel,
    receiverId,
    receiverModel,
    referredName,
    referredEmail,
    referredMobile,
    comment: comment || ''
  });

  // Get Giver name details
  const GiverCollection = giverModel === 'Exhibitor' ? Exhibitor : Visitor;
  const giverProfile = await GiverCollection.findById(giverId);
  const giverName = giverProfile ? (giverProfile.name || giverProfile.companyName || 'A member') : 'A member';

  // Get Receiver details for notification
  const ReceiverCollection = receiverModel === 'Exhibitor' ? Exhibitor : Visitor;
  const receiverProfile = await ReceiverCollection.findById(receiverId);

  // Store in Notification model
  await Notification.create({
    recipientId: receiverId,
    recipientType: receiverModel.toLowerCase(),
    type: 'referral',
    title: 'New Referral Received',
    message: `${giverName} passed you a business referral lead: ${referredName}.`,
    data: {
      roomId: roomId.toString(),
      roundId: roundId.toString(),
      referralId: entry._id.toString(),
      referredName
    }
  });

  // Send push notification via FCM
  if (receiverProfile && receiverProfile.fcmToken) {
    try {
      await sendNotification(receiverProfile.fcmToken, [
        'New Referral Received',
        `${giverName} passed you a business referral lead: ${referredName}.`,
        {
          type: 'referral',
          roomId: roomId.toString(),
          roundId: roundId.toString(),
          referralId: entry._id.toString()
        }
      ]);
    } catch (err) {
      console.error('Failed to dispatch FCM notification:', err);
    }
  }

  return response.success('Referral passed successfully', entry, res);
});

/**
 * Get cumulative counts of referrals given and received by the user
 */
const getMyRoundReferralStats = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { roomId, roundId } = req.query;

  const queryGave = { giverId: userId };
  const queryReceived = { receiverId: userId };

  if (roomId) {
    queryGave.roomId = roomId;
    queryReceived.roomId = roomId;
  }
  if (roundId) {
    queryGave.roundId = roundId;
    queryReceived.roundId = roundId;
  }

  const givenCount = await RoomReferralEntry.countDocuments(queryGave);
  const receivedCount = await RoomReferralEntry.countDocuments(queryReceived);

  return response.success('Referrals stats retrieved', {
    given: givenCount,
    received: receivedCount
  }, res);
});

/**
 * Paginated list of referrals involving the user
 */
const getMyRoundReferrals = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { type = 'all', page = 1, limit = 10 } = req.query;

  let query = {};
  if (type === 'given') {
    query = { giverId: userId };
  } else if (type === 'received') {
    query = { receiverId: userId };
  } else {
    query = { $or: [{ giverId: userId }, { receiverId: userId }] };
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const total = await RoomReferralEntry.countDocuments(query);
  
  const entries = await RoomReferralEntry.find(query)
    .populate('roomId', 'name date location')
    .populate('roundId', 'name roundNumber')
    .populate('giverId', 'name companyName email phone')
    .populate('receiverId', 'name companyName email phone')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  return response.success('Referrals list retrieved', {
    referrals: entries,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      itemsPerPage: parseInt(limit)
    }
  }, res);
});

module.exports = {
  createRoom,
  updateRoom,
  deleteRoom,
  createRound,
  updateRound,
  deleteRound,
  addUsersToRound,
  addUsersToRoundByFilter,
  removeUserFromRound,
  getRoomDetails,
  listRooms,
  exportRoomReferralsToExcel,
  
  // Mobile client controllers
  getMyRooms,
  getMyRoundsByRoom,
  createRoundReferral,
  getMyRoundReferralStats,
  getMyRoundReferrals
};

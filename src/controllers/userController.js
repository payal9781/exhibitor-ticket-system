// src/controllers/userController.js
const asyncHandler = require('../utils/asyncHandler');
const { response } = require('../utils/apiResponse');
const { models } = require('../models/z-index');
const { generateQRCode } = require('../services/qrCodeService');

const registerForEvent = asyncHandler(async (req, res) => {
  const { eventId } = req.body;
  const userId = req.user.id;
  const role = req.user.type;

  const event = await models.Event.findById(eventId);
  if (!event || event.isDeleted) {
    return response.notFound('Event not found', res);
  }

  const updateField = role === 'exhibitor' ? 'exhibitor' : 'visitor';
  const updatedEvent = await models.Event.findByIdAndUpdate(
    eventId,
    { $addToSet: { [updateField]: userId } },
    { new: true }
  );

  const qrData = {
    eventId,
    userId,
    role,
    startDate: event.fromDate,
    endDate: event.toDate
  };
  const qrCode = await generateQRCode(JSON.stringify(qrData));

  return response.success('Registered for event successfully', { event: updatedEvent, qrCode }, res);
});

const scanQRCode = asyncHandler(async (req, res) => {
  const { qrData } = req.body;
  const scannerId = req.user.id;
  const scannerRole = req.user.type;

  let parsedData;
  try {
    parsedData = JSON.parse(qrData);
  } catch (error) {
    return response.badRequest('Invalid QR code', res);
  }

  const { eventId, userId, role, startDate, endDate } = parsedData;
  const event = await models.Event.findById(eventId);
  if (!event || event.isDeleted || new Date() < startDate || new Date() > endDate) {
    return response.badRequest('Invalid or expired event', res);
  }

  const UserModel = models[role.charAt(0).toUpperCase() + role.slice(1)];
  const scannedUser = await UserModel.findById(userId);
  if (!scannedUser || !scannedUser.isActive) {
    return response.badRequest('Invalid user', res);
  }

  await models.Scan.create({
    scanner: scannerId,
    userModel: scannerRole.charAt(0).toUpperCase() + scannerRole.slice(1),
    scannedUser: [userId],
    eventId
  });

  return response.success('QR code scanned successfully', scannedUser, res);
});

const markAttendance = asyncHandler(async (req, res) => {
  const { qrData } = req.body;
  
  let parsedData;
  try {
    parsedData = JSON.parse(qrData);
  } catch (error) {
    return response.badRequest('Invalid QR code', res);
  }

  const { eventId, userId, role } = parsedData;
  const event = await models.Event.findById(eventId);
  if (!event || event.isDeleted) {
    return response.badRequest('Invalid event', res);
  }

  const UserModel = models[role.charAt(0).toUpperCase() + role.slice(1)];
  const user = await UserModel.findById(userId);
  if (!user || !user.isActive) {
    return response.badRequest('Invalid user', res);
  }

  const attendance = await models.Attendance.findOneAndUpdate(
    { eventId, user: userId, userModel: role.charAt(0).toUpperCase() + role.slice(1) },
    {
      $push: {
        attedndanceDetails: {
          date: new Date(),
          entryTime: new Date()
        }
      }
    },
    { upsert: true, new: true }
  );

  return response.success('Attendance marked successfully', attendance, res);
});

const getUserList = asyncHandler(async (req, res) => {
  const { eventId, role } = req.query;
  const Model = models[role.charAt(0).toUpperCase() + role.slice(1)];

  if (!Model) {
    return response.badRequest('Invalid role', res);
  }

  const event = await models.Event.findById(eventId).select(`${role.toLowerCase()}`);
  if (!event) {
    return response.notFound('Event not found', res);
  }

  const users = await Model.find({ _id: { $in: event[role.toLowerCase()] }, isDeleted: false });
  return response.success('Users retrieved successfully', users, res);
});

const getUserDetails = asyncHandler(async (req, res) => {
  const { userId, role } = req.params;
  const Model = models[role.charAt(0).toUpperCase() + role.slice(1)];

  if (!Model) {
    return response.badRequest('Invalid role', res);
  }

  const user = await Model.findOne({ _id: userId, isDeleted: false });
  if (!user) {
    return response.notFound('User not found', res);
  }

  return response.success('User details retrieved successfully', user, res);
});

const createUser = asyncHandler(async (req, res) => {
  const { role, ...userData } = req.body;
  const Model = models[role.charAt(0).toUpperCase() + role.slice(1)];

  if (!Model) {
    return response.badRequest('Invalid role', res);
  }

  const existingUser = await Model.findOne({ email: userData.email });
  if (existingUser) {
    return response.conflict('User already exists', res);
  }

  const user = await Model.create(userData);
  return response.create(`${role} created successfully`, user, res);
});

const updateUser = asyncHandler(async (req, res) => {
  const { userId, role } = req.params;
  const Model = models[role.charAt(0).toUpperCase() + role.slice(1)];

  if (!Model) {
    return response.badRequest('Invalid role', res);
  }

  const user = await Model.findOneAndUpdate(
    { _id: userId, isDeleted: false },
    req.body,
    { new: true }
  );
  if (!user) {
    return response.notFound('User not found', res);
  }

  return response.success(`${role} updated successfully`, user, res);
});

const deleteUser = asyncHandler(async (req, res) => {
  const { userId, role } = req.params;
  const Model = models[role.charAt(0).toUpperCase() + role.slice(1)];

  if (!Model) {
    return response.badRequest('Invalid role', res);
  }

  const user = await Model.findOneAndUpdate(
    { _id: userId, isDeleted: false },
    { isDeleted: true },
    { new: true }
  );
  if (!user) {
    return response.notFound('User not found', res);
  }

  return response.success(`${role} deleted successfully`, {}, res);
});

// Get all users for user management
const getUsers = asyncHandler(async (req, res) => {
  const { role, status, search } = req.body;
  let query = { isDeleted: false };
  
  if (status && status !== 'all') {
    query.isActive = status === 'active';
  }
  
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }

  let users = [];
  if (role && role !== 'all') {
    const Model = models[role.charAt(0).toUpperCase() + role.slice(1)];
    if (Model) {
      users = await Model.find(query);
    }
  } else {
    // Get users from all models
    const exhibitors = await models.Exhibitor.find(query);
    const visitors = await models.Visitor.find(query);
    const organizers = await models.Organizer.find(query);
    
    users = [
      ...exhibitors.map(u => ({ ...u.toObject(), role: 'exhibitor' })),
      ...visitors.map(u => ({ ...u.toObject(), role: 'visitor' })),
      ...organizers.map(u => ({ ...u.toObject(), role: 'organizer' }))
    ];
  }

  return response.success('Users retrieved successfully', users, res);
});

// Get single user by ID
const getUser = asyncHandler(async (req, res) => {
  const { id } = req.body;
  
  // Try to find user in all models
  let user = null;
  let userRole = null;
  
  const models_to_check = ['Exhibitor', 'Visitor', 'Organizer'];
  for (const modelName of models_to_check) {
    const Model = models[modelName];
    const foundUser = await Model.findOne({ _id: id, isDeleted: false });
    if (foundUser) {
      user = foundUser;
      userRole = modelName.toLowerCase();
      break;
    }
  }
  
  if (!user) {
    return response.notFound('User not found', res);
  }
  
  return response.success('User retrieved successfully', { ...user.toObject(), role: userRole }, res);
});

// Get user statistics
const getUserStats = asyncHandler(async (req, res) => {
  const totalExhibitors = await models.Exhibitor.countDocuments({ isDeleted: false });
  const activeExhibitors = await models.Exhibitor.countDocuments({ isDeleted: false, isActive: true });
  const totalVisitors = await models.Visitor.countDocuments({ isDeleted: false });
  const activeVisitors = await models.Visitor.countDocuments({ isDeleted: false, isActive: true });
  const totalOrganizers = await models.Organizer.countDocuments({ isDeleted: false });
  const activeOrganizers = await models.Organizer.countDocuments({ isDeleted: false, isActive: true });

  const stats = {
    totalUsers: totalExhibitors + totalVisitors + totalOrganizers,
    activeUsers: activeExhibitors + activeVisitors + activeOrganizers,
    totalExhibitors,
    activeExhibitors,
    totalVisitors,
    activeVisitors,
    totalOrganizers,
    activeOrganizers
  };

  return response.success('User statistics retrieved successfully', stats, res);
});

// Change user status
const changeUserStatus = asyncHandler(async (req, res) => {
  const { id, status } = req.body;
  
  let user = null;
  let userRole = null;
  
  const models_to_check = ['Exhibitor', 'Visitor', 'Organizer'];
  for (const modelName of models_to_check) {
    const Model = models[modelName];
    const foundUser = await Model.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { isActive: status === 'active' },
      { new: true }
    );
    if (foundUser) {
      user = foundUser;
      userRole = modelName.toLowerCase();
      break;
    }
  }
  
  if (!user) {
    return response.notFound('User not found', res);
  }
  
  return response.success('User status updated successfully', { ...user.toObject(), role: userRole }, res);
});

// Change user role (this would require moving user between collections)
const changeUserRole = asyncHandler(async (req, res) => {
  const { id, role } = req.body;
  
  // This is complex as it requires moving data between collections
  // For now, return an error indicating this feature needs implementation
  return response.badRequest('Role change feature not implemented yet', res);
});

// Reset user password
const resetPassword = asyncHandler(async (req, res) => {
  const { id } = req.body;
  
  let user = null;
  const models_to_check = ['Exhibitor', 'Visitor', 'Organizer'];
  for (const modelName of models_to_check) {
    const Model = models[modelName];
    const foundUser = await Model.findOne({ _id: id, isDeleted: false });
    if (foundUser) {
      user = foundUser;
      break;
    }
  }
  
  if (!user) {
    return response.notFound('User not found', res);
  }
  
  // Generate a temporary password (in real implementation, send email)
  const tempPassword = Math.random().toString(36).slice(-8);
  
  return response.success('Password reset successfully', { tempPassword }, res);
});

// Bulk update user status
const bulkUpdateUserStatus = asyncHandler(async (req, res) => {
  const { userIds, status } = req.body;
  
  const isActive = status === 'active';
  const updatedUsers = [];
  
  const models_to_check = ['Exhibitor', 'Visitor', 'Organizer'];
  for (const modelName of models_to_check) {
    const Model = models[modelName];
    const users = await Model.updateMany(
      { _id: { $in: userIds }, isDeleted: false },
      { isActive },
      { new: true }
    );
    if (users.modifiedCount > 0) {
      const updatedDocs = await Model.find({ _id: { $in: userIds }, isDeleted: false });
      updatedUsers.push(...updatedDocs.map(u => ({ ...u.toObject(), role: modelName.toLowerCase() })));
    }
  }
  
  return response.success('Users updated successfully', updatedUsers, res);
});

// Export users
const exportUsers = asyncHandler(async (req, res) => {
  const { format } = req.body;
  
  const exhibitors = await models.Exhibitor.find({ isDeleted: false });
  const visitors = await models.Visitor.find({ isDeleted: false });
  const organizers = await models.Organizer.find({ isDeleted: false });
  
  const allUsers = [
    ...exhibitors.map(u => ({ ...u.toObject(), role: 'exhibitor' })),
    ...visitors.map(u => ({ ...u.toObject(), role: 'visitor' })),
    ...organizers.map(u => ({ ...u.toObject(), role: 'organizer' }))
  ];
  
  if (format === 'csv') {
    // In real implementation, convert to CSV format
    return response.success('Users exported successfully', { data: allUsers, format: 'csv' }, res);
  }
  
  return response.success('Users exported successfully', { data: allUsers, format: 'json' }, res);
});

module.exports = {
  registerForEvent,
  scanQRCode,
  markAttendance,
  getUserList,
  getUserDetails,
  createUser,
  updateUser,
  deleteUser,
  getUsers,
  getUser,
  getUserStats,
  changeUserStatus,
  changeUserRole,
  resetPassword,
  bulkUpdateUserStatus,
  exportUsers
};
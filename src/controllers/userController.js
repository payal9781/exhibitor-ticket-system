// src/controllers/userController.js
const asyncHandler = require('../utils/asyncHandler');
const { response } = require('../utils/apiResponse');
const { models } = require('../models/z-index');
const { generateQRCode } = require('../services/qrCodeService');

const registerForEvent = asyncHandler(async (req, res) => {
  const { eventId } = req.body;
  const userId = req.user._id;
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
  const scannerId = req.user._id;
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

module.exports = {
  registerForEvent,
  scanQRCode,
  markAttendance,
  getUserList,
  getUserDetails,
  createUser,
  updateUser,
  deleteUser
};
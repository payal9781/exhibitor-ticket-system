// src/controllers/authController.js
const { successResponse, errorResponse } = require('../utils/apiResponse');
const asyncHandler = require('express-async-handler');
const Organizer = require('../models/Organizer');
const Superadmin = require('../models/Superadmin');
const Exhibitor = require('../models/Exhibitor');
const Visitor = require('../models/Visitor');
const Event = require('../models/Event');
const UserEventSlot = require('../models/UserEventSlot');
const otpService = require('../services/otpService');
const generateSlots = require('../utils/slotGenerator');
const generateQR = require('../utils/qrGenerator');
const moment = require("moment");
const axios = require('axios');
const getModelByRole = (role) => {
  switch (role) {
    case 'organizer': return Organizer;
    case 'superAdmin': return Superadmin;
    case 'exhibitor': return Exhibitor;
    case 'visitor': return Visitor;
    default: return null;
  }
};

const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const register = asyncHandler(async (req, res) => {
  const { role, ...userData } = req.body;
  const Model = getModelByRole(role);
  if (!Model) return errorResponse(res, 'Invalid role');
  if (['exhibitor', 'visitor'].includes(role)) {
    return errorResponse(res, 'Use event registration flow for exhibitor/visitor', 400);
  }

  // Check if user already exists
  const existingUser = await Model.findOne({ email: userData.email, isDeleted: { $ne: true } });
  if (existingUser) {
    return errorResponse(res, 'User with this email already exists', 409);
  }

  if (role === 'organizer' && userData.phone) {
    const existingPhone = await Organizer.findOne({ phone: userData.phone, isDeleted: { $ne: true } });
    if (existingPhone) {
      return errorResponse(res, 'An organizer with this phone number already exists', 409);
    }
  }

  try {
    const registrationPayload = { ...userData };
    if (role === 'organizer') {
      registrationPayload.isActive = false;
    }

    const user = new Model(registrationPayload);
    const payload = {
      name: String(userData.name).trim(),
      email: userData.email,
      mobile: userData.phone,
      businessKeyword: "Event",
      originId: "67ca6934c15747af04fff36c",
      countryCode: "91"
    };

    try {
      const DIGITAL_CARD_URL = "https://digitalcard.co.in/web/create-account/mobile";
      var result = await axios.post(DIGITAL_CARD_URL, payload, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      if (result.data != null) { user.digitalProfile = result.data.path; }
      else { console.log(`Something went wrong while creating digital card: ${result.data}`); }
    } catch (err) {
      console.log(`Error in creating digital card: ${err}`);
    }

    await user.save();

    if (role === 'organizer') {
      const organizerNotificationService = require('../services/organizerNotificationService');
      try {
        await organizerNotificationService.notifyOrganizerRegistrationPending({
          name: user.name || userData.name,
          email: user.email,
          phone: user.phone || userData.phone,
          organizationName: user.organizationName || userData.organizationName,
        });
      } catch (notifyError) {
        console.error('Failed to send organizer registration notifications:', notifyError);
      }
    } else {
      try {
        const emailService = require('../services/emailService');
        await emailService.sendWelcomeEmail(
          user.name || userData.name,
          user.email,
          userData.password
        );
        console.log(`Welcome email sent to: ${user.email}`);
      } catch (emailError) {
        console.error('Failed to send welcome email:', emailError);
      }
    }

    const userResponse = user.toObject();
    delete userResponse.password;
    userResponse.role = role;

    if (role === 'organizer') {
      return successResponse(res, {
        user: userResponse,
        pendingApproval: true,
        message: 'Registration successful. Your account is pending admin approval. You will receive an email when your account is activated.',
      }, 201);
    }

    const token = user.generateAccessToken();
    successResponse(res, { user: userResponse, token }, 201);
  } catch (error) {
    if (error.code === 11000) {
      // Handle duplicate key error
      const field = Object.keys(error.keyPattern)[0];
      return errorResponse(res, `${field} already exists`, 409);
    }
    throw error;
  }
});

const sendOtp = asyncHandler(async (req, res) => {
  const { role, phone } = req.body;
  if (!['exhibitor', 'visitor'].includes(role)) {
    return successResponse(res, { message: 'Invalid role for OTP login', data: 0 });
  }

  const Model = getModelByRole(role);
  let user = await Model.findOne({ phone });
  let exists = !!user;

  if (!user) {
    user = new Model({ phone });
    await user.save();
  }

  // Use the new OTP service
  const result = await otpService.sendOTP(phone);
  
  if (!result.success) {
    return errorResponse(res, result.message || 'Failed to send OTP', 500);
  }

  successResponse(res, {
    message: 'OTP sent successfully',
    data: {
      userId: user._id,
      exists,
      sessionId: result.data.sessionId
    }
  });
});

const verifyOtp = asyncHandler(async (req, res) => {
  const { role, phone, otp, machineId, fcmToken } = req.body;
  if (!['exhibitor', 'visitor'].includes(role)) {
    return successResponse(res, { message: 'Invalid role for OTP login', data: 0 });
  }

  const Model = getModelByRole(role);
  const user = await Model.findOne({ phone });
  if (!user) {
    return successResponse(res, { message: 'User not found', data: 0 });
  }

  // Use the new OTP service
  const verifyResult = await otpService.verifyOTP(phone, otp);

  if (!verifyResult.success) {
    return successResponse(res, { message: verifyResult.message || 'Invalid or expired OTP', data: 0 });
  }

  if (machineId !== undefined) {
    user.machineId = machineId;
  }
  if (fcmToken !== undefined) {
    user.fcmToken = fcmToken;
  }
  await user.save();
  if (!user.isActive) {
    return successResponse(res, { message: 'user is inactive', data: 0 });
  }
  const token = user.generateAccessToken();
  // Add role to user response
  const userResponse = user.toObject();
  delete userResponse.password;
  userResponse.role = role;

  successResponse(res, {
    message: 'OTP verified successfully',
    data: {
      user: userResponse,
      token
    }
  });
});

const login = asyncHandler(async (req, res) => {
  const { role, email, password } = req.body;

  // Validate required fields
  if (!email || !password) {
    return errorResponse(res, 'Email and password are required', 400);
  }

  if (!role) {
    return errorResponse(res, 'Role is required', 400);
  }

  // Check if role is valid for email/password login
  if (['exhibitor', 'visitor'].includes(role)) {
    return errorResponse(res, 'Use OTP login for exhibitor/visitor', 400);
  }

  const Model = getModelByRole(role);
  if (!Model) {
    return errorResponse(res, 'Invalid role specified', 400);
  }

  // Find user by email
  const user = await Model.findOne({ email });

  // Don't reveal if email exists or not for security
  // Return generic error to prevent user enumeration attacks
  if (!user) {
    return errorResponse(res, 'Invalid email or password', 401);
  }

  // Check if user is active
  if (user.isActive === false) {
    if (role === 'organizer') {
      return errorResponse(res, 'Your organizer account is pending approval or has been deactivated. Please wait for a super admin to activate your account.', 403);
    }
    return errorResponse(res, 'Your account has been deactivated. Please contact support.', 403);
  }

  // Verify password
  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) {
    return errorResponse(res, 'Invalid email or password', 401);
  }

  // Generate token
  const token = user.generateAccessToken();

  // Prepare user response
  const userResponse = user.toObject();
  delete userResponse.password;
  userResponse.role = role;

  successResponse(res, { user: userResponse, token });
});


const loginApp = asyncHandler(async (req, res) => {
  const { role, phone, machineId, fcmToken } = req.body;

  // Validate role
  if (!['exhibitor', 'visitor'].includes(role)) {
    return successResponse(res, { message: 'Invalid role for OTP login', data: 0 });
  }

  // Validate required fields
  if (!phone || !machineId) {
    return successResponse(res, { message: 'Phone number and machine ID are required', data: 0 });
  }

  const Model = getModelByRole(role);
  const user = await Model.findOne({ phone });

  if (!user) {
    return successResponse(res, { message: 'User not found', data: 0 });
  }

  let isVerified = false;

  // Check machineId verification logic
  if (!user.machineId || user.machineId === '') {
    // If machineId is empty, update it with the provided machineId
    isVerified = false; // First time login, not verified yet
  } else if (user.machineId === machineId) {
    // If machineId matches, user is verified
    isVerified = true;
  } else {
    // If machineId doesn't match, user is not verified
    isVerified = false;
  }

  const token = user.generateAccessToken();
  user.fcmToken = fcmToken;
  await user.save();
  // Prepare user response
  const userResponse = user.toObject();
  delete userResponse.password;
  delete userResponse.otp;
  delete userResponse.otpExpires;
  userResponse.role = role;

  successResponse(res, {
    message: 'Login successful',
    data: {
      user: userResponse,
      token,
      isVerified
    }
  });
});


const logout = asyncHandler(async (req, res) => {
  successResponse(res, { message: 'Logged out successfully' });
});

const forgotPassword = asyncHandler(async (req, res) => {
  const { email, role } = req.body;

  if (!email || !role) {
    return errorResponse(res, 'Email and role are required', 400);
  }

  if (!['organizer', 'superAdmin'].includes(role)) {
    return errorResponse(res, 'Invalid role for password reset', 400);
  }

  const Model = getModelByRole(role);
  const user = await Model.findOne({ email });

  if (!user) {
    // Don't reveal if user exists or not for security
    return successResponse(res, { message: 'If an account with that email exists, a password reset link has been sent.' });
  }

  // Generate reset token
  const crypto = require('crypto');
  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  user.resetPasswordToken = resetToken;
  user.resetPasswordExpires = resetTokenExpiry;
  await user.save();

  // Send email
  const emailService = require('../services/emailService');
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

  try {
    await emailService.sendPasswordResetEmail(email, resetUrl, user.name || 'User');
    successResponse(res, { message: 'If an account with that email exists, a password reset link has been sent.' });
  } catch (error) {
    // Clear the reset token if email fails
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    console.error('Failed to send password reset email:', error);
    console.error('Email error details:', {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      user: process.env.SMTP_USER,
      secure: process.env.SMTP_SECURE
    });
    return errorResponse(res, 'Failed to send password reset email. Please try again later.', 500);
  }
});

const verifyResetToken = asyncHandler(async (req, res) => {
  // Get token from either request body or URL parameter
  const token = req.body.token || req.params.token;

  if (!token) {
    return errorResponse(res, 'Reset token is required', 400);
  }

  // Check in both models
  let user = await Organizer.findOne({
    resetPasswordToken: token,
    resetPasswordExpires: { $gt: Date.now() }
  });

  if (!user) {
    user = await Superadmin.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });
  }

  if (!user) {
    return errorResponse(res, 'Invalid or expired reset token', 400);
  }

  successResponse(res, {
    message: 'Token is valid',
    data: {
      email: user.email,
      name: user.name
    }
  });
});

const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return errorResponse(res, 'Token and password are required', 400);
  }

  if (password.length < 8) {
    return errorResponse(res, 'Password must be at least 8 characters long', 400);
  }

  // Check in both models
  let user = await Organizer.findOne({
    resetPasswordToken: token,
    resetPasswordExpires: { $gt: Date.now() }
  });

  if (!user) {
    user = await Superadmin.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });
  }

  if (!user) {
    return errorResponse(res, 'Invalid or expired reset token', 400);
  }

  // Update password
  user.password = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  successResponse(res, { message: 'Password has been reset successfully' });
});

const getAuthUserId = (req) => req.user?.id || req.user?._id;

const getProfileAllowedFields = (role) => {
  if (role === 'organizer') {
    return [
      'name',
      'phone',
      'organizationName',
      'company',
      'designation',
      'digitalProfile',
      'address',
      'extraDetails',
    ];
  }
  if (role === 'superAdmin') {
    return ['name', 'phone', 'company', 'designation', 'address'];
  }
  return [];
};

const normalizeProfileValue = (value) => {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (Array.isArray(value)) {
    return value.map(normalizeProfileValue);
  }
  if (value && typeof value === 'object') {
    const normalized = {};
    Object.keys(value).forEach((key) => {
      normalized[key] = normalizeProfileValue(value[key]);
    });
    return normalized;
  }
  return value;
};

const pickProfileUpdateData = (body, role) => {
  const allowed = getProfileAllowedFields(role);
  const updateData = {};
  for (const key of allowed) {
    if (body[key] !== undefined) {
      updateData[key] = normalizeProfileValue(body[key]);
    }
  }
  return updateData;
};

// Get current user profile
const getProfile = asyncHandler(async (req, res) => {
  const userRole = req.user.role || req.user.type;
  const Model = getModelByRole(userRole);
  const userId = getAuthUserId(req);

  if (!Model || !userId) {
    return errorResponse(res, 'Invalid user role', 400);
  }

  const user = await Model.findById(userId).select('-password');
  if (!user) {
    return errorResponse(res, 'User not found', 404);
  }

  const userResponse = user.toObject();
  userResponse.role = userRole;

  successResponse(res, { user: userResponse, message: 'Profile retrieved successfully' });
});

// Update current user profile
const updateProfile = asyncHandler(async (req, res) => {
  const userRole = req.user.role || req.user.type;
  const Model = getModelByRole(userRole);
  const userId = getAuthUserId(req);

  if (!Model || !userId) {
    return errorResponse(res, 'Invalid user role', 400);
  }

  const updateData = pickProfileUpdateData(req.body, userRole);
  if (Object.keys(updateData).length === 0) {
    return errorResponse(res, 'No valid fields to update', 400);
  }

  const existingUser = await Model.findById(userId);
  if (!existingUser) {
    return errorResponse(res, 'User not found', 404);
  }

  try {
    const user = await Model.findByIdAndUpdate(userId, updateData, {
      new: true,
      runValidators: true,
    }).select('-password');

    if (!user) {
      return errorResponse(res, 'Failed to update user', 500);
    }

    const userResponse = user.toObject();
    userResponse.role = userRole;

    successResponse(res, { user: userResponse, message: 'Profile updated successfully' });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map((err) => err.message);
      return errorResponse(res, `Validation error: ${validationErrors.join(', ')}`, 400);
    }

    if (error.name === 'CastError') {
      return errorResponse(res, 'Invalid user ID format', 400);
    }

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return errorResponse(res, `${field} already exists`, 400);
    }

    console.error('Update profile error:', error);
    errorResponse(res, `Failed to update profile: ${error.message}`, 500);
  }
});

// Change password
const changePassword = asyncHandler(async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return errorResponse(res, 'Current password and new password are required', 400);
    }

    if (newPassword.length < 8) {
      return errorResponse(res, 'New password must be at least 8 characters long', 400);
    }

    const userRole = req.user.role || req.user.type;
    const Model = getModelByRole(userRole);

    if (!Model) {
      return errorResponse(res, 'Invalid user role', 400);
    }

    const userId = getAuthUserId(req);
    const user = await Model.findById(userId);
    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }

    // Verify current password
    const isCurrentPasswordValid = await user.isPasswordCorrect(currentPassword);
    if (!isCurrentPasswordValid) {
      return errorResponse(res, 'Current password is incorrect', 400);
    }

    // Update password
    user.password = newPassword;
    await user.save();

    successResponse(res, { message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    errorResponse(res, 'Failed to change password', 500);
  }
});

module.exports = {
  register,
  sendOtp,
  verifyOtp,
  login,
  loginApp,
  logout,
  forgotPassword,
  verifyResetToken,
  resetPassword,
  getProfile,
  updateProfile,
  changePassword
};
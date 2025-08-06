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
  const existingUser = await Model.findOne({ email: userData.email });
  if (existingUser) {
    return errorResponse(res, 'User with this email already exists', 409);
  }
  
  try {
    const user = new Model(userData);
    await user.save();
    const token = user.generateAccessToken();
    
    // Remove password from response and add role
    const userResponse = user.toObject();
    delete userResponse.password;
    userResponse.role = role; // Add role to response
    
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
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  user.otp = otp;
  user.otpExpires = expiresAt;
  await user.save();
  const sent = await otpService(phone, otp);
  if (!sent) {
    return successResponse(res, { message: 'Failed to send OTP', data: 0 });
  }
  successResponse(res, { 
    message: 'OTP sent successfully',
    data: { 
      userId: user._id, 
      exists 
    }
  });
});

const verifyOtp = asyncHandler(async (req, res) => {
  const { role, phone, otp} = req.body;
  if (!['exhibitor', 'visitor'].includes(role)) {
    return successResponse(res, { message: 'Invalid role for OTP login', data: 0 });
  }
  const Model = getModelByRole(role);
  const user = await Model.findOne({phone});
  if (!user) {
    return successResponse(res, { message: 'User not found', data: 0 });
  }
  if (!user.otp || user.otp !== otp || user.otpExpires < new Date()) {
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();
    return successResponse(res, { message: 'Invalid or expired OTP', data: 0 });
  }
  user.otp = undefined;
  user.otpExpires = undefined;
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
  if (['exhibitor', 'visitor'].includes(role)) return errorResponse(res, 'Use OTP login for exhibitor/visitor', 400);
  const Model = getModelByRole(role);
  if (!Model) return errorResponse(res, 'Invalid role');
  const user = await Model.findOne({ email });
  if (!user || !(await user.isPasswordCorrect(password))) {
    return errorResponse(res, 'Invalid credentials', 401);
  }
  const token = user.generateAccessToken();
  // Add role to user response
  const userResponse = user.toObject();
  delete userResponse.password;
  userResponse.role = role;
  successResponse(res, { user: userResponse, token });
});


const loginApp = asyncHandler(async (req, res) => {
  const { role, phone, machineId } = req.body;
  
  // Validate role
  if (!['exhibitor', 'visitor'].includes(role)) {
    return successResponse(res, { message: 'Invalid role for OTP login' ,data:0});
  }
  
  // Validate required fields
  if (!phone || !machineId) {
    return successResponse(res, { message: 'Phone number and machine ID are required' , data:0});
  }
  
  const Model = getModelByRole(role);
  const user = await Model.findOne({ phone });
  
  if (!user) {
    return successResponse(res, { message: 'User not found' , data:0});
  }
  
  let isVerified = false;
  
  // Check machineId verification logic
  if (!user.machineId || user.machineId === '') {
    // If machineId is empty, update it with the provided machineId
    user.machineId = machineId;
    await user.save();
    isVerified = false; // First time login, not verified yet
  } else if (user.machineId === machineId) {
    // If machineId matches, user is verified
    isVerified = true;
  } else {
    // If machineId doesn't match, user is not verified
    isVerified = false;
  }
  
  const token = user.generateAccessToken();
  
  // Prepare user response
  const userResponse = user.toObject();
  delete userResponse.password;
  delete userResponse.otp;
  delete userResponse.otpExpires;
  userResponse.role = role;
  
  successResponse(res, { 
    message:'Login successful',
    data:{
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

// Get current user profile
const getProfile = asyncHandler(async (req, res) => {
  try {
    const userRole = req.user.role || req.user.type;
    const Model = getModelByRole(userRole);
    
    if (!Model) {
      return errorResponse(res, 'Invalid user role', 400);
    }

    const user = await Model.findById(req.user._id).select('-password');
    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }

    const userResponse = user.toObject();
    userResponse.role = userRole;

    successResponse(res, { user: userResponse, message: 'Profile retrieved successfully' });
  } catch (error) {
    console.error('Get profile error:', error);
    errorResponse(res, 'Failed to retrieve profile', 500);
  }
});

// Update current user profile
const updateProfile = asyncHandler(async (req, res) => {
  try {
    console.log('🔥 Update Profile - Request user:', req.user);
    console.log('🔥 Update Profile - Request body:', req.body);
    
    const userRole = req.user.role || req.user.type;
    console.log('🔥 Update Profile - Determined role:', userRole);
    
    const Model = getModelByRole(userRole);
    console.log('🔥 Update Profile - Model found:', !!Model);
    
    if (!Model) {
      console.error('🔥 Update Profile - Invalid user role:', userRole);
      return errorResponse(res, `Invalid user role: ${userRole}`, 400);
    }

    const { password, ...updateData } = req.body; // Exclude password from profile update
    console.log('🔥 Update Profile - Update data:', updateData);
    
    // Check if user exists first
    const existingUser = await Model.findById(req.user._id);
    if (!existingUser) {
      console.error('🔥 Update Profile - User not found:', req.user._id);
      return errorResponse(res, 'User not found', 404);
    }
    
    console.log('🔥 Update Profile - Existing user found:', existingUser.email);
    
    const user = await Model.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      console.error('🔥 Update Profile - Failed to update user');
      return errorResponse(res, 'Failed to update user', 500);
    }

    console.log('🔥 Update Profile - User updated successfully');
    const userResponse = user.toObject();
    userResponse.role = userRole;

    successResponse(res, { user: userResponse, message: 'Profile updated successfully' });
  } catch (error) {
    console.error('🔥 Update profile error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      user: req.user,
      body: req.body
    });
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return errorResponse(res, `Validation error: ${validationErrors.join(', ')}`, 400);
    }
    
    if (error.name === 'CastError') {
      return errorResponse(res, 'Invalid user ID format', 400);
    }
    
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return errorResponse(res, `${field} already exists`, 400);
    }
    
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

    const user = await Model.findById(req.user._id);
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
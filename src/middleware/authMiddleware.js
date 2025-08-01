// src/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');
const Superadmin = require('../models/Superadmin');
const Organizer = require('../models/Organizer');
const Exhibitor = require('../models/Exhibitor');
const Visitor = require('../models/Visitor');

const authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      throw new Error('Authentication required');
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    let user;

    switch (decoded.role) {
      case 'superadmin':
        user = await Superadmin.findById(decoded.userId);
        break;
      case 'organizer':
        user = await Organizer.findById(decoded.userId);
        break;
      case 'exhibitor':
        user = await Exhibitor.findById(decoded.userId);
        break;
      case 'visitor':
        user = await Visitor.findById(decoded.userId);
        break;
      default:
        throw new Error('Invalid role');
    }

    if (!user) {
      throw new Error('User not found');
    }

    req.user = { ...user.toObject(), role: decoded.role };
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Unauthorized access' });
    }
    next();
  };
};

module.exports = { authenticate, authorize };
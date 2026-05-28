// Add this new file: src/models/Notification.js
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  recipientType: {
    type: String,
    enum: ['exhibitor', 'visitor'],
    required: true
  },
  type: {
    type: String,
    enum: ['meeting_request', 'meeting_response', 'referral', 'other'],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  data: {
    type: Object, // Additional data like { meetingId, eventId, requesterId, status }
    default: {}
  },
  isRead: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

// Index for efficient querying by recipient
notificationSchema.index({ recipientId: 1, recipientType: 1, createdAt: -1 });

module.exports = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
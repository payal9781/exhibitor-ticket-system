// src/models/Event.js
const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  organizerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organizer',
    required: true
  },
  title: { type: String, required: true },
  description: { type: String },
  fromDate: { type: Date, required: true },
  toDate: { type: Date, required: true },
  startTime: { type: String, required: true }, // Format: "HH:MM:SS"
  endTime: { type: String, required: true }, // Format: "HH:MM:SS"
  location: { type: String, required: true },
  media: [{
    title: { type: String, default: "" },
    description: { type: String, default: "" },
    redirectUrl: { type: String, default: "" },
    fromDate: { type: Date, default: null },
    toDate: { type: Date, default: null },
    fileUrl: { type: String, default: "" } // Store the uploaded file URL
  }],
  meetingStartTime: String, // e.g., "14:00:00"
  meetingEndTime: String, // e.g., "16:00:00"
  timeInterval: Number, // in minutes, e.g., 15
  registrationLink: { type: String, unique: true },
  isDeleted: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  extraDetails: { type: mongoose.Schema.Types.Mixed },
  exhibitor: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "Exhibitor" },
    qrCode: { type: String },
    registeredAt: { type: Date, default: Date.now },
    isVerified: { type: Boolean, default: true },
  }],
  visitor: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "Visitor" },
    qrCode: { type: String },
    registeredAt: { type: Date, default: Date.now },
    isVerified: { type: Boolean, default: true },
  }],
  sponsors: [{
    name: { type: String, required: true },
    logo: { type: String },
    description: { type: String },
    website: { type: String },
    tier: { type: String },
    addedAt: { type: Date, default: Date.now }
  }],
  schedules: [{
    date: { type: Date, default: null }, // null for common schedules applying to all days
    activities: [{
      startTime: { type: String, required: true }, // Format: "HH:MM"
      endTime: { type: String, required: true }, // Format: "HH:MM"
      title: { type: String, required: true },
      description: { type: String },
      category: { type: String } // e.g., 'session', 'break', 'keynote', etc.
    }]
  }]
}, { timestamps: true });

module.exports = mongoose.models.Event || mongoose.model('Event', eventSchema);
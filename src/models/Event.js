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
  media: [{ type: String }],
  registrationLink: { type: String, unique: true },
  isDeleted: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  extraDetails: { type: mongoose.Schema.Types.Mixed },
  exhibitor: [{ 
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "Exhibitor" },
    qrCode: { type: String },
    registeredAt: { type: Date, default: Date.now }
  }],
  visitor: [{ 
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "Visitor" },
    qrCode: { type: String },
    registeredAt: { type: Date, default: Date.now }
  }],

}, { timestamps: true });

module.exports = mongoose.models.Event || mongoose.model('Event', eventSchema);
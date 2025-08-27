// src/models/Lead.js
const mongoose = require('mongoose');

const LeadsSchema = new mongoose.Schema({
  eventId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Event', 
    required: true 
  },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true 
  },
  userType: { 
    type: String, 
    enum: ['exhibitor', 'visitor'], 
    required: true 
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, { timestamps: true });

module.exports = mongoose.models.Lead || mongoose.model('Lead', LeadsSchema);

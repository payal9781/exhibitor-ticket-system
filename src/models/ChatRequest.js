// src/models/ChatRequest.js
const mongoose = require('mongoose');

const chatRequestSchema = new mongoose.Schema({
  eventId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Event', 
    required: true 
  },
  senderId: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true,
    refPath: 'senderType'
  },
  senderType: { 
    type: String, 
    enum: ['Visitor', 'Exhibitor', 'visitor', 'exhibitor'], 
    required: true,
    set: v => v ? (v.charAt(0).toUpperCase() + v.slice(1)) : v
  },
  receiverId: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true,
    refPath: 'receiverType'
  },
  receiverType: { 
    type: String, 
    enum: ['Visitor', 'Exhibitor', 'visitor', 'exhibitor'], 
    required: true,
    set: v => v ? (v.charAt(0).toUpperCase() + v.slice(1)) : v
  },
  status: { 
    type: String, 
    enum: ['pending', 'accepted', 'rejected'], 
    default: 'pending' 
  }
}, { timestamps: true });

module.exports = mongoose.models.ChatRequest || mongoose.model('ChatRequest', chatRequestSchema);

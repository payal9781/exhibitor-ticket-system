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
    enum: ['visitor', 'exhibitor'], 
    required: true 
  },
  receiverId: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true,
    refPath: 'receiverType'
  },
  receiverType: { 
    type: String, 
    enum: ['visitor', 'exhibitor'], 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['pending', 'accepted', 'rejected'], 
    default: 'pending' 
  }
}, { timestamps: true });

module.exports = mongoose.models.ChatRequest || mongoose.model('ChatRequest', chatRequestSchema);

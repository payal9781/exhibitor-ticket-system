// src/models/ChatMessage.js
const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
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
  messageType: { 
    type: String, 
    enum: ['text', 'image'], 
    default: 'text' 
  },
  message: { 
    type: String, 
    required: true 
  },
  isRead: { 
    type: Boolean, 
    default: false 
  }
}, { timestamps: true });

module.exports = mongoose.models.ChatMessage || mongoose.model('ChatMessage', chatMessageSchema);

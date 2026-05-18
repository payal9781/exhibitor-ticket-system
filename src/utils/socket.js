// src/utils/socket.js
const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const ChatMessage = require('../models/ChatMessage');
const ChatRequest = require('../models/ChatRequest');

let io = null;

const initSocket = (server) => {
  io = socketIO(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  // Authentication Middleware for Socket Connection
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;

      if (!token) {
        return next(new Error('Authentication error: Token is required'));
      }

      // Remove Bearer prefix if present
      const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;

      jwt.verify(cleanToken, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return next(new Error('Authentication error: Invalid token'));
        }

        socket.user = decoded; // Contains id, name, email, type
        next();
      });
    } catch (error) {
      next(new Error('Authentication error: Server error during verification'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user.id;
    console.log(`🔌 User connected to Socket: ${socket.user.name} (${userId})`);

    // Join room specific to this user ID (allows multi-device messaging)
    socket.join(userId.toString());

    // Listen for 'send_message' event from client
    socket.on('send_message', async (data, callback) => {
      try {
        const senderId = socket.user.id;
        const senderType = socket.user.type; // 'visitor' or 'exhibitor'
        const { eventId, receiverId, receiverType, message, messageType = 'text' } = data;

        if (!eventId || !receiverId || !receiverType || !message) {
          if (callback) {
            callback({ success: false, error: 'Missing required parameters: eventId, receiverId, receiverType, and message are required' });
          }
          return;
        }

        // Verify accepted request exists (crucial constraint!)
        const chatRequest = await ChatRequest.findOne({
          eventId,
          status: 'accepted',
          $or: [
            { senderId, receiverId },
            { senderId: receiverId, receiverId: senderId }
          ]
        });

        if (!chatRequest) {
          if (callback) {
            callback({ success: false, error: 'Chat request must be accepted first before sending messages' });
          }
          return;
        }

        let messagePayload = message;

        // Handle Socket Image Upload (Raw Buffer, Base64, or Uint8Array)
        if (messageType === 'image') {
          let buffer;
          let fileExtension = '.png'; // default fallback

          if (Buffer.isBuffer(message)) {
            buffer = message;
          } else if (message instanceof Uint8Array || message instanceof ArrayBuffer) {
            buffer = Buffer.from(message);
          } else if (typeof message === 'string') {
            if (message.startsWith('data:image')) {
              // Base64 Data URL
              const matches = message.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
              if (matches && matches.length === 3) {
                fileExtension = `.${matches[1]}`;
                buffer = Buffer.from(matches[2], 'base64');
              } else {
                buffer = Buffer.from(message, 'base64');
              }
            } else {
              // Plain base64 string
              buffer = Buffer.from(message, 'base64');
            }
          } else if (message && typeof message === 'object' && message.type === 'Buffer' && Array.isArray(message.data)) {
            // Handles automatic Socket.io Buffer JSON serialization fallback
            buffer = Buffer.from(message.data);
          } else {
            // Try to force convert
            buffer = Buffer.from(message);
          }

          if (!buffer || buffer.length === 0) {
            if (callback) {
              callback({ success: false, error: 'Invalid or empty image buffer payload' });
            }
            return;
          }

          // Create unique filename
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const fileName = `chat-${uniqueSuffix}${fileExtension}`;
          const dirPath = path.join(__dirname, '../../uploads/chats');

          // Ensure directories exist
          if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
          }

          const filePath = path.join(dirPath, fileName);
          fs.writeFileSync(filePath, buffer);

          // Stored strictly relative path
          messagePayload = `uploads/chats/${fileName}`;
          console.log(`🖼️ Socket Image uploaded and saved to: ${messagePayload}`);
        }

        // Save message to MongoDB
        const chatMessage = new ChatMessage({
          eventId,
          senderId,
          senderType,
          receiverId,
          receiverType,
          messageType,
          message: messagePayload
        });
        await chatMessage.save();

        // Populate sender/receiver details
        const populatedMessage = await ChatMessage.findById(chatMessage._id)
          .populate({ path: 'senderId', select: 'name companyName email phone profileImage' })
          .populate({ path: 'receiverId', select: 'name companyName email phone profileImage' });

        // Emit message in real-time via Socket to receiver room
        io.to(receiverId.toString()).emit('new_message', populatedMessage);

        // Acknowledge sending success
        if (callback) {
          callback({ success: true, data: populatedMessage });
        } else {
          socket.emit('message_sent', populatedMessage);
        }

      } catch (error) {
        console.error('Socket send_message error:', error);
        if (callback) {
          callback({ success: false, error: 'Internal server error while sending message' });
        }
      }
    });

    socket.on('disconnect', () => {
      console.log(`🔌 User disconnected from Socket: ${socket.user.name} (${userId})`);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.io has not been initialized. Please call initSocket first.');
  }
  return io;
};

/**
 * Emit an event to a specific user ID
 * @param {string|ObjectId} userId 
 * @param {string} eventName 
 * @param {object} data 
 */
const emitToUser = (userId, eventName, data) => {
  if (io) {
    io.to(userId.toString()).emit(eventName, data);
  }
};

/**
 * Emit an event to multiple user IDs
 * @param {Array<string|ObjectId>} userIds 
 * @param {string} eventName 
 * @param {object} data 
 */
const emitToUsers = (userIds, eventName, data) => {
  if (io) {
    userIds.forEach(userId => {
      if (userId) {
        io.to(userId.toString()).emit(eventName, data);
      }
    });
  }
};

module.exports = {
  initSocket,
  getIO,
  emitToUser,
  emitToUsers
};

const mongoose = require('mongoose');

const followSchema = new mongoose.Schema({
  followerId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'followerType'
  },
  followerType: {
    type: String,
    required: true,
    enum: ['Exhibitor', 'Visitor']
  },
  followingId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'followingType'
  },
  followingType: {
    type: String,
    required: true,
    enum: ['Exhibitor', 'Visitor']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound index to ensure a user can only follow another user once
followSchema.index({ followerId: 1, followingId: 1 }, { unique: true });

// Index for quick lookups
followSchema.index({ followerId: 1, followerType: 1 });
followSchema.index({ followingId: 1, followingType: 1 });

module.exports = mongoose.model('Follow', followSchema);

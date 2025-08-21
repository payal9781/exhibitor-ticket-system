const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  value: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  color: {
    type: String,
    default: '#6B7280' // Default gray color
  },
  icon: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  organizerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organizer',
    required: true
  },
  order: {
    type: Number,
    default: 0
  }
}, { 
  timestamps: true 
});

// Index for better query performance
categorySchema.index({ organizerId: 1, isActive: 1 });
categorySchema.index({ value: 1, organizerId: 1 }, { unique: true });

module.exports = mongoose.models.Category || mongoose.model('Category', categorySchema);
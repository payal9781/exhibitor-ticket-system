const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const organizerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String, unique: true, sparse: true },
  organizationName: { type: String },
  company: { type: String }, // Added for profile update compatibility
  designation: { type: String }, // Added for profile update compatibility
  address: { 
    street: { type: String },
    city: { type: String },
    state: { type: String },
    country: { type: String },
    zipCode: { type: String }
  },
  avatar: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false },
  extraDetails: { 
    website: { type: String },
    description: { type: String },
    socialMedia: {
      linkedin: { type: String },
      twitter: { type: String },
      facebook: { type: String },
      instagram: { type: String }
    },
    businessInfo: {
      taxId: { type: String },
      businessType: { type: String, enum: ['corporation', 'llc', 'partnership', 'sole_proprietorship', 'nonprofit'] },
      foundedYear: { type: Number },
      employeeCount: { type: String },
      industry: { type: String }
    },
    notes: { type: String },
    tags: [{ type: String }]
  },
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date }
}, { timestamps: true });

organizerSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

organizerSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};

organizerSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      _id: this._id,
      email: this.email,
      type: 'organizer'
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY
    }
  );
};

module.exports = mongoose.models.Organizer || mongoose.model('Organizer', organizerSchema);
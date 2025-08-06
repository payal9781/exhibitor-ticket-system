// src/models/Visitor.js
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const visitorSchema = new mongoose.Schema({
  name: { type: String },
  email: { type: String, unique: true },
  phone: { type: String, unique: true, sparse: true, required: true },
  companyName: { type: String },
  profileImage: { type: String },
  coverImage: { type: String },
  bio: { type: String },
  Sector: { type: String },
  keyWords: [{ type: String }],
  website: { type: String },
  location: { type: String },
  socialMediaLinks: { type: Object },
  machineId: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false },
  otp: { type: String },
  otpExpires: { type: Date }
}, { timestamps: true });
visitorSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      _id: this._id,
      name: this.name,
      email: this.email,
      type: 'visitor'
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY
    }
  );
};
module.exports = mongoose.models.Visitor || mongoose.model('Visitor', visitorSchema);
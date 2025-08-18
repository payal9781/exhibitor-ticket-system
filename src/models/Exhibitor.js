// src/models/Exhibitor.js
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const exhibitorSchema = new mongoose.Schema({
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
  isActive: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false },
  digitalProfile: { type: String, default: '' },
  machineId: { type: String ,default: ''},
  otp: { type: String },
  otpExpires: { type: Date }
}, { timestamps: true });
exhibitorSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      _id: this._id,
      name: this.companyName,
      email: this.email,
      type: 'exhibitor'
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY
    }
  );
};
module.exports = mongoose.models.Exhibitor || mongoose.model('Exhibitor', exhibitorSchema);
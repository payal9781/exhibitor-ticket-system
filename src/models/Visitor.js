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
  address:{
    city:{type:String},
    state:{type:String}
  },
  socialMediaLinks: { type: Object },
  machineId: { type: String, default: '' },
  digitalProfile: { type: String, default: "" },
  isActive: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false },
  otp: { type: String },
  otpExpires: { type: Date },
  fcmToken: {type:String,default:''}
}, { timestamps: true });
visitorSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      id: this._id,
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
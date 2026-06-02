// src/models/Exhibitor.js
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const exhibitorSchema = new mongoose.Schema({
  email: { type: String },
  phone: { type: String, required: true },
  companyName: { type: String },
  profileImage: { type: String },
  coverImage: { type: String },
  bio: { type: String },
  Sector: { type: String },
  industrySectors: [{ type: mongoose.Schema.Types.ObjectId, ref: 'IndustrySector' }],
  keyWords: [{ type: String }],
  website: { type: String },
  location: { type: String, default: '' },
  address: {
    city: { type: String },
    state: { type: String },
    country: { type: String },
  },
  socialMediaLinks: { type: Object },
  digitalProfile: { type: String, default: "" },
  isActive: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false },
  machineId: { type: String ,default: ''},
  otp: { type: String },
  otpExpires: { type: Date },
  fcmToken: {type:String,default:''}
}, { timestamps: true });
exhibitorSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      id: this._id,
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
const ExhibitorModel = mongoose.models.Exhibitor || mongoose.model('Exhibitor', exhibitorSchema);
if (!mongoose.models.exhibitor) {
  mongoose.model('exhibitor', exhibitorSchema);
}
module.exports = ExhibitorModel;
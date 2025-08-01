// src/models/Visitor.js
const mongoose = require('mongoose');

const visitorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, unique: true, sparse: true },
  companyName: { type: String },
  profileImage: { type: String },
  coverImage: { type: String },
  bio: { type: String },
  Sector: { type: String },
  companyName: { type: String },
  keyWords: [{ type: String }],
  website: { type: String },
  location: { type: String },
  socialMediaLinks: { type: Object },
  isActive: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });


visitorSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

visitorSchema.methods.isPasswordCorrect = async function (password) {
    return await bcrypt.compare(password, this.password);
};
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

module.exports = mongoose.model('Visitor', visitorSchema);
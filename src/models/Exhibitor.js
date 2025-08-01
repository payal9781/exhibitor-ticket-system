// src/models/Exhibitor.js
const mongoose = require('mongoose');

const exhibitorSchema = new mongoose.Schema({
  // name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, unique: true, sparse: true },
  companyName: { type: String },
  profileImage: { type: String },
  coverImage: { type: String },
  bio: { type: String },
  Sector: { type: String },
  keyWords: [{ type: String }],
  website: { type: String },
  location: { type: String },
  socialMediaLinks: { type: Object },
  isActive: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false }

}, { timestamps: true });

exhibitorSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

exhibitorSchema.methods.isPasswordCorrect = async function (password) {
    return await bcrypt.compare(password, this.password);
};
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

module.exports = mongoose.model('Exhibitor', exhibitorSchema);
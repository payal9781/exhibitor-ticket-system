// src/models/Superadmin.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const superadminSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    mobile: { type: String, unique: true, sparse: true },
    avatar: { type: String, default: '' },
    extraDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
    isActive: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    extraDetails: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

superadminSchema.pre('save', async function (next) {
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 10);
    }
    next();
});

superadminSchema.methods.isPasswordCorrect = async function (password) {
    return await bcrypt.compare(password, this.password);
};
superadminSchema.methods.generateAccessToken = function () {
    return jwt.sign(
        {
            _id: this._id,
            email: this.email,
            type: 'superAdmin'
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY
        }
    );
};


module.exports = mongoose.model('Superadmin', superadminSchema);
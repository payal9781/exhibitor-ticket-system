const mongoose = require('mongoose');

let schema = new mongoose.Schema({
    name: { type: String, default: "" },
    mobile: { type: String, default: "" },
    companyEmailId: { type: String, default: "" },
    companyName: { type: String, default: "" },
    businessMobile: { type: String, default: "" },
    address: { type: String, default: "" },
    keywords: { type: String, default: "" },
    notes: { type: String, default: "" },
    userId: { type: mongoose.Schema.Types.ObjectId, default: null },
}, { timestamps: true });

module.exports = mongoose.model('scannedCards', schema);

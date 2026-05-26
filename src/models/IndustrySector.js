const mongoose = require('mongoose');

const industrySectorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    value: { type: String, required: true, trim: true, lowercase: true },
    description: { type: String, trim: true, default: '' },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

industrySectorSchema.index({ value: 1 }, { unique: true, partialFilterExpression: { isDeleted: false } });
industrySectorSchema.index({ isActive: 1, isDeleted: 1, name: 1 });

module.exports =
  mongoose.models.IndustrySector || mongoose.model('IndustrySector', industrySectorSchema);

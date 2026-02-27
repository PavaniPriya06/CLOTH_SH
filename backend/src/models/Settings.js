const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true, index: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
    description: { type: String },
    lastModifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    
    // ═══════════════════════════════════════════════════════════════════
    // SOFT DELETE - Preserve settings history
    // ═══════════════════════════════════════════════════════════════════
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Settings', settingsSchema);

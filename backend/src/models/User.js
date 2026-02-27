const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, unique: true, sparse: true, lowercase: true },
    phone: { type: String, unique: true, sparse: true },
    password: { type: String },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    // Social login
    socialId: { type: String },
    provider: { type: String, enum: ['local', 'facebook', 'instagram'], default: 'local' },
    avatar: { type: String },
    // Saved addresses (comprehensive for India)
    addresses: [{
        label: { type: String, default: 'Home' },
        fullName: String,
        phone: String,
        houseNo: String,
        street: String,
        landmark: String,
        city: String,
        state: String,
        pincode: String,
        lat: Number,
        lng: Number,
        isDefault: { type: Boolean, default: false }
    }],
    isActive: { type: Boolean, default: true },
    
    // ═══════════════════════════════════════════════════════════════════
    // SOFT DELETE - Never permanently delete user data
    // ═══════════════════════════════════════════════════════════════════
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// ═══════════════════════════════════════════════════════════════════
// INDEXES for faster queries
// ═══════════════════════════════════════════════════════════════════
userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ role: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ isDeleted: 1, role: 1 });  // Compound index for admin queries

// Hash password before saving
userSchema.pre('save', async function (next) {
    if (!this.isModified('password') || !this.password) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

// Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);

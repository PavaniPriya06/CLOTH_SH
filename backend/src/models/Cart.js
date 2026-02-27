const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    items: [{
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        name: String,
        price: Number,
        image: String,
        quantity: { type: Number, default: 1, min: 1 },
        size: String,
        color: String,
        addedAt: { type: Date, default: Date.now }
    }],
    totalItems: { type: Number, default: 0 },
    totalPrice: { type: Number, default: 0 },
    
    // ═══════════════════════════════════════════════════════════════════
    // SOFT DELETE - For cart recovery/analytics
    // ═══════════════════════════════════════════════════════════════════
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date }
}, { timestamps: true });

// ═══════════════════════════════════════════════════════════════════
// INDEXES for faster queries
// ═══════════════════════════════════════════════════════════════════
cartSchema.index({ updatedAt: -1 });  // Recently updated carts

// Calculate totals before saving
cartSchema.pre('save', function (next) {
    this.totalItems = this.items.reduce((sum, item) => sum + item.quantity, 0);
    this.totalPrice = this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    next();
});

module.exports = mongoose.model('Cart', cartSchema);

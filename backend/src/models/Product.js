const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    originalPrice: { type: Number },
    gender: {
        type: String,
        enum: ['Men', 'Women', 'Kids', 'Unisex'],
        required: true
    },
    qualityGrade: {
        type: String,
        enum: ['Premium', 'Export', 'Regular'],
        default: 'Regular'
    },
    description: { type: String, required: true },
    images: [{ type: String }], // Array of image paths
    category: {
        type: String,
        enum: ['Co-ord Sets', 'Tops', 'Bottoms', 'Dresses', 'New Arrivals', 'Sale'],
        default: 'Co-ord Sets'
    },
    sizes: [{ type: String, enum: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Free Size'] }],
    colors: [{ type: String }],
    stock: { type: Number, default: 10, min: 0 },
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    isNewArrival: { type: Boolean, default: true },
    tags: [{ type: String }],
    ratings: {
        average: { type: Number, default: 0 },
        count: { type: Number, default: 0 }
    },
    
    // ═══════════════════════════════════════════════════════════════════
    // SOFT DELETE - Never permanently delete product data
    // ═══════════════════════════════════════════════════════════════════
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// ═══════════════════════════════════════════════════════════════════
// INDEXES for faster queries
// ═══════════════════════════════════════════════════════════════════
productSchema.index({ name: 'text', description: 'text', tags: 'text' }); // Text search
productSchema.index({ category: 1, isActive: 1 });                        // Category listings
productSchema.index({ gender: 1, category: 1 });                          // Filter by gender
productSchema.index({ price: 1 });                                        // Price sorting
productSchema.index({ stock: 1 });                                        // Low stock queries
productSchema.index({ isFeatured: 1, isActive: 1 });                      // Featured products
productSchema.index({ isNewArrival: 1, createdAt: -1 });                  // New arrivals
productSchema.index({ isDeleted: 1, isActive: 1 });                       // Admin queries

module.exports = mongoose.model('Product', productSchema);

const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    orderNumber: { type: String, unique: true, index: true },
    items: [{
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        name: String,
        price: Number,
        image: String,
        quantity: { type: Number, default: 1 },
        size: String,
        color: String
    }],
    totalAmount: { type: Number, required: true },
    shippingCharge: { type: Number, default: 0 },
    status: {
        type: String,
        enum: ['CREATED', 'PENDING', 'PAID', 'PLACED', 'SHIPPED', 'DELIVERED', 'CANCELLED'],
        default: 'CREATED',
        index: true
    },
    paymentMethod: { type: String, enum: ['COD', 'Razorpay', 'UPI', 'Card', 'NetBanking', 'Wallet', 'Pending'], default: 'Pending' },
    paymentStatus: { type: String, enum: ['Pending', 'Paid', 'Failed', 'Refunded'], default: 'Pending', index: true },
    paymentId: { type: String, sparse: true, unique: true, index: true },  // Razorpay payment ID - unique to prevent duplicates
    razorpayOrderId: { type: String, index: true },
    razorpaySignature: { type: String },
    upiId: { type: String },
    upiTransactionId: { type: String },
    paymentReceipt: { type: String },
    
    // Shipping address with location
    shippingAddress: {
        fullName: String,
        phone: String,
        houseNo: String,
        street: String,
        landmark: String,
        city: String,
        state: String,
        pincode: String,
        // Geolocation data
        lat: Number,
        lng: Number,
        accuracy: Number,           // GPS accuracy in meters
        locationSource: { type: String, enum: ['GPS', 'IP', 'Manual', 'Unknown'], default: 'Unknown' },
        ipAddress: String,          // IP address at order time
        ipCity: String,             // City from IP lookup
        ipRegion: String,           // State/Region from IP lookup
        ipCountry: String           // Country from IP lookup
    },
    
    // Stock reduction tracking
    stockReduced: { type: Boolean, default: false },  // Track if stock was reduced for this order
    stockReducedAt: { type: Date },
    
    invoicePath: { type: String },
    invoiceUrl: { type: String },
    pdfPath: { type: String },
    notes: { type: String },
    
    // SMS Notifications
    smsSent: { type: Boolean, default: false },
    smsAdminSent: { type: Boolean, default: false },
    smsError: { type: String },
    lastSmsSendAttempt: { type: Date },
    
    statusHistory: [{
        status: String,
        timestamp: { type: Date, default: Date.now },
        note: String
    }],
    
    // ═══════════════════════════════════════════════════════════════════
    // SOFT DELETE - Never permanently delete order data
    // ═══════════════════════════════════════════════════════════════════
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    deletionReason: { type: String }
}, { timestamps: true });

// ═══════════════════════════════════════════════════════════════════
// INDEXES for faster queries
// ═══════════════════════════════════════════════════════════════════
orderSchema.index({ user: 1, createdAt: -1 });           // User's orders sorted by date
orderSchema.index({ status: 1, createdAt: -1 });         // Orders by status
orderSchema.index({ paymentStatus: 1, status: 1 });      // Payment filtering
orderSchema.index({ isDeleted: 1, status: 1 });          // Admin queries
orderSchema.index({ createdAt: -1 });                     // Recent orders

// Auto-generate order number
orderSchema.pre('save', async function (next) {
    if (!this.orderNumber) {
        const count = await mongoose.model('Order').countDocuments();
        this.orderNumber = `TCS${String(count + 1).padStart(6, '0')}`;
    }
    next();
});

module.exports = mongoose.model('Order', orderSchema);

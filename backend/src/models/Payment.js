const mongoose = require('mongoose');

// ══════════════════════════════════════════════════════════════════════════
// PAYMENT MODEL - Tracks all payments separately from orders
// ══════════════════════════════════════════════════════════════════════════
const paymentSchema = new mongoose.Schema({
    // Razorpay identifiers
    razorpayPaymentId: { type: String, unique: true, sparse: true },
    razorpayOrderId: { type: String },
    razorpaySignature: { type: String },
    
    // Related order and user
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    
    // Payment details
    amount: { type: Number, required: true },  // Amount in rupees
    currency: { type: String, default: 'INR' },
    
    // Payment method info
    method: { 
        type: String, 
        enum: ['UPI', 'Card', 'NetBanking', 'Wallet', 'COD', 'Unknown'],
        default: 'Unknown'
    },
    methodDetails: {
        upiId: String,           // UPI ID used
        upiApp: String,          // GPay, PhonePe, Paytm etc.
        bank: String,            // For netbanking
        cardNetwork: String,     // Visa, Mastercard, etc.
        cardLast4: String,       // Last 4 digits of card
        wallet: String,          // Paytm, Mobikwik, etc.
    },
    
    // Status tracking
    status: {
        type: String,
        enum: ['CREATED', 'PENDING', 'PAID', 'FAILED', 'REFUNDED', 'CANCELLED'],
        default: 'CREATED'
    },
    
    // Razorpay webhook/API data
    razorpayStatus: String,      // captured, authorized, failed, etc.
    razorpayFee: Number,         // Fee charged by Razorpay (in paise)
    razorpayTax: Number,         // Tax on fee (in paise)
    razorpayError: {
        code: String,
        description: String,
        source: String,
        step: String,
        reason: String
    },
    
    // Contact info at payment time
    contact: {
        name: String,
        email: String,
        phone: String
    },
    
    // Refund tracking
    refunds: [{
        refundId: String,
        amount: Number,
        status: String,
        createdAt: { type: Date, default: Date.now }
    }],
    
    // Webhook info
    webhookReceived: { type: Boolean, default: false },
    webhookPayload: mongoose.Schema.Types.Mixed,
    
    // Notes
    notes: mongoose.Schema.Types.Mixed,
    
    // ═══════════════════════════════════════════════════════════════════
    // SOFT DELETE - Never permanently delete payment records
    // ═══════════════════════════════════════════════════════════════════
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    
}, { timestamps: true });

// Index for quick lookups
paymentSchema.index({ user: 1, createdAt: -1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ 'methodDetails.upiId': 1 });
paymentSchema.index({ order: 1 });                      // Find payment by order
paymentSchema.index({ razorpayOrderId: 1 });            // Find by Razorpay order ID
paymentSchema.index({ createdAt: -1 });                 // Recent payments
paymentSchema.index({ isDeleted: 1, status: 1 });       // Admin queries

module.exports = mongoose.model('Payment', paymentSchema);

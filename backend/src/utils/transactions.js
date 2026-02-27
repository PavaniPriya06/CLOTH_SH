// ══════════════════════════════════════════════════════════════════════════════
// TRANSACTION UTILITIES - MongoDB Transaction Support for Critical Operations
// ══════════════════════════════════════════════════════════════════════════════
// Provides:
// - Transaction wrapper for multi-document operations
// - Automatic rollback on failure
// - Retry logic for transient errors
// - Error logging and tracking
// ══════════════════════════════════════════════════════════════════════════════

const mongoose = require('mongoose');

/**
 * Execute a function within a MongoDB transaction
 * Automatically handles commit/abort and retries for transient errors
 * 
 * @param {Function} fn - Async function to execute (receives session as parameter)
 * @param {Object} options - Transaction options
 * @param {number} options.maxRetries - Maximum retry attempts (default: 3)
 * @param {number} options.retryDelay - Delay between retries in ms (default: 100)
 * @returns {Promise<any>} - Result of the function
 */
const withTransaction = async (fn, options = {}) => {
    const { maxRetries = 3, retryDelay = 100 } = options;
    
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const session = await mongoose.startSession();
        
        try {
            session.startTransaction({
                readConcern: { level: 'majority' },
                writeConcern: { w: 'majority' }
            });
            
            // Execute the function with the session
            const result = await fn(session);
            
            // Commit the transaction
            await session.commitTransaction();
            
            console.log(`✅ Transaction committed successfully (attempt ${attempt})`);
            return result;
            
        } catch (error) {
            // Abort the transaction
            await session.abortTransaction();
            lastError = error;
            
            // Check if error is retryable
            const isTransient = error.hasErrorLabel?.('TransientTransactionError') ||
                               error.code === 251 || // NoSuchTransaction
                               error.code === 112 || // WriteConflict
                               error.code === 244;   // TransactionAborted
            
            if (isTransient && attempt < maxRetries) {
                console.log(`⚠️ Transaction failed (attempt ${attempt}), retrying in ${retryDelay}ms...`);
                console.log(`   Error: ${error.message}`);
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            } else {
                console.error(`❌ Transaction failed after ${attempt} attempt(s):`, error.message);
                throw error;
            }
        } finally {
            session.endSession();
        }
    }
    
    throw lastError;
};

/**
 * Execute a critical payment operation with transaction support
 * Includes: Order update + Stock reduction + Payment record
 * 
 * @param {Object} params - Operation parameters
 * @param {Object} params.order - Order document to update
 * @param {Object} params.paymentData - Payment record data
 * @param {boolean} params.reduceStock - Whether to reduce stock
 * @returns {Promise<Object>} - Updated order and payment record
 */
const executePaymentTransaction = async ({ order, paymentData, reduceStock = true }) => {
    const Order = require('../models/Order');
    const Product = require('../models/Product');
    const Payment = require('../models/Payment');
    
    return withTransaction(async (session) => {
        // 1. Update order status
        order.paymentStatus = 'Paid';
        order.status = 'PAID';
        order.paymentId = paymentData.paymentId;
        order.razorpayOrderId = paymentData.razorpayOrderId;
        order.razorpaySignature = paymentData.razorpaySignature;
        order.paymentMethod = paymentData.method || 'Razorpay';
        order.statusHistory.push({
            status: 'PAID',
            note: 'Payment verified via transaction'
        });
        
        await order.save({ session });
        console.log(`   ✅ Order ${order.orderNumber} updated`);
        
        // 2. Reduce stock if required
        if (reduceStock && !order.stockReduced && order.items?.length > 0) {
            for (const item of order.items) {
                if (item.product) {
                    const result = await Product.updateOne(
                        { _id: item.product, stock: { $gte: item.quantity || 1 } },
                        { $inc: { stock: -(item.quantity || 1) } },
                        { session }
                    );
                    
                    if (result.modifiedCount === 0) {
                        console.log(`   ⚠️ Could not reduce stock for product ${item.product}`);
                    } else {
                        console.log(`   ✅ Stock reduced for product ${item.name || item.product}`);
                    }
                }
            }
            
            // Mark stock as reduced
            order.stockReduced = true;
            order.stockReducedAt = new Date();
            await order.save({ session });
        }
        
        // 3. Create payment record
        let payment = null;
        try {
            payment = new Payment({
                razorpayPaymentId: paymentData.paymentId,
                razorpayOrderId: paymentData.razorpayOrderId,
                razorpaySignature: paymentData.razorpaySignature,
                order: order._id,
                user: order.user,
                amount: order.totalAmount,
                method: paymentData.method || 'UPI',
                status: 'PAID',
                contact: paymentData.contact || {}
            });
            
            await payment.save({ session });
            console.log(`   ✅ Payment record created: ${paymentData.paymentId}`);
        } catch (err) {
            // Duplicate payment is OK (idempotency)
            if (err.code === 11000) {
                console.log(`   ⏭️ Payment record already exists (idempotent)`);
            } else {
                throw err;
            }
        }
        
        return { order, payment };
    });
};

/**
 * Execute order cancellation with stock restoration
 * Uses transaction to ensure both order update and stock restoration succeed together
 * 
 * @param {string} orderId - Order ID to cancel
 * @param {string} reason - Cancellation reason
 * @param {string} cancelledBy - User ID who cancelled
 * @returns {Promise<Object>} - Cancelled order
 */
const cancelOrderWithStockRestore = async (orderId, reason, cancelledBy) => {
    const Order = require('../models/Order');
    const Product = require('../models/Product');
    
    return withTransaction(async (session) => {
        // Find and update order
        const order = await Order.findById(orderId).session(session);
        
        if (!order) {
            throw new Error('Order not found');
        }
        
        if (order.status === 'CANCELLED') {
            throw new Error('Order is already cancelled');
        }
        
        // Restore stock if it was reduced
        if (order.stockReduced && order.items?.length > 0) {
            for (const item of order.items) {
                if (item.product) {
                    await Product.updateOne(
                        { _id: item.product },
                        { $inc: { stock: item.quantity || 1 } },
                        { session }
                    );
                    console.log(`   ✅ Stock restored for product ${item.name || item.product}`);
                }
            }
        }
        
        // Update order status
        order.status = 'CANCELLED';
        order.statusHistory.push({
            status: 'CANCELLED',
            note: reason || 'Order cancelled'
        });
        
        // Soft delete if needed
        // order.isDeleted = true;
        // order.deletedAt = new Date();
        // order.deletedBy = cancelledBy;
        // order.deletionReason = reason;
        
        await order.save({ session });
        console.log(`   ✅ Order ${order.orderNumber} cancelled`);
        
        return order;
    });
};

/**
 * Soft delete with cascading updates
 * Example: Soft delete user and their related data
 * 
 * @param {string} model - Model name ('User', 'Product', etc.)
 * @param {string} id - Document ID to soft delete
 * @param {string} deletedBy - User ID who performed deletion
 * @param {string} reason - Deletion reason
 * @returns {Promise<Object>} - Deleted document
 */
const softDelete = async (model, id, deletedBy, reason = '') => {
    const Model = require(`../models/${model}`);
    
    const doc = await Model.findByIdAndUpdate(
        id,
        {
            isDeleted: true,
            deletedAt: new Date(),
            deletedBy: deletedBy,
            ...(reason && { deletionReason: reason })
        },
        { new: true }
    );
    
    if (!doc) {
        throw new Error(`${model} not found`);
    }
    
    console.log(`✅ ${model} ${id} soft deleted`);
    return doc;
};

/**
 * Restore a soft-deleted document
 * 
 * @param {string} model - Model name
 * @param {string} id - Document ID to restore
 * @returns {Promise<Object>} - Restored document
 */
const restoreDeleted = async (model, id) => {
    const Model = require(`../models/${model}`);
    
    const doc = await Model.findByIdAndUpdate(
        id,
        {
            isDeleted: false,
            $unset: { deletedAt: 1, deletedBy: 1, deletionReason: 1 }
        },
        { new: true }
    );
    
    if (!doc) {
        throw new Error(`${model} not found`);
    }
    
    console.log(`✅ ${model} ${id} restored`);
    return doc;
};

module.exports = {
    withTransaction,
    executePaymentTransaction,
    cancelOrderWithStockRestore,
    softDelete,
    restoreDeleted
};

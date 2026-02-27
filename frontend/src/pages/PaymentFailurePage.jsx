import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiXCircle, FiRefreshCw, FiHome, FiPhone, FiMail, FiAlertTriangle } from 'react-icons/fi';
import api from '../utils/api';
import toast from 'react-hot-toast';

export default function PaymentFailurePage() {
    const navigate = useNavigate();
    const { orderId } = useParams();
    const [searchParams] = useSearchParams();
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [retrying, setRetrying] = useState(false);

    // Get error details from URL params (passed by Razorpay redirect)
    const errorCode = searchParams.get('error_code') || '';
    const errorDescription = searchParams.get('error_description') || 'Payment could not be completed';
    const errorReason = searchParams.get('error_reason') || '';

    useEffect(() => {
        const fetchOrder = async () => {
            if (!orderId) {
                setLoading(false);
                return;
            }
            try {
                const { data } = await api.get(`/orders/${orderId}`);
                setOrder(data);
            } catch (err) {
                console.error('Error fetching order:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchOrder();
    }, [orderId]);

    const handleRetryPayment = async () => {
        if (!order) {
            toast.error('Order not found');
            navigate('/cart');
            return;
        }
        
        setRetrying(true);
        try {
            // Navigate back to cart or retry payment
            navigate('/cart');
        } catch (err) {
            toast.error('Could not retry payment');
        } finally {
            setRetrying(false);
        }
    };

    const getErrorMessage = () => {
        if (errorCode === 'BAD_REQUEST_ERROR') {
            return 'The payment request was invalid. Please try again.';
        }
        if (errorCode === 'GATEWAY_ERROR') {
            return 'Payment gateway error. Please try again later.';
        }
        if (errorCode === 'PAYMENT_FAILED') {
            return 'Your payment was declined. Please check your payment details.';
        }
        if (errorReason === 'payment_cancelled') {
            return 'You cancelled the payment. Your order is still saved.';
        }
        return errorDescription || 'Payment could not be completed. Please try again.';
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-cream-100">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-charcoal mx-auto mb-4"></div>
                    <p className="font-sans text-charcoal-muted">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-cream-100 via-red-50 to-cream-100 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', damping: 20 }}
                className="w-full max-w-lg"
            >
                {/* Failure Hero */}
                <div className="text-center mb-8">
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2, type: 'spring', damping: 12 }}
                        className="w-28 h-28 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6"
                    >
                        <FiXCircle className="w-14 h-14 text-red-500" />
                    </motion.div>
                    <motion.h1
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="font-serif text-3xl md:text-4xl text-charcoal mb-3"
                    >
                        Payment Failed
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.4 }}
                        className="font-sans text-charcoal-muted text-lg"
                    >
                        {getErrorMessage()}
                    </motion.p>
                </div>

                {/* Error Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.45 }}
                    className="bg-white rounded-[2rem] shadow-strong overflow-hidden mb-6"
                >
                    {/* Order Info (if available) */}
                    {order && (
                        <div className="bg-gradient-to-r from-red-800 to-red-900 px-7 py-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-sans text-red-200 text-xs uppercase tracking-widest mb-1">Order</p>
                                    <p className="font-serif text-white text-2xl font-bold">#{order.orderNumber}</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-sans text-red-200 text-xs uppercase tracking-widest mb-1">Amount</p>
                                    <p className="font-sans text-white text-2xl font-bold">₹{order.totalAmount?.toLocaleString()}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="p-7 space-y-6">
                        {/* Error Details */}
                        {errorCode && (
                            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                                <div className="flex items-start gap-3">
                                    <FiAlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
                                    <div>
                                        <p className="font-sans text-sm font-bold text-red-800 mb-1">Error Details</p>
                                        <p className="font-sans text-xs text-red-600">
                                            Code: {errorCode}
                                            {errorReason && <span className="block">Reason: {errorReason}</span>}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* What to do next */}
                        <div className="space-y-3">
                            <p className="font-sans text-sm font-bold text-charcoal">What to do next:</p>
                            <ul className="space-y-2 font-sans text-sm text-charcoal-muted">
                                <li className="flex items-start gap-2">
                                    <span className="w-5 h-5 bg-cream-200 rounded-full flex items-center justify-center text-xs font-bold text-charcoal flex-shrink-0 mt-0.5">1</span>
                                    Check your payment method has sufficient balance
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="w-5 h-5 bg-cream-200 rounded-full flex items-center justify-center text-xs font-bold text-charcoal flex-shrink-0 mt-0.5">2</span>
                                    Try a different payment method (UPI, Card, Net Banking)
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="w-5 h-5 bg-cream-200 rounded-full flex items-center justify-center text-xs font-bold text-charcoal flex-shrink-0 mt-0.5">3</span>
                                    Contact your bank if the issue persists
                                </li>
                            </ul>
                        </div>

                        {/* No charge notice */}
                        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
                            <FiCheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                            <p className="font-sans text-sm text-green-700">
                                <strong>No amount deducted.</strong> If any amount was deducted, it will be refunded within 5-7 business days.
                            </p>
                        </div>
                    </div>
                </motion.div>

                {/* Action Buttons */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="space-y-3"
                >
                    <button
                        onClick={handleRetryPayment}
                        disabled={retrying}
                        className="w-full btn-primary py-4 flex items-center justify-center gap-2 text-lg"
                    >
                        {retrying ? (
                            <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                        ) : (
                            <FiRefreshCw className="w-5 h-5" />
                        )}
                        Try Again
                    </button>

                    <button
                        onClick={() => navigate('/')}
                        className="w-full btn-outline py-4 flex items-center justify-center gap-2"
                    >
                        <FiHome className="w-5 h-5" />
                        Back to Home
                    </button>
                </motion.div>

                {/* Support Contact */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="mt-8 text-center"
                >
                    <p className="font-sans text-xs text-charcoal-muted mb-2">Need help? Contact us:</p>
                    <div className="flex items-center justify-center gap-4">
                        <a href="tel:+919876543210" className="flex items-center gap-1 text-charcoal hover:text-gold transition-colors">
                            <FiPhone className="w-4 h-4" />
                            <span className="font-sans text-sm">+91 98765 43210</span>
                        </a>
                        <a href="mailto:support@tcs.com" className="flex items-center gap-1 text-charcoal hover:text-gold transition-colors">
                            <FiMail className="w-4 h-4" />
                            <span className="font-sans text-sm">support@tcs.com</span>
                        </a>
                    </div>
                </motion.div>
            </motion.div>
        </div>
    );
}

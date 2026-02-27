import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../utils/api';
import toast from 'react-hot-toast';

// ══════════════════════════════════════════════════════════════════════════════
// PAYMENT CALLBACK PAGE - Handles return from external UPI apps
// ══════════════════════════════════════════════════════════════════════════════
// This page is crucial for mobile UPI flow. When users pay via external apps
// (Google Pay, PhonePe, etc.), they are redirected back to this page.
// We then verify the payment status with the backend.
// ══════════════════════════════════════════════════════════════════════════════

export default function PaymentCallbackPage() {
    const navigate = useNavigate();
    const { orderId } = useParams();
    const [searchParams] = useSearchParams();
    const [status, setStatus] = useState('verifying'); // verifying, success, failed
    const [message, setMessage] = useState('Verifying your payment...');
    const [order, setOrder] = useState(null);

    // Get payment details from URL params (passed by Razorpay)
    const razorpayPaymentId = searchParams.get('razorpay_payment_id');
    const razorpayOrderId = searchParams.get('razorpay_order_id');
    const razorpaySignature = searchParams.get('razorpay_signature');
    const errorCode = searchParams.get('error_code');
    const errorDescription = searchParams.get('error_description');

    useEffect(() => {
        const verifyPayment = async () => {
            // If there's an error in URL params, payment failed
            if (errorCode) {
                setStatus('failed');
                setMessage(errorDescription || 'Payment failed');
                setTimeout(() => {
                    navigate(`/payment-failed/${orderId}?error_code=${errorCode}&error_description=${encodeURIComponent(errorDescription || '')}`);
                }, 1500);
                return;
            }

            // If we have payment details, verify with backend
            if (razorpayPaymentId && razorpayOrderId && razorpaySignature) {
                try {
                    // Get shipping address from sessionStorage (saved before redirect)
                    const savedAddress = sessionStorage.getItem('pending_shipping_address');
                    const shippingAddress = savedAddress ? JSON.parse(savedAddress) : null;

                    const { data } = await api.post('/payment/verify', {
                        razorpay_order_id: razorpayOrderId,
                        razorpay_payment_id: razorpayPaymentId,
                        razorpay_signature: razorpaySignature,
                        shippingAddress
                    });

                    if (data.success) {
                        setStatus('success');
                        setMessage('Payment successful! Redirecting...');
                        setOrder(data);
                        
                        // Clear saved address
                        sessionStorage.removeItem('pending_shipping_address');
                        
                        // Redirect to success page
                        setTimeout(() => {
                            navigate(`/checkout-success/${data.orderId}`);
                        }, 1500);
                    } else {
                        setStatus('failed');
                        setMessage(data.message || 'Payment verification failed');
                        setTimeout(() => {
                            navigate(`/payment-failed/${orderId}`);
                        }, 2000);
                    }
                } catch (err) {
                    console.error('Payment verification error:', err);
                    setStatus('failed');
                    setMessage(err.response?.data?.message || 'Payment verification failed');
                    
                    setTimeout(() => {
                        navigate(`/payment-failed/${orderId}`);
                    }, 2000);
                }
            } else if (orderId) {
                // No payment params but we have orderId - check order status directly
                try {
                    const { data: orderData } = await api.get(`/orders/${orderId}`);
                    
                    if (orderData.paymentStatus === 'Paid') {
                        setStatus('success');
                        setMessage('Payment already confirmed!');
                        setTimeout(() => {
                            navigate(`/checkout-success/${orderId}`);
                        }, 1500);
                    } else {
                        // Payment not complete, redirect back to cart
                        setStatus('failed');
                        setMessage('Payment not completed');
                        setTimeout(() => {
                            navigate('/cart');
                        }, 2000);
                    }
                } catch (err) {
                    setStatus('failed');
                    setMessage('Could not verify order status');
                    setTimeout(() => {
                        navigate('/cart');
                    }, 2000);
                }
            } else {
                // No order ID and no payment params
                setStatus('failed');
                setMessage('Invalid payment callback');
                setTimeout(() => {
                    navigate('/');
                }, 2000);
            }
        };

        verifyPayment();
    }, [razorpayPaymentId, razorpayOrderId, razorpaySignature, errorCode, orderId, navigate]);

    return (
        <div className="min-h-screen bg-cream-100 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center max-w-md w-full"
            >
                {/* Status Animation */}
                <div className="mb-8">
                    {status === 'verifying' && (
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                            className="w-24 h-24 border-4 border-gold border-t-transparent rounded-full mx-auto"
                        />
                    )}
                    
                    {status === 'success' && (
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', damping: 12 }}
                            className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto"
                        >
                            <span className="text-5xl">✅</span>
                        </motion.div>
                    )}
                    
                    {status === 'failed' && (
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', damping: 12 }}
                            className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto"
                        >
                            <span className="text-5xl">❌</span>
                        </motion.div>
                    )}
                </div>

                {/* Status Text */}
                <motion.h2
                    key={status}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`font-serif text-2xl mb-3 ${
                        status === 'success' ? 'text-green-700' :
                        status === 'failed' ? 'text-red-700' :
                        'text-charcoal'
                    }`}
                >
                    {status === 'verifying' ? 'Verifying Payment' :
                     status === 'success' ? 'Payment Successful!' :
                     'Payment Failed'}
                </motion.h2>

                <motion.p
                    key={message}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="font-sans text-charcoal-muted"
                >
                    {message}
                </motion.p>

                {/* Order details if available */}
                {order?.orderNumber && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="mt-6 bg-white rounded-2xl p-6 shadow-soft"
                    >
                        <p className="font-sans text-xs text-charcoal-muted uppercase tracking-wider mb-1">Order Number</p>
                        <p className="font-serif text-xl text-charcoal font-bold">#{order.orderNumber}</p>
                    </motion.div>
                )}

                {/* Help text */}
                {status === 'verifying' && (
                    <p className="font-sans text-xs text-charcoal-muted mt-6">
                        Please don't close this page while we verify your payment...
                    </p>
                )}
            </motion.div>
        </div>
    );
}

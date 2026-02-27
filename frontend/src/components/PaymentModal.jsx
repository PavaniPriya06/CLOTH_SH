import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiCreditCard, FiSmartphone, FiCheckCircle, FiShield, FiLock, FiTruck } from 'react-icons/fi';
import api from '../utils/api';
import toast from 'react-hot-toast';

const UPI_APPS = [
    { name: 'Google Pay', icon: '🟢', color: '#34A853', scheme: 'gpay' },
    { name: 'PhonePe', icon: '💜', color: '#5F259F', scheme: 'phonepe' },
    { name: 'Paytm', icon: '🔵', color: '#00BAF2', scheme: 'paytm' },
    { name: 'Any UPI App', icon: '📲', color: '#6B7280', scheme: 'upi' },
];

export default function PaymentModal({ isOpen, onClose, onSuccess, order, amount }) {
    const [method, setMethod] = useState('razorpay'); // Default to Razorpay for UPI
    const [adminUpi, setAdminUpi] = useState('');
    const [loading, setLoading] = useState(false);
    const [razorpayLoaded, setRazorpayLoaded] = useState(false);
    const [razorpayKey, setRazorpayKey] = useState('');

    useEffect(() => {
        // Fetch admin UPI and Razorpay key
        const fetchData = async () => {
            try {
                const [upiRes, keyRes] = await Promise.all([
                    api.get('/payment/upi-id').catch(() => ({ data: {} })),
                    api.get('/payment/key').catch(() => ({ data: {} }))
                ]);
                if (upiRes.data?.upiId) setAdminUpi(upiRes.data.upiId);
                if (keyRes.data?.key) setRazorpayKey(keyRes.data.key);
            } catch {}
        };
        fetchData();

        // Load Razorpay script
        if (!window.Razorpay) {
            const script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.onload = () => setRazorpayLoaded(true);
            script.onerror = () => toast.error('Payment service unavailable');
            document.body.appendChild(script);
        } else {
            setRazorpayLoaded(true);
        }
    }, []);

    // Razorpay UPI Payment (RECOMMENDED - Real payment via Razorpay)
    const handleRazorpayUPI = async () => {
        if (!razorpayLoaded || !razorpayKey) {
            toast.error('Payment gateway loading, please wait...');
            return;
        }
        
        setLoading(true);
        try {
            // Create Razorpay order for this specific order
            const { data: rpOrder } = await api.post('/payment/create-upi-order', {
                orderId: order._id,
                amount: amount
            });

            // Save shipping address to sessionStorage for mobile callback recovery
            if (order.shippingAddress) {
                sessionStorage.setItem('pendingShippingAddress', JSON.stringify(order.shippingAddress));
                sessionStorage.setItem('pendingOrderAmount', String(amount));
            }

            // Detect if mobile device
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            
            // Get the base URL for callbacks
            const baseUrl = window.location.origin;
            const callbackUrl = `${baseUrl}/payment-callback/${order._id}`;

            const options = {
                key: razorpayKey,
                amount: rpOrder.amount,
                currency: 'INR',
                name: 'TCS – The Co-ord Set Studio',
                description: `Order #${order.orderNumber}`,
                order_id: rpOrder.id,
                prefill: {
                    name: order.shippingAddress?.fullName || '',
                    contact: order.shippingAddress?.phone || '',
                },
                // Mobile-specific: redirect callback URL
                callback_url: isMobile ? callbackUrl : undefined,
                redirect: isMobile,
                config: {
                    display: {
                        blocks: {
                            upi: {
                                name: "Pay via UPI",
                                instruments: [
                                    { method: "upi", flows: isMobile ? ["intent", "qrcode"] : ["qrcode", "collect", "intent"] }
                                ]
                            }
                        },
                        sequence: ["block.upi"],
                        preferences: {
                            show_default_blocks: false
                        }
                    }
                },
                theme: { 
                    color: '#D4A574', 
                    backdrop_color: '#2C1810',
                    hide_topbar: false
                },
                modal: { 
                    backdropclose: false,
                    escape: false,
                    confirm_close: true,
                    ondismiss: () => {
                        setLoading(false);
                        toast.error('Payment cancelled');
                    }
                },
                handler: async (response) => {
                    try {
                        // ✅ VERIFY PAYMENT SIGNATURE AND AUTO-CREATE ORDER
                        const verifyRes = await api.post('/payment/verify', {
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                            shippingAddress: order.shippingAddress,
                            amount
                        });
                        
                        if (verifyRes.data.success && verifyRes.data.orderId) {
                            // Clear sessionStorage after successful verification
                            sessionStorage.removeItem('pendingShippingAddress');
                            sessionStorage.removeItem('pendingOrderAmount');
                            toast.success('✅ Order Placed Successfully! 🎉');
                            onSuccess(verifyRes.data.orderId); // Pass auto-created order ID
                        } else {
                            toast.error('Payment verification failed');
                        }
                    } catch (err) {
                        toast.error(err.response?.data?.message || 'Payment verification failed');
                        console.error('Verify error:', err);
                    } finally {
                        setLoading(false);
                    }
                },
            };

            const rzp = new window.Razorpay(options);
            rzp.on('payment.failed', (response) => {
                toast.error(`Payment failed: ${response.error.description}`);
                setLoading(false);
            });
            rzp.open();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not initiate payment');
            setLoading(false);
        }
    };

    // Razorpay Full Payment (Cards, Net Banking, Wallets, UPI)
    const handleRazorpayFull = async () => {
        if (!razorpayLoaded || !razorpayKey) {
            toast.error('Payment gateway loading, please wait...');
            return;
        }
        
        setLoading(true);
        try {
            const { data: rpOrder } = await api.post('/payment/create-upi-order', {
                orderId: order._id,
                amount: amount
            });

            // Save shipping address to sessionStorage for mobile callback recovery
            if (order.shippingAddress) {
                sessionStorage.setItem('pendingShippingAddress', JSON.stringify(order.shippingAddress));
                sessionStorage.setItem('pendingOrderAmount', String(amount));
            }

            // Detect if mobile device
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            
            // Get the base URL for callbacks
            const baseUrl = window.location.origin;
            const callbackUrl = `${baseUrl}/payment-callback/${order._id}`;

            const options = {
                key: razorpayKey,
                amount: rpOrder.amount,
                currency: 'INR',
                name: 'TCS – The Co-ord Set Studio',
                description: `Order #${order.orderNumber}`,
                order_id: rpOrder.id,
                prefill: {
                    name: order.shippingAddress?.fullName || '',
                    contact: order.shippingAddress?.phone || '',
                },
                // Mobile-specific: redirect callback URL
                callback_url: isMobile ? callbackUrl : undefined,
                redirect: isMobile,
                theme: { 
                    color: '#D4A574', 
                    backdrop_color: '#2C1810'
                },
                modal: { 
                    backdropclose: false,
                    escape: false,
                    confirm_close: true,
                    ondismiss: () => {
                        setLoading(false);
                        toast.error('Payment cancelled');
                    }
                },
                handler: async (response) => {
                    try {
                        const verifyRes = await api.post('/payment/verify-upi', {
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                            orderId: order._id
                        });
                        
                        // Clear sessionStorage after successful verification
                        sessionStorage.removeItem('pendingShippingAddress');
                        sessionStorage.removeItem('pendingOrderAmount');
                        toast.success('Payment successful! 🎉');
                        onSuccess(verifyRes.data.orderId);
                    } catch (err) {
                        toast.error('Payment verification failed. Contact support.');
                    } finally {
                        setLoading(false);
                    }
                },
            };

            const rzp = new window.Razorpay(options);
            rzp.on('payment.failed', (response) => {
                toast.error(`Payment failed: ${response.error.description}`);
                setLoading(false);
            });
            rzp.open();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not initiate payment');
            setLoading(false);
        }
    };

    // Cash on Delivery Handler
    const handleCOD = async () => {
        if (amount > 5000) {
            toast.error('COD is only available for orders up to ₹5,000');
            return;
        }
        
        setLoading(true);
        try {
            const { data } = await api.post('/payment/cod', {
                orderId: order._id
            });
            
            if (data.success) {
                toast.success('🎉 Order placed successfully! Pay on delivery.');
                onSuccess(data.orderId);
            } else {
                toast.error(data.message || 'Could not place COD order');
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not place COD order');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                onClick={(e) => e.target === e.currentTarget && !loading && onClose()}
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    transition={{ type: 'spring', damping: 25 }}
                    className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto"
                >
                    {/* Header */}
                    <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-7 py-5 border-b border-cream-200 rounded-t-[2rem]">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-gold to-gold-dark rounded-2xl flex items-center justify-center shadow-soft">
                                <FiCreditCard className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h2 className="font-serif text-2xl text-charcoal">Secure Payment</h2>
                                <p className="font-sans text-xs text-charcoal-muted">Step 2 of 2 — Pay ₹{amount?.toLocaleString()}</p>
                            </div>
                        </div>
                        <button 
                            onClick={onClose}
                            disabled={loading}
                            className="w-10 h-10 bg-cream-100 hover:bg-cream-200 rounded-full flex items-center justify-center transition-colors disabled:opacity-50"
                        >
                            <FiX className="w-5 h-5 text-charcoal" />
                        </button>
                    </div>

                    <div className="p-7 space-y-5">
                        {/* Trust badges */}
                        <div className="flex items-center gap-3 justify-center py-2">
                            {[
                                { icon: FiLock, text: '256-bit SSL' },
                                { icon: FiShield, text: 'PCI DSS' },
                                { icon: FiCheckCircle, text: 'Verified' }
                            ].map(({ icon: Icon, text }) => (
                                <span key={text} className="font-sans text-xs text-charcoal-muted bg-green-50 border border-green-200 px-3 py-2 rounded-full flex items-center gap-1.5">
                                    <Icon className="w-3 h-3 text-green-600" /> {text}
                                </span>
                            ))}
                        </div>

                        {/* Order info */}
                        {order && (
                            <div className="bg-gradient-to-r from-charcoal to-charcoal-light rounded-2xl p-5 flex justify-between items-center text-white">
                                <div>
                                    <p className="font-sans text-xs text-cream-400 uppercase tracking-wider">Order</p>
                                    <p className="font-serif text-xl">#{order.orderNumber}</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-sans text-xs text-cream-400 uppercase tracking-wider">Amount</p>
                                    <p className="font-sans text-2xl font-bold text-gold">₹{amount?.toLocaleString()}</p>
                                </div>
                            </div>
                        )}

                        {/* Payment destination info */}
                        {adminUpi && (
                            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                                <p className="font-sans text-xs text-amber-700 font-bold uppercase tracking-wider mb-1">💰 Payment goes to:</p>
                                <p className="font-sans text-lg font-bold text-amber-900">{adminUpi}</p>
                                <p className="font-sans text-xs text-amber-700 mt-1">via Razorpay secure gateway</p>
                            </div>
                        )}

                        {/* Method Tabs */}
                        <div className="flex gap-2 bg-cream-100 rounded-2xl p-1.5">
                            {[
                                { id: 'razorpay', label: 'UPI', icon: FiSmartphone },
                                { id: 'all', label: 'Cards/Banks', icon: FiCreditCard },
                                { id: 'cod', label: 'Cash on Delivery', icon: FiTruck },
                            ].map(({ id, label, icon: Icon }) => (
                                <button key={id} onClick={() => setMethod(id)}
                                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-sans text-xs font-medium transition-all ${method === id ? 'bg-white text-charcoal shadow-soft' : 'text-charcoal-muted hover:text-charcoal'}`}>
                                    <Icon className="w-4 h-4" /> {label}
                                </button>
                            ))}
                        </div>

                        {/* UPI Method (via Razorpay) */}
                        {method === 'razorpay' && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                                <div className="bg-cream-100 rounded-2xl p-5 space-y-4">
                                    <p className="font-sans text-sm font-bold text-charcoal text-center">Pay securely via UPI</p>
                                    
                                    {/* UPI App Icons */}
                                    <div className="flex justify-center gap-4">
                                        {UPI_APPS.map(app => (
                                            <div key={app.name} className="flex flex-col items-center gap-1">
                                                <span className="text-3xl">{app.icon}</span>
                                                <span className="font-sans text-xs text-charcoal-muted">{app.name.split(' ')[0]}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex items-center gap-2 justify-center text-xs font-sans text-green-700 bg-green-100 px-4 py-2 rounded-full">
                                        <FiCheckCircle className="w-4 h-4" />
                                        <span>Powered by Razorpay • Money goes directly to seller</span>
                                    </div>
                                </div>

                                <motion.button 
                                    onClick={handleRazorpayUPI} 
                                    disabled={loading || !razorpayLoaded}
                                    whileHover={{ scale: loading ? 1 : 1.02 }} 
                                    whileTap={{ scale: loading ? 1 : 0.98 }}
                                    className="btn-primary w-full flex items-center justify-center gap-3 py-4 text-lg disabled:opacity-70"
                                >
                                    {loading ? (
                                        <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                                    ) : (
                                        <FiSmartphone className="w-5 h-5" />
                                    )}
                                    {loading ? 'Opening UPI...' : `Pay ₹${amount?.toLocaleString()} via UPI`}
                                </motion.button>

                                <p className="text-xs text-center text-charcoal-muted">
                                    You'll be redirected to Razorpay to complete payment
                                </p>
                            </motion.div>
                        )}

                        {/* All Payment Methods (via Razorpay) */}
                        {method === 'all' && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                                <div className="bg-cream-100 rounded-2xl p-5 space-y-3">
                                    <p className="font-sans text-sm font-bold text-charcoal">All payment methods:</p>
                                    {[
                                        '📲 UPI - Google Pay, PhonePe, Paytm',
                                        '💳 Debit / Credit Cards',
                                        '🏦 Net Banking',
                                        '👛 Digital Wallets'
                                    ].map(m => (
                                        <div key={m} className="flex items-center gap-2 text-sm font-sans text-charcoal-muted">
                                            <FiCheckCircle className="text-green-500 w-4 h-4 flex-shrink-0" />
                                            {m}
                                        </div>
                                    ))}
                                </div>
                                
                                <div className="text-xs font-sans text-charcoal-muted text-center flex items-center justify-center gap-2">
                                    <FiLock className="w-4 h-4" /> Secured by Razorpay — PCI DSS Compliant
                                </div>

                                <motion.button 
                                    onClick={handleRazorpayFull} 
                                    disabled={loading || !razorpayLoaded}
                                    whileHover={{ scale: loading ? 1 : 1.02 }} 
                                    whileTap={{ scale: loading ? 1 : 0.98 }}
                                    className="btn-primary w-full flex items-center justify-center gap-3 py-4 text-lg disabled:opacity-70"
                                >
                                    {loading ? (
                                        <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                                    ) : (
                                        <FiCreditCard className="w-5 h-5" />
                                    )}
                                    {loading ? 'Opening Razorpay...' : `Pay ₹${amount?.toLocaleString()}`}
                                </motion.button>
                            </motion.div>
                        )}

                        {/* Cash on Delivery */}
                        {method === 'cod' && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                                <div className="bg-cream-100 rounded-2xl p-5 space-y-3">
                                    <div className="flex items-center justify-center gap-3 mb-3">
                                        <FiTruck className="w-8 h-8 text-charcoal" />
                                        <span className="font-sans text-lg font-bold text-charcoal">Cash on Delivery</span>
                                    </div>
                                    <p className="font-sans text-sm text-charcoal-muted text-center">
                                        Pay when your order arrives at your doorstep
                                    </p>
                                    {[
                                        '🚚 Pay only when you receive the product',
                                        '💵 Cash / UPI accepted on delivery',
                                        '📦 Inspect before you pay',
                                        '🔄 Easy returns if not satisfied'
                                    ].map(m => (
                                        <div key={m} className="flex items-center gap-2 text-sm font-sans text-charcoal-muted">
                                            <FiCheckCircle className="text-green-500 w-4 h-4 flex-shrink-0" />
                                            {m}
                                        </div>
                                    ))}
                                </div>
                                
                                {amount > 5000 && (
                                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                                        <p className="font-sans text-xs text-amber-700">
                                            ⚠️ COD available for orders up to ₹5,000. For larger orders, please use online payment.
                                        </p>
                                    </div>
                                )}

                                <motion.button 
                                    onClick={handleCOD} 
                                    disabled={loading || amount > 5000}
                                    whileHover={{ scale: loading || amount > 5000 ? 1 : 1.02 }} 
                                    whileTap={{ scale: loading || amount > 5000 ? 1 : 0.98 }}
                                    className="btn-primary w-full flex items-center justify-center gap-3 py-4 text-lg disabled:opacity-70"
                                >
                                    {loading ? (
                                        <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                                    ) : (
                                        <FiTruck className="w-5 h-5" />
                                    )}
                                    {loading ? 'Placing Order...' : `Place COD Order — ₹${amount?.toLocaleString()}`}
                                </motion.button>
                                
                                <p className="text-xs text-center text-charcoal-muted">
                                    Please keep exact change ready for faster delivery
                                </p>
                            </motion.div>
                        )}

                        {/* Security notice */}
                        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-center">
                            <p className="font-sans text-xs text-blue-800">
                                🔒 Your payment is protected by 256-bit encryption. We never store your card details.
                            </p>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}

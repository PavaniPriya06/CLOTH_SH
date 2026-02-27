import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiTrash2, FiMinus, FiPlus } from 'react-icons/fi';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import api, { getMediaUrl } from '../utils/api';
import toast from 'react-hot-toast';
import AddressModal from '../components/AddressModal';
import PaymentModal from '../components/PaymentModal';

export default function CartPage() {
    const { items, removeFromCart, updateQuantity, clearCart, totalAmount, shippingCharge, grandTotal } = useCart();
    const { user } = useAuth();
    const navigate = useNavigate();
    
    const [step, setStep] = useState(1); // 1: cart, 2: address, 3: payment, 4: success
    const [showAddressModal, setShowAddressModal] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [address, setAddress] = useState(null);
    const [currentOrder, setCurrentOrder] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!user) navigate('/auth');
    }, [user, navigate]);

    const handleAddressSubmit = async (addressData) => {
        setLoading(true);
        try {
            const orderData = {
                items: items.map(i => ({ 
                    product: i.product, 
                    name: i.name, 
                    price: i.price, 
                    image: i.image, 
                    quantity: i.quantity, 
                    size: i.size 
                })),
                shippingAddress: {
                    fullName: addressData.fullName,
                    phone: addressData.phone,
                    houseNo: addressData.houseNo,
                    street: addressData.street,
                    landmark: addressData.landmark,
                    city: addressData.city,
                    state: addressData.state,
                    pincode: addressData.pincode
                },
                // Location data from AddressModal
                location: {
                    lat: addressData.lat,
                    lng: addressData.lng,
                    accuracy: addressData.accuracy,
                    locationSource: addressData.locationSource,
                    ipAddress: addressData.ipAddress,
                    ipCity: addressData.ipCity,
                    ipRegion: addressData.ipRegion,
                    ipCountry: addressData.ipCountry
                },
                paymentMethod: 'Pending', // Will be set during payment
                saveAddress: true // Save address to user profile
            };

            const { data: order } = await api.post('/orders', orderData);
            setCurrentOrder(order);
            setAddress(addressData);
            setShowAddressModal(false);
            setStep(3); // Move to payment
            setShowPaymentModal(true);
            toast.success('Address saved! Now choose payment method.');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save address');
        } finally {
            setLoading(false);
        }
    };

    const handlePaymentSuccess = async (orderId) => {
        clearCart();
        setShowPaymentModal(false);
        navigate(`/checkout-success/${orderId}`);
    };

    if (items.length === 0) return (
        <div className="min-h-screen flex flex-col items-center justify-center pt-20 bg-cream-100">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
                <div className="w-32 h-32 bg-cream-200 rounded-full flex items-center justify-center mx-auto mb-8">
                    <span className="text-5xl">🛍️</span>
                </div>
                <h2 className="font-serif text-4xl text-charcoal mb-4">Your Cart is Empty</h2>
                <p className="font-sans text-charcoal-muted mb-8">Explore our collection and find something you love!</p>
                <button onClick={() => navigate('/')} className="btn-primary">Shop Now</button>
            </motion.div>
        </div>
    );

    return (
        <div className="min-h-screen pt-20 bg-cream-100">
            <AddressModal 
                isOpen={showAddressModal}
                onClose={() => setShowAddressModal(false)}
                onSubmit={handleAddressSubmit}
                initialData={{ name: user?.name, phone: user?.phone }}
            />
            <PaymentModal 
                isOpen={showPaymentModal}
                onClose={() => setShowPaymentModal(false)}
                onSuccess={handlePaymentSuccess}
                order={currentOrder}
                amount={grandTotal}
            />
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <header className="mb-12">
                    <h1 className="font-serif text-4xl text-charcoal mb-4">Your Shopping Cart</h1>
                </header>

                <div className="grid lg:grid-cols-3 gap-12">
                    {/* Main content */}
                    <div className="lg:col-span-2">
                        <div className="space-y-6">
                            {items.map(item => (
                                <motion.div key={item.key} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                    className="flex gap-6 pb-6 border-b border-cream-300 last:border-0">
                                    <div className="w-24 h-32 rounded-2xl overflow-hidden flex-shrink-0 bg-cream-200 shadow-sm">
                                        <img src={item.image ? getMediaUrl(item.image) : `https://placehold.co/120x160/F5F0E8/4A3728?text=${encodeURIComponent(item.name)}`}
                                            alt={item.name} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                                        <div>
                                            <div className="flex justify-between items-start mb-1">
                                                <h3 className="font-serif text-charcoal text-xl leading-tight">{item.name}</h3>
                                                <button onClick={() => removeFromCart(item.key)} className="text-charcoal-muted hover:text-red-500 transition-colors p-1">
                                                    <FiTrash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <p className="font-sans text-charcoal-muted text-xs uppercase tracking-widest mb-4">Size: {item.size}</p>
                                            <div className="flex items-center gap-4">
                                                <p className="font-sans font-bold text-charcoal text-lg">₹{item.price.toLocaleString()}</p>
                                                <div className="flex items-center gap-3 bg-white rounded-full px-2 py-1 border border-cream-300">
                                                    <button onClick={() => updateQuantity(item.key, item.quantity - 1)} className="w-6 h-6 rounded-full hover:bg-cream-100 flex items-center justify-center"><FiMinus className="w-3 h-3" /></button>
                                                    <span className="font-sans text-xs font-bold w-4 text-center">{item.quantity}</span>
                                                    <button onClick={() => updateQuantity(item.key, item.quantity + 1)} className="w-6 h-6 rounded-full hover:bg-cream-100 flex items-center justify-center"><FiPlus className="w-3 h-3" /></button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>

                    {/* Order Summary */}
                    <div className="lg:col-span-1">
                        <div className="card p-8 sticky top-32 bg-white/50 backdrop-blur-md">
                            <h3 className="font-serif text-2xl text-charcoal mb-8">Summary</h3>
                            <div className="space-y-4 mb-8">
                                <div className="flex justify-between font-sans text-sm">
                                    <span className="text-charcoal-muted">Subtotal</span>
                                    <span className="text-charcoal font-bold">₹{totalAmount.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between font-sans text-sm">
                                    <span className="text-charcoal-muted">Shipping</span>
                                    <span className={`font-bold ${shippingCharge === 0 ? 'text-green-600' : 'text-charcoal'}`}>{shippingCharge === 0 ? 'FREE' : `₹${shippingCharge}`}</span>
                                </div>
                                <div className="pt-4 border-t border-cream-300 flex justify-between items-end">
                                    <span className="font-serif text-2xl text-charcoal">Total</span>
                                    <div className="text-right">
                                        <p className="font-sans text-[10px] text-charcoal-muted uppercase font-bold tracking-widest leading-none">Grand Total</p>
                                        <p className="font-sans font-bold text-2xl text-charcoal leading-none">₹{grandTotal.toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>

                            <motion.button 
                                onClick={() => setShowAddressModal(true)} 
                                disabled={loading}
                                whileHover={{ scale: 1.02 }} 
                                whileTap={{ scale: 0.98 }}
                                className="btn-gold w-full flex items-center justify-center gap-2 disabled:opacity-70 py-3 text-lg"
                            >
                                🛒 BUY NOW
                            </motion.button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

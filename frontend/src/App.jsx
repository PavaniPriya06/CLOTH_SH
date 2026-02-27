import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';

import Navbar from './components/Navbar';
import Footer from './components/Footer';
import LandingPage from './pages/LandingPage';
import ProductPage from './pages/ProductPage';
import CartPage from './pages/CartPage';
import AuthPage from './pages/AuthPage';
import AdminLogin from './pages/AdminLogin';
import OrdersPage from './pages/OrdersPage';
import AdminDashboard from './pages/AdminDashboard';
import CheckoutSuccessPage from './pages/CheckoutSuccessPage';
import PaymentCallbackPage from './pages/PaymentCallbackPage';
import PaymentFailurePage from './pages/PaymentFailurePage';

// OAuth callback handler
function OAuthCallback() {
    const [params] = useSearchParams();
    const { handleOAuthCallback } = useAuth();
    useEffect(() => {
        const token = params.get('token');
        if (token) handleOAuthCallback(token);
        window.location.href = '/';
    }, []);
    return <div className="flex h-screen items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold"></div></div>;
}

function ProtectedRoute({ children, adminOnly = false }) {
    const { user, isAdmin } = useAuth();
    if (!user) return <Navigate to="/auth" replace />;
    if (adminOnly && !isAdmin) return <Navigate to="/" replace />;
    return children;
}

function Layout({ children }) {
    return (
        <div className="min-h-screen flex flex-col">
            <Navbar />
            <main className="flex-1">{children}</main>
            <Footer />
        </div>
    );
}

export default function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <CartProvider>
                    <Toaster
                        position="top-right"
                        toastOptions={{
                            style: { fontFamily: 'Inter', background: '#FAF7F0', color: '#2C1810', border: '1px solid #D4A574' },
                            success: { iconTheme: { primary: '#D4A574', secondary: '#FAF7F0' } }
                        }}
                    />
                    <Routes>
                        <Route path="/" element={<Layout><LandingPage /></Layout>} />
                        <Route path="/product/:id" element={<Layout><ProductPage /></Layout>} />
                        <Route path="/auth" element={<AuthPage />} />
                        <Route path="/auth/callback" element={<OAuthCallback />} />
                        <Route path="/cart" element={<Layout><ProtectedRoute><CartPage /></ProtectedRoute></Layout>} />
                        <Route path="/orders" element={<Layout><ProtectedRoute><OrdersPage /></ProtectedRoute></Layout>} />
                        <Route path="/order-success/:orderId" element={<ProtectedRoute><CheckoutSuccessPage /></ProtectedRoute>} />
                        <Route path="/checkout-success/:orderId" element={<ProtectedRoute><CheckoutSuccessPage /></ProtectedRoute>} />
                        <Route path="/payment-callback/:orderId" element={<PaymentCallbackPage />} />
                        <Route path="/payment-failed/:orderId" element={<PaymentFailurePage />} />
                        <Route path="/admin/login" element={<AdminLogin />} />
                        <Route path="/admin" element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </CartProvider>
            </AuthProvider>
        </BrowserRouter>
    );
}

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
require('dotenv').config();

// Import database config (production-grade)
const { connectDB, disconnectDB, getDBHealth } = require('./config/database');

// Import routes
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const cartRoutes = require('./routes/cart');
const orderRoutes = require('./routes/orders');
const paymentRoutes = require('./routes/payment');
const settingsRoutes = require('./routes/settings');
const adminExportRoutes = require('./routes/adminExport');

// Import passport config
require('./config/passport');

const app = express();
const PORT = process.env.PORT || 5000;

// ═══════════════════════════════════════════════════════════════════
// KEEP SERVER STABLE - Prevent crashes from unhandled errors
// ═══════════════════════════════════════════════════════════════════
process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception (server continues):', err.message);
    // Don't exit - keep server running
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection (server continues):', reason);
    // Don't exit - keep server running
});

// Graceful shutdown with proper cleanup
const gracefulShutdown = async (signal) => {
    console.log(`\n📴 ${signal} received. Starting graceful shutdown...`);
    
    // Close server to stop accepting new connections
    if (global.server) {
        console.log('   Closing HTTP server...');
        global.server.close();
    }
    
    // Close database connection
    await disconnectDB();
    
    console.log('✅ Graceful shutdown complete');
    process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Middleware
app.use(cors({
    origin: function(origin, callback) {
        // Allow requests with no origin (mobile apps, UPI deep links, Postman, etc.)
        if (!origin) return callback(null, true);
        
        const allowedOrigins = [
            'http://localhost:5173',
            'http://localhost:3000',
            'http://localhost:5000',
            process.env.CLIENT_URL
        ].filter(Boolean);
        
        // Allow any Vercel or Render domain, or localhost for dev
        if (origin.includes('vercel.app') || 
            origin.includes('onrender.com') || 
            origin.includes('localhost') ||
            allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        
        // Allow all origins in production for mobile browser compatibility
        callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 86400 // 24 hours - cache preflight responses
}));

// Handle preflight requests explicitly for mobile browsers
app.options('*', cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: process.env.JWT_SECRET || 'tcs_session_secret',
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

// Static files (product images)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/admin/export', adminExportRoutes);

// Health check with comprehensive MongoDB status
app.get('/api/health', (req, res) => {
    const dbHealth = getDBHealth();
    res.json({ 
        status: 'TCS Backend Running!', 
        time: new Date(),
        environment: process.env.NODE_ENV || 'development',
        database: {
            status: dbHealth.state,
            connected: dbHealth.connected,
            host: dbHealth.host,
            name: dbHealth.database
        },
        uptime: Math.floor(process.uptime()) + 's',
        memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB'
        }
    });
});

// ═══════════════════════════════════════════════════════════════════
// INITIALIZE DATABASE AND SEED ADMIN
// Uses production-grade MongoDB Atlas connection from config/database.js
// NO in-memory fallback - data persistence is MANDATORY
// ═══════════════════════════════════════════════════════════════════
const initializeDatabase = async () => {
    const connected = await connectDB();
    
    if (!connected) {
        console.log('⚠️ Database not connected - some features will be unavailable');
        return;
    }
    
    // Seed admin user
    try {
        const User = require('./models/User');
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@tcs.com';
        const existing = await User.findOne({ email: adminEmail, isDeleted: { $ne: true } });
        if (!existing) {
            await User.create({
                name: 'TCS Admin',
                email: adminEmail,
                password: process.env.ADMIN_PASSWORD || 'Admin@123',
                role: 'admin'
            });
            console.log(`✅ Admin seeded: ${adminEmail}`);
        } else {
            console.log(`✅ Admin exists: ${adminEmail}`);
        }
    } catch (seedErr) {
        console.log('⚠️ Could not seed admin:', seedErr.message);
    }
};

initializeDatabase();

// Serve frontend static files in production
if (process.env.NODE_ENV === 'production') {
    const frontendPath = path.join(__dirname, '../../frontend/dist');
    app.use(express.static(frontendPath));
    
    // Handle React routing - serve index.html for all non-API routes
    app.get('*', (req, res) => {
        if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
            res.sendFile(path.join(frontendPath, 'index.html'));
        }
    });
}

// ═══════════════════════════════════════════════════════════════════
// START SERVER WITH ERROR HANDLING
// ═══════════════════════════════════════════════════════════════════
const server = app.listen(PORT, () => {
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log(`🚀 TCS Server running on http://localhost:${PORT}`);
    console.log(`📦 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`♻️ Auto-reconnect enabled - server will stay connected`);
    console.log(`💾 Data persistence: MongoDB Atlas (production-grade)`);
    console.log('═══════════════════════════════════════════════════════════════════');
});

// Store server reference for graceful shutdown
global.server = server;

// Keep server alive - prevent idle timeout (especially on Render/Heroku)
server.keepAliveTimeout = 65000;  // 65 seconds
server.headersTimeout = 66000;   // Slightly more than keepAliveTimeout

// Handle server errors without crashing
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} already in use. Server running elsewhere?`);
    } else {
        console.error('❌ Server error:', err.message);
    }
});

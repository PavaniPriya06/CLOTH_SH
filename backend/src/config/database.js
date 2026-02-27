// ══════════════════════════════════════════════════════════════════════════════
// DATABASE CONFIGURATION - Production-Grade MongoDB Connection
// ══════════════════════════════════════════════════════════════════════════════
// This file manages MongoDB Atlas connection with:
// - Auto-reconnection on failure
// - Connection pooling
// - Proper error handling
// - NO in-memory fallback (production requirement)
// ══════════════════════════════════════════════════════════════════════════════

const mongoose = require('mongoose');

// Connection state tracking
let isConnected = false;
let connectionAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_INTERVAL = 5000; // 5 seconds

// MongoDB connection options for production stability
const mongoOptions = {
    // Connection timeout
    serverSelectionTimeoutMS: 10000,     // 10s to find a server
    connectTimeoutMS: 10000,             // 10s to connect
    socketTimeoutMS: 45000,              // 45s socket timeout
    
    // Connection pool settings
    maxPoolSize: 50,                     // Max connections in pool
    minPoolSize: 5,                      // Keep 5 connections ready
    maxIdleTimeMS: 60000,                // Close idle connections after 60s
    
    // Write/Read settings
    retryWrites: true,                   // Retry failed writes
    retryReads: true,                    // Retry failed reads
    w: 'majority',                       // Write concern: majority
    
    // Heartbeat and monitoring
    heartbeatFrequencyMS: 10000,         // Check connection every 10s
    
    // Auto-index (disable in production for performance)
    autoIndex: process.env.NODE_ENV !== 'production',
    
    // Buffer commands when disconnected
    bufferCommands: true,
};

// Connection event handlers
const setupConnectionHandlers = () => {
    mongoose.connection.on('connected', () => {
        isConnected = true;
        connectionAttempts = 0;
        console.log('✅ MongoDB Atlas connected successfully');
        console.log(`   Database: ${mongoose.connection.name}`);
        console.log(`   Host: ${mongoose.connection.host}`);
    });

    mongoose.connection.on('disconnected', () => {
        isConnected = false;
        console.log('⚠️ MongoDB disconnected');
        
        // Auto-reconnect if not shutting down
        if (process.env.SHUTDOWN !== 'true') {
            console.log('   Attempting to reconnect...');
        }
    });

    mongoose.connection.on('reconnected', () => {
        isConnected = true;
        connectionAttempts = 0;
        console.log('✅ MongoDB reconnected successfully');
    });

    mongoose.connection.on('error', (err) => {
        console.error('❌ MongoDB connection error:', err.message);
        isConnected = false;
    });

    // Connection pool events
    mongoose.connection.on('fullsetup', () => {
        console.log('   MongoDB replica set connected');
    });
};

// Main connection function
const connectDB = async () => {
    const uri = process.env.MONGODB_URI;
    
    // ═══════════════════════════════════════════════════════════════════
    // CRITICAL: MongoDB Atlas URI is REQUIRED for production
    // No in-memory database fallback - data must persist!
    // ═══════════════════════════════════════════════════════════════════
    if (!uri) {
        console.error('═══════════════════════════════════════════════════════════════════');
        console.error('❌ CRITICAL ERROR: MONGODB_URI environment variable is not set!');
        console.error('');
        console.error('   This application requires MongoDB Atlas for data persistence.');
        console.error('   In-memory databases are NOT supported for production use.');
        console.error('');
        console.error('   Please set MONGODB_URI in your .env file:');
        console.error('   MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/tcs_store');
        console.error('');
        console.error('   Get your free MongoDB Atlas cluster at: https://www.mongodb.com/atlas');
        console.error('═══════════════════════════════════════════════════════════════════');
        
        // In development, allow graceful degradation for setup
        if (process.env.NODE_ENV !== 'production') {
            console.log('');
            console.log('⚠️ Development mode: Server will start but database operations will fail.');
            console.log('   Please configure MONGODB_URI to enable full functionality.');
            return false;
        }
        
        // In production, this is a fatal error
        process.exit(1);
    }

    // Log connection type (helpful for debugging)
    const isAtlas = uri.includes('mongodb+srv') || uri.includes('mongodb.net');
    const isLocal = uri.includes('localhost') || uri.includes('127.0.0.1');
    
    if (isAtlas) {
        console.log('🌐 Connecting to MongoDB Atlas (cloud)...');
    } else if (isLocal) {
        console.log('💻 Connecting to local MongoDB...');
        if (process.env.NODE_ENV === 'production') {
            console.warn('⚠️ WARNING: Using local MongoDB in production is not recommended!');
        }
    }

    // Setup event handlers before connecting
    setupConnectionHandlers();

    // Attempt connection with retry logic
    const attemptConnection = async () => {
        connectionAttempts++;
        
        try {
            console.log(`🔌 Connecting to MongoDB Atlas (attempt ${connectionAttempts})...`);
            
            await mongoose.connect(uri, mongoOptions);
            
            // Verify connection is working
            await mongoose.connection.db.admin().ping();
            
            console.log('✅ MongoDB Atlas connection verified');
            return true;
            
        } catch (err) {
            console.error(`❌ Connection attempt ${connectionAttempts} failed:`, err.message);
            
            if (connectionAttempts < MAX_RECONNECT_ATTEMPTS) {
                console.log(`   Retrying in ${RECONNECT_INTERVAL / 1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, RECONNECT_INTERVAL));
                return attemptConnection();
            } else {
                console.error('═══════════════════════════════════════════════════════════════════');
                console.error('❌ CRITICAL: Failed to connect to MongoDB Atlas after maximum attempts');
                console.error('   Please check:');
                console.error('   1. Your MONGODB_URI is correct');
                console.error('   2. Your IP is whitelisted in MongoDB Atlas');
                console.error('   3. Your network allows outbound connections');
                console.error('   4. MongoDB Atlas cluster is running');
                console.error('═══════════════════════════════════════════════════════════════════');
                
                if (process.env.NODE_ENV === 'production') {
                    process.exit(1);
                }
                return false;
            }
        }
    };

    return attemptConnection();
};

// Graceful disconnect
const disconnectDB = async () => {
    process.env.SHUTDOWN = 'true';
    
    if (mongoose.connection.readyState !== 0) {
        console.log('📴 Closing MongoDB connection...');
        await mongoose.connection.close();
        console.log('✅ MongoDB connection closed');
    }
};

// Health check function
const getDBHealth = () => {
    const states = ['Disconnected', 'Connected', 'Connecting', 'Disconnecting'];
    return {
        connected: isConnected,
        state: states[mongoose.connection.readyState] || 'Unknown',
        readyState: mongoose.connection.readyState,
        host: mongoose.connection.host || 'N/A',
        database: mongoose.connection.name || 'N/A',
        connectionAttempts
    };
};

// Check if connected
const checkConnection = () => {
    if (!isConnected || mongoose.connection.readyState !== 1) {
        throw new Error('Database not connected. Please ensure MongoDB Atlas is configured.');
    }
    return true;
};

module.exports = {
    connectDB,
    disconnectDB,
    getDBHealth,
    checkConnection,
    mongoOptions
};

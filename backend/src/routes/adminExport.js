// ══════════════════════════════════════════════════════════════════════════════
// ADMIN DATA EXPORT ROUTES - Export data to CSV/Excel
// ══════════════════════════════════════════════════════════════════════════════
// Provides admin with ability to:
// - Export all orders as CSV
// - Export all users as CSV
// - Export all payments as CSV
// - Export all products as CSV
// - Export inventory report
// ══════════════════════════════════════════════════════════════════════════════

const router = require('express').Router();
const { protect, adminOnly } = require('../middleware/auth');
const Order = require('../models/Order');
const User = require('../models/User');
const Payment = require('../models/Payment');
const Product = require('../models/Product');

// Helper: Convert array of objects to CSV
const toCSV = (data, columns) => {
    if (!data || data.length === 0) return '';
    
    // Header row
    const header = columns.map(col => col.label || col.key).join(',');
    
    // Data rows
    const rows = data.map(item => {
        return columns.map(col => {
            let value = col.key.split('.').reduce((obj, key) => obj?.[key], item);
            
            // Handle arrays
            if (Array.isArray(value)) {
                value = value.join('; ');
            }
            
            // Handle objects
            if (typeof value === 'object' && value !== null) {
                value = JSON.stringify(value);
            }
            
            // Handle dates
            if (value instanceof Date) {
                value = value.toISOString();
            }
            
            // Escape commas and quotes for CSV
            if (typeof value === 'string') {
                if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                    value = `"${value.replace(/"/g, '""')}"`;
                }
            }
            
            return value ?? '';
        }).join(',');
    });
    
    return [header, ...rows].join('\n');
};

// ═══════════════════════════════════════════════════════════════════
// EXPORT ORDERS - All orders with full details
// ═══════════════════════════════════════════════════════════════════
router.get('/orders', protect, adminOnly, async (req, res) => {
    try {
        const { startDate, endDate, status, includeDeleted } = req.query;
        
        const filter = {};
        
        // Date range filter
        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate);
            if (endDate) filter.createdAt.$lte = new Date(endDate);
        }
        
        // Status filter
        if (status) filter.status = status;
        
        // Include deleted filter (default: exclude deleted)
        if (includeDeleted !== 'true') {
            filter.isDeleted = { $ne: true };
        }
        
        const orders = await Order.find(filter)
            .populate('user', 'name email phone')
            .sort({ createdAt: -1 })
            .lean();
        
        const columns = [
            { key: 'orderNumber', label: 'Order Number' },
            { key: 'createdAt', label: 'Date' },
            { key: 'user.name', label: 'Customer Name' },
            { key: 'user.email', label: 'Customer Email' },
            { key: 'user.phone', label: 'Customer Phone' },
            { key: 'totalAmount', label: 'Total Amount (₹)' },
            { key: 'shippingCharge', label: 'Shipping (₹)' },
            { key: 'status', label: 'Order Status' },
            { key: 'paymentStatus', label: 'Payment Status' },
            { key: 'paymentMethod', label: 'Payment Method' },
            { key: 'paymentId', label: 'Payment ID' },
            { key: 'shippingAddress.fullName', label: 'Ship To' },
            { key: 'shippingAddress.phone', label: 'Ship Phone' },
            { key: 'shippingAddress.houseNo', label: 'House No' },
            { key: 'shippingAddress.street', label: 'Street' },
            { key: 'shippingAddress.landmark', label: 'Landmark' },
            { key: 'shippingAddress.city', label: 'City' },
            { key: 'shippingAddress.state', label: 'State' },
            { key: 'shippingAddress.pincode', label: 'Pincode' },
            { key: 'notes', label: 'Notes' },
            { key: 'isDeleted', label: 'Deleted' }
        ];
        
        const csv = toCSV(orders, columns);
        
        const filename = `TCS_Orders_${new Date().toISOString().split('T')[0]}.csv`;
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csv);
        
    } catch (err) {
        console.error('Export orders error:', err);
        res.status(500).json({ message: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════
// EXPORT USERS - All registered users
// ═══════════════════════════════════════════════════════════════════
router.get('/users', protect, adminOnly, async (req, res) => {
    try {
        const { role, includeDeleted } = req.query;
        
        const filter = {};
        if (role) filter.role = role;
        if (includeDeleted !== 'true') {
            filter.isDeleted = { $ne: true };
        }
        
        const users = await User.find(filter)
            .select('-password')
            .sort({ createdAt: -1 })
            .lean();
        
        // Count orders for each user
        const userIds = users.map(u => u._id);
        const orderCounts = await Order.aggregate([
            { $match: { user: { $in: userIds }, isDeleted: { $ne: true } } },
            { $group: { _id: '$user', count: { $sum: 1 }, totalSpent: { $sum: '$totalAmount' } } }
        ]);
        
        const orderMap = {};
        orderCounts.forEach(oc => {
            orderMap[oc._id.toString()] = { count: oc.count, totalSpent: oc.totalSpent };
        });
        
        // Add order stats to users
        const enrichedUsers = users.map(u => ({
            ...u,
            orderCount: orderMap[u._id.toString()]?.count || 0,
            totalSpent: orderMap[u._id.toString()]?.totalSpent || 0
        }));
        
        const columns = [
            { key: '_id', label: 'User ID' },
            { key: 'name', label: 'Name' },
            { key: 'email', label: 'Email' },
            { key: 'phone', label: 'Phone' },
            { key: 'role', label: 'Role' },
            { key: 'provider', label: 'Login Provider' },
            { key: 'isActive', label: 'Active' },
            { key: 'orderCount', label: 'Total Orders' },
            { key: 'totalSpent', label: 'Total Spent (₹)' },
            { key: 'createdAt', label: 'Registered Date' },
            { key: 'isDeleted', label: 'Deleted' }
        ];
        
        const csv = toCSV(enrichedUsers, columns);
        
        const filename = `TCS_Users_${new Date().toISOString().split('T')[0]}.csv`;
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csv);
        
    } catch (err) {
        console.error('Export users error:', err);
        res.status(500).json({ message: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════
// EXPORT PAYMENTS - All payment records
// ═══════════════════════════════════════════════════════════════════
router.get('/payments', protect, adminOnly, async (req, res) => {
    try {
        const { startDate, endDate, status, includeDeleted } = req.query;
        
        const filter = {};
        
        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate);
            if (endDate) filter.createdAt.$lte = new Date(endDate);
        }
        
        if (status) filter.status = status;
        if (includeDeleted !== 'true') {
            filter.isDeleted = { $ne: true };
        }
        
        const payments = await Payment.find(filter)
            .populate('user', 'name email phone')
            .populate('order', 'orderNumber')
            .sort({ createdAt: -1 })
            .lean();
        
        const columns = [
            { key: 'razorpayPaymentId', label: 'Payment ID' },
            { key: 'razorpayOrderId', label: 'Razorpay Order ID' },
            { key: 'order.orderNumber', label: 'Order Number' },
            { key: 'user.name', label: 'Customer Name' },
            { key: 'user.email', label: 'Customer Email' },
            { key: 'amount', label: 'Amount (₹)' },
            { key: 'currency', label: 'Currency' },
            { key: 'method', label: 'Payment Method' },
            { key: 'status', label: 'Status' },
            { key: 'methodDetails.upiId', label: 'UPI ID' },
            { key: 'methodDetails.bank', label: 'Bank' },
            { key: 'methodDetails.cardNetwork', label: 'Card Network' },
            { key: 'methodDetails.cardLast4', label: 'Card Last 4' },
            { key: 'razorpayFee', label: 'Razorpay Fee (paise)' },
            { key: 'createdAt', label: 'Date' },
            { key: 'isDeleted', label: 'Deleted' }
        ];
        
        const csv = toCSV(payments, columns);
        
        const filename = `TCS_Payments_${new Date().toISOString().split('T')[0]}.csv`;
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csv);
        
    } catch (err) {
        console.error('Export payments error:', err);
        res.status(500).json({ message: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════
// EXPORT PRODUCTS - All products with inventory
// ═══════════════════════════════════════════════════════════════════
router.get('/products', protect, adminOnly, async (req, res) => {
    try {
        const { category, includeDeleted, lowStock } = req.query;
        
        const filter = {};
        if (category) filter.category = category;
        if (includeDeleted !== 'true') {
            filter.isDeleted = { $ne: true };
        }
        if (lowStock === 'true') {
            filter.stock = { $lte: 10 };
        }
        
        const products = await Product.find(filter)
            .sort({ createdAt: -1 })
            .lean();
        
        const columns = [
            { key: '_id', label: 'Product ID' },
            { key: 'name', label: 'Name' },
            { key: 'price', label: 'Price (₹)' },
            { key: 'originalPrice', label: 'Original Price (₹)' },
            { key: 'category', label: 'Category' },
            { key: 'gender', label: 'Gender' },
            { key: 'qualityGrade', label: 'Quality' },
            { key: 'stock', label: 'Stock' },
            { key: 'sizes', label: 'Available Sizes' },
            { key: 'colors', label: 'Colors' },
            { key: 'isActive', label: 'Active' },
            { key: 'isFeatured', label: 'Featured' },
            { key: 'isNewArrival', label: 'New Arrival' },
            { key: 'ratings.average', label: 'Rating' },
            { key: 'ratings.count', label: 'Review Count' },
            { key: 'createdAt', label: 'Added Date' },
            { key: 'isDeleted', label: 'Deleted' }
        ];
        
        const csv = toCSV(products, columns);
        
        const filename = `TCS_Products_${new Date().toISOString().split('T')[0]}.csv`;
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csv);
        
    } catch (err) {
        console.error('Export products error:', err);
        res.status(500).json({ message: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════
// EXPORT INVENTORY REPORT - Low stock and sales analysis
// ═══════════════════════════════════════════════════════════════════
router.get('/inventory', protect, adminOnly, async (req, res) => {
    try {
        // Get all products with stock info
        const products = await Product.find({ isDeleted: { $ne: true } })
            .select('name category stock price')
            .lean();
        
        // Get order items to calculate sales
        const salesData = await Order.aggregate([
            { $match: { status: { $in: ['PAID', 'PLACED', 'SHIPPED', 'DELIVERED'] }, isDeleted: { $ne: true } } },
            { $unwind: '$items' },
            { $group: {
                _id: '$items.product',
                totalSold: { $sum: '$items.quantity' },
                totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
            }}
        ]);
        
        const salesMap = {};
        salesData.forEach(s => {
            if (s._id) salesMap[s._id.toString()] = s;
        });
        
        // Enrich products with sales data
        const inventory = products.map(p => ({
            ...p,
            totalSold: salesMap[p._id.toString()]?.totalSold || 0,
            totalRevenue: salesMap[p._id.toString()]?.totalRevenue || 0,
            stockValue: p.stock * p.price,
            lowStock: p.stock <= 10
        }));
        
        const columns = [
            { key: '_id', label: 'Product ID' },
            { key: 'name', label: 'Product Name' },
            { key: 'category', label: 'Category' },
            { key: 'price', label: 'Unit Price (₹)' },
            { key: 'stock', label: 'Current Stock' },
            { key: 'stockValue', label: 'Stock Value (₹)' },
            { key: 'totalSold', label: 'Units Sold' },
            { key: 'totalRevenue', label: 'Total Revenue (₹)' },
            { key: 'lowStock', label: 'Low Stock Alert' }
        ];
        
        const csv = toCSV(inventory, columns);
        
        const filename = `TCS_Inventory_${new Date().toISOString().split('T')[0]}.csv`;
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csv);
        
    } catch (err) {
        console.error('Export inventory error:', err);
        res.status(500).json({ message: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════
// DAILY SALES REPORT - Revenue by date
// ═══════════════════════════════════════════════════════════════════
router.get('/sales-report', protect, adminOnly, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        const matchStage = {
            status: { $in: ['PAID', 'PLACED', 'SHIPPED', 'DELIVERED'] },
            isDeleted: { $ne: true }
        };
        
        if (startDate || endDate) {
            matchStage.createdAt = {};
            if (startDate) matchStage.createdAt.$gte = new Date(startDate);
            if (endDate) matchStage.createdAt.$lte = new Date(endDate);
        }
        
        const salesByDay = await Order.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' },
                        day: { $dayOfMonth: '$createdAt' }
                    },
                    orders: { $sum: 1 },
                    revenue: { $sum: '$totalAmount' },
                    shippingCollected: { $sum: '$shippingCharge' }
                }
            },
            { $sort: { '_id.year': -1, '_id.month': -1, '_id.day': -1 } }
        ]);
        
        // Format the data
        const formatted = salesByDay.map(day => ({
            date: `${day._id.year}-${String(day._id.month).padStart(2, '0')}-${String(day._id.day).padStart(2, '0')}`,
            orders: day.orders,
            revenue: day.revenue,
            shippingCollected: day.shippingCollected,
            netRevenue: day.revenue - day.shippingCollected
        }));
        
        const columns = [
            { key: 'date', label: 'Date' },
            { key: 'orders', label: 'Total Orders' },
            { key: 'revenue', label: 'Gross Revenue (₹)' },
            { key: 'shippingCollected', label: 'Shipping Collected (₹)' },
            { key: 'netRevenue', label: 'Net Revenue (₹)' }
        ];
        
        const csv = toCSV(formatted, columns);
        
        const filename = `TCS_SalesReport_${new Date().toISOString().split('T')[0]}.csv`;
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csv);
        
    } catch (err) {
        console.error('Export sales report error:', err);
        res.status(500).json({ message: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════
// GET EXPORT OPTIONS - List all available exports
// ═══════════════════════════════════════════════════════════════════
router.get('/', protect, adminOnly, async (req, res) => {
    try {
        // Get counts for dashboard
        const [orderCount, userCount, productCount, paymentCount] = await Promise.all([
            Order.countDocuments({ isDeleted: { $ne: true } }),
            User.countDocuments({ isDeleted: { $ne: true } }),
            Product.countDocuments({ isDeleted: { $ne: true } }),
            Payment.countDocuments({ isDeleted: { $ne: true } })
        ]);
        
        res.json({
            exports: [
                { name: 'Orders', endpoint: '/api/admin/export/orders', count: orderCount },
                { name: 'Users', endpoint: '/api/admin/export/users', count: userCount },
                { name: 'Products', endpoint: '/api/admin/export/products', count: productCount },
                { name: 'Payments', endpoint: '/api/admin/export/payments', count: paymentCount },
                { name: 'Inventory Report', endpoint: '/api/admin/export/inventory', count: productCount },
                { name: 'Sales Report', endpoint: '/api/admin/export/sales-report', count: orderCount }
            ],
            supportedFormats: ['CSV'],
            queryParams: {
                startDate: 'Filter by start date (ISO format)',
                endDate: 'Filter by end date (ISO format)',
                status: 'Filter by status',
                includeDeleted: 'Include soft-deleted records (true/false)',
                lowStock: 'Only show low stock items (products only)'
            }
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;

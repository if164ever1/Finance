const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = 3000;
const ASSETS_DIR = path.join(__dirname, 'Assets');

// Middleware
app.use(cors()); // Enable CORS for frontend
app.use(express.json()); // Parse JSON request bodies

/**
 * Sanitize paymentType for filesystem safety
 * - Remove path traversal, slashes, and special chars
 * - Allow letters, numbers, spaces, underscores, hyphens
 * - Convert spaces to underscores for folder/file naming
 */
function sanitizePaymentType(paymentType) {
    // Remove any path traversal attempts, slashes, and invalid characters
    let sanitized = paymentType.trim();
    
    // Only allow letters, numbers, spaces, underscores, and hyphens
    sanitized = sanitized.replace(/[^a-zA-Z0-9\s_-]/g, '');
    
    // Replace spaces with underscores
    sanitized = sanitized.replace(/\s+/g, '_');
    
    // Remove leading/trailing underscores or hyphens
    sanitized = sanitized.replace(/^[_-]+|[_-]+$/g, '');
    
    return sanitized || 'Unknown'; // Fallback if empty after sanitization
}

/**
 * Get month name from date string (YYYY-MM-DD)
 * Returns month name like "January", "February", etc.
 */
function getMonthName(dateString) {
    const date = new Date(dateString + 'T00:00:00'); // Add time to avoid timezone issues
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[date.getMonth()];
}

/**
 * Get year from date string (YYYY-MM-DD)
 */
function getYear(dateString) {
    return new Date(dateString + 'T00:00:00').getFullYear();
}

/**
 * Initialize empty year data structure with all 12 months
 */
function initializeYearData(paymentType, year) {
    const months = {
        'January': { totalAmount: 0, totalCashback: 0, transactions: [] },
        'February': { totalAmount: 0, totalCashback: 0, transactions: [] },
        'March': { totalAmount: 0, totalCashback: 0, transactions: [] },
        'April': { totalAmount: 0, totalCashback: 0, transactions: [] },
        'May': { totalAmount: 0, totalCashback: 0, transactions: [] },
        'June': { totalAmount: 0, totalCashback: 0, transactions: [] },
        'July': { totalAmount: 0, totalCashback: 0, transactions: [] },
        'August': { totalAmount: 0, totalCashback: 0, transactions: [] },
        'September': { totalAmount: 0, totalCashback: 0, transactions: [] },
        'October': { totalAmount: 0, totalCashback: 0, transactions: [] },
        'November': { totalAmount: 0, totalCashback: 0, transactions: [] },
        'December': { totalAmount: 0, totalCashback: 0, transactions: [] }
    };
    
    return {
        paymentType: paymentType,
        year: year,
        months: months
    };
}

/**
 * POST /api/purchase
 * Saves a purchase to the appropriate JSON file organized by paymentType and year
 */
app.post('/api/purchase', async (req, res) => {
    try {
        const { paymentType, amount, date } = req.body;

        // Validation
        if (!paymentType || typeof paymentType !== 'string' || paymentType.trim() === '') {
            return res.status(400).json({ error: 'paymentType is required and must be a non-empty string' });
        }

        if (typeof amount !== 'number' || amount <= 0 || isNaN(amount)) {
            return res.status(400).json({ error: 'amount must be a positive number' });
        }

        // Use today's date if date is missing or invalid
        let purchaseDate = date;
        if (!purchaseDate || !/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)) {
            const today = new Date();
            purchaseDate = today.toISOString().split('T')[0]; // YYYY-MM-DD format
        }

        // Validate date format
        const dateObj = new Date(purchaseDate + 'T00:00:00');
        if (isNaN(dateObj.getTime())) {
            return res.status(400).json({ error: 'Invalid date format. Expected YYYY-MM-DD' });
        }

        // Sanitize paymentType for filesystem safety
        const sanitizedPaymentType = sanitizePaymentType(paymentType);

        // Get year and month from date
        const year = getYear(purchaseDate);
        const monthName = getMonthName(purchaseDate);

        // Calculate cashback (3% of amount, rounded to 2 decimal places)
        const cashback = Math.round(amount * 0.03 * 100) / 100;

        // Create directory path: Assets/<PaymentType>/
        const paymentTypeDir = path.join(ASSETS_DIR, sanitizedPaymentType);

        // Ensure directory exists (create if it doesn't)
        await fs.mkdir(paymentTypeDir, { recursive: true });

        // Create file path: Assets/<PaymentType>/<PaymentType>_<YEAR>.json
        const fileName = `${sanitizedPaymentType}_${year}.json`;
        const filePath = path.join(paymentTypeDir, fileName);

        // Read existing data or initialize new structure
        let yearData;
        try {
            const fileContent = await fs.readFile(filePath, 'utf8');
            yearData = JSON.parse(fileContent);
        } catch (error) {
            // File doesn't exist, initialize new structure
            if (error.code === 'ENOENT') {
                yearData = initializeYearData(sanitizedPaymentType, year);
            } else {
                throw error; // Re-throw if it's a different error (e.g., JSON parse error)
            }
        }

        // Ensure months structure exists (in case of corrupted data)
        if (!yearData.months) {
            yearData.months = initializeYearData(sanitizedPaymentType, year).months;
        }

        // Ensure the specific month exists
        if (!yearData.months[monthName]) {
            yearData.months[monthName] = { totalAmount: 0, totalCashback: 0, transactions: [] };
        }

        // Update month data
        const month = yearData.months[monthName];
        month.totalAmount = Math.round((month.totalAmount + amount) * 100) / 100; // Round to 2 decimals
        month.totalCashback = Math.round((month.totalCashback + cashback) * 100) / 100;
        
        // Add transaction entry
        month.transactions.push({
            date: purchaseDate,
            amount: amount,
            cashback: cashback
        });

        // Write to temp file first, then rename (atomic write to avoid corruption)
        const tempFilePath = filePath + '.tmp';
        await fs.writeFile(tempFilePath, JSON.stringify(yearData, null, 2), 'utf8');
        await fs.rename(tempFilePath, filePath);

        // Return success response with updated month totals
        res.json({
            success: true,
            message: 'Purchase saved successfully',
            month: monthName,
            year: year,
            paymentType: sanitizedPaymentType,
            monthTotals: {
                totalAmount: month.totalAmount,
                totalCashback: month.totalCashback,
                transactionCount: month.transactions.length
            }
        });

    } catch (error) {
        console.error('Error saving purchase:', error);
        res.status(500).json({ 
            error: 'Failed to save purchase',
            message: error.message 
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Finance Tracker API is running' });
});

// Start server
app.listen(PORT, () => {
    console.log(`Finance Tracker API server running on http://localhost:${PORT}`);
    console.log(`Assets directory: ${ASSETS_DIR}`);
});


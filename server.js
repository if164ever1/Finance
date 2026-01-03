const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = 3000;
const DATA_DIR = path.join(__dirname, 'data');
const TRANSACTIONS_FILE = path.join(DATA_DIR, 'transactions.json');

// Middleware
app.use(express.json()); // Parse JSON request bodies
app.use(express.static('public')); // Serve static files from /public

/**
 * Initialize data directory and transactions file on server start
 */
async function initializeData() {
    try {
        // Ensure /data directory exists
        await fs.mkdir(DATA_DIR, { recursive: true });
        
        // Ensure transactions.json exists, create with empty array if missing
        try {
            await fs.access(TRANSACTIONS_FILE);
        } catch {
            // File doesn't exist, create it with empty array
            await fs.writeFile(TRANSACTIONS_FILE, JSON.stringify([], null, 2), 'utf8');
            console.log('Created transactions.json file');
        }
        
        console.log(`Data directory: ${DATA_DIR}`);
    } catch (error) {
        console.error('Error initializing data:', error);
    }
}

/**
 * Get month name from month number (1-12)
 */
function getMonthName(month) {
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month - 1];
}

/**
 * Calculate cashback (3% of amount, rounded to 2 decimals)
 */
function calculateCashback(amount) {
    return Math.round(amount * 0.03 * 100) / 100;
}

/**
 * Parse and validate year/month from query params, with defaults to current month
 * Returns {year, month} or throws error for invalid values
 */
function parseYearMonth(yearParam, monthParam) {
    const now = new Date();
    const year = yearParam ? parseInt(yearParam) : now.getFullYear();
    const month = monthParam ? parseInt(monthParam) : (now.getMonth() + 1);
    
    // Validate year (reasonable range: 2000-2100)
    if (isNaN(year) || year < 2000 || year > 2100) {
        throw new Error('Invalid year. Must be between 2000 and 2100');
    }
    
    // Validate month (1-12)
    if (isNaN(month) || month < 1 || month > 12) {
        throw new Error('Invalid month. Must be between 1 and 12');
    }
    
    return { year, month };
}

/**
 * Read transactions from file, return empty array if file is missing or corrupted
 */
async function readTransactions() {
    try {
        const fileContent = await fs.readFile(TRANSACTIONS_FILE, 'utf8');
        const transactions = JSON.parse(fileContent);
        
        // Ensure it's an array
        if (!Array.isArray(transactions)) {
            return [];
        }
        
        return transactions;
    } catch (error) {
        // File missing or corrupted, return empty array
        if (error.code === 'ENOENT' || error instanceof SyntaxError) {
            return [];
        }
        throw error; // Re-throw other errors
    }
}

/**
 * Filter transactions by year and month
 */
function filterByMonth(transactions, year, month) {
    return transactions.filter(transaction => {
        const transactionDate = new Date(transaction.date + 'T00:00:00');
        return transactionDate.getFullYear() === year && 
               (transactionDate.getMonth() + 1) === month;
    });
}

/**
 * Round money value to 2 decimal places
 */
function moneyRound(value) {
    return Math.round(value * 100) / 100;
}

/**
 * GET /api/dashboard
 * Returns monthly dashboard summary (cashback-only)
 * Query params: year (optional), month (optional) - defaults to current month
 */
app.get('/api/dashboard', async (req, res) => {
    try {
        // Parse and validate year/month from query params
        let year, month;
        try {
            const parsed = parseYearMonth(req.query.year, req.query.month);
            year = parsed.year;
            month = parsed.month;
        } catch (error) {
            return res.status(400).json({ 
                error: 'Invalid query parameters',
                message: error.message 
            });
        }
        
        // Read transactions (gracefully handles missing/corrupted file)
        const allTransactions = await readTransactions();
        
        // Filter transactions for the requested month/year
        const monthTransactions = filterByMonth(allTransactions, year, month);
        
        // Calculate spending totals
        const totalSpent = monthTransactions.reduce((sum, t) => sum + t.amount, 0);
        
        // Calculate cashback (3% rate)
        const cashbackRate = 0.03;
        const totalCashbackUSD = moneyRound(totalSpent * cashbackRate);
        
        // Build response
        res.json({
            period: {
                year: year,
                month: month,
                label: `${getMonthName(month)} ${year}`
            },
            spending: {
                count: monthTransactions.length,
                totalSpent: moneyRound(totalSpent)
            },
            cashback: {
                rate: cashbackRate,
                totalCashbackUSD: totalCashbackUSD
            }
        });
        
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        res.status(500).json({ 
            error: 'Failed to fetch dashboard data',
            message: error.message 
        });
    }
});

/**
 * GET /api/monthly
 * Returns transactions for the specified month/year (defaults to current month)
 */
app.get('/api/monthly', async (req, res) => {
    try {
        // Get year and month from query params, default to current month
        const now = new Date();
        const year = parseInt(req.query.year) || now.getFullYear();
        const month = parseInt(req.query.month) || (now.getMonth() + 1);
        
        // Read transactions from file
        const fileContent = await fs.readFile(TRANSACTIONS_FILE, 'utf8');
        const allTransactions = JSON.parse(fileContent);
        
        // Filter transactions for the requested month/year
        const monthTransactions = allTransactions.filter(transaction => {
            const transactionDate = new Date(transaction.date + 'T00:00:00');
            return transactionDate.getFullYear() === year && 
                   (transactionDate.getMonth() + 1) === month;
        });
        
        // Calculate totals
        const totals = {
            spent: 0,
            cashback: 0,
            count: monthTransactions.length
        };
        
        // Compute cashback for each transaction and calculate totals
        const transactionsWithCashback = monthTransactions.map(transaction => {
            const cashback = calculateCashback(transaction.amount);
            totals.spent += transaction.amount;
            totals.cashback += cashback;
            
            return {
                id: transaction.id,
                date: transaction.date,
                description: transaction.description,
                amount: transaction.amount,
                cashback: cashback
            };
        });
        
        // Round totals to 2 decimals
        totals.spent = Math.round(totals.spent * 100) / 100;
        totals.cashback = Math.round(totals.cashback * 100) / 100;
        
        // Return response
        res.json({
            year: year,
            month: month,
            label: `${getMonthName(month)} ${year}`,
            totals: totals,
            transactions: transactionsWithCashback
        });
        
    } catch (error) {
        console.error('Error fetching monthly data:', error);
        res.status(500).json({ 
            error: 'Failed to fetch monthly data',
            message: error.message 
        });
    }
});

/**
 * POST /api/transactions
 * Creates a new transaction and saves it to transactions.json
 */
app.post('/api/transactions', async (req, res) => {
    try {
        const { date, description, amount } = req.body;
        
        // Validation
        if (!description || typeof description !== 'string' || description.trim() === '') {
            return res.status(400).json({ error: 'description is required and must be a non-empty string' });
        }
        
        if (typeof amount !== 'number' || amount <= 0 || isNaN(amount)) {
            return res.status(400).json({ error: 'amount must be a positive number' });
        }
        
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({ error: 'date is required and must be in YYYY-MM-DD format' });
        }
        
        // Validate date is valid
        const dateObj = new Date(date + 'T00:00:00');
        if (isNaN(dateObj.getTime())) {
            return res.status(400).json({ error: 'Invalid date format' });
        }
        
        // Read existing transactions
        const fileContent = await fs.readFile(TRANSACTIONS_FILE, 'utf8');
        const transactions = JSON.parse(fileContent);
        
        // Create new transaction with unique ID (using timestamp + random)
        const newTransaction = {
            id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
            date: date,
            description: description.trim(),
            amount: amount
        };
        
        // Add to transactions array
        transactions.push(newTransaction);
        
        // Write back to file (atomic write: write to temp file, then rename)
        const tempFile = TRANSACTIONS_FILE + '.tmp';
        await fs.writeFile(tempFile, JSON.stringify(transactions, null, 2), 'utf8');
        await fs.rename(tempFile, TRANSACTIONS_FILE);
        
        // Return created transaction
        res.status(201).json(newTransaction);
        
    } catch (error) {
        console.error('Error creating transaction:', error);
        res.status(500).json({ 
            error: 'Failed to create transaction',
            message: error.message 
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Finance Tracker API is running' });
});

// Start server
async function startServer() {
    await initializeData();
    
    app.listen(PORT, () => {
        console.log(`Finance Tracker API server running on http://localhost:${PORT}`);
        console.log(`Serving static files from: ${path.join(__dirname, 'public')}`);
    });
}

startServer().catch(console.error);

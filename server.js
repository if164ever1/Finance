const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = 3000;
const DATA_DIR = path.join(__dirname, 'data');
const TRANSACTIONS_FILE = path.join(DATA_DIR, 'transactions.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const PRICES_FILE = path.join(DATA_DIR, 'prices.json');

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

        // Ensure settings.json exists
        await ensureSettingsFile();

        // Ensure prices.json exists
        await ensurePricesFile();
        
        console.log(`Data directory: ${DATA_DIR}`);
    } catch (error) {
        console.error('Error initializing data:', error);
    }
}

/**
 * Ensure settings.json exists, create with defaults if missing
 */
async function ensureSettingsFile() {
    try {
        await fs.access(SETTINGS_FILE);
    } catch {
        // File doesn't exist, create with defaults
        const defaults = {
            cashbackRate: 0.03,
            stakingAPR: 0.0473
        };
        await fs.writeFile(SETTINGS_FILE, JSON.stringify(defaults, null, 2), 'utf8');
        console.log('Created settings.json file with defaults');
    }
}

/**
 * Read settings from file, fallback to defaults if corrupted or missing fields
 */
async function readSettings() {
    const defaults = {
        cashbackRate: 0.03,
        stakingAPR: 0.0473
    };

    try {
        const fileContent = await fs.readFile(SETTINGS_FILE, 'utf8');
        const settings = JSON.parse(fileContent);

        // Merge with defaults for missing fields
        return {
            cashbackRate: typeof settings.cashbackRate === 'number' ? settings.cashbackRate : defaults.cashbackRate,
            stakingAPR: typeof settings.stakingAPR === 'number' ? settings.stakingAPR : defaults.stakingAPR
        };
    } catch (error) {
        // File missing or corrupted, return defaults and optionally rewrite
        console.warn('Settings file corrupted or missing, using defaults:', error.message);
        // Optionally rewrite safe defaults
        try {
            await fs.writeFile(SETTINGS_FILE, JSON.stringify(defaults, null, 2), 'utf8');
        } catch (writeError) {
            console.error('Failed to rewrite settings file:', writeError.message);
        }
        return defaults;
    }
}

/**
 * Ensure prices.json exists, create with empty sol object if missing
 */
async function ensurePricesFile() {
    try {
        await fs.access(PRICES_FILE);
    } catch {
        // File doesn't exist, create with empty structure
        const initial = { "sol": {} };
        await fs.writeFile(PRICES_FILE, JSON.stringify(initial, null, 2), 'utf8');
        console.log('Created prices.json file');
    }
}

/**
 * Read prices cache from file
 */
async function readPricesCache() {
    try {
        const fileContent = await fs.readFile(PRICES_FILE, 'utf8');
        return JSON.parse(fileContent);
    } catch (error) {
        // File missing or corrupted, return empty structure
        console.warn('Prices file corrupted or missing, using empty cache:', error.message);
        return { "sol": {} };
    }
}

/**
 * Write prices cache to file
 */
async function writePricesCache(cache) {
    try {
        await fs.writeFile(PRICES_FILE, JSON.stringify(cache, null, 2), 'utf8');
    } catch (error) {
        console.error('Failed to write prices cache:', error.message);
        throw error;
    }
}

/**
 * Validate if date string is in YYYY-MM-DD format
 */
function isValidISODate(dateString) {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateString)) return false;
    
    const date = new Date(dateString + 'T00:00:00');
    return date.toISOString().startsWith(dateString);
}

/**
 * Fetch SOL price from CoinGecko API for a specific date
 */
async function fetchSolPriceFromApi(dateString) {
    try {
        // Convert YYYY-MM-DD to DD-MM-YYYY for CoinGecko
        const [year, month, day] = dateString.split('-');
        const coingeckoDate = `${day}-${month}-${year}`;
        
        const url = `https://api.coingecko.com/api/v3/coins/solana/history?date=${coingeckoDate}&localization=false`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`CoinGecko API returned ${response.status}`);
        }
        
        const data = await response.json();
        const priceUSD = data.market_data?.current_price?.usd;
        
        if (typeof priceUSD !== 'number') {
            throw new Error('Invalid price data from API');
        }
        
        return priceUSD;
    } catch (error) {
        console.error('Error fetching SOL price from API:', error.message);
        throw error;
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
 * GET /api/price/sol?date=YYYY-MM-DD
 * Returns SOL price for the specified date, with caching
 */
app.get('/api/price/sol', async (req, res) => {
    try {
        const date = req.query.date;
        
        // Validate date format
        if (!date || !isValidISODate(date)) {
            return res.status(400).json({
                error: 'Invalid date format',
                message: 'Date must be in YYYY-MM-DD format'
            });
        }
        
        // Read prices cache
        const cache = await readPricesCache();
        
        // Check if price is cached
        if (cache.sol[date]) {
            return res.json({
                symbol: 'SOL',
                date: date,
                priceUSD: cache.sol[date],
                source: 'cache'
            });
        }
        
        // Fetch from API
        let priceUSD;
        try {
            priceUSD = await fetchSolPriceFromApi(date);
        } catch (apiError) {
            console.error('API fetch failed:', apiError.message);
            return res.status(502).json({
                error: 'External API error',
                message: 'Failed to fetch price from CoinGecko API'
            });
        }
        
        // Store in cache
        cache.sol[date] = priceUSD;
        await writePricesCache(cache);
        
        // Return response
        res.json({
            symbol: 'SOL',
            date: date,
            priceUSD: priceUSD,
            source: 'api'
        });
        
    } catch (error) {
        console.error('Error in price endpoint:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});

/**
 * Calculate cashback (rate * amount, rounded to 2 decimals)
 */
function calculateCashback(amount, rate) {
    return Math.round(amount * rate * 100) / 100;
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
 * GET /api/settings
 * Returns current settings (read-only)
 */
app.get('/api/settings', async (req, res) => {
    try {
        const settings = await readSettings();
        res.json(settings);
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ 
            error: 'Failed to fetch settings',
            message: error.message 
        });
    }
});

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
        
        // Read settings
        const settings = await readSettings();
        
        // Read transactions (gracefully handles missing/corrupted file)
        const allTransactions = await readTransactions();
        
        // Filter transactions for the requested month/year
        const monthTransactions = filterByMonth(allTransactions, year, month);
        
        // Calculate spending totals
        const totalSpent = monthTransactions.reduce((sum, t) => sum + t.amount, 0);
        
        // Calculate cashback using settings rate
        const cashbackRate = settings.cashbackRate;
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
        
        // Read settings
        const settings = await readSettings();
        
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
            const cashback = calculateCashback(transaction.amount, settings.cashbackRate);
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

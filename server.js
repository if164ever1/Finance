const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = 3000;
const DATA_DIR = path.join(__dirname, 'data');
const TRANSACTIONS_FILE = path.join(DATA_DIR, 'transactions.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const PRICES_FILE = path.join(DATA_DIR, 'prices.json');
const CATEGORIES_FILE = path.join(DATA_DIR, 'categories.json');

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
        
        // Ensure categories.json exists
        await ensureCategoriesFile();
        
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
 * Ensure categories.json exists, create with initial categories if missing
 */
async function ensureCategoriesFile() {
    try {
        await fs.access(CATEGORIES_FILE);
    } catch {
        const initial = {
            categories: [
                "Gymnastic",
                "AT&T",
                "Affirm",
                "State Farm",
                "Optimum",
                "Water Utility",
                "Grocery",
                "Others"
            ]
        };
        await fs.writeFile(CATEGORIES_FILE, JSON.stringify(initial, null, 2), 'utf8');
        console.log('Created categories.json file');
    }
}

/**
 * Read categories from file and return array of category strings
 * Always include 'Others' as a fallback option
 */
async function readCategories() {
    try {
        const fileContent = await fs.readFile(CATEGORIES_FILE, 'utf8');
        const data = JSON.parse(fileContent);
        const list = Array.isArray(data.categories) ? data.categories.slice() : [];
        if (!list.includes('Others')) list.push('Others');
        return list;
    } catch (error) {
        console.warn('Categories file missing or corrupted, using default list:', error.message);
        return ["Others"];
    }
}

/**
 * Write categories array to file (atomic)
 */
async function writeCategories(list) {
    const data = { categories: list };
    const tempFile = CATEGORIES_FILE + '.tmp';
    await fs.writeFile(tempFile, JSON.stringify(data, null, 2), 'utf8');
    await fs.rename(tempFile, CATEGORIES_FILE);
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
 * In-memory cache for live SOL price
 */
let livePriceCache = { price: null, timestamp: null };

/**
 * GET /api/price/sol/live
 * Returns current SOL price with timestamp and caching
 */
app.get('/api/price/sol/live', async (req, res) => {
    try {
        const now = Date.now();
        const cacheTTL = 15 * 60 * 1000; // 15 minutes
        
        // Check if we have a recent cached price
        if (livePriceCache.price && (now - livePriceCache.timestamp) < cacheTTL) {
            return res.json({
                symbol: 'SOL',
                priceUSD: livePriceCache.price,
                asOf: new Date(livePriceCache.timestamp).toISOString(),
                source: 'cache'
            });
        }
        
        // Fetch new price
        const today = new Date().toISOString().split('T')[0];
        let priceUSD;
        try {
            priceUSD = await fetchSolPriceFromApi(today);
        } catch (apiError) {
            // If API fails and no cache, return 502
            if (!livePriceCache.price) {
                return res.status(502).json({
                    error: 'External API error',
                    message: 'Failed to fetch SOL price and no cached value available'
                });
            }
            // Return stale cache if available
            return res.json({
                symbol: 'SOL',
                priceUSD: livePriceCache.price,
                asOf: new Date(livePriceCache.timestamp).toISOString(),
                source: 'stale-cache'
            });
        }
        
        // Update cache
        livePriceCache = { price: priceUSD, timestamp: now };
        
        res.json({
            symbol: 'SOL',
            priceUSD: priceUSD,
            asOf: new Date(now).toISOString(),
            source: 'api'
        });
        
    } catch (error) {
        console.error('Error in live price endpoint:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});

/**
 * Get SOL price for a specific date, using cache or fetching if needed
 */
async function getSolPriceForDate(dateString) {
    const cache = await readPricesCache();
    
    if (cache.sol[dateString]) {
        return cache.sol[dateString];
    }
    
    try {
        const price = await fetchSolPriceFromApi(dateString);
        cache.sol[dateString] = price;
        await writePricesCache(cache);
        return price;
    } catch (error) {
        console.warn(`Failed to fetch SOL price for ${dateString}:`, error.message);
        return null;
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

// GET /api/categories - list available categories
app.get('/api/categories', async (req, res) => {
    try {
        const categories = await readCategories();
        res.json({ categories });
    } catch (error) {
        console.error('Error reading categories:', error.message);
        res.status(500).json({ error: 'Failed to read categories' });
    }
});

/**
 * POST /api/categories
 * Body: { name: 'New Category' }
 */
app.post('/api/categories', async (req, res) => {
    try {
        const { name } = req.body;
        if (!name || typeof name !== 'string') {
            return res.status(400).json({ error: 'name is required and must be a string' });
        }

        const trimmed = name.trim();
        if (trimmed === '') {
            return res.status(400).json({ error: 'name must be a non-empty string' });
        }

        const categories = await readCategories();
        // Prevent duplicates (case-insensitive)
        if (categories.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
            return res.status(409).json({ error: 'Category already exists' });
        }

        categories.push(trimmed);
        await writeCategories(categories);
        res.json({ categories });
    } catch (error) {
        console.error('Error adding category:', error.message);
        res.status(500).json({ error: 'Failed to add category' });
    }
});

/**
 * DELETE /api/categories/:name
 */
app.delete('/api/categories/:name', async (req, res) => {
    try {
        const raw = req.params.name || '';
        const name = decodeURIComponent(raw).trim();
        if (!name) return res.status(400).json({ error: 'Invalid category name' });

        if (name.toLowerCase() === 'others') {
            return res.status(400).json({ error: 'Cannot delete Others' });
        }

        const categories = await readCategories();
        const idx = categories.findIndex(c => c.toLowerCase() === name.toLowerCase());
        if (idx === -1) return res.status(404).json({ error: 'Category not found' });

        // Check if any transaction uses this category (case-insensitive)
        try {
            const fileContent = await fs.readFile(TRANSACTIONS_FILE, 'utf8');
            const transactions = JSON.parse(fileContent);
            const inUse = transactions.some(t => (t.category || '').toLowerCase() === name.toLowerCase());
            if (inUse) {
                return res.status(409).json({ error: 'Category is in use', category: name });
            }
        } catch (readErr) {
            console.warn('Failed to read transactions while deleting category:', readErr.message);
            // If transactions file can't be read, be conservative and block deletion to avoid data loss
            return res.status(500).json({ error: 'Failed to verify category usage' });
        }

        // Remove and write
        categories.splice(idx, 1);
        await writeCategories(categories);
        res.json({ categories });
    } catch (error) {
        console.error('Error deleting category:', error.message);
        res.status(500).json({ error: 'Failed to delete category' });
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
        
        // Calculate SOL simulation
        let solTotalCashbackUSD = 0;
        let solTotalSOL = 0;
        let solSkipped = 0;
        
        for (const transaction of monthTransactions) {
            const cashbackUSD = moneyRound(transaction.amount * cashbackRate);
            solTotalCashbackUSD += cashbackUSD;
            
            const priceUSD = await getSolPriceForDate(transaction.date);
            if (priceUSD !== null) {
                const solBought = cashbackUSD / priceUSD;
                solTotalSOL += solBought;
            } else {
                solSkipped++;
            }
        }
        
        const solAvgPriceUSD = solTotalSOL > 0 ? moneyRound(solTotalCashbackUSD / solTotalSOL) : null;
        
        // Calculate staking estimates
        const stakingAPR = settings.stakingAPR;
        const stakedSOL = Number(solTotalSOL.toFixed(6));
        const estMonthlyRewardSOL = Number((stakedSOL * (stakingAPR / 12)).toFixed(6));
        const estYearlyRewardSOL = Number((stakedSOL * stakingAPR).toFixed(6));
        
        // Calculate cumulative staking earnings to date
        const asOfDate = new Date().toISOString().split('T')[0];
        let earnedSOL = 0;
        let skippedToDate = 0;
        const asOfDateObj = new Date(asOfDate + 'T00:00:00');
        
        for (const transaction of allTransactions) {
            const transactionDateObj = new Date(transaction.date + 'T00:00:00');
            if (transactionDateObj > asOfDateObj) continue; // future transaction, skip
            
            const cashbackUSD = moneyRound(transaction.amount * cashbackRate);
            const purchasePriceUSD = await getSolPriceForDate(transaction.date);
            if (purchasePriceUSD === null) {
                skippedToDate++;
                continue;
            }
            
            const solBought = cashbackUSD / purchasePriceUSD;
            const daysStaked = Math.max(0, Math.floor((asOfDateObj - transactionDateObj) / (1000 * 60 * 60 * 24)));
            const earnedFromThis = solBought * stakingAPR * (daysStaked / 365);
            earnedSOL += earnedFromThis;
        }
        
        const todayPriceUSD = await getSolPriceForDate(asOfDate);
        const earnedUSD = todayPriceUSD !== null ? moneyRound(earnedSOL * todayPriceUSD) : 0;
        
        // Build response
        const response = {
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
            },
            sol: {
                method: "simulation",
                totalCashbackUSD: moneyRound(solTotalCashbackUSD),
                totalSOL: stakedSOL,
                avgPriceUSD: solAvgPriceUSD
            },
            staking: {
                apr: stakingAPR,
                stakedSOL: stakedSOL,
                estMonthlyRewardSOL: estMonthlyRewardSOL,
                estYearlyRewardSOL: estYearlyRewardSOL
            },
            stakingToDate: {
                asOf: asOfDate,
                earnedSOL: Number(earnedSOL.toFixed(6)),
                earnedUSD: earnedUSD,
                apr: stakingAPR,
                priceUSD: todayPriceUSD !== null ? moneyRound(todayPriceUSD) : null
            }
        };
        
        if (solSkipped > 0) {
            response.sol.skipped = solSkipped;
        }
        if (skippedToDate > 0) {
            response.stakingToDate.skipped = skippedToDate;
        }
        
        res.json(response);
        
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
                category: transaction.category || 'Uncategorized',
                amount: transaction.amount,
                cashback: cashback
            };
        });
        
        // Round totals to 2 decimals
        totals.spent = Math.round(totals.spent * 100) / 100;
        totals.cashback = Math.round(totals.cashback * 100) / 100;
        
        // Calculate category summary
        const categorySummary = {};
        monthTransactions.forEach(transaction => {
            const category = transaction.category || 'Uncategorized';
            if (!categorySummary[category]) {
                categorySummary[category] = 0;
            }
            categorySummary[category] += transaction.amount;
        });
        
        // Round category totals to 2 decimals
        Object.keys(categorySummary).forEach(category => {
            categorySummary[category] = Math.round(categorySummary[category] * 100) / 100;
        });
        
        // Return response
        res.json({
            year: year,
            month: month,
            label: `${getMonthName(month)} ${year}`,
            totals: totals,
            categorySummary: categorySummary,
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
        const { date, description, category, amount } = req.body;
        
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
        
        // Validate category (optional, defaults to "Uncategorized")
        const validCategory = (category && typeof category === 'string' && category.trim() !== '') 
            ? category.trim() 
            : 'Uncategorized';
        
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
            category: validCategory,
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

/**
 * DELETE /api/transactions/:id
 * Deletes a transaction by ID
 */
app.delete('/api/transactions/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Read existing transactions
        const fileContent = await fs.readFile(TRANSACTIONS_FILE, 'utf8');
        const transactions = JSON.parse(fileContent);
        
        // Find and remove the transaction
        const index = transactions.findIndex(t => t.id === id);
        if (index === -1) {
            return res.status(404).json({ error: 'Transaction not found' });
        }
        
        transactions.splice(index, 1);
        
        // Write back to file
        const tempFile = TRANSACTIONS_FILE + '.tmp';
        await fs.writeFile(tempFile, JSON.stringify(transactions, null, 2), 'utf8');
        await fs.rename(tempFile, TRANSACTIONS_FILE);
        
        // Return success
        res.json({ ok: true, deletedId: id });
        
    } catch (error) {
        console.error('Error deleting transaction:', error);
        res.status(500).json({ 
            error: 'Failed to delete transaction',
            message: error.message 
        });
    }
});

// Export endpoints
app.get('/api/export/transactions.csv', async (req, res) => {
    try {
        let transactions = [];
        try {
            const fileContent = await fs.readFile(TRANSACTIONS_FILE, 'utf8');
            transactions = JSON.parse(fileContent);
        } catch (error) {
            // If file doesn't exist or is corrupted, use empty array
            console.warn('Transactions file missing or corrupted for export, using empty array:', error.message);
        }

        // Convert to CSV
        const csvHeader = 'id,date,description,amount\n';
        const csvRows = transactions.map(transaction => {
            const id = escapeCsvField(transaction.id || '');
            const date = escapeCsvField(transaction.date || '');
            const description = escapeCsvField(transaction.description || '');
            const amount = escapeCsvField(transaction.amount || '');
            return `${id},${date},${description},${amount}`;
        }).join('\n');
        
        const csvContent = csvHeader + csvRows;

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="transactions.csv"');
        res.send(csvContent);
    } catch (error) {
        console.error('Error exporting transactions to CSV:', error);
        res.status(500).json({ error: 'Failed to export transactions' });
    }
});

app.get('/api/export/transactions.json', async (req, res) => {
    try {
        let fileContent = '[]'; // Default empty array
        try {
            fileContent = await fs.readFile(TRANSACTIONS_FILE, 'utf8');
            // Validate it's valid JSON
            JSON.parse(fileContent);
        } catch (error) {
            console.warn('Transactions file missing or corrupted for JSON export, using empty array:', error.message);
        }

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="transactions.json"');
        res.send(fileContent);
    } catch (error) {
        console.error('Error exporting transactions to JSON:', error);
        res.status(500).json({ error: 'Failed to export transactions' });
    }
});

/**
 * Escape a field for CSV format
 */
function escapeCsvField(field) {
    const stringField = String(field);
    // If field contains comma, quote, or newline, wrap in quotes and escape internal quotes
    if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n') || stringField.includes('\r')) {
        return '"' + stringField.replace(/"/g, '""') + '"';
    }
    return stringField;
}

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

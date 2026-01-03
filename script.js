// Store transactions in an array
let transactions = [];

// Cache DOM elements for better performance
const purchaseAmountInput = document.getElementById('purchaseAmount');
const purchaseDateInput = document.getElementById('purchaseDate');
const addPurchaseBtn = document.getElementById('addPurchaseBtn');
const totalSpentElement = document.getElementById('totalSpent');
const totalCashbackElement = document.getElementById('totalCashback');
const transactionsList = document.getElementById('transactionsList');

// Set default date to today
const today = new Date();
const todayFormatted = today.toISOString().split('T')[0]; // Format: YYYY-MM-DD
purchaseDateInput.value = todayFormatted;

// Calculate cashback at 3% rate
function calculateCashback(amount) {
    return amount * 0.03;
}

// Calculate total spent from all transactions
function calculateTotalSpent() {
    return transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
}

// Calculate total cashback from all transactions
function calculateTotalCashback() {
    return transactions.reduce((sum, transaction) => sum + transaction.cashback, 0);
}

// Format currency to display with $ and 2 decimal places
function formatCurrency(amount) {
    return '$' + amount.toFixed(2);
}

// Update the stats display (total spent and total cashback)
function updateStats() {
    const totalSpent = calculateTotalSpent();
    const totalCashback = calculateTotalCashback();
    
    totalSpentElement.textContent = formatCurrency(totalSpent);
    totalCashbackElement.textContent = formatCurrency(totalCashback);
}

// Render all transactions in the list
function renderTransactions() {
    // Clear existing list
    transactionsList.innerHTML = '';

    // If no transactions, show empty state
    if (transactions.length === 0) {
        const emptyState = document.createElement('li');
        emptyState.className = 'empty-state';
        emptyState.textContent = 'No transactions yet. Add a purchase to get started.';
        transactionsList.appendChild(emptyState);
        return;
    }

    // Create list items for each transaction
    transactions.forEach(transaction => {
        const listItem = document.createElement('li');
        listItem.className = 'transaction-item';
        
        // Create container for transaction details
        const detailsDiv = document.createElement('div');
        detailsDiv.className = 'transaction-details';
        
        const amountSpan = document.createElement('span');
        amountSpan.className = 'transaction-amount';
        amountSpan.textContent = formatCurrency(transaction.amount);
        
        // Add arrow separator
        const arrow1 = document.createTextNode(' → ');
        
        const cashbackSpan = document.createElement('span');
        cashbackSpan.className = 'transaction-cashback';
        cashbackSpan.textContent = 'Cashback: ' + formatCurrency(transaction.cashback);
        
        // Add arrow separator
        const arrow2 = document.createTextNode(' → ');
        
        const dateSpan = document.createElement('span');
        dateSpan.className = 'transaction-date';
        dateSpan.textContent = 'Date: ' + transaction.date;
        
        detailsDiv.appendChild(amountSpan);
        detailsDiv.appendChild(arrow1);
        detailsDiv.appendChild(cashbackSpan);
        detailsDiv.appendChild(arrow2);
        detailsDiv.appendChild(dateSpan);
        
        listItem.appendChild(detailsDiv);
        transactionsList.appendChild(listItem);
    });
}

// Add a new purchase transaction
function addPurchase() {
    // Get and parse the input value
    const inputValue = purchaseAmountInput.value.trim();
    const amount = parseFloat(inputValue);

    // Validate input: check if empty, not a number, or negative
    if (inputValue === '' || isNaN(amount) || amount <= 0) {
        alert('Please enter a valid positive amount.');
        return;
    }

    // Get and validate the date
    const date = purchaseDateInput.value;
    if (!date) {
        alert('Please select a purchase date.');
        return;
    }

    // Calculate cashback for this purchase
    const cashback = calculateCashback(amount);

    // Create transaction object with amount, cashback, and date
    const transaction = {
        amount: amount,
        cashback: cashback,
        date: date // Store date in YYYY-MM-DD format
    };
    
    transactions.push(transaction);

    // Clear the amount input field (keep date as default for next entry)
    purchaseAmountInput.value = '';

    // Update the UI
    updateStats();
    renderTransactions();
}

// Event listener for the Add Purchase button
addPurchaseBtn.addEventListener('click', addPurchase);

// Allow adding purchase with Enter key
purchaseAmountInput.addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        addPurchase();
    }
});


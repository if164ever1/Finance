// Store transactions in an array
let transactions = [];

// Cache DOM elements for better performance
const purchaseDescriptionInput = document.getElementById('purchaseDescription');
const purchaseAmountInput = document.getElementById('purchaseAmount');
const cashbackAmountInput = document.getElementById('cashbackAmount');
const purchaseDateInput = document.getElementById('purchaseDate');
const addPurchaseBtn = document.getElementById('addPurchaseBtn');
const totalSpentElement = document.getElementById('totalSpent');
const totalCashbackElement = document.getElementById('totalCashback');
const transactionsList = document.getElementById('transactionsList');

// Set default date to today
const today = new Date();
const todayFormatted = today.toISOString().split('T')[0]; // Format: YYYY-MM-DD
purchaseDateInput.value = todayFormatted;

// Update cashback field live as user types the amount
purchaseAmountInput.addEventListener('input', function() {
    const inputValue = this.value.trim();
    const amount = parseFloat(inputValue);
    
    // Calculate and display cashback if amount is valid, otherwise show $0.00
    if (inputValue !== '' && !isNaN(amount) && amount > 0) {
        const cashback = calculateCashback(amount);
        cashbackAmountInput.value = formatCurrency(cashback);
    } else {
        cashbackAmountInput.value = '$0.00';
    }
});

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
        
        // Display description first
        const descriptionSpan = document.createElement('span');
        descriptionSpan.className = 'transaction-description';
        descriptionSpan.textContent = transaction.description;
        
        // Add arrow separator
        const arrow1 = document.createTextNode(' — ');
        
        const amountSpan = document.createElement('span');
        amountSpan.className = 'transaction-amount';
        amountSpan.textContent = formatCurrency(transaction.amount);
        
        // Add arrow separator
        const arrow2 = document.createTextNode(' → ');
        
        const cashbackSpan = document.createElement('span');
        cashbackSpan.className = 'transaction-cashback';
        cashbackSpan.textContent = 'Cashback: ' + formatCurrency(transaction.cashback);
        
        // Add arrow separator
        const arrow3 = document.createTextNode(' → ');
        
        const dateSpan = document.createElement('span');
        dateSpan.className = 'transaction-date';
        dateSpan.textContent = 'Date: ' + transaction.date;
        
        detailsDiv.appendChild(descriptionSpan);
        detailsDiv.appendChild(arrow1);
        detailsDiv.appendChild(amountSpan);
        detailsDiv.appendChild(arrow2);
        detailsDiv.appendChild(cashbackSpan);
        detailsDiv.appendChild(arrow3);
        detailsDiv.appendChild(dateSpan);
        
        listItem.appendChild(detailsDiv);
        transactionsList.appendChild(listItem);
    });
}

// Show error message (small, non-intrusive)
function showError(message) {
    // Remove existing error message if any
    const existingError = document.querySelector('.error-message');
    if (existingError) {
        existingError.remove();
    }

    // Create error message element
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    errorDiv.style.cssText = 'color: #f44336; background-color: #ffebee; padding: 10px; border-radius: 4px; margin-top: 10px; font-size: 14px;';
    
    // Insert after the Add Purchase button
    addPurchaseBtn.parentNode.insertBefore(errorDiv, addPurchaseBtn.nextSibling);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.remove();
        }
    }, 5000);
}

// Add a new purchase transaction
async function addPurchase() {
    // Get and validate description
    const description = purchaseDescriptionInput.value.trim();
    if (description === '') {
        alert('Please enter a purchase description.');
        return;
    }

    // Get and parse the amount input value
    const inputValue = purchaseAmountInput.value.trim();
    const amount = parseFloat(inputValue);

    // Validate amount: check if empty, not a number, or negative
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

    // Calculate cashback for this purchase (already calculated in the field, but recalculate to ensure accuracy)
    const cashback = calculateCashback(amount);

    // Send data to backend API
    try {
        const response = await fetch('http://localhost:3000/api/purchase', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                paymentType: description, // The description field is used as paymentType
                amount: amount,
                date: date
            })
        });

        const result = await response.json();

        if (!response.ok) {
            // Backend returned an error
            showError(`Error: ${result.error || 'Failed to save purchase'}`);
            return;
        }

        // Backend save successful, now update the UI
        // Create transaction object with description, amount, cashback, and date
        const transaction = {
            description: description,
            amount: amount,
            cashback: cashback,
            date: date // Store date in YYYY-MM-DD format
        };
        
        transactions.push(transaction);

        // Clear the input fields (description and amount, reset cashback to $0.00, keep date as default for next entry)
        purchaseDescriptionInput.value = '';
        purchaseAmountInput.value = '';
        cashbackAmountInput.value = '$0.00';

        // Update the UI
        updateStats();
        renderTransactions();

    } catch (error) {
        // Network error or fetch failed
        console.error('Error calling backend API:', error);
        showError('Failed to connect to server. Please make sure the backend is running.');
    }
}

// Event listener for the Add Purchase button
addPurchaseBtn.addEventListener('click', addPurchase);

// Allow adding purchase with Enter key from description or amount field
purchaseDescriptionInput.addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        addPurchase();
    }
});

purchaseAmountInput.addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        addPurchase();
    }
});


// Cache DOM elements for performance
const purchaseDescriptionInput = document.getElementById('purchaseDescription');
const purchaseAmountInput = document.getElementById('purchaseAmount');
const cashbackAmountInput = document.getElementById('cashbackAmount');
const purchaseDateInput = document.getElementById('purchaseDate');
const addPurchaseBtn = document.getElementById('addPurchaseBtn');

// Monthly dashboard elements
const monthlyLabel = document.getElementById('monthlyLabel');
const monthlyCount = document.getElementById('monthlyCount');
const monthlySpent = document.getElementById('monthlySpent');
const monthlyCashback = document.getElementById('monthlyCashback');
const monthlyTableBody = document.getElementById('monthlyTableBody');

// Set default date to today
const today = new Date();
const todayFormatted = today.toISOString().split('T')[0];
purchaseDateInput.value = todayFormatted;

// Update cashback field live as user types the amount
purchaseAmountInput.addEventListener('input', function() {
    const inputValue = this.value.trim();
    const amount = parseFloat(inputValue);
    
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

// Format currency to display with $ and 2 decimal places
function formatCurrency(amount) {
    return '$' + amount.toFixed(2);
}

// Format date from YYYY-MM-DD to MM/DD/YYYY for display
function formatDate(dateString) {
    const date = new Date(dateString + 'T00:00:00');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
}

// Fetch and render monthly data
async function loadMonthlyData() {
    try {
        const response = await fetch('/api/monthly');
        if (!response.ok) {
            throw new Error('Failed to load monthly data');
        }
        
        const data = await response.json();
        renderMonthlyData(data);
    } catch (error) {
        console.error('Error loading monthly data:', error);
        monthlyLabel.textContent = 'Error loading data';
        monthlyTableBody.innerHTML = '<tr><td colspan="4" class="empty-state">Failed to load monthly data</td></tr>';
    }
}

// Render monthly data to the dashboard
function renderMonthlyData(data) {
    // Update label
    monthlyLabel.textContent = data.label;
    
    // Update totals
    monthlyCount.textContent = data.totals.count;
    monthlySpent.textContent = formatCurrency(data.totals.spent);
    monthlyCashback.textContent = formatCurrency(data.totals.cashback);
    
    // Render table
    if (data.transactions.length === 0) {
        monthlyTableBody.innerHTML = '<tr><td colspan="4" class="empty-state">No transactions for this month yet.</td></tr>';
    } else {
        monthlyTableBody.innerHTML = data.transactions.map(transaction => `
            <tr>
                <td>${formatDate(transaction.date)}</td>
                <td>${escapeHtml(transaction.description)}</td>
                <td>${formatCurrency(transaction.amount)}</td>
                <td class="cashback-cell">${formatCurrency(transaction.cashback)}</td>
            </tr>
        `).join('');
    }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Show error message
function showError(message) {
    const existingError = document.querySelector('.error-message');
    if (existingError) {
        existingError.remove();
    }

    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    errorDiv.style.cssText = 'color: #f44336; background-color: #ffebee; padding: 10px; border-radius: 4px; margin-top: 10px; font-size: 14px;';
    
    addPurchaseBtn.parentNode.insertBefore(errorDiv, addPurchaseBtn.nextSibling);
    
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

    // Get and parse the amount
    const inputValue = purchaseAmountInput.value.trim();
    const amount = parseFloat(inputValue);

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

    // Send data to backend API
    try {
        const response = await fetch('/api/transactions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                date: date,
                description: description,
                amount: amount
            })
        });

        const result = await response.json();

        if (!response.ok) {
            showError(`Error: ${result.error || 'Failed to save purchase'}`);
            return;
        }

        // Clear the input fields
        purchaseDescriptionInput.value = '';
        purchaseAmountInput.value = '';
        cashbackAmountInput.value = '$0.00';

        // Reload monthly data to show the new transaction
        await loadMonthlyData();

    } catch (error) {
        console.error('Error calling backend API:', error);
        showError('Failed to connect to server. Please make sure the backend is running.');
    }
}

// Event listeners
addPurchaseBtn.addEventListener('click', addPurchase);

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

// Load monthly data when page loads
loadMonthlyData();

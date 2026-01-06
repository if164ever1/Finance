// Cache DOM elements for performance
const purchaseDescriptionInput = document.getElementById('purchaseDescription');
const purchaseAmountInput = document.getElementById('purchaseAmount');
const cashbackAmountInput = document.getElementById('cashbackAmount');
const purchaseDateInput = document.getElementById('purchaseDate');
const purchaseCategorySelect = document.getElementById('purchaseCategory');
const addPurchaseBtn = document.getElementById('addPurchaseBtn');

// Monthly dashboard elements
const monthlyLabel = document.getElementById('monthlyLabel');
const monthlyCount = document.getElementById('monthlyCount');
const monthlySpent = document.getElementById('monthlySpent');
const monthlyCashback = document.getElementById('monthlyCashback');
const monthlyTableBody = document.getElementById('monthlyTableBody');

// Period selector elements
const monthSelector = document.getElementById('monthSelector');
const yearSelector = document.getElementById('yearSelector');

// Export button elements
const downloadCsvBtn = document.getElementById('downloadCsvBtn');
const downloadJsonBtn = document.getElementById('downloadJsonBtn');

// Selected period state
let selectedPeriod = {
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1
};

// Active category for pie chart highlighting
let activeCategory = null;

// Initialize period selectors
function initializePeriodSelectors() {
    // Populate year selector: current year ±5
    const currentYear = new Date().getFullYear();
    yearSelector.innerHTML = '';
    for (let year = currentYear - 5; year <= currentYear + 5; year++) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearSelector.appendChild(option);
    }
    
    // Set default values
    monthSelector.value = selectedPeriod.month;
    yearSelector.value = selectedPeriod.year;
    
    // Add event listeners
    monthSelector.addEventListener('change', () => {
        selectedPeriod.month = parseInt(monthSelector.value);
        activeCategory = null; // Reset active category when period changes
        refreshForSelectedPeriod();
    });
    
    yearSelector.addEventListener('change', () => {
        selectedPeriod.year = parseInt(yearSelector.value);
        activeCategory = null; // Reset active category when period changes
        refreshForSelectedPeriod();
    });
}

// Initialize export button event listeners
function initializeExportButtons() {
    downloadCsvBtn.addEventListener('click', () => {
        const link = document.createElement('a');
        link.href = '/api/export/transactions.csv';
        link.download = 'transactions.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    downloadJsonBtn.addEventListener('click', () => {
        const link = document.createElement('a');
        link.href = '/api/export/transactions.json';
        link.download = 'transactions.json';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
}

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
async function loadMonthly(period = selectedPeriod) {
    try {        // Show loading state
        monthlyLabel.textContent = 'Loading...';
        monthlyCount.textContent = '0';
        monthlySpent.textContent = '$0.00';
        monthlyCashback.textContent = '$0.00';
        document.getElementById('categorySummaryContent').innerHTML = '<div class="category-summary-empty">Loading...</div>';
        monthlyTableBody.innerHTML = '<tr><td colspan="6" class="empty-state">Loading...</td></tr>';
                const url = `/api/monthly?year=${period.year}&month=${period.month}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Failed to load monthly data');
        }
        
        const data = await response.json();
        renderMonthlyData(data);
    } catch (error) {
        console.error('Error loading monthly data:', error);
        monthlyLabel.textContent = 'Error loading data';
        document.getElementById('categorySummaryContent').innerHTML = '<div class="category-summary-empty">Error loading category data</div>';
        monthlyTableBody.innerHTML = '<tr><td colspan="6" class="empty-state">Failed to load monthly data</td></tr>';
    }
}

// Render category summary
function renderCategorySummary(categorySummary) {
    const content = document.getElementById('categorySummaryContent');
    
    if (!categorySummary || Object.keys(categorySummary).length === 0) {
        content.innerHTML = '<div class="category-summary-empty">No category data for this month.</div>';
        return;
    }
    
    // Sort categories by total descending
    const sortedCategories = Object.entries(categorySummary)
        .sort(([,a], [,b]) => b - a)
        .map(([category, amount]) => `
            <div class="category-summary-item">
                <span class="category-summary-category">${escapeHtml(category)}</span>
                <span class="category-summary-amount">${formatCurrency(amount)}</span>
            </div>
        `).join('');
    
    content.innerHTML = sortedCategories;
}

// Draw category pie chart
function drawCategoryPieChart(categorySummary) {
    const canvas = document.getElementById('categoryPieChart');
    const ctx = canvas.getContext('2d');
    const legendElement = document.getElementById('categoryPieLegend');
    
    // Handle retina displays
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;
    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    ctx.scale(dpr, dpr);
    
    // Clear canvas
    ctx.clearRect(0, 0, displayWidth, displayHeight);
    
    // Clear legend
    legendElement.innerHTML = '';
    
    // Check if we have data
    if (!categorySummary || Object.keys(categorySummary).length === 0) {
        // Draw "No category data" text on canvas
        ctx.fillStyle = '#999';
        ctx.font = '16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('No category data', displayWidth / 2, displayHeight / 2);
        
        // Show empty legend message
        legendElement.innerHTML = '<div class="legend-empty">No categories to display.</div>';
        return;
    }
    
    // Convert to array and sort by value descending
    const data = Object.entries(categorySummary)
        .sort(([,a], [,b]) => b - a)
        .map(([name, value]) => ({ name, value }));
    
    // Calculate total
    const total = data.reduce((sum, item) => sum + item.value, 0);
    
    if (total === 0) {
        // Draw "No category data" text on canvas
        ctx.fillStyle = '#999';
        ctx.font = '16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('No category data', displayWidth / 2, displayHeight / 2);
        
        // Show empty legend message
        legendElement.innerHTML = '<div class="legend-empty">No categories to display.</div>';
        return;
    }
    
    // Pie chart settings
    const centerX = displayWidth / 2;
    const centerY = displayHeight / 2;
    const radius = Math.min(displayWidth, displayHeight) / 2 - 20; // padding
    
    let currentAngle = -Math.PI / 2; // Start at top
    
    // Draw pie slices and build legend
    const legendItems = [];
    
    // First pass: draw all slices (inactive ones with reduced opacity if there's an active category)
    data.forEach((item, index) => {
        const sliceAngle = (item.value / total) * 2 * Math.PI;
        const midAngle = currentAngle + sliceAngle / 2;
        
        // Generate color using HSL
        const hue = (index * 55) % 360;
        const color = `hsl(${hue}, 65%, 55%)`;
        
        // Calculate slice center for highlighting
        const sliceCenterX = centerX;
        const sliceCenterY = centerY;
        
        // Check if this slice should be highlighted
        const isActive = item.name === activeCategory;
        if (isActive) {
            // Offset active slice
            const offset = 8;
            const dx = Math.cos(midAngle) * offset;
            const dy = Math.sin(midAngle) * offset;
            sliceCenterX += dx;
            sliceCenterY += dy;
        }
        
        // Set opacity for inactive slices when there's an active category
        if (activeCategory && !isActive) {
            ctx.globalAlpha = 0.25;
        } else {
            ctx.globalAlpha = 1.0;
        }
        
        // Draw slice
        ctx.beginPath();
        ctx.moveTo(sliceCenterX, sliceCenterY);
        ctx.arc(sliceCenterX, sliceCenterY, radius, currentAngle, currentAngle + sliceAngle);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        
        // Add white border between slices
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Calculate percentage
        const percentage = (item.value / total) * 100;
        
        // Build legend item
        const isLegendActive = item.name === activeCategory;
        legendItems.push(`
            <div class="legend-item ${isLegendActive ? 'active' : ''}" data-category="${escapeHtml(item.name)}">
                <div class="legend-color" style="background-color: ${color}"></div>
                <div class="legend-name">${escapeHtml(item.name)}</div>
                <div class="legend-values">
                    <div class="legend-amount">${formatCurrency(item.value)}</div>
                    <div class="legend-percent">${percentage.toFixed(1)}%</div>
                </div>
            </div>
        `);
        
        currentAngle += sliceAngle;
    });
    
    // Reset global alpha
    ctx.globalAlpha = 1.0;
    
    // Render legend
    legendElement.innerHTML = legendItems.join('');
    
    // Add click handlers to legend items
    const legendItemsElements = legendElement.querySelectorAll('.legend-item');
    legendItemsElements.forEach(item => {
        item.addEventListener('click', () => {
            const categoryName = item.getAttribute('data-category');
            activeCategory = activeCategory === categoryName ? null : categoryName;
            drawCategoryPieChart(categorySummary);
        });
    });
}

// Render monthly data to the dashboard
function renderMonthlyData(data) {
    // Update label
    monthlyLabel.textContent = data.label;
    
    // Update totals
    monthlyCount.textContent = data.totals.count;
    monthlySpent.textContent = formatCurrency(data.totals.spent);
    monthlyCashback.textContent = formatCurrency(data.totals.cashback);
    
    // Render category summary
    renderCategorySummary(data.categorySummary);
    
    // Draw category pie chart
    drawCategoryPieChart(data.categorySummary);
    
    // Render table
    if (data.transactions.length === 0) {
        monthlyTableBody.innerHTML = '<tr><td colspan="6" class="empty-state">No transactions for this month yet.</td></tr>';
    } else {
        monthlyTableBody.innerHTML = data.transactions.map(transaction => `
            <tr>
                <td>${formatDate(transaction.date)}</td>
                <td>${escapeHtml(transaction.description)}</td>
                <td>${escapeHtml(transaction.category || 'Uncategorized')}</td>
                <td>${formatCurrency(transaction.amount)}</td>
                <td class="cashback-cell">${formatCurrency(transaction.cashback)}</td>
                <td class="actions-cell">
                    <button class="delete-btn" data-id="${transaction.id}" title="Delete transaction">🗑️</button>
                </td>
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

    // Get category (default to "Uncategorized" if not selected)
    const category = purchaseCategorySelect.value || 'Uncategorized';

    // Disable button and show saving state
    addPurchaseBtn.disabled = true;
    addPurchaseBtn.textContent = 'Saving...';

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
                category: category,
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
        purchaseCategorySelect.value = 'Uncategorized'; // Reset to default
        cashbackAmountInput.value = '$0.00';

        // Reload both monthly (current month) and dashboard (selected period) data
        await Promise.all([loadMonthly(), loadDashboard()]);

    } catch (error) {
        console.error('Error calling backend API:', error);
        showError('Failed to connect to server. Please make sure the backend is running.');
    } finally {
        // Re-enable button and reset text
        addPurchaseBtn.disabled = false;
        addPurchaseBtn.textContent = 'Add Purchase';
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

// Event delegation for delete buttons
monthlyTableBody.addEventListener('click', async function(event) {
    if (event.target.classList.contains('delete-btn')) {
        const id = event.target.dataset.id;
        if (confirm('Delete this transaction?')) {
            try {
                event.target.disabled = true;
                event.target.textContent = 'Deleting...';
                
                const response = await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
                if (!response.ok) throw new Error('Delete failed');
                
                // Refresh data
                await refreshForSelectedPeriod();
            } catch (error) {
                console.error('Error deleting transaction:', error);
                alert('Failed to delete transaction. Please try again.');
                event.target.disabled = false;
                event.target.textContent = '🗑️';
            }
        }
    }
});

// Dashboard panel elements
const dashboardMonthLabel = document.getElementById('dashboardMonthLabel');
const dashboardCount = document.getElementById('dashboardCount');
const dashboardSpent = document.getElementById('dashboardSpent');
const dashboardCashback = document.getElementById('dashboardCashback');
const dashboardRate = document.getElementById('dashboardRate');
const dashboardSolPurchased = document.getElementById('dashboardSolPurchased');
const dashboardStakingMonthly = document.getElementById('dashboardStakingMonthly');
const dashboardStakingSubtext = document.getElementById('dashboardStakingSubtext');
const dashboardStakingEarned = document.getElementById('dashboardStakingEarned');
const dashboardStakingEarnedSubtext = document.getElementById('dashboardStakingEarnedSubtext');
const solPriceBadge = document.getElementById('solPriceBadge');
const solPriceTime = document.getElementById('solPriceTime');

// Fetch and render dashboard data
async function loadDashboard(period = selectedPeriod) {
    try {
        // Show loading state
        dashboardMonthLabel.textContent = 'Loading dashboard...';
        dashboardCount.textContent = '-';
        dashboardSpent.textContent = '-';
        dashboardCashback.textContent = '-';
        dashboardSolPurchased.textContent = '- SOL';
        dashboardStakingMonthly.textContent = 'Monthly: - SOL';
        dashboardStakingSubtext.textContent = 'Yearly: - SOL • APR: -%';
        dashboardStakingEarned.textContent = '$-';
        dashboardStakingEarnedSubtext.textContent = '~- SOL • As of -';
        
        const url = `/api/dashboard?year=${period.year}&month=${period.month}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Failed to load dashboard data');
        }
        
        const data = await response.json();
        renderDashboardData(data);
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        dashboardMonthLabel.textContent = 'Error loading dashboard';
        dashboardCount.textContent = 'Error';
        dashboardSpent.textContent = 'Error';
        dashboardCashback.textContent = 'Error';
        dashboardRate.textContent = '';
        dashboardSolPurchased.textContent = 'Error';
        dashboardStakingMonthly.textContent = 'Error';
        dashboardStakingSubtext.textContent = 'Error';
        dashboardStakingEarned.textContent = 'Error';
        dashboardStakingEarnedSubtext.textContent = 'Error';
    }
}

// Refresh both monthly and dashboard for the selected period
async function refreshForSelectedPeriod() {
    await Promise.all([loadMonthly(selectedPeriod), loadDashboard(selectedPeriod)]);
}

// Render dashboard data to the right panel
function renderDashboardData(data) {
    // Update month label
    dashboardMonthLabel.textContent = data.period.label;
    
    // Update stat values
    dashboardCount.textContent = data.spending.count;
    dashboardSpent.textContent = formatCurrency(data.spending.totalSpent);
    dashboardCashback.textContent = formatCurrency(data.cashback.totalCashbackUSD);
    
    // Update cashback rate (convert 0.03 to percentage)
    const ratePercent = (data.cashback.rate * 100).toFixed(0);
    dashboardRate.textContent = `Rate: ${ratePercent}%`;
    
    // Update SOL purchased
    dashboardSolPurchased.textContent = `${data.sol.totalSOL.toFixed(6)} SOL`;
    
    // Update staking estimates
    if (data.staking) {
        dashboardStakingMonthly.textContent = `Monthly: +${data.staking.estMonthlyRewardSOL.toFixed(6)} SOL`;
        const aprPercent = (data.staking.apr * 100).toFixed(2);
        dashboardStakingSubtext.textContent = `Yearly: +${data.staking.estYearlyRewardSOL.toFixed(6)} SOL • APR: ${aprPercent}%`;
    } else {
        dashboardStakingMonthly.textContent = 'Monthly: +0.000000 SOL';
        dashboardStakingSubtext.textContent = 'Yearly: +0.000000 SOL • APR: 0.00%';
    }
    
    // Update staking earned to date
    if (data.stakingToDate) {
        dashboardStakingEarned.textContent = formatCurrency(data.stakingToDate.earnedUSD);
        dashboardStakingEarnedSubtext.textContent = `~${data.stakingToDate.earnedSOL.toFixed(6)} SOL • As of ${data.stakingToDate.asOf}`;
    } else {
        dashboardStakingEarned.textContent = '$0.00';
        dashboardStakingEarnedSubtext.textContent = '~0.000000 SOL • As of -';
    }
}

// Load live SOL price
async function loadSolLivePrice() {
    try {
        const response = await fetch('/api/price/sol/live');
        if (!response.ok) throw new Error('API error');
        
        const data = await response.json();
        solPriceBadge.textContent = `SOL $${data.priceUSD.toFixed(2)}`;
        
        const time = new Date(data.asOf).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        solPriceTime.textContent = `Updated ${time}`;
    } catch (error) {
        console.error('Error loading live SOL price:', error);
        solPriceBadge.textContent = 'SOL --';
        solPriceTime.textContent = 'Price unavailable';
    }
}

// Load monthly data when page loads
initializePeriodSelectors();
initializeExportButtons();
refreshForSelectedPeriod();

// Load live SOL price on page load and every 60 seconds
loadSolLivePrice();
setInterval(loadSolLivePrice, 60000);

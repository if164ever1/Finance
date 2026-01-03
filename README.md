# Finance Tracker

A simple finance tracker application that saves purchases to JSON files organized by payment type and year.

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

This will install:
- `express` - Web server framework
- `cors` - Enable CORS for frontend-backend communication

### 2. Start the Backend Server

```bash
npm start
```

Or directly:
```bash
node server.js
```

The server will start on `http://localhost:3000`

### 3. Open the Frontend

Simply open `index.html` in your web browser. The frontend will connect to the backend API automatically.

## Project Structure

```
Finance/
├── Assets/                    # Data storage (created automatically)
│   └── <PaymentType>/         # One folder per payment type
│       └── <PaymentType>_<YEAR>.json
├── index.html                 # Frontend HTML
├── script.js                  # Frontend JavaScript
├── styles.css                 # Frontend CSS
├── server.js                  # Backend API server
├── package.json               # Node.js dependencies
└── README.md                  # This file
```

## API Endpoints

### POST /api/purchase

Saves a purchase to the JSON file system.

**Request Body:**
```json
{
  "paymentType": "Gymnastic",
  "amount": 100,
  "date": "2026-01-03"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Purchase saved successfully",
  "month": "January",
  "year": 2026,
  "paymentType": "Gymnastic",
  "monthTotals": {
    "totalAmount": 100,
    "totalCashback": 3,
    "transactionCount": 1
  }
}
```

### GET /api/health

Health check endpoint to verify the server is running.

## Data Storage Format

Data is stored in JSON files organized by payment type and year:

- **Location:** `Assets/<PaymentType>/<PaymentType>_<YEAR>.json`
- **Example:** `Assets/Gymnastic/Gymnastic_2026.json`

**JSON Structure:**
```json
{
  "paymentType": "Gymnastic",
  "year": 2026,
  "months": {
    "January": {
      "totalAmount": 100,
      "totalCashback": 3,
      "transactions": [
        { "date": "2026-01-03", "amount": 100, "cashback": 3 }
      ]
    },
    "February": {
      "totalAmount": 0,
      "totalCashback": 0,
      "transactions": []
    },
    ...
  }
}
```

## Notes

- Payment types are sanitized for filesystem safety (special characters removed, spaces converted to underscores)
- Cashback is automatically calculated at 3% of the purchase amount
- The backend uses atomic file writes (writes to temp file, then renames) to prevent data corruption
- All dates are stored in YYYY-MM-DD format


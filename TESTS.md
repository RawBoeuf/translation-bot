# Testing Documentation

## Running Tests

### Prerequisites
- Server must be running (`npm start`)
- Port 3553 must be available

### Run Tests
```bash
npm test
```

## Test Coverage

### API Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | HTML dashboard |
| `/api/status` | GET | Bot & Ollama status |
| `/api/stats` | GET | Translation stats, uptime, memory |
| `/api/config` | GET | Channel, role, user configuration |
| `/api/logs` | GET | Activity logs |
| `/api/history` | GET | Translation history |
| `/api/translate` | POST | Test translation |
| `/api/models` | GET | Available Ollama models |

### File Validation
- Config file exists and valid JSON
- .env file exists with DISCORD_TOKEN
- index.js syntax valid
- public/index.html exists and valid

## Test Output

```
========================================
Translation Bot Test Suite
========================================

✓ Server is running and serving HTML
✓ /api/status endpoint working
✓ /api/stats endpoint working
✓ /api/config endpoint working
✓ /api/logs endpoint working
✓ /api/history endpoint working
✓ /api/translate endpoint working
✓ /api/models endpoint working
✓ Config file exists and is valid JSON
✓ .env file exists and has required fields
✓ index.js has valid syntax
✓ public/index.html exists and valid

========================================
Results: 12 passed, 0 failed
========================================
```

## Adding New Tests

To add new tests, edit `tests/api.test.js`:

```javascript
async function myNewTest() {
  const res = await makeRequest('/api/your-endpoint');
  if (res.status !== 200) throw new Error('Failed');
  console.log('✓ Your test passed');
}

tests.myNewTest = myNewTest;
```

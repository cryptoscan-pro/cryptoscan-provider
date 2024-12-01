# Cryptoscan Provider

WebSocket data provider library for real-time crypto data scanning and processing.

## Installation

```bash
npm install cryptoscan-provider
```

## Features

- Real-time data processing via WebSocket connection
- Dynamic WebSocket URL configuration
- Unique ID generation for each data entry
- TypeScript support
- Configurable through environment variables

## Requirements

- Node.js >= 14.0.0
- WebSocket server endpoint

## Configuration

Set the WebSocket server URL using the environment variable:

```env
PROVIDER_API_URL=ws://your-websocket-server:port
```

If not set, it defaults to `ws://localhost:8080`.

## Usage

```typescript
import processData from 'cryptoscan-provider';

// Example data object
const data = {
  key: "BTC-USDT",
  price: 50000,
  volume: 100.5,
  timestamp: 1234567890
};

// Process the data
const id = processData(data);
console.log('Generated ID:', id);
```

### Data Object Format

The data object should follow this structure:
```typescript
interface DataObject {
  [key: string]: string | number;
  key: string; // Required field
}
```

### WebSocket Connection

On first run, the library will:
1. Extract object keys and their types
2. Establish WebSocket connection with query parameters
3. Start sending data updates

The WebSocket URL will include query parameters with the object structure:
```
ws://your-server/ws?keys=key,price,volume&types=string,number,number
```

## Development

```bash
# Install dependencies
npm install

# Build the library
npm run build

# Clean build files
npm run clean
```

## License

ISC

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

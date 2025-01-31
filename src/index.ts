import "dotenv/config"
import { v5 } from 'uuid';
import WebSocketReconnect from "@javeoff/ws-reconnect";

const WS_URL = process.env.PROVIDER_API_URL || 'ws://api.cryptoscan.pro:3002';
const NAMESPACE = '1b671a64-40d5-491e-99b0-da01ff1f3341';

interface DataObject {
  [key: string]: string | number;
  key: string;
}

interface ConnectionStats {
  messageCount: number;
  lastCheck: number;
}

interface Connection {
  ws: WebSocketReconnect;
  format: string;
  stats: ConnectionStats;
  index: number; // For round-robin
}

function getDataFormat(data: Omit<DataObject, 'key'>): string {
  const keys = Object.keys(data).sort();
  const types = keys.map(k => typeof data[k]);
  return `${keys.join(',')}:${types.join(',')}`;
}

function createConnection(format: string, data: Omit<DataObject, 'key'>, isCompressed: boolean, index: number): Connection {
  const objectKeys = ['id', ...Object.keys(data)];
  const valueTypes = ['string', ...Object.values(data).map(v => typeof v)];

  const queryParams = new URLSearchParams({
    keys: objectKeys.join(','),
    types: valueTypes.join(',')
  }).toString();

  const ws = new WebSocketReconnect(isCompressed ? `${WS_URL}?${queryParams}` : WS_URL, {
    resendOnReconnect: false,
  });

  return {
    ws,
    format,
    index,
    stats: {
      messageCount: 0,
      lastCheck: Date.now()
    }
  };
}

function updateStats(connection: Connection) {
  connection.stats.messageCount++;
}

let connection: Connection | null = null;

export default function processData({ key, ...data }: DataObject, isCompressed: boolean) {
  if (!WS_URL) {
    return;
  }

  if (!data.key) {
    throw new Error('Key is required');
  }

  const id = v5(key, NAMESPACE);
  if (!id) {
    throw new Error('Invalid id');
  }

  const format = getDataFormat(data);

  if (!connection) {
    connection = createConnection(format, data, isCompressed, 0);
  }
  
  updateStats(connection);

  if (isCompressed) {
    const values = [id, ...Object.values(data)].join(',');
    connection.ws.send(values);
  } else {
    connection.ws.send(JSON.stringify(data));
  }


  return id;
}

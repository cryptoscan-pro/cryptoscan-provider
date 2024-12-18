import "dotenv/config"
import { v5 } from 'uuid';
import WebSocketReconnect from "@javeoff/ws-reconnect";

const WS_URL = process.env.PROVIDER_API_URL || 'ws://api.cryptoscan.pro:3002';
const NAMESPACE = '1b671a64-40d5-491e-99b0-da01ff1f3341';

const MAX_MESSAGES_PER_SECOND = 3000;
const CHECK_INTERVAL = 1000; // 1 second
const MAX_CONNECTIONS = 10; // Maximum connections per format

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

const connections = new Map<string, Connection[]>();

function getDataFormat(data: DataObject): string {
  const keys = Object.keys(data).sort();
  const types = keys.map(k => typeof data[k]);
  return `${keys.join(',')}:${types.join(',')}`;
}

function createConnection(format: string, data: DataObject, isCompressed: boolean, index: number): Connection {
  const objectKeys = ['id', ...Object.keys(data)];
  const valueTypes = ['string', ...Object.values(data).map(v => typeof v)];

  const queryParams = new URLSearchParams({
    keys: objectKeys.join(','),
    types: valueTypes.join(',')
  }).toString();

  const ws = new WebSocketReconnect(isCompressed ? `${WS_URL}?${queryParams}` : WS_URL);

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
  const now = Date.now();
  if (now - connection.stats.lastCheck >= CHECK_INTERVAL) {
    connection.stats.messageCount = 0;
    connection.stats.lastCheck = now;
  }
  connection.stats.messageCount++;
}

function getOrCreateConnections(format: string, data: DataObject, isCompressed: boolean): Connection[] {
  let conns = connections.get(format);
  if (!conns) {
    const initialConnection = createConnection(format, data, isCompressed, 0);
    conns = [initialConnection];
    connections.set(format, conns);
  }
  return conns;
}

function getNextConnection(conns: Connection[], data: DataObject, isCompressed: boolean): Connection {
  // Check load on current connections
  const now = Date.now();
  for (const conn of conns) {
    if (now - conn.stats.lastCheck >= CHECK_INTERVAL) {
      conn.stats.messageCount = 0;
      conn.stats.lastCheck = now;
    }
  }

  // If last connection is overloaded, create new one
  const lastConn = conns[conns.length - 1];
  if (lastConn.stats.messageCount >= MAX_MESSAGES_PER_SECOND && conns.length < MAX_CONNECTIONS) {
    const newConn = createConnection(lastConn.format, data, isCompressed, conns.length);
    conns.push(newConn);
  }

  // Round-robin connection selection
  const conn = conns[0];
  conns.push(conns.shift()!);
  return conn;
}

export default function processData(data: DataObject, isCompressed: boolean) {
  if (!WS_URL) {
    return;
  }

  if (!data.key) {
    throw new Error('Key is required');
  }

  const id = v5(data.key, NAMESPACE);
  if (!id) {
    throw new Error('Invalid id');
  }

  const format = getDataFormat(data);
  const conns = getOrCreateConnections(format, data, isCompressed);
  const connection = getNextConnection(conns, data, isCompressed);
  
  updateStats(connection);

  if (isCompressed) {
    const values = [id, ...Object.values(data)].join(',');
    connection.ws.send(values);
  } else {
    connection.ws.send(JSON.stringify(data));
  }


  return id;
}

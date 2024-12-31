import "dotenv/config"
import { v5 } from 'uuid';
import WebSocketReconnect from "@javeoff/ws-reconnect";

const WS_URL = process.env.PROVIDER_API_URL || 'ws://api.cryptoscan.pro:3002';
const NAMESPACE = '1b671a64-40d5-491e-99b0-da01ff1f3341';

const MAX_MESSAGES_PER_SECOND = Number(process.env.MAX_MESSAGES_PER_SECOND || 5000);
const CHECK_INTERVAL = Number(process.env.CHECK_INTERVAL || 10000); // 1 second
const MAX_CONNECTIONS = Number(process.env.MAX_CONNECTIONS || 20); // Maximum connections per format

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

  const ws = new WebSocketReconnect(isCompressed ? `${WS_URL}?${queryParams}` : WS_URL, {
    resendOnReconnect: true,
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

function cleanupConnections(conns: Connection[]) {
  if (conns.length <= 1) return; // Always keep at least one connection

  const now = Date.now();
  const totalMessages = conns.reduce((sum, conn) => {
    // Update stats for accurate counting
    if (now - conn.stats.lastCheck >= CHECK_INTERVAL) {
      conn.stats.messageCount = 0;
      conn.stats.lastCheck = now;
    }
    return sum + conn.stats.messageCount;
  }, 0);

  // Calculate required number of connections
  const requiredConnections = Math.ceil(totalMessages / MAX_MESSAGES_PER_SECOND);
  
  // Close excess connections
  while (conns.length > Math.max(1, requiredConnections)) {
    const conn = conns.pop();
    if (conn) {
      conn.ws.close();
    }
  }
}

function getNextConnection(conns: Connection[], data: DataObject, isCompressed: boolean): Connection {
  const now = Date.now();
  
  // Update stats for all connections
  let totalMessages = 0;
  for (const conn of conns) {
    if (now - conn.stats.lastCheck >= CHECK_INTERVAL) {
      conn.stats.messageCount = 0;
      conn.stats.lastCheck = now;
    }
    totalMessages += conn.stats.messageCount;
  }

  // Check if new connection is needed
  const avgMessagesPerConnection = totalMessages / conns.length;
  if (avgMessagesPerConnection >= MAX_MESSAGES_PER_SECOND && conns.length < MAX_CONNECTIONS) {
    const newConn = createConnection(conns[0].format, data, isCompressed, conns.length);
    conns.push(newConn);
  }

  // Check if we need to close any connections
  cleanupConnections(conns);

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

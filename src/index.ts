import "dotenv/config"
import { v5 } from 'uuid';
import WebSocketReconnect from "@javeoff/ws-reconnect";

const WS_URL = process.env.PROVIDER_API_URL || 'ws://localhost:8080';
const NAMESPACE = '1b671a64-40d5-491e-99b0-da01ff1f3341';

interface DataObject {
  [key: string]: string | number;
  key: string;
}

interface Connection {
  ws: WebSocketReconnect;
  format: string;
}

const connections = new Map<string, Connection>();

function getDataFormat(data: DataObject): string {
  const keys = Object.keys(data).sort();
  const types = keys.map(k => typeof data[k]);
  return `${keys.join(',')}:${types.join(',')}`;
}

function createConnection(format: string, data: DataObject): WebSocketReconnect {
  const objectKeys = ['id', ...Object.keys(data)];
  const valueTypes = ['string', ...Object.values(data).map(v => typeof v)];

  const queryParams = new URLSearchParams({
    keys: objectKeys.join(','),
    types: valueTypes.join(',')
  }).toString();

  const ws = new WebSocketReconnect(`${WS_URL}?${queryParams}`);

  ws.on('open', () => {
    console.log('WebSocket connection opened', WS_URL);
  });

  ws.on("close", () => {
    console.log('WebSocket connection closed', WS_URL);
    connections.delete(format);
  });

  connections.set(format, { ws, format });
  return ws;
}

export default function processData(data: DataObject) {
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
  let connection = connections.get(format);

  if (!connection) {
    const ws = createConnection(format, data);
    connection = { ws, format };
  }

  const values = [id, ...Object.values(data)].join(',');
  connection.ws.send(values);

  return id;
}

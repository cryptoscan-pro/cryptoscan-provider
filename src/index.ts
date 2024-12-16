import "dotenv/config"
import { v5 } from 'uuid';
import WebSocketReconnect from "@javeoff/ws-reconnect";

const WS_URL = process.env.PROVIDER_API_URL || 'ws://api.cryptoscan.pro:3002';
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

function createConnection(format: string, data: DataObject, isCompressed: boolean): WebSocketReconnect {
  const objectKeys = ['id', ...Object.keys(data)];
  const valueTypes = ['string', ...Object.values(data).map(v => typeof v)];

  const queryParams = new URLSearchParams({
    keys: objectKeys.join(','),
    types: valueTypes.join(',')
  }).toString();

  const ws = new WebSocketReconnect(isCompressed ? `${WS_URL}?${queryParams}` : WS_URL);

  connections.set(format, { ws, format });
  return ws;
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
  let connection = connections.get(format);

  if (!connection) {
    const ws = createConnection(format, data, isCompressed);
    connection = { ws, format };
  }

  if (isCompressed) {
    const values = [id, ...Object.values(data)].join(',');
    connection.ws.send(values);
  }
  else {
    connection.ws.send({ id, ...data });
  }


  return id;
}

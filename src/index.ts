import "dotenv/config"
import { v5 as uuidv5 } from 'uuid';
import WebSocketReconnect from "@javeoff/ws-reconnect";

const WS_URL = process.env.PROVIDER_API_URL || 'ws://localhost:8080';

interface DataObject {
  [key: string]: string | number;
  key: string;
}

let wsConnection: WebSocketReconnect | null = null;
let objectKeys: string[] = [];
let valueTypes: string[] = [];
let isFirstRun = true;

const NAMESPACE = '1b671a64-40d5-491e-99b0-da01ff1f3341';

export default function processData(data: DataObject) {
  if (!WS_URL) {
    return;
  }

  if (!data.key) {
    throw new Error('Key is required');
  }

  const id = uuidv5(data.key, NAMESPACE);

  if (isFirstRun) {
    objectKeys = ['id', ...Object.keys(data)];
    valueTypes = ['string', ...objectKeys.map(key => typeof data[key])];

    const queryParams = new URLSearchParams({
      keys: objectKeys.join(','),
      types: valueTypes.join(',')
    }).toString();

    wsConnection = new WebSocketReconnect(`${WS_URL}/ws?${queryParams}`);

    wsConnection.on('open', () => {
      const values = [id, ...objectKeys].map(key => data[key]).join(',');
      wsConnection?.send(values);
    })

    isFirstRun = false;
  } else if (wsConnection) {
    const values = [id, ...objectKeys].map(key => data[key]).join(',');
    wsConnection.send(values);
  }

  return id;
}

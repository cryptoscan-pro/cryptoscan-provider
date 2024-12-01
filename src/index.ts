import "dotenv/config"
import { v5 as uuidv5 } from 'uuid';
import WebSocket from 'ws';

const WS_URL = process.env.PROVIDER_API_URL || 'ws://localhost:8080';

interface DataObject {
  [key: string]: string | number;
  key: string;
}

let wsConnection: WebSocket | null = null;
let objectKeys: string[] = [];
let valueTypes: string[] = [];
let isFirstRun = true;

const NAMESPACE = '1b671a64-40d5-491e-99b0-da01ff1f3341';

export default function processData(data: DataObject): string {
  if (isFirstRun) {
    objectKeys = Object.keys(data);
    valueTypes = objectKeys.map(key => typeof data[key]);

    const queryParams = new URLSearchParams({
      keys: objectKeys.join(','),
      types: valueTypes.join(',')
    }).toString();

    wsConnection = new WebSocket(`${WS_URL}/ws?${queryParams}`);
    
    wsConnection.onopen = () => {
      const values = objectKeys.map(key => data[key]).join(',');
      wsConnection?.send(values);
    };

    isFirstRun = false;
  } else if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
    const values = objectKeys.map(key => data[key]).join(',');
    wsConnection.send(values);
  }

  const id = uuidv5(data.key, NAMESPACE);
  return id;
}

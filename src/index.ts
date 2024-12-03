import "dotenv/config"
import { v5 } from 'uuid';
import WebSocketReconnect from "@javeoff/ws-reconnect";

const WS_URL = process.env.PROVIDER_API_URL || 'ws://localhost:8080';

interface DataObject {
  [key: string]: string | number;
  key: string;
}

export function createProcessData() {
  let wsConnection: WebSocketReconnect | null = null;
  let objectKeys: string[] = [];
  let valueTypes: string[] = [];
  let isFirstRun = true;

  const NAMESPACE = '1b671a64-40d5-491e-99b0-da01ff1f3341';

  return function ({ key, ...data }: DataObject) {
    if (!WS_URL) {
      return;
    }

    if (!key) {
      throw new Error('Key is required');
    }

    const id = v5(key, NAMESPACE);

    if (!id) {
      throw new Error('Invalid id');
    }

    if (isFirstRun) {
      objectKeys = ['id', ...Object.keys(data)];
      valueTypes = ['string', ...objectKeys.map(k => typeof data[k])];

      const queryParams = new URLSearchParams({
        keys: objectKeys.join(','),
        types: valueTypes.join(',')
      }).toString();

      wsConnection = new WebSocketReconnect(`${WS_URL}/ws?${queryParams}`);

      wsConnection.on('open', () => {
        const values = [id, ...Object.values(data)].join(',');
        wsConnection?.send(values);
      })

      isFirstRun = false;
    } else if (wsConnection) {
      const values = [id, ...Object.values(data)].join(',');
      wsConnection.send(values);
    }

    return id;
  }
}

export default createProcessData();

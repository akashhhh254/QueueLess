import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';

interface ClientConnection {
  ws: WebSocket;
  userId?: string;
  queueId?: string;
  isAlive: boolean;
}

export class WSServerManager {
  private static wss: WebSocketServer | null = null;
  private static clients: Set<ClientConnection> = new Set();

  static initialize(server: Server) {
    this.wss = new WebSocketServer({ noServer: true });

    server.on('upgrade', (request, socket, head) => {
      const url = new URL(request.url || '', `http://${request.headers.host}`);
      if (url.pathname === '/ws') {
        this.wss?.handleUpgrade(request, socket, head, (ws) => {
          this.wss?.emit('connection', ws, request);
        });
      }
    });

    this.wss.on('connection', (ws: WebSocket) => {
      const client: ClientConnection = {
        ws,
        isAlive: true,
      };

      this.clients.add(client);

      ws.on('pong', () => {
        client.isAlive = true;
      });

      ws.on('message', (data: string) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === 'SUBSCRIBE') {
            if (message.userId) client.userId = message.userId;
            if (message.queueId) client.queueId = message.queueId;
            ws.send(JSON.stringify({ type: 'SUBSCRIBED', queueId: client.queueId, userId: client.userId }));
          } else if (message.type === 'PING') {
            ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
          }
        } catch {
          // Ignore malformed client frames
        }
      });

      ws.on('close', () => {
        this.clients.delete(client);
      });

      ws.on('error', () => {
        this.clients.delete(client);
      });

      // Send initial connection acknowledgement
      ws.send(JSON.stringify({ type: 'CONNECTED', message: 'QueueLess Real-Time WebSocket Channel Active', timestamp: Date.now() }));
    });

    // 30s heartbeat interval
    setInterval(() => {
      for (const client of this.clients) {
        if (!client.isAlive) {
          client.ws.terminate();
          this.clients.delete(client);
          continue;
        }
        client.isAlive = false;
        client.ws.ping();
      }
    }, 30000);
  }

  /**
   * Broadcasts an event to all relevant clients (or globally if no filters specified).
   */
  static broadcast(event: {
    type: string;
    queueId?: string;
    userId?: string;
    payload: any;
  }) {
    const payloadStr = JSON.stringify({
      type: event.type,
      queueId: event.queueId,
      userId: event.userId,
      data: event.payload,
      timestamp: Date.now(),
    });

    for (const client of this.clients) {
      if (client.ws.readyState !== WebSocket.OPEN) continue;

      // If event targets a specific queue, match subscribers
      if (event.queueId && client.queueId && client.queueId !== event.queueId) {
        continue;
      }

      // If event targets a specific user, match subscriber
      if (event.userId && client.userId && client.userId !== event.userId) {
        continue;
      }

      client.ws.send(payloadStr);
    }
  }
}

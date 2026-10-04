import React, { createContext, useContext, useEffect, useState, useRef, ReactNode, useCallback } from 'react';
import { useAuth } from './AuthContext';

type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

interface WebSocketContextType {
  status: ConnectionStatus;
  statusMessage: string;
  subscribeQueue: (queueId: string) => void;
  addListener: (event: string, callback: (data: any) => void) => () => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [statusMessage, setStatusMessage] = useState<string>('Connecting to live queue stream...');
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const listenersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map());
  const activeQueueIdRef = useRef<string | null>(null);

  const connect = useCallback(() => {
    if (socketRef.current && (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setStatus('connected');
        setStatusMessage('Live connection active');

        // Subscribe with user ID and any previously active queue
        ws.send(JSON.stringify({
          type: 'SUBSCRIBE',
          userId: user?.id,
          queueId: activeQueueIdRef.current,
        }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          const eventType = message.type;
          const listeners = listenersRef.current.get(eventType);
          if (listeners) {
            listeners.forEach((cb) => cb(message.data));
          }
          // Also trigger general 'message' listener
          const allListeners = listenersRef.current.get('*');
          if (allListeners) {
            allListeners.forEach((cb) => cb(message));
          }
        } catch {
          // ignore frame
        }
      };

      ws.onclose = () => {
        setStatus('reconnecting');
        setStatusMessage('Connection lost. Reconnecting to live queue...');
        scheduleReconnect();
      };

      ws.onerror = () => {
        setStatus('reconnecting');
        setStatusMessage('Reconnecting...');
        ws.close();
      };
    } catch {
      setStatus('reconnecting');
      scheduleReconnect();
    }
  }, [user?.id]);

  const scheduleReconnect = () => {
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    reconnectTimeoutRef.current = setTimeout(() => {
      connect();
    }, 3000);
  };

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connect]);

  const subscribeQueue = useCallback((queueId: string) => {
    activeQueueIdRef.current = queueId;
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'SUBSCRIBE',
        queueId,
        userId: user?.id,
      }));
    }
  }, [user?.id]);

  const addListener = useCallback((event: string, callback: (data: any) => void) => {
    if (!listenersRef.current.has(event)) {
      listenersRef.current.set(event, new Set());
    }
    listenersRef.current.get(event)!.add(callback);

    return () => {
      const set = listenersRef.current.get(event);
      if (set) {
        set.delete(callback);
      }
    };
  }, []);

  return (
    <WebSocketContext.Provider value={{ status, statusMessage, subscribeQueue, addListener }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

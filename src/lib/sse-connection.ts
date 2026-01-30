/**
 * Singleton SSE Connection Manager
 *
 * Ensures only ONE EventSource connection exists globally,
 * preventing HTTP connection exhaustion from multiple hooks.
 */

type EventHandler = (event: MessageEvent) => void;

interface SSEConnectionState {
  eventSource: EventSource | null;
  isConnected: boolean;
  listeners: Map<string, Set<EventHandler>>;
  onOpenCallbacks: Set<() => void>;
  onCloseCallbacks: Set<() => void>;
  reconnectTimeout: NodeJS.Timeout | null;
  reconnectAttempts: number;
}

const state: SSEConnectionState = {
  eventSource: null,
  isConnected: false,
  listeners: new Map(),
  onOpenCallbacks: new Set(),
  onCloseCallbacks: new Set(),
  reconnectTimeout: null,
  reconnectAttempts: 0,
};

function connect() {
  // Already connected or connecting
  if (state.eventSource?.readyState === EventSource.OPEN ||
      state.eventSource?.readyState === EventSource.CONNECTING) {
    return;
  }

  // Clean up existing connection
  if (state.eventSource) {
    state.eventSource.close();
    state.eventSource = null;
  }

  try {
    console.log("[SSE-Singleton] Creating new EventSource connection");
    const eventSource = new EventSource("/api/events");
    state.eventSource = eventSource;

    eventSource.onopen = () => {
      console.log("[SSE-Singleton] Connected");
      state.isConnected = true;
      state.reconnectAttempts = 0;
      state.onOpenCallbacks.forEach(cb => cb());
    };

    eventSource.onerror = () => {
      console.log("[SSE-Singleton] Connection error, will reconnect");
      state.isConnected = false;
      eventSource.close();
      state.eventSource = null;
      state.onCloseCallbacks.forEach(cb => cb());

      // Exponential backoff
      const delay = Math.min(1000 * Math.pow(2, state.reconnectAttempts), 30000);
      state.reconnectAttempts++;

      if (state.reconnectTimeout) {
        clearTimeout(state.reconnectTimeout);
      }
      state.reconnectTimeout = setTimeout(connect, delay);
    };

    // Re-attach all existing listeners to new connection
    state.listeners.forEach((handlers, eventType) => {
      handlers.forEach(handler => {
        eventSource.addEventListener(eventType, handler);
      });
    });
  } catch (error) {
    console.error("[SSE-Singleton] Failed to create EventSource:", error);
  }
}

function disconnect() {
  if (state.reconnectTimeout) {
    clearTimeout(state.reconnectTimeout);
    state.reconnectTimeout = null;
  }
  if (state.eventSource) {
    state.eventSource.close();
    state.eventSource = null;
  }
  state.isConnected = false;
}

/**
 * Subscribe to an SSE event type
 * Returns an unsubscribe function
 */
export function subscribeToSSE(
  eventType: string,
  handler: EventHandler
): () => void {
  // Ensure we're connected
  connect();

  // Track listener
  if (!state.listeners.has(eventType)) {
    state.listeners.set(eventType, new Set());
  }
  state.listeners.get(eventType)!.add(handler);

  // Add to current EventSource if it exists
  if (state.eventSource) {
    state.eventSource.addEventListener(eventType, handler);
  }

  // Return unsubscribe function
  return () => {
    const handlers = state.listeners.get(eventType);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        state.listeners.delete(eventType);
      }
    }
    if (state.eventSource) {
      state.eventSource.removeEventListener(eventType, handler);
    }

    // If no more listeners, disconnect after a delay
    // (in case another component is about to subscribe)
    if (state.listeners.size === 0) {
      setTimeout(() => {
        if (state.listeners.size === 0) {
          console.log("[SSE-Singleton] No more listeners, disconnecting");
          disconnect();
        }
      }, 5000);
    }
  };
}

/**
 * Subscribe to connection state changes
 */
export function onSSEConnect(callback: () => void): () => void {
  state.onOpenCallbacks.add(callback);
  // If already connected, call immediately
  if (state.isConnected) {
    callback();
  }
  return () => {
    state.onOpenCallbacks.delete(callback);
  };
}

export function onSSEDisconnect(callback: () => void): () => void {
  state.onCloseCallbacks.add(callback);
  return () => {
    state.onCloseCallbacks.delete(callback);
  };
}

export function isSSEConnected(): boolean {
  return state.isConnected;
}

/**
 * Force reconnect (useful after auth changes)
 */
export function reconnectSSE(): void {
  disconnect();
  connect();
}

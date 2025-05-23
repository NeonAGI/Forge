import React, { createContext, useContext, useState, FC, PropsWithChildren } from "react";

// Simple UUID generator fallback
const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export interface LoggedEvent {
  id: string;
  direction: "client" | "server";
  eventName: string;
  eventData: Record<string, any>;
  timestamp: string;
  timestampMs: number;
  expanded: boolean;
  category?: "connection" | "audio" | "conversation" | "error" | "tool" | "system";
}

interface EventContextValue {
  loggedEvents: LoggedEvent[];
  logClientEvent: (eventObj: Record<string, any>, eventNameSuffix?: string, category?: LoggedEvent["category"]) => void;
  logServerEvent: (eventObj: Record<string, any>, eventNameSuffix?: string, category?: LoggedEvent["category"]) => void;
  toggleExpand: (id: string) => void;
  clearEvents: () => void;
  getEventsByCategory: (category: LoggedEvent["category"]) => LoggedEvent[];
  getRecentEvents: (limitMs?: number) => LoggedEvent[];
}

const EventContext = createContext<EventContextValue | undefined>(undefined);

export const EventProvider: FC<PropsWithChildren> = ({ children }) => {
  const [loggedEvents, setLoggedEvents] = useState<LoggedEvent[]>([]);

  const addLoggedEvent = (
    direction: "client" | "server",
    eventName: string,
    eventData: Record<string, any>,
    category?: LoggedEvent["category"]
  ) => {
    const id = eventData.event_id || generateId();
    const timestamp = new Date().toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      fractionalSecondDigits: 3
    });
    const timestampMs = Date.now();

    const newEvent: LoggedEvent = {
      id,
      direction,
      eventName,
      eventData,
      timestamp,
      timestampMs,
      expanded: false,
      category: category || categorizeEvent(eventName, eventData)
    };

    setLoggedEvents((prev) => {
      // Keep only last 100 events for performance
      const newEvents = [newEvent, ...prev];
      return newEvents.slice(0, 100);
    });
  };

  const categorizeEvent = (eventName: string, eventData: Record<string, any>): LoggedEvent["category"] => {
    if (eventName.includes("connection") || eventName.includes("session") || eventName.includes("ice")) {
      return "connection";
    }
    if (eventName.includes("audio") || eventName.includes("speech") || eventName.includes("voice")) {
      return "audio";
    }
    if (eventName.includes("conversation") || eventName.includes("message") || eventName.includes("response")) {
      return "conversation";
    }
    if (eventName.includes("error") || eventName.includes("failed") || eventData.error) {
      return "error";
    }
    if (eventName.includes("tool") || eventName.includes("function")) {
      return "tool";
    }
    return "system";
  };

  const logClientEvent: EventContextValue["logClientEvent"] = (eventObj, eventNameSuffix = "", category) => {
    const name = `${eventObj.type || eventObj.action || "client_event"} ${eventNameSuffix}`.trim();
    addLoggedEvent("client", name, eventObj, category);
  };

  const logServerEvent: EventContextValue["logServerEvent"] = (eventObj, eventNameSuffix = "", category) => {
    const name = `${eventObj.type || eventObj.action || "server_event"} ${eventNameSuffix}`.trim();
    addLoggedEvent("server", name, eventObj, category);
  };

  const toggleExpand: EventContextValue["toggleExpand"] = (id) => {
    setLoggedEvents((prev) =>
      prev.map((log) => {
        if (log.id === id) {
          return { ...log, expanded: !log.expanded };
        }
        return log;
      })
    );
  };

  const clearEvents = () => {
    setLoggedEvents([]);
  };

  const getEventsByCategory = (category: LoggedEvent["category"]) => {
    return loggedEvents.filter(event => event.category === category);
  };

  const getRecentEvents = (limitMs: number = 5000) => {
    const cutoffTime = Date.now() - limitMs;
    return loggedEvents.filter(event => event.timestampMs >= cutoffTime);
  };

  return (
    <EventContext.Provider
      value={{
        loggedEvents,
        logClientEvent,
        logServerEvent,
        toggleExpand,
        clearEvents,
        getEventsByCategory,
        getRecentEvents
      }}
    >
      {children}
    </EventContext.Provider>
  );
};

export const useEvent = () => {
  const context = useContext(EventContext);
  if (!context) {
    throw new Error("useEvent must be used within an EventProvider");
  }
  return context;
};
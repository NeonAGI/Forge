import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  month: string;
  time: string;
  color: string;
}

export function useCalendar() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCalendarEvents = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await apiRequest("GET", "/api/calendar");
      const data = await response.json();
      setEvents(data);
    } catch (err) {
      console.error("Failed to fetch calendar events:", err);
      setError("Failed to load calendar events");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendarEvents();

    // Refresh calendar data every hour
    const intervalId = setInterval(fetchCalendarEvents, 60 * 60 * 1000);
    
    return () => clearInterval(intervalId);
  }, []);

  return {
    events,
    isLoading,
    error,
    refresh: fetchCalendarEvents
  };
}

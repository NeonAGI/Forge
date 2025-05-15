import { useState, useEffect } from "react";

export interface ClockData {
  time: string;
  date: string;
}

export function useClock(): ClockData {
  const [clockData, setClockData] = useState<ClockData>({
    time: "",
    date: ""
  });

  useEffect(() => {
    // Initialize the clock immediately
    updateClock();

    // Update the clock every second
    const intervalId = setInterval(updateClock, 1000);

    return () => clearInterval(intervalId);
  }, []);

  function updateClock() {
    const now = new Date();
    
    // Format time (12-hour with AM/PM)
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const formattedHours = hours % 12 || 12;
    const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const timeString = `${formattedHours}:${formattedMinutes} ${ampm}`;
    
    // Format date (Weekday, Month Day, Year)
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    const dateString = now.toLocaleDateString('en-US', options);
    
    setClockData({
      time: timeString,
      date: dateString
    });
  }

  return clockData;
}

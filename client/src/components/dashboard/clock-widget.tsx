import React from "react";
import { useClock } from "@/hooks/use-clock";

// Export a simple Clock component for the header
export const Clock: React.FC = () => {
  const { time, date } = useClock();

  return (
    <span className="text-white/80">{time}</span>
  );
};

// Keep the original ClockWidget (renamed) for compatibility
export const ClockWidget: React.FC = () => {
  const { time, date } = useClock();

  // Extract hours and minutes for the visual clock animation with error handling
  let hours = 0;
  let minutes = 0;
  let isAM = true;
  
  if (time) {
    try {
      const timeArr = time.split(':');
      if (timeArr.length >= 2) {
        hours = parseInt(timeArr[0] || '0');
        const minutesPart = timeArr[1].split(' ');
        minutes = parseInt(minutesPart[0] || '0');
        isAM = time.includes('AM');
      }
    } catch (err) {
      console.error('Error parsing time:', err);
    }
  }

  return (
    <div className="text-white">
      <div className="text-7xl font-light mb-3">
        {time || "00:00 AM"}
      </div>
      <div className="text-lg text-white/70">
        {date || "Loading date..."}
      </div>
    </div>
  );
};

import React from "react";
import { useClock } from "@/hooks/use-clock";
import { GlassCard } from "@/components/ui/glass-card";
import { Clock as ClockIcon } from "lucide-react";

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
    <GlassCard 
      className="col-span-1 glass-glow overflow-hidden"
      animationDelay={0}
      headerContent={
        <div className="flex items-center">
          <ClockIcon className="h-4 w-4 text-accent mr-2" />
          <span className="text-sm font-medium text-text-muted">Local Time</span>
          <span className="ml-auto h-2 w-2 rounded-full bg-accent pulse-dot"></span>
        </div>
      }
    >
      <div className="relative text-center py-2">
        {/* Clock Background Halo */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full bg-gradient-to-tr from-accent/5 to-accent/10 blur-xl"></div>
        
        <div className="relative">
          <div className="text-5xl font-light mb-1 tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-[#f1f5fa] to-[#a0aec0]">
            {time || "00:00 AM"}
          </div>
          <div className="text-xs text-accent tracking-wider uppercase font-medium">
            {date || "Loading date..."}
          </div>
        </div>
        
        {/* Minimal Clock Animation */}
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-accent/30 to-transparent"></div>
      </div>
    </GlassCard>
  );
};

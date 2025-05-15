import React from "react";
import { useClock } from "@/hooks/use-clock";
import { GlassCard } from "@/components/ui/glass-card";

export const ClockWidget: React.FC = () => {
  const { time, date } = useClock();

  return (
    <GlassCard 
      title="Clock" 
      statusIndicator={true} 
      className="col-span-1"
      animationDelay={0}
    >
      <div className="text-center">
        <div className="text-4xl font-light mb-2">{time}</div>
        <div className="text-sm text-accent">{date}</div>
      </div>
    </GlassCard>
  );
};

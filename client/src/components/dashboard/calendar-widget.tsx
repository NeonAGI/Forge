import React from "react";
import { useCalendar } from "@/hooks/use-calendar";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Plus, Clock, Calendar as CalendarIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface EventItemProps {
  date: string;
  month: string;
  title: string;
  time: string;
  color: string;
}

const EventItem: React.FC<EventItemProps> = ({ date, month, title, time, color }) => {
  // Map color string to actual color values suitable for our dark theme
  const colorMap: Record<string, { bg: string, text: string, glow: string }> = {
    blue: { 
      bg: 'rgba(25, 95, 170, 0.2)', 
      text: '#4da0ff', 
      glow: 'rgba(77, 160, 255, 0.15)'
    },
    green: { 
      bg: 'rgba(16, 128, 67, 0.2)', 
      text: '#4ade80', 
      glow: 'rgba(74, 222, 128, 0.15)' 
    },
    purple: { 
      bg: 'rgba(109, 40, 217, 0.2)', 
      text: '#a78bfa', 
      glow: 'rgba(167, 139, 250, 0.15)' 
    },
    orange: { 
      bg: 'rgba(211, 84, 0, 0.2)', 
      text: '#f97316', 
      glow: 'rgba(249, 115, 22, 0.15)' 
    },
    red: { 
      bg: 'rgba(185, 28, 28, 0.2)', 
      text: '#f87171', 
      glow: 'rgba(248, 113, 113, 0.15)' 
    }
  };

  const { bg, text, glow } = colorMap[color] || colorMap.blue;

  return (
    <div className="flex items-center p-3 rounded-lg bg-primary/60 hover:bg-primary/70 border border-border/20 transition-all cursor-pointer relative overflow-hidden group">
      {/* Subtle highlight effect on hover */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
      
      {/* Date box with color */}
      <div 
        className="w-12 h-12 flex-shrink-0 rounded-lg flex flex-col items-center justify-center mr-4 relative"
        style={{ background: bg, boxShadow: `0 0 15px ${glow}` }}
      >
        <div className="text-xs font-medium opacity-80" style={{ color: text }}>{month}</div>
        <div className="text-lg font-semibold" style={{ color: text }}>{date}</div>
      </div>
      
      <div className="flex-grow">
        <h3 className="font-medium text-text">{title}</h3>
        <div className="text-sm text-text-muted flex items-center mt-1">
          <Clock className="h-3 w-3 mr-1" style={{ color: text }} />
          {time}
        </div>
      </div>
      
      <div className="flex-shrink-0 ml-4">
        <span 
          className="inline-block w-2 h-2 rounded-full"
          style={{ backgroundColor: text, boxShadow: `0 0 5px ${glow}` }}
        ></span>
      </div>
    </div>
  );
};

export const CalendarWidget: React.FC = () => {
  const { events, isLoading, error } = useCalendar();

  return (
    <GlassCard 
      className="col-span-1 md:col-span-2 glass-glow"
      animationDelay={0.2}
      headerContent={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center">
            <CalendarIcon className="h-4 w-4 text-accent mr-2" />
            <span className="text-sm font-medium text-text-muted">Upcoming Events</span>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-accent hover:bg-white/10"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        {isLoading ? (
          <>
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center p-3 bg-primary/60 rounded-lg overflow-hidden">
                <Skeleton className="w-12 h-12 rounded-lg mr-4 bg-white/10" />
                <div className="flex-grow">
                  <Skeleton className="h-5 w-40 mb-2 bg-white/10" />
                  <Skeleton className="h-4 w-32 bg-white/10" />
                </div>
              </div>
            ))}
          </>
        ) : error ? (
          <div className="text-center py-4 text-destructive">
            <p>Could not load calendar events</p>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-8 text-accent">
            <p>No upcoming events</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2 border-accent/50 text-accent hover:bg-accent/10"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Event
            </Button>
          </div>
        ) : (
          events.map((event, index) => (
            <EventItem
              key={index}
              date={event.date}
              month={event.month}
              title={event.title}
              time={event.time}
              color={event.color}
            />
          ))
        )}
      </div>
    </GlassCard>
  );
};

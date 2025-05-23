import React from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, Plus, Clock, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useCalendar } from "@/hooks/use-calendar";

interface EventProps {
  title: string;
  date: string;
  time: string;
  category?: string;
  color?: string;
}

const EventCard: React.FC<EventProps> = ({ 
  title, 
  date, 
  time, 
  category = "Default", 
  color = "#00c3ff" 
}) => {
  return (
    <div className="flex p-3 bg-primary/40 rounded-xl backdrop-blur-sm mb-3 border border-border/20 hover:border-border/30 transition-all relative overflow-hidden card-transition">
      {/* Date indicator */}
      <div className="w-14 h-14 flex-shrink-0 rounded-lg mr-4 flex flex-col items-center justify-center bg-primary/60 border border-border/20">
        <div className="text-xs text-text-muted uppercase">{date.split(' ')[0]}</div>
        <div className="text-xl font-bold text-text">{date.split(' ')[1]}</div>
      </div>
      
      {/* Event details */}
      <div className="flex-grow">
        <h3 className="font-medium text-text mb-1">{title}</h3>
        <div className="flex items-center">
          <Clock className="h-3 w-3 mr-1 text-text-muted" />
          <span className="text-xs text-text-muted">{time}</span>
        </div>
      </div>
      
      {/* Category indicator */}
      <div 
        className="absolute top-0 right-0 w-3 h-full" 
        style={{ backgroundColor: color }}
      ></div>
      
      {/* Subtle arrow */}
      <Button 
        variant="ghost" 
        size="icon" 
        className="text-text-muted hover:text-accent absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
};

export const CalendarWidget: React.FC = () => {
  const { events, isLoading, error } = useCalendar();
  
  // Map event types to colors
  const getEventColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'meeting':
        return '#00c3ff';
      case 'personal':
        return '#ef8700';
      case 'deadline':
        return '#ff0055';
      default:
        return '#00c3ff';
    }
  };

  return (
    <GlassCard 
      className="col-span-1 md:col-span-2 glass-glow h-full card-transition"
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
      {/* Background glow effects for depth */}
      <div className="absolute top-1/4 left-1/2 w-40 h-40 rounded-full bg-accent/5 -translate-x-1/2 blur-[80px] pointer-events-none"></div>
      <div className="absolute bottom-1/3 right-1/4 w-32 h-32 rounded-full bg-accent-alt/5 blur-[60px] pointer-events-none"></div>
      
      <div className="space-y-2 relative">
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
          <div className="text-center py-6 text-text-muted">
            <p>No upcoming events found</p>
          </div>
        ) : (
          <>
            {events.length === 0 ? (
              <div className="text-center py-10">
                <div className="flex justify-center mb-4">
                  <CalendarIcon className="h-12 w-12 text-text-muted/30" />
                </div>
                <h3 className="font-medium text-text-muted mb-2">No upcoming events</h3>
                <p className="text-sm text-text-muted/70">Your schedule is clear</p>
              </div>
            ) : (
              <div className="space-y-1">
                {events.map((event, index) => (
                  <EventCard 
                    key={index}
                    title={event.title}
                    date={event.date}
                    time={event.time}
                    category={event.category}
                    color={getEventColor(event.category || "")}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </GlassCard>
  );
};

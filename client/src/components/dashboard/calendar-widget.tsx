import React from "react";
import { useCalendar } from "@/hooks/use-calendar";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Plus, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface EventItemProps {
  date: string;
  month: string;
  title: string;
  time: string;
  color: string;
}

const EventItem: React.FC<EventItemProps> = ({ date, month, title, time, color }) => {
  return (
    <div className="flex items-center p-3 rounded-lg bg-white/50 hover:bg-white/70 transition cursor-pointer">
      <div className={`w-12 h-12 flex-shrink-0 rounded-lg bg-${color}-100 text-${color}-500 flex flex-col items-center justify-center mr-4`}>
        <div className="text-xs font-medium">{month}</div>
        <div className="text-lg font-semibold">{date}</div>
      </div>
      <div className="flex-grow">
        <h3 className="font-medium">{title}</h3>
        <div className="text-sm text-accent flex items-center mt-1">
          <Clock className="h-4 w-4 mr-1" />
          {time}
        </div>
      </div>
      <div className="flex-shrink-0 ml-4">
        <span className={`inline-block w-2 h-2 rounded-full bg-${color}-500`}></span>
      </div>
    </div>
  );
};

export const CalendarWidget: React.FC = () => {
  const { events, isLoading, error } = useCalendar();

  return (
    <GlassCard 
      title="Calendar" 
      className="col-span-1 md:col-span-2"
      animationDelay={0.2}
      headerContent={
        <Button 
          variant="ghost" 
          size="icon" 
          className="text-accent hover:text-text"
        >
          <Plus className="h-5 w-5" />
        </Button>
      }
    >
      <div className="space-y-3">
        {isLoading ? (
          <>
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center p-3">
                <Skeleton className="w-12 h-12 rounded-lg mr-4" />
                <div className="flex-grow">
                  <Skeleton className="h-5 w-40 mb-2" />
                  <Skeleton className="h-4 w-32" />
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
            <Button variant="outline" size="sm" className="mt-2">
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

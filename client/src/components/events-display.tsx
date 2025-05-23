import React, { useState } from "react";
import { useEvent, LoggedEvent } from "@/contexts/event-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronDown, ChevronRight, Trash2, Download } from "lucide-react";

const categoryColors: Record<LoggedEvent["category"] | "all", string> = {
  connection: "bg-blue-100 text-blue-800 border-blue-300",
  audio: "bg-green-100 text-green-800 border-green-300", 
  conversation: "bg-purple-100 text-purple-800 border-purple-300",
  error: "bg-red-100 text-red-800 border-red-300",
  tool: "bg-orange-100 text-orange-800 border-orange-300",
  system: "bg-gray-100 text-gray-800 border-gray-300",
  all: "bg-slate-100 text-slate-800 border-slate-300"
};

const directionColors = {
  client: "bg-indigo-50 border-l-indigo-400",
  server: "bg-emerald-50 border-l-emerald-400"
};

interface EventItemProps {
  event: LoggedEvent;
  onToggle: (id: string) => void;
}

const EventItem: React.FC<EventItemProps> = ({ event, onToggle }) => {
  const categoryColor = categoryColors[event.category || "system"];
  const directionColor = directionColors[event.direction];

  return (
    <div className={`border rounded-lg p-3 mb-2 border-l-4 ${directionColor}`}>
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => onToggle(event.id)}
      >
        <div className="flex items-center gap-2 flex-1">
          {event.expanded ? (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-500" />
          )}
          
          <Badge variant="outline" className={`text-xs ${categoryColor}`}>
            {event.category}
          </Badge>
          
          <Badge variant="secondary" className="text-xs">
            {event.direction}
          </Badge>
          
          <span className="font-medium text-sm flex-1">{event.eventName}</span>
          
          <span className="text-xs text-gray-500 font-mono">
            {event.timestamp}
          </span>
        </div>
      </div>
      
      {event.expanded && (
        <div className="mt-3 pl-6">
          <pre className="text-xs bg-gray-50 p-3 rounded border overflow-x-auto">
            {JSON.stringify(event.eventData, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export const EventsDisplay: React.FC = () => {
  const { 
    loggedEvents, 
    toggleExpand, 
    clearEvents, 
    getEventsByCategory 
  } = useEvent();
  
  const [selectedCategory, setSelectedCategory] = useState<LoggedEvent["category"] | "all">("all");

  const filteredEvents = selectedCategory === "all" 
    ? loggedEvents 
    : getEventsByCategory(selectedCategory);

  const categoryCounts = {
    all: loggedEvents.length,
    connection: getEventsByCategory("connection").length,
    audio: getEventsByCategory("audio").length,
    conversation: getEventsByCategory("conversation").length,
    error: getEventsByCategory("error").length,
    tool: getEventsByCategory("tool").length,
    system: getEventsByCategory("system").length,
  };

  const exportEvents = () => {
    const data = JSON.stringify(loggedEvents, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `forge-events-${new Date().toISOString().slice(0, 19)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Event Log</CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportEvents}
              disabled={loggedEvents.length === 0}
            >
              <Download className="w-4 h-4 mr-1" />
              Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={clearEvents}
              disabled={loggedEvents.length === 0}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Clear
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <Tabs value={selectedCategory} onValueChange={(value) => setSelectedCategory(value as any)}>
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="all" className="text-xs">
              All ({categoryCounts.all})
            </TabsTrigger>
            <TabsTrigger value="connection" className="text-xs">
              Conn ({categoryCounts.connection})
            </TabsTrigger>
            <TabsTrigger value="audio" className="text-xs">
              Audio ({categoryCounts.audio})
            </TabsTrigger>
            <TabsTrigger value="conversation" className="text-xs">
              Chat ({categoryCounts.conversation})
            </TabsTrigger>
            <TabsTrigger value="error" className="text-xs">
              Error ({categoryCounts.error})
            </TabsTrigger>
            <TabsTrigger value="tool" className="text-xs">
              Tool ({categoryCounts.tool})
            </TabsTrigger>
            <TabsTrigger value="system" className="text-xs">
              Sys ({categoryCounts.system})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value={selectedCategory} className="mt-4">
            <ScrollArea className="h-96">
              {filteredEvents.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  No events to display
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredEvents.map((event) => (
                    <EventItem
                      key={event.id}
                      event={event}
                      onToggle={toggleExpand}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
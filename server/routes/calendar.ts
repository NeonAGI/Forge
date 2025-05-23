import { Router, Request, Response } from "express";

const router = Router();

// Calendar API endpoint
router.get("/", async (req: Request, res: Response) => {
  try {
    // Mock calendar data for demonstration
    const calendarEvents = [
      {
        id: "1",
        title: "Design Review Meeting",
        date: "01",
        month: "JUL",
        time: "2:00 PM - 3:30 PM",
        color: "blue"
      },
      {
        id: "2",
        title: "Team Brainstorm Session",
        date: "02",
        month: "JUL",
        time: "10:30 AM - 12:00 PM",
        color: "green"
      },
      {
        id: "3",
        title: "Quarterly Planning",
        date: "03",
        month: "JUL",
        time: "9:00 AM - 4:00 PM",
        color: "purple"
      }
    ];
    
    res.json(calendarEvents);
  } catch (err) {
    console.error("Error fetching calendar events:", err);
    res.status(500).json({ error: "Failed to fetch calendar data" });
  }
});

export default router;
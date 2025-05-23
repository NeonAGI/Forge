import { Request, Response, NextFunction } from 'express';

/**
 * Request logging middleware
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.url;
  
  console.log(`${timestamp} - ${method} ${url}`);
  
  // Add request start time for response time calculation
  res.locals.startTime = Date.now();
  
  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - res.locals.startTime;
    const statusCode = res.statusCode;
    console.log(`${timestamp} - ${method} ${url} - ${statusCode} (${duration}ms)`);
  });
  
  next();
};

/**
 * Error logging middleware
 */
export const errorLogger = (err: Error, req: Request, res: Response, next: NextFunction) => {
  const timestamp = new Date().toISOString();
  console.error(`${timestamp} - ERROR: ${err.message}`);
  console.error(`Stack: ${err.stack}`);
  next(err);
};
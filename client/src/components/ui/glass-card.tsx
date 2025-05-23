import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "primary" | "secondary";
  animationDelay?: number;
  headerContent?: React.ReactNode;
  footerContent?: React.ReactNode;
  statusIndicator?: boolean;
  className?: string;
  title?: string;
  animateEntrance?: boolean;
}

const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  (
    {
      className,
      variant = "primary",
      animationDelay = 0,
      headerContent,
      footerContent,
      statusIndicator = false,
      title,
      animateEntrance = true,
      children,
      ...props
    },
    ref
  ) => {
    const variantClasses = {
      primary: "glass",
      secondary: "glass-secondary",
    };

    return (
      <Card
        ref={ref}
        className={cn(
          variantClasses[variant],
          animateEntrance && "fade-in",
          className
        )}
        style={{ animationDelay: `${animationDelay}s` }}
        {...props}
      >
        {(title || headerContent) && (
          <CardHeader className="flex justify-between items-start pb-2">
            {title && (
              <div className="flex justify-between items-start w-full">
                <h2 className="font-medium text-lg">{title}</h2>
                {statusIndicator && (
                  <span className="bg-green-500 h-2 w-2 rounded-full pulse-dot"></span>
                )}
              </div>
            )}
            {headerContent}
          </CardHeader>
        )}
        <CardContent className={cn(!title && !headerContent && "pt-6", "pb-4")}>
          {children}
        </CardContent>
        {footerContent && <CardFooter>{footerContent}</CardFooter>}
      </Card>
    );
  }
);

GlassCard.displayName = "GlassCard";

export { GlassCard };

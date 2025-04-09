// components/ui/progress.tsx
"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

// Define the extended props type
interface ProgressProps extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  indicatorClassName?: string; // Add the custom prop type
}

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps // Use the extended props type
>(({ className, value, indicatorClassName, ...props }, ref) => ( // Destructure indicatorClassName
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      "relative h-4 w-full overflow-hidden rounded-full bg-secondary",
      className
    )}
    {...props} // Spread only the remaining valid props for the Root element
  >
    <ProgressPrimitive.Indicator
      className={cn( // Apply indicatorClassName here along with base classes
        "h-full w-full flex-1 bg-primary transition-all",
        indicatorClassName // Use the custom class here
      )}
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </ProgressPrimitive.Root>
))
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface SeparatorProps extends HTMLAttributes<HTMLHRElement> {
  orientation?: "horizontal" | "vertical";
}

export function Separator({
  className,
  orientation = "horizontal",
  ...props
}: SeparatorProps) {
  return (
    <hr
      className={cn(
        "shrink-0 border-border",
        orientation === "horizontal" ? "w-full border-t" : "h-full border-l",
        className,
      )}
      {...props}
    />
  );
}

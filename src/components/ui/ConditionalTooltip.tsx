import React, { memo } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface ConditionalTooltipProps {
  children: React.ReactNode;
  content: string;
  isActive: boolean;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}

const ConditionalTooltip = memo<ConditionalTooltipProps>(({ 
  children, 
  content, 
  isActive, 
  side = "top",
  className 
}) => {
  if (!isActive) {
    return <>{children}</>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild className={className}>
        {children}
      </TooltipTrigger>
      <TooltipContent side={side}>
        <p>{content}</p>
      </TooltipContent>
    </Tooltip>
  );
});

ConditionalTooltip.displayName = "ConditionalTooltip";

export default ConditionalTooltip;
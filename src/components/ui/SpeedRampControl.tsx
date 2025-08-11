import React, { memo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useHoldToRepeat } from '@/hooks/useHoldToRepeat';

interface SpeedRampControlProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
}

const SpeedRampControl = memo<SpeedRampControlProps>(({
  label,
  value,
  onChange,
  min = 0,
  max = 999,
  step = 1,
  unit = "",
  className,
  inputClassName,
  disabled = false
}) => {
  const handleDecrement = () => {
    const newValue = Math.max(min, value - step);
    onChange(newValue);
  };

  const handleIncrement = () => {
    const newValue = Math.min(max, value + step);
    onChange(newValue);
  };
  const decHold = useHoldToRepeat({ onAction: handleDecrement, delay: 300, interval: 100 });
  const incHold = useHoldToRepeat({ onAction: handleIncrement, delay: 300, interval: 100 });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value) || 0;
    if (newValue >= min && newValue <= max) {
      onChange(newValue);
    }
  };

  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onPointerDown={decHold.onPointerDown}
          onPointerUp={decHold.onPointerUp}
          onPointerLeave={decHold.onPointerLeave}
          onPointerCancel={decHold.onPointerCancel}
          onClick={decHold.onClick}
          disabled={disabled || value <= min}
          className="h-6 w-6 p-0"
        >
          <ChevronLeft className="h-3 w-3" />
        </Button>
        
        <Input
          type="number"
          value={value}
          onChange={handleInputChange}
          className={cn("h-6 w-12 text-center text-xs p-0", inputClassName)}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
        />
        
        <Button
          variant="outline"
          size="sm"
          onPointerDown={incHold.onPointerDown}
          onPointerUp={incHold.onPointerUp}
          onPointerLeave={incHold.onPointerLeave}
          onPointerCancel={incHold.onPointerCancel}
          onClick={incHold.onClick}
          disabled={disabled || value >= max}
          className="h-6 w-6 p-0"
        >
          <ChevronRight className="h-3 w-3" />
        </Button>
      </div>
      {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
    </div>
  );
});

SpeedRampControl.displayName = "SpeedRampControl";

export default SpeedRampControl;
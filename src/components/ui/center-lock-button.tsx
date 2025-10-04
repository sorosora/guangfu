'use client';

import { Button } from '@/components/ui/button';
import { Navigation, NavigationOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CenterLockButtonProps {
  isLocked: boolean;
  onToggle: () => void;
  disabled?: boolean;
  className?: string;
}

export function CenterLockButton({
  isLocked,
  onToggle,
  disabled = false,
  className,
}: CenterLockButtonProps) {
  return (
    <Button
      variant={isLocked ? 'default' : 'outline'}
      size="icon"
      className={cn('shadow-lg', isLocked && 'bg-blue-600 hover:bg-blue-700', className)}
      onClick={onToggle}
      disabled={disabled}
    >
      {isLocked ? <Navigation className="w-5 h-5" /> : <NavigationOff className="w-5 h-5" />}
    </Button>
  );
}

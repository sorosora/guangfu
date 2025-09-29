'use client';

import { Button } from '@/components/ui/button';
import { Plus, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ZoomButtonsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  canZoomIn?: boolean;
  canZoomOut?: boolean;
  className?: string;
}

export function ZoomButtons({
  onZoomIn,
  onZoomOut,
  canZoomIn = true,
  canZoomOut = true,
  className,
}: ZoomButtonsProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {/* Zoom In 按鈕 */}
      <Button
        variant="outline"
        size="icon"
        className="shadow-lg bg-white hover:bg-gray-50"
        onClick={onZoomIn}
        disabled={!canZoomIn}
        title="放大"
      >
        <Plus className="w-4 h-4" />
      </Button>

      {/* Zoom Out 按鈕 */}
      <Button
        variant="outline"
        size="icon"
        className="shadow-lg bg-white hover:bg-gray-50"
        onClick={onZoomOut}
        disabled={!canZoomOut}
        title="縮小"
      >
        <Minus className="w-4 h-4" />
      </Button>
    </div>
  );
}

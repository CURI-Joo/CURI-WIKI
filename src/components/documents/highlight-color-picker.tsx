'use client';

import { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Check, ChevronDown, Highlighter } from 'lucide-react';
import { HIGHLIGHT_COLORS, getHighlightColor, type HighlightColor } from '@/lib/highlight-colors';

export function HighlightColorPicker({
  onSelect, onBeforeOpen, disabled, className,
}: {
  onSelect: (color: HighlightColor) => void;
  onBeforeOpen?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<HighlightColor>('yellow');

  return (
    <Popover.Root open={open} onOpenChange={(next) => {
      if (next) onBeforeOpen?.();
      setOpen(next);
    }}>
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label="형광펜 색상 선택"
          title="형광펜 색상 선택"
          onMouseDown={(event) => { event.preventDefault(); onBeforeOpen?.(); }}
          className={className ?? 'inline-flex h-10 items-center gap-2 rounded-xl border border-border px-4 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary disabled:pointer-events-none disabled:opacity-50'}
        >
          <span className="rounded px-0.5 py-1" style={{ backgroundColor: getHighlightColor(selected).background }}>
            <Highlighter className="h-4 w-4 text-text-primary" />
          </span>
          형광펜 <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start" sideOffset={8} aria-label="형광펜 색상"
          onCloseAutoFocus={(event) => event.preventDefault()}
          className="z-50 w-72 max-w-[calc(100vw-32px)] rounded-xl border border-border bg-background p-3 shadow-xl"
        >
          <p className="mb-3 text-xs font-medium text-text-secondary">형광펜 색상</p>
          <div className="grid grid-cols-5 gap-1">
            {HIGHLIGHT_COLORS.map((color) => (
              <button
                key={color.id} type="button" aria-label={`${color.label} 형광펜`} aria-pressed={selected === color.id}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => { setSelected(color.id); setOpen(false); onSelect(color.id); }}
                className="flex h-11 items-center justify-center rounded-lg hover:bg-surface"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-black/10" style={{ backgroundColor: color.background }}>
                  {selected === color.id && <Check className="h-4 w-4 text-text-primary" />}
                </span>
              </button>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

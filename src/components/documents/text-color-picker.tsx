'use client';

import { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Check, ChevronDown } from 'lucide-react';
import { TEXT_COLORS, getTextColor, type TextColor } from '@/lib/text-colors';

export function TextColorPicker({ onSelect, onBeforeOpen, disabled, className }: {
  onSelect: (color: TextColor) => void;
  onBeforeOpen?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<TextColor>('black');
  return <Popover.Root open={open} onOpenChange={next => { if (next) onBeforeOpen?.(); setOpen(next); }}>
    <Popover.Trigger asChild>
      <button type="button" disabled={disabled} aria-label="글자색 선택" title="글자색 선택"
        onMouseDown={event => { event.preventDefault(); onBeforeOpen?.(); }}
        className={className ?? 'inline-flex h-10 items-center gap-2 rounded-xl border border-border px-4 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary disabled:pointer-events-none disabled:opacity-50'}>
        <span aria-hidden="true" className="flex h-6 w-5 items-center justify-center border-b-2 text-base font-semibold leading-none" style={{ color: getTextColor(selected).color, borderColor: getTextColor(selected).color }}>A</span>
        글자색 <ChevronDown className="h-3.5 w-3.5" />
      </button>
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Content align="start" sideOffset={8} aria-label="글자색 팔레트"
        onCloseAutoFocus={event => event.preventDefault()}
        className="z-50 w-72 max-w-[calc(100vw-32px)] rounded-xl border border-border bg-background p-3 shadow-xl">
        <p className="mb-3 text-xs font-medium text-text-secondary">글자색</p>
        <div className="grid grid-cols-5 gap-1">
          {TEXT_COLORS.map(color => <button key={color.id} type="button" aria-label={`${color.label} 글자색`} aria-pressed={selected === color.id}
            onMouseDown={event => event.preventDefault()}
            onClick={() => { setSelected(color.id); setOpen(false); onSelect(color.id); }}
            className="relative flex h-11 items-center justify-center rounded-lg transition-colors hover:bg-surface focus-visible:outline-curi-pink">
            <span aria-hidden="true" className="text-xl font-semibold" style={{ color: color.color }}>A</span>
            {selected === color.id && <Check aria-hidden="true" className="absolute bottom-1 right-1 h-3 w-3 text-text-primary" />}
          </button>)}
        </div>
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>;
}

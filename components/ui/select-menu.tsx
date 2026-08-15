"use client";

import { Check, ChevronDown } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

export type SelectMenuOption = { value: string; label: string };

type SelectMenuProps = {
  id: string;
  name: string;
  defaultValue?: string;
  options: SelectMenuOption[];
  ariaLabel: string;
  required?: boolean;
  /** Extra class on the wrapper, for compact placements such as the header search. */
  variant?: string;
  /** Notified when the selection changes, for callers that react without submitting. */
  onValueChange?: (value: string) => void;
};

export function SelectMenu({ id, name, defaultValue = "", options, ariaLabel, required = false, variant, onValueChange }: SelectMenuProps) {
  const root = useRef<HTMLDivElement>(null);
  const generatedId = useId();
  const listboxId = `${id}-${generatedId.replace(/:/g, "")}-listbox`;
  const initialIndex = Math.max(0, options.findIndex((option) => option.value === defaultValue));
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [open, setOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const selected = options[selectedIndex] ?? options[0];

  const updateDirection = useCallback(() => {
    const trigger = root.current?.querySelector<HTMLButtonElement>(".select-menu-trigger");
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const roomBelow = window.innerHeight - rect.bottom;
    const roomAbove = rect.top;
    setOpenUp(roomBelow < Math.min(270, options.length * 36 + 12) && roomAbove > roomBelow);
  }, [options.length]);

  useEffect(() => {
    if (!open) return;
    updateDirection();
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const reposition = () => updateDirection();
    document.addEventListener("pointerdown", close);
    window.addEventListener("resize", reposition, { passive: true });
    window.addEventListener("scroll", reposition, { passive: true, capture: true });
    return () => {
      document.removeEventListener("pointerdown", close);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, { capture: true });
    };
  }, [open, updateDirection]);

  function choose(index: number) {
    setSelectedIndex(index);
    setActiveIndex(index);
    setOpen(false);
    const value = options[index]?.value;
    if (value !== undefined) onValueChange?.(value);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open) choose(activeIndex);
      else setOpen(true);
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    setOpen(true);
    if (event.key === "Home") setActiveIndex(0);
    else if (event.key === "End") setActiveIndex(options.length - 1);
    else setActiveIndex((current) => {
      const direction = event.key === "ArrowDown" ? 1 : -1;
      return (current + direction + options.length) % options.length;
    });
  }

  return (
    <div className={`select-menu${variant ? ` ${variant}` : ""}${open ? " open" : ""}${openUp ? " open-up" : ""}`} ref={root}>
      <input type="hidden" name={name} value={selected?.value ?? ""} required={required} />
      <button
        id={id}
        className="select-menu-trigger"
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-controls={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-activedescendant={open ? `${listboxId}-option-${activeIndex}` : undefined}
        onClick={() => { setActiveIndex(selectedIndex); setOpen((current) => !current); }}
        onKeyDown={handleKeyDown}
      >
        <span>{selected?.label}</span>
        <ChevronDown size={14} strokeWidth={1.8} aria-hidden="true" />
      </button>
      {open && (
        <div className="select-menu-popover" id={listboxId} role="listbox" aria-label={ariaLabel}>
          {options.map((option, index) => (
            <button
              id={`${listboxId}-option-${index}`}
              className={`select-menu-option${activeIndex === index ? " active" : ""}${selectedIndex === index ? " selected" : ""}`}
              type="button"
              role="option"
              aria-selected={selectedIndex === index}
              key={option.value}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(index)}
            >
              <span>{option.label}</span>
              {selectedIndex === index && <Check size={13} strokeWidth={2} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

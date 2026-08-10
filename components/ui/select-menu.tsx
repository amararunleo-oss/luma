"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

export type SelectMenuOption = { value: string; label: string };

type SelectMenuProps = {
  id: string;
  name: string;
  defaultValue?: string;
  options: SelectMenuOption[];
  ariaLabel: string;
  required?: boolean;
};

export function SelectMenu({ id, name, defaultValue = "", options, ariaLabel, required = false }: SelectMenuProps) {
  const root = useRef<HTMLDivElement>(null);
  const generatedId = useId();
  const listboxId = `${id}-${generatedId.replace(/:/g, "")}-listbox`;
  const initialIndex = Math.max(0, options.findIndex((option) => option.value === defaultValue));
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [open, setOpen] = useState(false);
  const selected = options[selectedIndex] ?? options[0];

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  function choose(index: number) {
    setSelectedIndex(index);
    setActiveIndex(index);
    setOpen(false);
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
    <div className={`select-menu${open ? " open" : ""}`} ref={root}>
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

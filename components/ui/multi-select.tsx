"use client";

import * as React from "react";
import { X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Command, CommandGroup, CommandItem } from "@/components/ui/command";
import { Command as CommandPrimitive } from "cmdk";
import { cn } from "@/lib/utils";

type Option = {
  value: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
};

interface MultiSelectProps {
  options: Option[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  isLoading?: boolean; // Adicionado
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Selecione...",
  className,
  disabled,
  isLoading, // Adicionado
  ...props
}: MultiSelectProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");

  const handleUnselect = React.useCallback((optionValue: string) => {
    onChange(selected.filter((s) => s !== optionValue));
  }, [onChange, selected]);

  const handleKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const input = inputRef.current;
    if (input) {
      if (e.key === "Delete" || e.key === "Backspace") {
        if (input.value === "" && selected.length > 0) {
          handleUnselect(selected[selected.length - 1]);
        }
      }
      if (e.key === "Escape") {
        input.blur();
      }
    }
  }, [handleUnselect, selected]);

  const selectables = options.filter((option) => !selected.includes(option.value));

  return (
    <Command onKeyDown={handleKeyDown} className={cn("overflow-visible bg-transparent", className)} {...props}>
      <div className={cn("group rounded-md border border-input px-3 py-2 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2", disabled && "cursor-not-allowed opacity-50")}>
        <div className="flex flex-wrap gap-1">
          {selected.map((value) => {
            const option = options.find((opt) => opt.value === value);
            if (!option) return null;
            return (
              <Badge key={option.value} variant="secondary">
                {option.label}
                <button
                  className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  onKeyDown={(e) => { if (e.key === "Enter") { handleUnselect(option.value); } }}
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onClick={() => handleUnselect(option.value)}
                  disabled={disabled}
                >
                  <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                </button>
              </Badge>
            );
          })}
          {/* Input field */}
          <CommandPrimitive.Input
            ref={inputRef}
            value={inputValue}
            onValueChange={setInputValue}
            onBlur={() => setOpen(false)}
            onFocus={() => setOpen(true)}
            placeholder={isLoading ? "Carregando..." : (selected.length > 0 ? "" : placeholder)}
            disabled={disabled || isLoading}
            className={cn("ml-2 flex-1 bg-transparent outline-none placeholder:text-muted-foreground", selected.length > 0 ? "w-auto" : "w-full")}
            style={{ minWidth: isLoading ? '100px' : (selected.length > 0 ? 'auto' : '100%') }} // Adjust width
          />
        </div>
      </div>
      <div className="relative mt-2">
        {open && selectables.length > 0 ? (
          <div className="absolute top-0 z-10 w-full rounded-md border bg-popover text-popover-foreground shadow-md outline-none animate-in">
            <CommandGroup className="h-full max-h-[200px] overflow-auto">
              {selectables.map((option) => {
                return (
                  <CommandItem
                    key={option.value}
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onSelect={() => {
                      setInputValue("");
                      onChange([...selected, option.value]);
                    }}
                    className={"cursor-pointer"}
                  >
                    {option.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </div>
        ) : null}
      </div>
    </Command>
  );
}
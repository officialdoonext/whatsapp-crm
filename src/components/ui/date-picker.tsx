"use client";

import * as React from "react";
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface DatePickerProps {
  value?: string | null; // "YYYY-MM-DD" or ISO string
  onChange: (dateStr: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  disabled = false,
  className,
  id,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Parse current selected date
  const selectedDate = React.useMemo(() => {
    if (!value) return null;
    try {
      if (value.includes("T")) return parseISO(value);
      const [y, m, d] = value.split("-").map(Number);
      return new Date(y, m - 1, d);
    } catch {
      return null;
    }
  }, [value]);

  // Current viewed month in calendar
  const [currentMonth, setCurrentMonth] = React.useState<Date>(
    () => selectedDate || new Date()
  );

  // Sync viewed month when selected date changes
  React.useEffect(() => {
    if (selectedDate) {
      setCurrentMonth(selectedDate);
    }
  }, [selectedDate]);

  // Close when clicked outside
  React.useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isOpen]);

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentMonth((prev) => subMonths(prev, 1));
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentMonth((prev) => addMonths(prev, 1));
  };

  const handleSelectDay = (day: Date) => {
    const formatted = format(day, "yyyy-MM-dd");
    onChange(formatted);
    setIsOpen(false);
  };

  const handleSelectToday = (e: React.MouseEvent) => {
    e.stopPropagation();
    const today = new Date();
    onChange(format(today, "yyyy-MM-dd"));
    setCurrentMonth(today);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setIsOpen(false);
  };

  // Generate calendar days
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const rows: Date[][] = [];
  let days: Date[] = [];
  let day = startDate;

  while (day <= endDate) {
    for (let i = 0; i < 7; i++) {
      days.push(day);
      day = addDays(day, 1);
    }
    rows.push(days);
    days = [];
  }

  const weekDays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  return (
    <div ref={containerRef} className="relative inline-block w-full">
      {/* Trigger Button (Max Height 36px, max radius 6px) */}
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "flex h-9 max-h-[36px] w-full items-center justify-between rounded-md border border-input bg-transparent px-2.5 py-1 text-sm text-foreground shadow-2xs transition-colors hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          !selectedDate && "text-muted-foreground",
          className
        )}
      >
        <span className="flex items-center gap-2 truncate">
          <CalendarIcon className="h-4 w-4 text-primary shrink-0" />
          <span className="truncate">
            {selectedDate ? format(selectedDate, "MMM d, yyyy") : placeholder}
          </span>
        </span>
        {selectedDate && !disabled && (
          <span
            role="button"
            tabIndex={0}
            onClick={handleClear}
            className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
          >
            <X className="h-3 w-3" />
          </span>
        )}
      </button>

      {/* Floating Custom Calendar Popover (Top of everything z-[99999]) */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 z-[99999] w-72 rounded-md border border-border bg-popover p-3 text-popover-foreground shadow-2xl animate-in fade-in-0 zoom-in-95">
          {/* Header Month / Year & Navigation */}
          <div className="flex items-center justify-between pb-2 border-b">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-input text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <span className="text-xs font-bold text-foreground">
              {format(currentMonth, "MMMM yyyy")}
            </span>

            <button
              type="button"
              onClick={handleNextMonth}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-input text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Weekday Labels */}
          <div className="grid grid-cols-7 pt-2 text-center text-[10px] font-semibold text-muted-foreground">
            {weekDays.map((d) => (
              <span key={d} className="py-1">
                {d}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="space-y-1 pt-1">
            {rows.map((week, idx) => (
              <div key={idx} className="grid grid-cols-7 gap-1">
                {week.map((dateItem) => {
                  const isCurrentMonth = isSameMonth(dateItem, currentMonth);
                  const isSelected = selectedDate && isSameDay(dateItem, selectedDate);
                  const isCurrentDay = isToday(dateItem);

                  return (
                    <button
                      key={dateItem.toISOString()}
                      type="button"
                      onClick={() => handleSelectDay(dateItem)}
                      className={cn(
                        "flex h-7 w-full items-center justify-center rounded text-xs font-medium transition-all cursor-pointer",
                        !isCurrentMonth && "text-muted-foreground/30 hover:text-muted-foreground",
                        isCurrentMonth && !isSelected && "text-foreground hover:bg-muted",
                        isCurrentDay && !isSelected && "border border-primary font-bold text-primary",
                        isSelected && "bg-primary text-primary-foreground font-bold shadow-2xs"
                      )}
                    >
                      {format(dateItem, "d")}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Quick Footer Action Buttons */}
          <div className="flex items-center justify-between border-t pt-2 mt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
            >
              Clear
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSelectToday}
              className="h-6 px-2 text-[11px] font-semibold"
            >
              Today
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

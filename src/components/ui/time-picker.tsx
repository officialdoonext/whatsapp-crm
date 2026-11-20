"use client";

import * as React from "react";
import { Clock, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface TimePickerProps {
  value?: string; // "HH:mm" in 24-hour format (e.g. "09:30", "18:00")
  onChange: (timeStr: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export function TimePicker({
  value,
  onChange,
  placeholder = "Select time",
  disabled = false,
  className,
  id,
}: TimePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Parse 24h "HH:mm" into 12h components
  const parsedTime = React.useMemo(() => {
    if (!value || !value.includes(":")) {
      return { hour12: "09", minute: "00", period: "AM" as "AM" | "PM", display: "" };
    }
    const [hStr, mStr] = value.split(":");
    let h = parseInt(hStr, 10);
    if (isNaN(h)) h = 9;
    const period: "AM" | "PM" = h >= 12 ? "PM" : "AM";
    let hour12Num = h % 12;
    if (hour12Num === 0) hour12Num = 12;
    const hour12 = hour12Num.toString().padStart(2, "0");
    const minute = (parseInt(mStr, 10) || 0).toString().padStart(2, "0");

    return {
      hour12,
      minute,
      period,
      display: `${hour12}:${minute} ${period}`,
    };
  }, [value]);

  const [selectedHour, setSelectedHour] = React.useState(parsedTime.hour12);
  const [selectedMinute, setSelectedMinute] = React.useState(parsedTime.minute);
  const [selectedPeriod, setSelectedPeriod] = React.useState(parsedTime.period);

  React.useEffect(() => {
    if (parsedTime.display) {
      setSelectedHour(parsedTime.hour12);
      setSelectedMinute(parsedTime.minute);
      setSelectedPeriod(parsedTime.period);
    }
  }, [parsedTime]);

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

  const commitTime = (h12: string, min: string, p: "AM" | "PM") => {
    let h = parseInt(h12, 10);
    if (p === "PM" && h < 12) h += 12;
    if (p === "AM" && h === 12) h = 0;
    const h24 = h.toString().padStart(2, "0");
    onChange(`${h24}:${min}`);
  };

  const handleSelectHour = (h: string) => {
    setSelectedHour(h);
    commitTime(h, selectedMinute, selectedPeriod);
  };

  const handleSelectMinute = (m: string) => {
    setSelectedMinute(m);
    commitTime(selectedHour, m, selectedPeriod);
  };

  const handleSelectPeriod = (p: "AM" | "PM") => {
    setSelectedPeriod(p);
    commitTime(selectedHour, selectedMinute, p);
  };

  const handleNow = (e: React.MouseEvent) => {
    e.stopPropagation();
    const now = new Date();
    const h24 = now.getHours().toString().padStart(2, "0");
    const m = now.getMinutes().toString().padStart(2, "0");
    onChange(`${h24}:${m}`);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setIsOpen(false);
  };

  const hours = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, "0"));
  const minutes = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, "0"));

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
          !parsedTime.display && "text-muted-foreground",
          className
        )}
      >
        <span className="flex items-center gap-2 truncate">
          <Clock className="h-4 w-4 text-primary shrink-0" />
          <span className="truncate font-mono">
            {parsedTime.display || placeholder}
          </span>
        </span>
        {parsedTime.display && !disabled && (
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

      {/* Floating Custom Time Popover (Top of everything z-[99999]) */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 z-[99999] w-64 rounded-md border border-border bg-popover p-3 text-popover-foreground shadow-2xl animate-in fade-in-0 zoom-in-95">
          <div className="flex items-center justify-between pb-2 border-b">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-primary" />
              Select Time
            </span>
            <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded">
              <button
                type="button"
                onClick={() => handleSelectPeriod("AM")}
                className={cn(
                  "px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer",
                  selectedPeriod === "AM"
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                AM
              </button>
              <button
                type="button"
                onClick={() => handleSelectPeriod("PM")}
                className={cn(
                  "px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer",
                  selectedPeriod === "PM"
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                PM
              </button>
            </div>
          </div>

          {/* Hours & Minutes Columns */}
          <div className="grid grid-cols-2 gap-2 pt-2.5">
            {/* Hours Column */}
            <div>
              <span className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 px-1">
                Hour
              </span>
              <div className="max-h-44 overflow-y-auto space-y-0.5 pr-1 scrollbar-thin">
                {hours.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => handleSelectHour(h)}
                    className={cn(
                      "w-full text-left px-2 py-1 rounded text-xs font-mono font-medium transition-all cursor-pointer flex items-center justify-between",
                      selectedHour === h
                        ? "bg-primary text-primary-foreground font-bold shadow-2xs"
                        : "text-foreground hover:bg-muted"
                    )}
                  >
                    <span>{h}</span>
                    {selectedHour === h && <Check className="h-3 w-3" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Minutes Column */}
            <div>
              <span className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 px-1">
                Minute
              </span>
              <div className="max-h-44 overflow-y-auto space-y-0.5 pr-1 scrollbar-thin">
                {minutes.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleSelectMinute(m)}
                    className={cn(
                      "w-full text-left px-2 py-1 rounded text-xs font-mono font-medium transition-all cursor-pointer flex items-center justify-between",
                      selectedMinute === m
                        ? "bg-primary text-primary-foreground font-bold shadow-2xs"
                        : "text-foreground hover:bg-muted"
                    )}
                  >
                    <span>:{m}</span>
                    {selectedMinute === m && <Check className="h-3 w-3" />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Footer Action Buttons */}
          <div className="flex items-center justify-between border-t pt-2 mt-2.5">
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
              onClick={handleNow}
              className="h-6 px-2 text-[11px] font-semibold"
            >
              Current Time
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

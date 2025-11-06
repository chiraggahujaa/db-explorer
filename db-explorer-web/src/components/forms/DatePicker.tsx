"use client"

import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { cn } from "@/utils/ui"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerProps {
  value?: Date | string
  onChange: (date: Date | undefined) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  disabled = false,
  className,
}: DatePickerProps) {
  // Convert string to Date if needed
  const dateValue = typeof value === "string" && value ? new Date(value) : value instanceof Date ? value : undefined

  // Calculate date restrictions for DOB (18-100 years old)
  const today = new Date()
  const maxDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate())
  const minDate = new Date(today.getFullYear() - 100, today.getMonth(), today.getDate())

  const handleSelect = (date: Date | undefined) => {
    onChange(date)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !dateValue && "text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          {dateValue ? (
            format(dateValue, "PPP")
          ) : (
            <span>{placeholder}</span>
          )}
          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={dateValue}
          onSelect={handleSelect}
          disabled={(date) =>
            date > maxDate || date < minDate
          }
          captionLayout="dropdown"
          fromYear={minDate.getFullYear()}
          toYear={maxDate.getFullYear()}
          defaultMonth={dateValue || maxDate}
        />
      </PopoverContent>
    </Popover>
  )
}
import * as React from "react"

import { cn } from "@/utils/ui"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface FormFieldProps extends React.ComponentProps<"input"> {
  label?: string;
  error?: string;
  showError?: boolean;
  required?: boolean;
  labelClassName?: string;
  fieldClassName?: string;
}

function FormField({
  label,
  error,
  showError = true,
  required = false,
  labelClassName,
  fieldClassName,
  className,
  id,
  ...props
}: FormFieldProps) {
  const hasError = Boolean(error);
  const generatedId = React.useId();
  const fieldId = id || generatedId;

  return (
    <div className={cn("space-y-2", fieldClassName)}>
      {label && (
        <Label htmlFor={fieldId} className={labelClassName}>
          {label}
          {required && <span className="text-destructive" style={{marginLeft: '-4px'}}>*</span>}
        </Label>
      )}
      <Input
        id={fieldId}
        aria-invalid={hasError}
        className={cn(
          hasError && "border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
          className
        )}
        {...props}
      />
      {error && showError && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  )
}

export { FormField }
"use client";

import { Control, FieldPath, FieldValues, useController } from "react-hook-form";

export interface NestedFieldController<T> {
  value: T;
  onChange: (value: T) => void;
  error?: string;
}

export type NestedFieldControllers<T extends Record<string, unknown>> = {
  [K in keyof T]: NestedFieldController<T[K]>;
};

/**
 * Helper function to update multiple nested fields at once
 */
export function updateNestedFields<T extends Record<string, unknown>>(
  controllers: NestedFieldControllers<T>,
  updates: Partial<T>
): void {
  Object.entries(updates).forEach(([key, value]) => {
    if (key in controllers && value !== undefined) {
      (controllers as Record<string, NestedFieldController<unknown>>)[key].onChange(value);
    }
  });
}

/**
 * Hook to create a single nested field controller
 * Use this multiple times for each field you need
 */
export function useNestedFieldController<
  TFieldValues extends FieldValues,
  TFieldName extends FieldPath<TFieldValues>
>(
  control: Control<TFieldValues>,
  name: TFieldName
): NestedFieldController<unknown> {
  const {
    field,
    fieldState: { error },
  } = useController({
    control,
    name,
  });

  return {
    value: field.value,
    onChange: field.onChange,
    error: error?.message,
  };
}
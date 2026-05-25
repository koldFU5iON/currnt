import { Controller, useFormContext } from "react-hook-form"
import { Field, FieldLabel, FieldError } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

interface FormFieldProps {
  name: string
  label: string
  type?: string
  placeholder?: string
  required?: boolean
  rows?: number
}

// <input type="date"> needs a local YYYY-MM-DD string, while the form holds a Date.
function toDateInputValue(value: unknown): string {
  const date =
    value instanceof Date ? value : value ? new Date(value as string) : null
  if (!date || Number.isNaN(date.getTime())) return ""
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function FormField({
  name,
  label,
  type = "text",
  placeholder,
  required = false,
  rows,
}: FormFieldProps) {
  const { control } = useFormContext()
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel>
            {label} {required && <span className="text-destructive">*</span>}
          </FieldLabel>
          {type === "textarea" ? (
            <Textarea
              {...field}
              placeholder={placeholder}
              rows={rows}
              aria-invalid={fieldState.invalid}
            />
          ) : type === "date" ? (
            <Input
              {...field}
              type="date"
              value={toDateInputValue(field.value)}
              onChange={(e) =>
                field.onChange(
                  e.target.value
                    ? new Date(`${e.target.value}T00:00:00`)
                    : undefined,
                )
              }
              aria-invalid={fieldState.invalid}
            />
          ) : (
            <Input
              {...field}
              type={type}
              placeholder={placeholder}
              aria-invalid={fieldState.invalid}
            />
          )}
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  )
}

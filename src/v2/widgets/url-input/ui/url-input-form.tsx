'use client'

import { useState } from 'react'

import { useForm } from '@tanstack/react-form'

import { v2Copy } from '@/v2/shared/lib/copy'
import { Button } from '@/v2/shared/ui/button'

import { parseUrlInputText } from '../model'

interface UrlInputFormProps {
  initialValue?: string
  onSubmit: (urls: string[]) => void
}

export function UrlInputForm({
  initialValue = '',
  onSubmit,
}: UrlInputFormProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const form = useForm({
    defaultValues: {
      urlsText: initialValue,
    },
    onSubmit: ({ value }) => {
      const result = parseUrlInputText(value.urlsText)

      if (!result.success) {
        setErrorMessage(result.message)
        return
      }

      setErrorMessage(null)
      onSubmit(result.urls)
    },
  })

  return (
    <form
      className="border-border bg-card text-card-foreground grid gap-4 rounded-xl border p-5 shadow-sm"
      data-tour="url-input"
      onSubmit={(event) => {
        event.preventDefault()
        event.stopPropagation()
        void form.handleSubmit()
      }}
    >
      <div className="grid gap-1.5">
        <h2 className="text-lg font-semibold">{v2Copy.urlInput.title}</h2>
        <p className="text-muted-foreground text-sm">
          {v2Copy.urlInput.description}
        </p>
      </div>

      <form.Field name="urlsText">
        {(field) => (
          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor={field.name}>
              {v2Copy.urlInput.label}
            </label>
            <textarea
              aria-describedby={
                errorMessage ? `${field.name}-error` : `${field.name}-hint`
              }
              aria-invalid={Boolean(errorMessage)}
              className="border-input bg-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 min-h-36 resize-y rounded-lg border px-3 py-2 text-sm shadow-xs transition-colors outline-none focus-visible:ring-3"
              id={field.name}
              name={field.name}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              placeholder={v2Copy.urlInput.placeholder}
              value={field.state.value}
            />
            <p
              className="text-muted-foreground text-xs"
              id={`${field.name}-hint`}
            >
              {v2Copy.urlInput.description}
            </p>
            {errorMessage ? (
              <p
                className="text-destructive text-sm"
                id={`${field.name}-error`}
              >
                {errorMessage}
              </p>
            ) : null}
          </div>
        )}
      </form.Field>

      <div className="flex justify-end">
        <Button type="submit">{v2Copy.urlInput.submit}</Button>
      </div>
    </form>
  )
}

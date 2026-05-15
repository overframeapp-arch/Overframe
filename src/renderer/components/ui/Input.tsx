import * as React from 'react'
import { cn } from '../../lib/cn'

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'flex h-7 w-full rounded bg-input px-2.5 py-1 text-xs',
        'border border-transparent',
        'placeholder:text-muted-foreground',
        'focus-visible:outline-none focus-visible:border-primary/50 focus-visible:ring-0',
        'transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-40',
        className
      )}
      {...props}
    />
  )
)
Input.displayName = 'Input'

import * as React from 'react'
import { cn } from '../../lib/cn'

const variantClasses = {
  default:     'bg-primary text-primary-foreground hover:bg-primary/85 shadow-sm',
  ghost:       'bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
  outline:     'border border-border bg-transparent hover:bg-muted text-foreground',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/85',
} as const

const sizeClasses = {
  sm:   'h-6 px-2 text-[11px]',
  md:   'h-7 px-2.5 text-xs',
  icon: 'h-6 w-6 p-0',
} as const

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variantClasses
  size?: keyof typeof sizeClasses
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'ghost', size = 'md', type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center rounded font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        'disabled:opacity-40 disabled:pointer-events-none',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    />
  )
)
Button.displayName = 'Button'

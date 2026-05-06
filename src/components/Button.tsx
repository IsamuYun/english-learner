import { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  leading?: ReactNode
  trailing?: ReactNode
}

const base =
  'inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 ease-apple disabled:opacity-40 disabled:cursor-not-allowed select-none active:scale-[0.98]'

const variants: Record<Variant, string> = {
  primary:
    'bg-accent text-white hover:bg-accent-hover shadow-[0_1px_2px_rgba(0,113,227,0.25)]',
  secondary:
    'bg-surface-alt text-ink-900 hover:bg-line-soft',
  ghost:
    'bg-transparent text-ink-700 hover:bg-surface-alt',
  danger:
    'bg-bad text-white hover:opacity-90',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] rounded-lg',
  md: 'h-10 px-4 text-sm rounded-xl',
  lg: 'h-12 px-6 text-[15px] rounded-xl2',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  leading,
  trailing,
  className = '',
  children,
  ...rest
}: Props) {
  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...rest}>
      {leading}
      <span>{children}</span>
      {trailing}
    </button>
  )
}

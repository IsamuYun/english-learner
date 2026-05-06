import { HTMLAttributes, ReactNode } from 'react'

interface Props extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  padded?: boolean
  elevated?: boolean
}

export default function Card({
  children,
  padded = true,
  elevated = false,
  className = '',
  ...rest
}: Props) {
  return (
    <div
      className={[
        'bg-surface rounded-xl2 hairline',
        padded ? 'p-6' : '',
        elevated ? 'shadow-card' : '',
        className,
      ].join(' ')}
      {...rest}
    >
      {children}
    </div>
  )
}

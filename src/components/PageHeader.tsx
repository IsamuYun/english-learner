import { ReactNode } from 'react'

interface Props {
  eyebrow?: string
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}

export default function PageHeader({ eyebrow, title, description, actions }: Props) {
  return (
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
      <div className="space-y-2">
        {eyebrow && (
          <div className="text-[12px] uppercase tracking-[0.14em] text-accent font-medium">
            {eyebrow}
          </div>
        )}
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-ink-900">
          {title}
        </h1>
        {description && (
          <p className="text-[15px] text-ink-500 max-w-xl leading-relaxed">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

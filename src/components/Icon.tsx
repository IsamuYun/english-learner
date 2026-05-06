import { SVGProps } from 'react'

type Name =
  | 'speaker'
  | 'mic'
  | 'mic-off'
  | 'arrow-right'
  | 'arrow-left'
  | 'check'
  | 'cross'
  | 'sparkle'
  | 'flame'
  | 'book'
  | 'pen'
  | 'flashcard'
  | 'chat'
  | 'chevron-right'
  | 'chevron-down'
  | 'settings'
  | 'home'
  | 'refresh'
  | 'play'
  | 'stop'
  | 'list'

interface Props extends SVGProps<SVGSVGElement> {
  name: Name
  size?: number
}

export default function Icon({ name, size = 18, ...rest }: Props) {
  const props: SVGProps<SVGSVGElement> = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    ...rest,
  }
  switch (name) {
    case 'speaker':
      return (
        <svg {...props}>
          <path d="M5 9v6h4l5 4V5L9 9H5z" />
          <path d="M16.5 8.5a5 5 0 0 1 0 7" />
          <path d="M19 6a8 8 0 0 1 0 12" />
        </svg>
      )
    case 'mic':
      return (
        <svg {...props}>
          <rect x="9" y="3" width="6" height="12" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0" />
          <path d="M12 18v3" />
        </svg>
      )
    case 'mic-off':
      return (
        <svg {...props}>
          <path d="M3 3l18 18" />
          <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
          <path d="M15 9V6a3 3 0 0 0-6 0" />
          <path d="M5 11a7 7 0 0 0 11.5 5.5" />
          <path d="M19 11a7 7 0 0 1-1 3.5" />
        </svg>
      )
    case 'arrow-right':
      return (
        <svg {...props}>
          <path d="M5 12h14" />
          <path d="M13 6l6 6-6 6" />
        </svg>
      )
    case 'arrow-left':
      return (
        <svg {...props}>
          <path d="M19 12H5" />
          <path d="M11 6l-6 6 6 6" />
        </svg>
      )
    case 'check':
      return (
        <svg {...props}>
          <path d="M5 12l5 5L20 7" />
        </svg>
      )
    case 'cross':
      return (
        <svg {...props}>
          <path d="M6 6l12 12" />
          <path d="M18 6L6 18" />
        </svg>
      )
    case 'sparkle':
      return (
        <svg {...props}>
          <path d="M12 3l1.8 4.6L18.5 9.5l-4.7 1.9L12 16l-1.8-4.6L5.5 9.5l4.7-1.9L12 3z" />
          <path d="M19 15l.9 2.2L22 18l-2.1.8L19 21l-.9-2.2L16 18l2.1-.8L19 15z" />
        </svg>
      )
    case 'flame':
      return (
        <svg {...props}>
          <path d="M12 3c1 4 4 5 4 9a4 4 0 0 1-8 0c0-2 1-3 1-5 0 0 2 1 3-4z" />
        </svg>
      )
    case 'book':
      return (
        <svg {...props}>
          <path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2V5z" />
          <path d="M8 7h8M8 11h8M8 15h6" />
        </svg>
      )
    case 'pen':
      return (
        <svg {...props}>
          <path d="M14.7 3.3a2.4 2.4 0 0 1 3.4 3.4L7 18l-4 1 1-4 10.7-11.7z" />
        </svg>
      )
    case 'flashcard':
      return (
        <svg {...props}>
          <rect x="3" y="6" width="18" height="13" rx="3" />
          <path d="M7 11h10M7 14h6" />
        </svg>
      )
    case 'chat':
      return (
        <svg {...props}>
          <path d="M21 12a8 8 0 0 1-8 8H7l-4 3V12a8 8 0 0 1 16 0z" />
        </svg>
      )
    case 'chevron-right':
      return (
        <svg {...props}>
          <path d="M9 6l6 6-6 6" />
        </svg>
      )
    case 'chevron-down':
      return (
        <svg {...props}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      )
    case 'settings':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 13.6a7.7 7.7 0 0 0 0-3.2l2-1.5-2-3.4-2.4.8a7.7 7.7 0 0 0-2.7-1.6L13.5 2h-3l-.8 2.7A7.7 7.7 0 0 0 7 6.3l-2.4-.8-2 3.4 2 1.5a7.7 7.7 0 0 0 0 3.2l-2 1.5 2 3.4 2.4-.8a7.7 7.7 0 0 0 2.7 1.6l.8 2.7h3l.8-2.7a7.7 7.7 0 0 0 2.7-1.6l2.4.8 2-3.4-2-1.5z" />
        </svg>
      )
    case 'home':
      return (
        <svg {...props}>
          <path d="M3 11l9-8 9 8" />
          <path d="M5 10v10h14V10" />
        </svg>
      )
    case 'refresh':
      return (
        <svg {...props}>
          <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
          <path d="M21 3v5h-5" />
          <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
          <path d="M3 21v-5h5" />
        </svg>
      )
    case 'play':
      return (
        <svg {...props}>
          <path d="M7 5l12 7-12 7V5z" />
        </svg>
      )
    case 'stop':
      return (
        <svg {...props}>
          <rect x="6" y="6" width="12" height="12" rx="2" />
        </svg>
      )
    case 'list':
      return (
        <svg {...props}>
          <path d="M8 6h13M8 12h13M8 18h13" />
          <circle cx="4" cy="6" r="1" />
          <circle cx="4" cy="12" r="1" />
          <circle cx="4" cy="18" r="1" />
        </svg>
      )
  }
}

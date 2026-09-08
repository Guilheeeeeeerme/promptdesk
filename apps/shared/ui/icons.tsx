import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function base(props: IconProps) {
  return {
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
    ...props,
  };
}

export function ExternalLinkIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6.5 3.5H3.5A1 1 0 0 0 2.5 4.5v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-3" />
      <path d="M9.5 2.5h4v4" />
      <path d="M7.5 8.5 13.5 2.5" />
    </svg>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M2.5 4.5h11" />
      <path d="M2.5 8h11" />
      <path d="M2.5 11.5h11" />
    </svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M8 3.5v9" />
      <path d="M3.5 8h9" />
    </svg>
  );
}

export function BuildingIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3.5 13.5V4.5A1 1 0 0 1 4.5 3.5h7a1 1 0 0 1 1 1v9" />
      <path d="M2.5 13.5h11" />
      <path d="M6 6.5h1" />
      <path d="M9 6.5h1" />
      <path d="M6 9.5h1" />
      <path d="M9 9.5h1" />
    </svg>
  );
}

export function FileIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4.5 2.5h5l3 3v8a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1Z" />
      <path d="M9.5 2.5v3h3" />
    </svg>
  );
}

export function UploadIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M8 10.5V3.5" />
      <path d="M5.5 6 8 3.5 10.5 6" />
      <path d="M3.5 12.5h9" />
    </svg>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3.5 5.5h9" />
      <path d="M6 5.5V3.5h4v2" />
      <path d="M5 5.5l.5 8h5l.5-8" />
    </svg>
  );
}

export function EyeIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M2.5 8s2.5-4 5.5-4 5.5 4 5.5 4-2.5 4-5.5 4-5.5-4-5.5-4Z" />
      <circle cx="8" cy="8" r="1.5" />
    </svg>
  );
}

export function ChatIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3.5 3.5h9a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H7l-2.5 2.5V10.5h-1a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="8" cy="8" r="2.5" />
      <path d="M8 2.5v1.5M8 12v1.5M2.5 8H4M12 8h1.5M3.8 3.8l1.1 1.1M11.1 11.1l1.1 1.1M12.2 3.8l-1.1 1.1M4.9 11.1l-1.1 1.1" />
    </svg>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M11.5 9.2A4.5 4.5 0 0 1 6.8 4.5 4.5 4.5 0 1 0 11.5 9.2Z" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

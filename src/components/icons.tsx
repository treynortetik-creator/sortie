import type { ReactNode, SVGProps } from 'react';

function Icon({ children, ...p }: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
      {children}
    </svg>
  );
}
type P = SVGProps<SVGSVGElement>;

export const CameraIcon = (p: P) => <Icon {...p}><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13" r="3.5" /></Icon>;
export const ListIcon = (p: P) => <Icon {...p}><path d="M8 6h13M8 12h13M8 18h13" /><circle cx="3.5" cy="6" r="1" /><circle cx="3.5" cy="12" r="1" /><circle cx="3.5" cy="18" r="1" /></Icon>;
export const CalendarIcon = (p: P) => <Icon {...p}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></Icon>;
export const GearIcon = (p: P) => <Icon {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></Icon>;
export const MicIcon = (p: P) => <Icon {...p}><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></Icon>;
export const StopIcon = (p: P) => <Icon {...p} fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></Icon>;
export const CheckIcon = (p: P) => <Icon {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></Icon>;
export const TrashIcon = (p: P) => <Icon {...p}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></Icon>;
export const DownloadIcon = (p: P) => <Icon {...p}><path d="M12 4v12m0 0l-4-4m4 4l4-4M5 20h14" /></Icon>;
export const ImageIcon = (p: P) => <Icon {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.5" /><path d="M21 16l-5-5-8 8" /></Icon>;
export const CloudOffIcon = (p: P) => <Icon {...p}><path d="M3 3l18 18M8.5 6.2A6 6 0 0 1 18 10a4 4 0 0 1 3 6.5M6 18a4 4 0 0 1-.7-7.9" /></Icon>;
export const RefreshIcon = (p: P) => <Icon {...p}><path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5" /></Icon>;
export const ChevronIcon = (p: P) => <Icon {...p}><path d="M9 6l6 6-6 6" /></Icon>;
export const XIcon = (p: P) => <Icon {...p}><path d="M6 6l12 12M18 6L6 18" /></Icon>;
export const SearchIcon = (p: P) => <Icon {...p}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></Icon>;
export const MergeIcon = (p: P) => <Icon {...p}><path d="M6 3v6a6 6 0 0 0 6 6h6M18 15l-3-3m3 3l-3 3M6 21v-3" /></Icon>;
export const PlayIcon = (p: P) => <Icon {...p} fill="currentColor"><path d="M8 5v14l11-7z" /></Icon>;
export const PlusIcon = (p: P) => <Icon {...p}><path d="M12 5v14M5 12h14" /></Icon>;
export const AlertIcon = (p: P) => <Icon {...p}><path d="M12 3l10 18H2L12 3zM12 10v5M12 18v.5" /></Icon>;

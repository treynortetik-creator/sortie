'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarIcon, CameraIcon, GearIcon, ListIcon } from './icons';

const TABS = [
  { href: '/', label: 'Capture', Icon: CameraIcon },
  { href: '/leads', label: 'Leads', Icon: ListIcon },
  { href: '/events', label: 'Events', Icon: CalendarIcon },
  { href: '/settings', label: 'Settings', Icon: GearIcon },
] as const;

export function TabBar() {
  const path = usePathname();
  const onCapture = path === '/';
  return (
    <nav
      aria-label="Main"
      className={`fixed inset-x-0 bottom-0 z-40 border-t ${onCapture ? 'border-white/10 bg-black text-white' : 'border-line bg-surface text-ink'}`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-xl">
        {TABS.map(({ href, label, Icon }) => {
          const active = href === '/' ? path === '/' : path.startsWith(href) || (href === '/leads' && path.startsWith('/lead'));
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex h-[var(--tabbar-h)] flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${active ? 'text-accent' : onCapture ? 'text-white/70' : 'text-muted'}`}
              >
                <Icon width={26} height={26} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

'use client';

import { useRouter, usePathname } from 'next/navigation';
import { logout, type CurrentUser } from '../lib/api-client';

interface ShellProps {
  user: CurrentUser;
  children: React.ReactNode;
}

const NAV = [
  { label: 'Overview', href: '/dashboard' },
  { label: 'Hotel Settings', href: '/dashboard/hotel' },
  { label: 'Rooms', href: '/dashboard/rooms' },
  { label: 'Guests', href: '/dashboard/guests' },
  { label: 'Reservations', href: '/dashboard/reservations' },
  { label: 'Front Desk', href: '/dashboard/front-desk' },
  { label: 'Housekeeping', href: '/dashboard/housekeeping' },
  { label: 'Billing', href: '/dashboard/billing' },
  { label: 'Reports', href: '/dashboard/reports' },
];

export function Shell({ user, children }: ShellProps) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div style={s.shell}>
      <header style={s.header}>
        <div style={s.headerLeft}>
          <strong style={s.logo}>PROPETRA</strong>
          {user.tenant && <span style={s.badge}>{user.tenant.name}</span>}
        </div>
        <div style={s.headerRight}>
          <span style={s.userInfo}>
            {user.firstName} {user.lastName}
            {user.role && ` · ${user.role.name}`}
          </span>
          <button
            style={s.logoutBtn}
            onClick={() => { logout(); router.replace('/login'); }}
          >
            Sign out
          </button>
        </div>
      </header>

      <div style={s.body}>
        <nav style={s.sidebar}>
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              style={{
                ...s.navLink,
                ...(pathname === item.href ? s.navLinkActive : {}),
              }}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <main style={s.main}>{children}</main>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  shell: { minHeight: '100vh', fontFamily: 'system-ui, sans-serif', background: '#f4f5f7', display: 'flex', flexDirection: 'column' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 1.5rem', height: 56, background: '#1a4d8f', color: '#fff', flexShrink: 0 },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  logo: { fontSize: '1.1rem', letterSpacing: '0.04em' },
  badge: { padding: '0.15rem 0.6rem', borderRadius: 12, background: 'rgba(255,255,255,0.15)', fontSize: '0.8rem' },
  headerRight: { display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.875rem' },
  userInfo: { opacity: 0.85 },
  logoutBtn: { padding: '0.3rem 0.75rem', borderRadius: 4, border: '1px solid rgba(255,255,255,0.45)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: '0.85rem' },
  body: { display: 'flex', flex: 1 },
  sidebar: { width: 200, background: '#fff', borderRight: '1px solid #e2e4e8', padding: '1.25rem 0', display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 },
  navLink: { display: 'block', padding: '0.5rem 1.25rem', fontSize: '0.9rem', color: '#374151', textDecoration: 'none', borderRadius: 4, margin: '0 0.5rem' },
  navLinkActive: { background: '#e8eef8', color: '#1a4d8f', fontWeight: 600 },
  main: { flex: 1, padding: '2rem', overflowY: 'auto' },
};

'use client';

import { useRouter, usePathname } from 'next/navigation';
import { logout, type CurrentUser } from '../lib/api-client';

interface AdminShellProps {
  user: CurrentUser;
  children: React.ReactNode;
}

const NAV = [
  { label: 'Tenants', href: '/admin' },
  { label: 'Onboard Tenant', href: '/admin/onboard' },
];

export function AdminShell({ user, children }: AdminShellProps) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div style={s.shell}>
      <header style={s.header}>
        <div style={s.headerLeft}>
          <strong style={s.logo}>PROPETRA</strong>
          <span style={s.badge}>TEAM PETRA · Admin Console</span>
        </div>
        <div style={s.headerRight}>
          <span style={s.userInfo}>{user.firstName} {user.lastName}</span>
          <button style={s.logoutBtn} onClick={() => { logout(); router.replace('/login'); }}>
            Sign out
          </button>
        </div>
      </header>

      <div style={s.body}>
        <nav style={s.sidebar}>
          <p style={s.navSection}>Platform</p>
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              style={{ ...s.navLink, ...(pathname === item.href ? s.navLinkActive : {}) }}
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
  shell: { minHeight: '100vh', fontFamily: 'system-ui, sans-serif', background: '#0f1117', display: 'flex', flexDirection: 'column', color: '#e2e8f0' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 1.5rem', height: 56, background: '#1e2130', borderBottom: '1px solid #2d3148', flexShrink: 0 },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  logo: { fontSize: '1.1rem', letterSpacing: '0.04em', color: '#fff' },
  badge: { padding: '0.15rem 0.65rem', borderRadius: 12, background: '#7c3aed', fontSize: '0.75rem', color: '#fff', fontWeight: 600 },
  headerRight: { display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.875rem' },
  userInfo: { color: '#94a3b8' },
  logoutBtn: { padding: '0.3rem 0.75rem', borderRadius: 4, border: '1px solid #374151', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: '0.85rem' },
  body: { display: 'flex', flex: 1 },
  sidebar: { width: 200, background: '#1e2130', borderRight: '1px solid #2d3148', padding: '1.25rem 0', display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 },
  navSection: { margin: '0 1rem 0.5rem', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#4b5563', fontWeight: 700 },
  navLink: { display: 'block', padding: '0.5rem 1.25rem', fontSize: '0.875rem', color: '#94a3b8', textDecoration: 'none', borderRadius: 4, margin: '0 0.5rem' },
  navLinkActive: { background: '#2d3148', color: '#a78bfa', fontWeight: 600 },
  main: { flex: 1, padding: '2rem', overflowY: 'auto' },
};

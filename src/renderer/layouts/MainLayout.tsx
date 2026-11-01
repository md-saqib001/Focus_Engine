import React from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, History as HistoryIcon, Settings as SettingsIcon, BarChart3, ShieldCheck } from 'lucide-react'

const MainLayout: React.FC = () => {
  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'History', path: '/history', icon: HistoryIcon },
    { name: 'Analytics', path: '/analytics', icon: BarChart3 },
    { name: 'Settings', path: '/settings', icon: SettingsIcon },
    { name: 'Debug', path: '/debug', icon: ShieldCheck }
  ]

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', backgroundColor: '#0f0f17', color: '#f8fafc', fontFamily: 'Inter, sans-serif' }}>
      {/* Sidebar */}
      <aside style={{ width: '260px', backgroundColor: '#181824', borderRight: '1px solid #232336', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
          {/* Logo Section */}
          <div style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid #232336' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #818cf8, #4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '18px', color: '#ffffff', boxShadow: '0 0 12px rgba(129, 140, 248, 0.4)' }}>
              F
            </div>
            <span style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '0.5px', background: 'linear-gradient(to right, #ffffff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Focus Engine
            </span>
          </div>

          {/* Navigation Links */}
          <nav style={{ flex: 1, padding: '20px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  style={({ isActive }) => ({
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    color: isActive ? '#ffffff' : '#94a3b8',
                    backgroundColor: isActive ? '#232336' : 'transparent',
                    textDecoration: 'none',
                    fontSize: '14px',
                    fontWeight: isActive ? 600 : 500,
                    transition: 'all 0.2s ease',
                    border: isActive ? '1px solid #2e2e48' : '1px solid transparent',
                    boxShadow: isActive ? '0 4px 12px rgba(0, 0, 0, 0.1)' : 'none'
                  })}
                  className="nav-link-hover"
                >
                  {({ isActive }) => {
                    return (
                      <>
                        <Icon size={18} style={{ color: isActive ? '#818cf8' : '#94a3b8', transition: 'color 0.2s ease' }} />
                        <span>{item.name}</span>
                      </>
                    )
                  }}
                </NavLink>
              )
            })}
          </nav>

          {/* Footer Status */}
          <div style={{ padding: '16px 24px', borderTop: '1px solid #232336', fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block', boxShadow: '0 0 8px #10b981' }}></span>
            <span>Engine Offline (Skeleton)</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main style={{ flex: 1, height: '100%', overflowY: 'auto', backgroundColor: '#0f0f17' }}>
        <Outlet />
      </main>

      {/* Inline styles for custom hover behavior */}
      <style>{`
        .nav-link-hover:hover {
          color: #ffffff !important;
          background-color: #1e1e2f !important;
        }
      `}</style>
    </div>
  )
}

export default MainLayout

import React from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import MainLayout from './layouts/MainLayout'
import Dashboard from './pages/Dashboard'
import History from './pages/History'
import Analytics from './pages/Analytics'
import Settings from './pages/Settings'
import Debug from './pages/Debug'
import { FocusSessionProvider } from './context/FocusSessionContext'

const App: React.FC = () => {
  return (
    <FocusSessionProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="history" element={<History />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="settings" element={<Settings />} />
            <Route path="debug" element={<Debug />} />
          </Route>
        </Routes>
      </HashRouter>
    </FocusSessionProvider>
  )
}

export default App

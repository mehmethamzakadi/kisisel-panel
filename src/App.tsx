import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import { DashboardPage } from './pages/DashboardPage'
import { NotesPage } from './pages/NotesPage'
import { MealsPage } from './pages/MealsPage'
import { MusicPage } from './pages/MusicPage'
import { Login } from './components/Login'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(!isSupabaseConfigured)

  useEffect(() => {
    if (!supabase) return

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) =>
      setSession(s),
    )
    return () => listener.subscription.unsubscribe()
  }, [])

  if (!isSupabaseConfigured) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<DashboardPage demo />} />
          <Route path="/notlar" element={<NotesPage />} />
          <Route path="/tarifler" element={<MealsPage />} />
          <Route path="/muzik" element={<MusicPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    )
  }

  if (!ready) return <main className="min-h-dvh" />
  if (!session) return <Login />

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DashboardPage email={session.user.email} />} />
        <Route path="/notlar" element={<NotesPage />} />
        <Route path="/tarifler" element={<MealsPage />} />
        <Route path="/muzik" element={<MusicPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App

import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function Login() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>(
    'idle',
  )
  const [message, setMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase) return

    setStatus('sending')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })

    if (error) {
      setStatus('error')
      setMessage(error.message)
    } else {
      setStatus('sent')
      setMessage('Giriş bağlantısı e-postana gönderildi.')
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-edge bg-card p-6 shadow-sm"
      >
        <h1 className="text-xl font-semibold">Panelim</h1>
        <p className="mt-1 mb-5 text-sm text-muted">
          E-posta adresine tek kullanımlık giriş bağlantısı gönderilir.
        </p>

        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ornek@eposta.com"
          autoComplete="email"
          className="w-full rounded-lg border border-edge bg-panel/60 px-3 py-2.5 text-ink outline-none focus:border-accent focus:bg-card"
        />

        <button
          type="submit"
          disabled={status === 'sending' || status === 'sent'}
          className="mt-3 w-full rounded-lg bg-accent px-3 py-2.5 font-medium text-white disabled:opacity-50"
        >
          {status === 'sending' ? 'Gönderiliyor…' : 'Giriş bağlantısı gönder'}
        </button>

        {message && (
          <p
            className={`mt-3 text-sm ${
              status === 'error' ? 'text-down' : 'text-muted'
            }`}
          >
            {message}
          </p>
        )}
      </form>
    </main>
  )
}

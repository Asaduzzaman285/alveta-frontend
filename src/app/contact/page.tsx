'use client'

import { useState, type FormEvent } from 'react'
import { Mail, Loader2, CheckCircle2 } from 'lucide-react'
import { Header } from '@/components/landing/Header'
import { Footer } from '@/components/landing/Footer'
import apiClient from '@/lib/api-client'
import { isAxiosError } from 'axios'

export default function ContactPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setStatus('submitting')
    setError(null)
    try {
      await apiClient.post('/api/v1/contact', { name, email, message })
      setStatus('sent')
    } catch (err) {
      setStatus('idle')
      const fallback = "Something went wrong. Please try again in a moment."
      if (isAxiosError(err)) {
        setError(err.response?.data?.message ?? fallback)
      } else {
        setError(fallback)
      }
    }
  }

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <div className="px-6 pt-6 sm:px-8 sm:pt-8">
        <Header />
      </div>

      <main className="mx-auto max-w-xl px-6 py-16 sm:px-8">
        <h1 className="font-display text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
          Get in touch
        </h1>
        <p className="mt-3 text-neutral-600">
          Questions, feedback, or something not working right? Send us a message and we&apos;ll get back to you.
        </p>

        {status === 'sent' ? (
          <div className="mt-10 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-800">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-medium">Message sent</p>
              <p className="mt-1 text-sm text-emerald-700">Thanks for reaching out — we&apos;ll get back to you soon.</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-10 space-y-5">
            <div>
              <label htmlFor="contact-name" className="mb-1.5 block text-sm font-medium text-neutral-700">
                Name
              </label>
              <input
                id="contact-name"
                type="text"
                required
                maxLength={255}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your full name"
                className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label htmlFor="contact-email" className="mb-1.5 block text-sm font-medium text-neutral-700">
                Email
              </label>
              <input
                id="contact-email"
                type="email"
                required
                maxLength={255}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label htmlFor="contact-message" className="mb-1.5 block text-sm font-medium text-neutral-700">
                Message
              </label>
              <textarea
                id="contact-message"
                required
                maxLength={5000}
                rows={6}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="How can we help?"
                className="w-full resize-none rounded-xl border border-neutral-200 px-4 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={status === 'submitting'}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {status === 'submitting' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4" />
                  Send message
                </>
              )}
            </button>
          </form>
        )}
      </main>

      <Footer />
    </div>
  )
}

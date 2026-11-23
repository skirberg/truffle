'use client'

import { useState } from 'react'

/** A color on /brand: the swatch is a button that copies its HEX, and says so for a moment. */
export function Swatch({ name, hex, role, ink }: { name: string; hex: string; role: string; ink: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(hex)
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch {
      // No clipboard here: the value is on the swatch to read.
    }
  }
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${name}, ${hex}`}
        className="flex h-28 items-end rounded-md p-3 text-left text-ui-label font-semibold shadow-edge-faint transition-transform duration-(--motion-tap) ease-out active:scale-[0.98]"
        style={{ background: hex, color: ink }}
      >
        <span aria-live="polite">{copied ? 'Copied' : hex}</span>
      </button>
      <p className="text-ui-small font-semibold">{name}</p>
      <p className="-mt-2 text-ui-label font-medium text-soft">{role}</p>
    </div>
  )
}

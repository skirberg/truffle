import Link from 'next/link'

/** A page that isn't there, in the product's own words: what happened, why it might have, and the way back. */
export function NoPage({ title, line }: { title: string; line: string }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[520px] flex-col justify-center gap-4 px-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/wordmark.svg" alt="Truffle" width={120} height={36} className="h-9 w-auto self-start" />
      <h1 className="text-title font-extrabold leading-[1.02] tracking-title max-[759px]:text-title-phone">{title}</h1>
      <p className="text-ui-body font-medium">{line}</p>
      <Link href="/value" className="self-start rounded-pill bg-truffle px-5 py-3 text-ui-body font-bold text-paper">
        Back to the map
      </Link>
    </main>
  )
}

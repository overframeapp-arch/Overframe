import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-6 py-32 text-center">
      <p className="text-sm uppercase tracking-widest text-primary/80">404</p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight md:text-5xl">
        Lost in the overlay
      </h1>
      <p className="mt-4 text-muted-foreground">
        The page you&rsquo;re looking for doesn&rsquo;t exist or has moved.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
      >
        Back to home
      </Link>
    </div>
  )
}

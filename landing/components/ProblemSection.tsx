export function ProblemSection() {
  return (
    <section className="px-6 pb-28 pt-4">
      <div className="mx-auto max-w-[600px] text-center">
        <div className="ov-divider mb-10">
          <span className="ov-divider-line" />
          <span className="ov-divider-icon" aria-hidden>&#x25C6;</span>
          <span className="ov-divider-line" />
        </div>

        <h2 className="mb-6 text-[clamp(1.2rem,2.8vw,1.55rem)] font-semibold tracking-wide text-[var(--text-head)]">
          Why I built this
        </h2>

        <p className="text-[clamp(0.95rem,2vw,1.08rem)] leading-[1.85] text-[var(--text)]">
          Every gamer knows the drill — wiki on the phone, Discord on a second screen,
          build guide in a tab that buries the game the second you switch.
          Overframe floats a real browser on top of your game, invisible to it.
          One hotkey to show it, one to hide it. Works with anti-cheat. Completely free.
        </p>

        <p className="mt-6 font-sans text-[0.82rem] text-[var(--text-dim)]">
          — A solo developer and PC gamer.
        </p>
      </div>
    </section>
  )
}

const AXES = [
  {
    eyebrow: 'Overlay',
    heading: 'Sits on top of everything.',
    items: [
      { icon: '◈', title: 'Always on top', desc: 'Works on any windowed or borderless game. Stays put after restarts.' },
      { icon: '◈', title: 'Click-through', desc: 'Press Alt+C and your clicks go straight through to the game.' },
      { icon: '◈', title: 'Per-game settings', desc: 'Adjust size and transparency for each game. Saved automatically.' },
    ],
  },
  {
    eyebrow: 'Security',
    heading: 'Never touches your game.',
    items: [
      { icon: '✓', title: 'No code injection', desc: 'Overframe never reaches into your game. Period.' },
      { icon: '✓', title: 'Invisible to the game', desc: 'Works exactly like the Discord overlay — a window that floats on top, nothing more.' },
      { icon: '✓', title: 'No special permissions', desc: 'Installs and runs like any regular app. No admin required.' },
    ],
  },
  {
    eyebrow: 'Browsing',
    heading: 'Real tabs. Real history.',
    items: [
      { icon: '◈', title: 'Full tab management', desc: 'Drag, mute, pin tabs. Background tabs sleep when hidden.' },
      { icon: '◈', title: 'Ad blocking', desc: 'Blocks ads and trackers. Pages load faster, fewer distractions.' },
      { icon: '◈', title: 'Your search engine', desc: 'Pick Google, DuckDuckGo, Bing or Brave. No forced defaults.' },
    ],
  },
  {
    eyebrow: 'Sharing',
    heading: 'Export once. Import anywhere.',
    items: [
      { icon: '◈', title: 'Per-game collections', desc: 'Group your favourite sites and wikis for each game.' },
      { icon: '◈', title: 'Share in one click', desc: 'Export your setup as a short code. Anyone can import it instantly.' },
      { icon: '◈', title: 'Auto-detects your games', desc: 'Supports Steam, Epic, GOG, Battle.net and more. No setup.' },
    ],
  },
]

export function FeaturesGrid() {
  return (
    <section
      id="features"
      className="scroll-mt-20 px-6 pb-24 pt-8"
      aria-labelledby="features-heading"
    >
      <div className="mx-auto max-w-[860px]">
        <div className="mb-10 text-center">
          <span className="mb-2 block font-sans text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-primary/70">
            Features
          </span>
          <h2
            id="features-heading"
            className="text-balance text-[clamp(1.6rem,3.5vw,2.4rem)] font-bold tracking-tight text-[var(--text-head)]"
          >
            A browser purpose-built for gaming.
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {AXES.map((axis) => (
            <div key={axis.eyebrow} className="feature-card">
              <div>
                <span className="mb-1 block font-sans text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-primary/70">
                  {axis.eyebrow}
                </span>
                <p className="text-[0.94rem] font-semibold leading-snug tracking-wide text-[var(--text-head)]">
                  {axis.heading}
                </p>
              </div>
              <ul className="flex flex-col gap-3">
                {axis.items.map((item) => (
                  <li key={item.title} className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-2">
                      <span className="text-[0.78rem] text-primary/70" aria-hidden>
                        {item.icon}
                      </span>
                      <span className="text-[0.88rem] font-semibold text-[var(--text-head)]">
                        {item.title}
                      </span>
                    </span>
                    <p className="pl-4 text-[0.83rem] leading-[1.65] text-[var(--text-dim)]">
                      {item.desc}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

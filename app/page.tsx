import Link from "next/link";

const highlights = [
  { icon: "◎", title: "Know your pipeline", text: "Keep every lead and its latest status in one clear view." },
  { icon: "↗", title: "Make every call count", text: "Log outcomes and follow up with the right people." },
  { icon: "▥", title: "See your momentum", text: "Track call activity and lead conversion at a glance." },
];

export default function Home() {
  return (
    <main className="landing-page min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="landing-glow landing-glow-one" aria-hidden="true" />
      <div className="landing-glow landing-glow-two" aria-hidden="true" />
      <header className="landing-header">
        <Link href="/" className="landing-brand" aria-label="LeadTrack home">
          <span className="landing-brand-mark">⚡</span>
          <span>LeadTrack</span>
        </Link>
        <div className="landing-header-actions">
          <span className="landing-header-note">Your next conversation starts here.</span>
          <Link href="/login" className="landing-signin">Sign in</Link>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-copy">
          <div className="landing-eyebrow"><span /> A clearer way to grow</div>
          <h1>Turn every lead into a <span>real conversation.</span></h1>
          <p className="landing-description">
            Organize your leads, make confident follow-ups, and see the progress behind every call—all in one focused workspace.
          </p>
          <div className="landing-actions">
            <Link href="/login?mode=signup" className="landing-primary">
              Create your account <span aria-hidden="true">→</span>
            </Link>
            <Link href="/login" className="landing-secondary">I already have an account</Link>
          </div>
          <div className="landing-proof"><span className="landing-proof-dot" /> Your leads stay organized. Your next step stays clear.</div>
        </div>

        <div className="landing-preview" aria-label="LeadTrack dashboard preview">
          <div className="preview-topbar">
            <div className="preview-brand"><span>⚡</span> LeadTrack</div>
            <div className="preview-label">SAMPLE DASHBOARD</div>
          </div>
          <div className="preview-content">
            <div className="preview-heading">
              <div><div className="preview-kicker">YOUR WORKSPACE</div><h2>Good morning 👋</h2><p>Here’s what’s happening with your leads.</p></div>
              <span className="preview-date">THIS WEEK</span>
            </div>
            <div className="preview-stats">
              <div><span>Active leads</span><strong>248</strong><small>↑ 12 this week</small></div>
              <div><span>Calls made</span><strong>36</strong><small>↑ 8 today</small></div>
              <div><span>Interested</span><strong>18</strong><small>7.3% conversion</small></div>
            </div>
            <div className="preview-panel">
              <div className="preview-panel-heading"><strong>Recent leads</strong><span>View all →</span></div>
              {[
                ["AS", "Ananya Sharma", "New", "blue"],
                ["RK", "Rohan Kapoor", "Interested", "green"],
                ["MP", "Meera Patel", "Follow up", "amber"],
              ].map(([initials, name, status, tone]) => (
                <div className="preview-lead" key={name}>
                  <span className={`preview-avatar ${tone}`}>{initials}</span>
                  <span className="preview-lead-name">{name}<small>Added recently</small></span>
                  <span className={`preview-status ${tone}`}>{status}</span>
                </div>
              ))}
            </div>
            <div className="preview-chart">
              <div><strong>Call activity</strong><span>Last 7 days</span></div>
              <div className="preview-bars" aria-hidden="true">{[32, 54, 42, 72, 49, 88, 64].map((height, i) => <i key={i} style={{ height: `${height}%` }} />)}</div>
              <div className="preview-days"><span>MON</span><span>TUE</span><span>WED</span><span>THU</span><span>FRI</span><span>SAT</span><span>SUN</span></div>
            </div>
          </div>
          <div className="preview-float"><span>✓</span><div><strong>Follow-up logged</strong><small>One step closer to a yes</small></div></div>
        </div>
      </section>

      <section className="landing-highlights" aria-label="LeadTrack features">
        {highlights.map((item) => (
          <article key={item.title} className="landing-highlight">
            <span className="landing-highlight-icon">{item.icon}</span>
            <div><h2>{item.title}</h2><p>{item.text}</p></div>
          </article>
        ))}
      </section>
      <footer className="landing-footer"><span>⚡ LeadTrack</span><span>Less chasing. More meaningful follow-through.</span></footer>
    </main>
  );
}

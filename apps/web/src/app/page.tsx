import Link from 'next/link';
import {
  Clock, AlertTriangle, Users, Zap, TrendingUp, Activity,
  GitBranch, Layers, Share2, BarChart2, Target, ArrowRight,
  CheckCircle2, Shield, RefreshCw, TriangleAlert,
} from 'lucide-react';
import { WaitlistForm } from '@/components/landing/WaitlistForm';

function GithubIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

const FEATURES = [
  {
    icon: Clock,       color: '#818cf8', bg: 'rgba(129,140,248,0.1)',
    title: 'Cycle Time',
    desc: 'Scatter distribution with P50 and P85 percentile lines. Trend comparison against the prior 30 days so you know if delivery is getting faster or slower.',
  },
  {
    icon: TrendingUp,  color: '#a78bfa', bg: 'rgba(167,139,250,0.1)',
    title: 'Lead Time',
    desc: 'Created to done, not just active time. Breaks down how long issues actually spend waiting versus being actively worked on.',
  },
  {
    icon: AlertTriangle, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',
    title: 'Bottleneck Tracker',
    desc: 'Identifies which stage issues wait in longest. Tracks persistence across consecutive 30-day windows and escalates recommendations when the same stage stays broken.',
  },
  {
    icon: BarChart2,   color: '#34d399', bg: 'rgba(52,211,153,0.1)',
    title: 'WIP and Flow',
    desc: 'Cumulative Flow Diagram showing how work distributes across stages each day. Spot pileups and flow breakdowns before they become delivery misses.',
  },
  {
    icon: Users,       color: '#60a5fa', bg: 'rgba(96,165,250,0.1)',
    title: 'Team Health',
    desc: 'Per-person completion counts, speed percentiles, and automatic flags for overloaded members, slow outliers, and high reactivation rates.',
  },
  {
    icon: Layers,      color: '#f472b6', bg: 'rgba(244,114,182,0.1)',
    title: 'Sprint Comparison',
    desc: 'Sprint-over-sprint velocity with P50 and P85 cycle time per sprint. Optional AI retrospective narrative powered by OpenRouter.',
  },
  {
    icon: Activity,    color: '#38bdf8', bg: 'rgba(56,189,248,0.1)',
    title: 'Flow Efficiency',
    desc: 'Ratio of active working time to total lead time, benchmarked against the industry median of 15%. Per-issue breakdown sorted by efficiency.',
  },
  {
    icon: GitBranch,   color: '#fb923c', bg: 'rgba(251,146,60,0.1)',
    title: 'Scope Creep',
    desc: 'Committed work vs mid-sprint additions, per sprint. Sprints above the 30% danger threshold are highlighted as a leading indicator of missed goals.',
  },
  {
    icon: Zap,         color: '#ef4444', bg: 'rgba(239,68,68,0.1)',
    title: 'At-Risk Radar',
    desc: 'Issues currently in progress that have already exceeded their state P85. Sorted by overage so you know exactly where to intervene right now.',
  },
  {
    icon: Target,      color: '#818cf8', bg: 'rgba(129,140,248,0.1)',
    title: 'Monte Carlo Forecast',
    desc: '10,000 simulations over your real historical throughput. Returns P50, P85, and P95 completion dates for any backlog size.',
  },
  {
    icon: Share2,      color: '#a78bfa', bg: 'rgba(167,139,250,0.1)',
    title: 'Shareable Dashboards',
    desc: 'One-click read-only link to any project dashboard. Recipients can view all charts without creating an account.',
  },
  {
    icon: RefreshCw,   color: '#34d399', bg: 'rgba(52,211,153,0.1)',
    title: 'Real-Time Sync',
    desc: 'Webhook support for instant updates on state changes. Backfill queue delivers recent data in under 15 minutes with full history in the background.',
  },
];

const SCREENSHOTS = [
  {
    file: 'cycle-time.png',
    title: 'Cycle time with Project Pulse',
    desc: 'The Pulse strip at the top surfaces your highest-severity signals on every page: active at-risk count, bottleneck state, and trend direction. The cycle time scatter shows every completed issue as a dot, with P50 and P85 lines and a comparison badge showing how the current period compares to the prior 30 days.',
    tag: 'Delivery Speed', tagColor: '#818cf8',
  },
  {
    file: 'bottleneck.png',
    title: 'Bottleneck Tracker with persistence detection',
    desc: 'Shows the average and P85 wait time per stage as a bar chart. When the same stage has been the bottleneck for three or more consecutive 30-day windows, the alert escalates to Critical and surfaces targeted action recommendations for that stage.',
    tag: 'Bottlenecks', tagColor: '#f59e0b',
  },
  {
    file: 'throughput.png',
    title: 'Team Health and Throughput',
    desc: 'Per-person issue counts and typical speed. The Team Health Flags section automatically surfaces members who are overloaded (high WIP), slow relative to the team (P85 more than 1.5x the median), or have an unusually high rate of issues being reopened.',
    tag: 'Team Output', tagColor: '#60a5fa',
  },
  {
    file: 'at-risk.png',
    title: 'At-Risk Radar',
    desc: 'Lists every currently in-progress issue that has already exceeded the P85 for its current state. Each row shows how far over the threshold it is, which assignee owns it, and a visual progress bar so you can triage at a glance.',
    tag: 'At-Risk', tagColor: '#ef4444',
  },
];

export default function LandingPage() {
  return (
    <div style={{ background: 'var(--bg)', color: 'var(--fg)', minHeight: '100vh' }}>

      {/* ─── Responsive styles ───────────────────────────────────────── */}
      <style>{`
        /* Layout primitives */
        .lp-section     { padding: 96px 24px; }
        .lp-hero-inner  { padding: 88px 24px 0; }

        /* Screenshot alternating rows */
        .lp-shot-row    { display: grid; gap: 48px; align-items: center; }
        .lp-shot-even   { grid-template-columns: 1fr 2.2fr; }
        .lp-shot-odd    { grid-template-columns: 2.2fr 1fr; }
        .lp-shot-list   { display: flex; flex-direction: column; gap: 96px; }

        /* Order: even row — text left, image right */
        .lp-text-even   { order: 0; }
        .lp-img-even    { order: 1; }
        /* Order: odd row — image left, text right */
        .lp-text-odd    { order: 1; }
        .lp-img-odd     { order: 0; }

        /* Dashboard and OS grids */
        .lp-dash-row    { display: grid; grid-template-columns: 2.2fr 1fr; gap: 48px; align-items: center; }
        .lp-os-grid     { display: grid; grid-template-columns: 1fr 1fr;   gap: 48px; align-items: start; }

        /* Code block */
        .lp-code-scroll { overflow-x: auto; }
        .lp-code-line   { display: flex; align-items: baseline; gap: 12px; white-space: nowrap; }

        /* Nav */
        .lp-nav-links   { display: flex; align-items: center; gap: 4px; }
        .lp-nav-gh      { display: flex; }

        /* Footer */
        .lp-footer-row  { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 20px; }

        /* ── Tablet (≤ 900px) ─────────────────────────────────────────── */
        @media (max-width: 900px) {
          .lp-nav-links  { display: none; }
          .lp-nav-gh     { display: none; }

          .lp-section    { padding: 64px 20px; }
          .lp-hero-inner { padding: 64px 20px 0; }
          .lp-shot-list  { gap: 64px; }

          .lp-shot-even,
          .lp-shot-odd   { grid-template-columns: 1fr; gap: 28px; }

          /* Always: text above image on mobile */
          .lp-text-even, .lp-text-odd { order: 0; }
          .lp-img-even,  .lp-img-odd  { order: 1; }

          .lp-dash-row   { grid-template-columns: 1fr; gap: 28px; }
          .lp-os-grid    { grid-template-columns: 1fr; gap: 40px; }

          .lp-footer-row { flex-direction: column; align-items: flex-start; }
        }

        /* ── Phone (≤ 640px) ──────────────────────────────────────────── */
        @media (max-width: 640px) {
          .lp-section    { padding: 48px 16px; }
          .lp-hero-inner { padding: 52px 16px 0; }
          .lp-shot-list  { gap: 52px; }
          .lp-code-line  { white-space: normal; word-break: break-all; }
        }
      `}</style>

      {/* ─── Nav ─────────────────────────────────────────────────────── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        borderBottom: '1px solid var(--border)',
        background: 'rgba(7,7,16,0.88)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}>
        <div style={{
          maxWidth: 1120, margin: '0 auto', padding: '0 20px',
          height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
        }}>
          {/* Logo */}
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'var(--brand-gradient)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <BarChart2 size={15} color="#fff" strokeWidth={2.5} />
            </div>
            <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em' }}>Cadence</span>
          </Link>

          {/* Nav links — hidden on mobile via .lp-nav-links */}
          <div className="lp-nav-links">
            {[
              { label: 'Features',     href: '#features' },
              { label: 'Screenshots',  href: '#screenshots' },
              { label: 'Open Source',  href: '#open-source' },
              { label: 'Quick Start',  href: '#quick-start' },
            ].map((link) => (
              <a key={link.href} href={link.href} style={{
                fontSize: 13.5, fontWeight: 500, color: 'var(--fg-muted)',
                textDecoration: 'none', padding: '5px 11px', borderRadius: 7,
              }}>
                {link.label}
              </a>
            ))}
          </div>

          {/* CTAs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <a
              className="lp-nav-gh"
              href="https://github.com/kingztech2019/cadence-plane-analytics"
              target="_blank" rel="noopener noreferrer"
              style={{
                alignItems: 'center', gap: 6,
                fontSize: 13, fontWeight: 500, color: 'var(--fg-muted)',
                textDecoration: 'none', padding: '5px 12px',
                border: '1px solid var(--border)', borderRadius: 8,
                background: 'transparent',
              }}
            >
              <GithubIcon size={14} />
              <span style={{ marginLeft: 6 }}>GitHub</span>
            </a>
            {/* <a href="#waitlist" style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 13, fontWeight: 600, color: '#fff',
              textDecoration: 'none', padding: '6px 14px',
              borderRadius: 8, background: 'var(--accent)',
              boxShadow: '0 1px 8px rgba(99,102,241,0.35)',
              whiteSpace: 'nowrap',
            }}>
              Join waitlist
            </a> */}
          </div>
        </div>
      </nav>

      {/* ─── Hero ────────────────────────────────────────────────────── */}
      <section style={{ position: 'relative', overflow: 'hidden', paddingBottom: 80 }}>
        <div aria-hidden style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: `
            linear-gradient(rgba(99,102,241,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(99,102,241,0.04) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
        }} />
        <div aria-hidden style={{
          position: 'absolute', top: -200, left: '50%', transform: 'translateX(-50%)',
          width: 800, height: 600, pointerEvents: 'none',
          background: 'radial-gradient(ellipse at center, rgba(99,102,241,0.14) 0%, transparent 70%)',
        }} />

        <div className="lp-hero-inner" style={{ maxWidth: 1120, margin: '0 auto', position: 'relative' }}>
          {/* Eyebrow */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              fontSize: 12, fontWeight: 600, letterSpacing: '0.05em',
              color: 'var(--accent-light)',
              background: 'var(--accent-dim)', border: '1px solid rgba(99,102,241,0.3)',
              borderRadius: 99, padding: '4px 14px',
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: 'var(--accent-light)', boxShadow: '0 0 6px var(--accent-light)',
              }} />
              Open source · MIT License · Built for Plane
            </span>
          </div>

          {/* Headline */}
          <h1 style={{
            fontSize: 'clamp(32px, 5vw, 60px)', fontWeight: 800,
            letterSpacing: '-0.035em', lineHeight: 1.08,
            textAlign: 'center', margin: '0 auto 24px', maxWidth: 820,
          }}>
            Understand how your team{' '}
            <span style={{
              background: 'var(--brand-gradient)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>
              actually ships
            </span>{' '}
            software
          </h1>

          {/* Subheadline */}
          <p style={{
            fontSize: 'clamp(15px, 2.5vw, 18px)', lineHeight: 1.6, fontWeight: 400,
            color: 'var(--fg-muted)', textAlign: 'center',
            maxWidth: 580, margin: '0 auto 40px',
          }}>
            Cadence connects to any Plane workspace and surfaces the delivery
            metrics that board views can't give you: cycle time trends, bottleneck
            persistence, team health signals, and probabilistic forecasts.
          </p>

          {/* Waitlist form */}
          <div id="waitlist" style={{ maxWidth: 520, margin: '0 auto 40px' }}>
            <WaitlistForm size="large" />
            <p style={{ textAlign: 'center', marginTop: 12, fontSize: 12.5, color: 'var(--fg-subtle)' }}>
              Hosted version launching soon. Self-host anytime from GitHub.
            </p>
          </div>

          {/* Secondary CTA */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 40 }}>
            <a
              href="https://github.com/kingztech2019/cadence-plane-analytics"
              target="_blank" rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                fontSize: 14, fontWeight: 500, color: 'var(--fg-muted)', textDecoration: 'none',
                padding: '9px 20px', borderRadius: 10,
                border: '1px solid var(--border)', background: 'var(--surface)',
              }}
            >
              <GithubIcon size={15} /> View on GitHub
            </a>
          </div>

          {/* Trust signals */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 20, flexWrap: 'wrap', marginBottom: 56,
          }}>
            {['No write access to Plane', 'Self-hostable in one command', 'Works with Plane Cloud and self-hosted', 'MIT licensed'].map((t) => (
              <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--fg-subtle)' }}>
                <CheckCircle2 size={13} color="var(--success)" strokeWidth={2.5} />
                {t}
              </span>
            ))}
          </div>

          {/* Hero screenshot */}
          <div style={{
            borderRadius: 16, overflow: 'hidden',
            border: '1px solid var(--border)',
            boxShadow: '0 40px 100px rgba(0,0,0,0.8), 0 0 0 1px rgba(99,102,241,0.15)',
            background: 'var(--surface-2)',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px',
              background: 'var(--surface-3)', borderBottom: '1px solid var(--border)',
            }}>
              <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#ef4444', opacity: 0.8 }} />
              <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#f59e0b', opacity: 0.8 }} />
              <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#22c55e', opacity: 0.8 }} />
              <div style={{
                flex: 1, margin: '0 10px', padding: '3px 0', textAlign: 'center',
                fontSize: 11, color: 'var(--fg-subtle)', background: 'var(--surface)', borderRadius: 5,
              }}>
                cadence.dev
              </div>
            </div>
            <img src="/screenshots/hero.png" alt="Cadence cycle time dashboard with Project Pulse strip" style={{ width: '100%', display: 'block' }} />
          </div>
        </div>
      </section>

      {/* ─── Honest framing ──────────────────────────────────────────── */}
      <section className="lp-section" style={{ borderTop: '1px solid var(--border-muted)' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--accent-light)', marginBottom: 12 }}>
              WHY CADENCE EXISTS
            </p>
            <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 38px)', fontWeight: 800, letterSpacing: '-0.025em', marginBottom: 16 }}>
              Built around the questions Plane doesn't answer
            </h2>
            <p style={{ fontSize: 'clamp(14px, 2vw, 16px)', color: 'var(--fg-muted)', maxWidth: 520, margin: '0 auto' }}>
              Plane tells you where issues are right now. Cadence tells you how long they take,
              where they get stuck, and when you'll be done.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
            {[
              {
                q: 'How long does work actually take?',
                a: 'Cycle time and lead time distributions with P50/P85 benchmarks and a trend line against the prior period. Not just averages that hide outliers.',
                icon: Clock, color: '#818cf8', dim: 'rgba(129,140,248,0.1)',
              },
              {
                q: 'Where do issues keep getting stuck?',
                a: 'The bottleneck tracker identifies which stage has the highest P85 wait time and detects when the same stage persists as the bottleneck across consecutive measurement windows.',
                icon: TriangleAlert, color: '#f59e0b', dim: 'rgba(245,158,11,0.1)',
              },
              {
                q: 'When will we actually finish?',
                a: "Monte Carlo simulation runs 10,000 samples over your team's real weekly throughput history and returns P50, P85, and P95 completion dates for any backlog size.",
                icon: Target, color: '#34d399', dim: 'rgba(52,211,153,0.1)',
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.q} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: item.dim, border: `1px solid ${item.color}30`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon size={18} color={item.color} strokeWidth={2} />
                  </div>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 8 }}>{item.q}</p>
                    <p style={{ fontSize: 13.5, color: 'var(--fg-muted)', lineHeight: 1.6 }}>{item.a}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Features grid ───────────────────────────────────────────── */}
      <section id="features" className="lp-section" style={{ borderTop: '1px solid var(--border-muted)' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--accent-light)', marginBottom: 12 }}>
              FEATURES
            </p>
            <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 38px)', fontWeight: 800, letterSpacing: '-0.025em', marginBottom: 16 }}>
              Every metric your engineering team needs
            </h2>
            <p style={{ fontSize: 'clamp(14px, 2vw, 16px)', color: 'var(--fg-muted)', maxWidth: 480, margin: '0 auto' }}>
              Twelve views covering delivery speed, flow health, team output, and risk detection.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="card card-hover" style={{ display: 'flex', gap: 14 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                    background: f.bg, border: `1px solid ${f.color}28`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon size={16} color={f.color} strokeWidth={2} />
                  </div>
                  <div>
                    <p style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 5, letterSpacing: '-0.01em' }}>{f.title}</p>
                    <p style={{ fontSize: 12.5, color: 'var(--fg-muted)', lineHeight: 1.55 }}>{f.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Screenshot sections ─────────────────────────────────────── */}
      <section id="screenshots" className="lp-section" style={{ borderTop: '1px solid var(--border-muted)' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--accent-light)', marginBottom: 12 }}>
              SCREENSHOTS
            </p>
            <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 38px)', fontWeight: 800, letterSpacing: '-0.025em' }}>
              See it in action
            </h2>
          </div>

          <div className="lp-shot-list">
            {SCREENSHOTS.map((shot, i) => {
              const isEven = i % 2 === 0;
              return (
                <div key={shot.file} className={`lp-shot-row ${isEven ? 'lp-shot-even' : 'lp-shot-odd'}`}>

                  {/* Text */}
                  <div className={isEven ? 'lp-text-even' : 'lp-text-odd'}>
                    <span style={{
                      display: 'inline-block', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
                      color: shot.tagColor, background: `${shot.tagColor}18`,
                      border: `1px solid ${shot.tagColor}30`,
                      borderRadius: 6, padding: '3px 10px', marginBottom: 16,
                    }}>
                      {shot.tag}
                    </span>
                    <h3 style={{ fontSize: 'clamp(18px, 2.5vw, 22px)', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.25, marginBottom: 14 }}>
                      {shot.title}
                    </h3>
                    <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--fg-muted)' }}>
                      {shot.desc}
                    </p>
                  </div>

                  {/* Screenshot */}
                  <div className={isEven ? 'lp-img-even' : 'lp-img-odd'} style={{
                    borderRadius: 12, overflow: 'hidden',
                    border: '1px solid var(--border)',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(99,102,241,0.1)',
                  }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 5, padding: '8px 12px',
                      background: 'var(--surface-3)', borderBottom: '1px solid var(--border)',
                    }}>
                      <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#ef4444', opacity: 0.7 }} />
                      <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#f59e0b', opacity: 0.7 }} />
                      <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#22c55e', opacity: 0.7 }} />
                    </div>
                    <img src={`/screenshots/${shot.file}`} alt={shot.title} style={{ width: '100%', display: 'block' }} />
                  </div>

                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Dashboard overview ──────────────────────────────────────── */}
      <section className="lp-section" style={{ borderTop: '1px solid var(--border-muted)' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <div className="lp-dash-row">
            {/* Screenshot */}
            <div style={{
              borderRadius: 12, overflow: 'hidden',
              border: '1px solid var(--border)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(99,102,241,0.1)',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '8px 12px',
                background: 'var(--surface-3)', borderBottom: '1px solid var(--border)',
              }}>
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#ef4444', opacity: 0.7 }} />
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#f59e0b', opacity: 0.7 }} />
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#22c55e', opacity: 0.7 }} />
              </div>
              <img src="/screenshots/dashboard.png" alt="Projects dashboard" style={{ width: '100%', display: 'block' }} />
            </div>
            {/* Text */}
            <div>
              <span style={{
                display: 'inline-block', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
                color: '#818cf8', background: 'rgba(129,140,248,0.1)', border: '1px solid rgba(129,140,248,0.2)',
                borderRadius: 6, padding: '3px 10px', marginBottom: 16,
              }}>Dashboard</span>
              <h3 style={{ fontSize: 'clamp(18px, 2.5vw, 22px)', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.25, marginBottom: 14 }}>
                All your projects in one place
              </h3>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--fg-muted)' }}>
                The dashboard shows every tracked project with live sync status and quick links
                to each analytics section. Multiple workspaces can be connected per account, each
                syncing independently with its own backfill and incremental update queue.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Open Source ─────────────────────────────────────────────── */}
      <section id="open-source" className="lp-section" style={{ borderTop: '1px solid var(--border-muted)' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <div className="lp-os-grid">
            {/* Left */}
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--accent-light)', marginBottom: 12 }}>
                OPEN SOURCE
              </p>
              <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 36px)', fontWeight: 800, letterSpacing: '-0.025em', marginBottom: 16 }}>
                MIT licensed. Self-host it, fork it, contribute to it.
              </h2>
              <p style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--fg-muted)', marginBottom: 28 }}>
                Cadence is fully open source under the MIT license. The entire codebase is
                available on GitHub. Run it on your own infrastructure, contribute a new metric,
                or integrate it with your internal tooling. No hidden enterprise tier.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
                {[
                  { icon: Shield,    text: 'MIT license: use it in any project, commercial or otherwise' },
                  { icon: GitBranch, text: 'Full source on GitHub including migrations, workers, and API' },
                  { icon: RefreshCw, text: 'Accepts pull requests for new metrics, bug fixes, and integrations' },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.text} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                        background: 'var(--accent-dim)', border: '1px solid rgba(99,102,241,0.25)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2,
                      }}>
                        <Icon size={13} color="var(--accent-light)" strokeWidth={2} />
                      </div>
                      <p style={{ fontSize: 13.5, color: 'var(--fg-muted)', lineHeight: 1.55 }}>{item.text}</p>
                    </div>
                  );
                })}
              </div>
              <a
                href="https://github.com/kingztech2019/cadence-plane-analytics"
                target="_blank" rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  fontSize: 14, fontWeight: 600, color: 'var(--fg)', textDecoration: 'none',
                  padding: '9px 20px', borderRadius: 9, border: '1px solid var(--border)',
                  background: 'var(--surface)',
                }}
              >
                <GithubIcon size={15} /> View on GitHub
              </a>
            </div>

            {/* Right — Tech stack */}
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--fg-subtle)', marginBottom: 20 }}>
                BUILT WITH
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { layer: 'Monorepo',  tech: 'Turborepo' },
                  { layer: 'Frontend',  tech: 'Next.js 15 App Router, Tailwind v4, Recharts' },
                  { layer: 'Backend',   tech: 'Fastify 5, Node.js 22' },
                  { layer: 'Database',  tech: 'PostgreSQL 16 with window functions and generated columns' },
                  { layer: 'Queue',     tech: 'BullMQ and Redis 7 with rate-limited backfill workers' },
                  { layer: 'Auth',      tech: 'JWT with OAuth 2.0 PKCE for Plane marketplace' },
                  { layer: 'AI',        tech: 'OpenRouter for sprint retrospective narratives (optional)' },
                  { layer: 'Infra',     tech: 'Docker Compose, Vercel for web, VPS for API and workers' },
                ].map((row) => (
                  <div key={row.layer} style={{
                    display: 'flex', alignItems: 'baseline', gap: 12,
                    padding: '10px 14px', background: 'var(--surface-2)',
                    border: '1px solid var(--border-muted)', borderRadius: 9,
                  }}>
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', color: 'var(--fg-subtle)', width: 72, flexShrink: 0 }}>
                      {row.layer.toUpperCase()}
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--fg-muted)', lineHeight: 1.4 }}>{row.tech}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Quick Start ─────────────────────────────────────────────── */}
      <section id="quick-start" className="lp-section" style={{ borderTop: '1px solid var(--border-muted)' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--accent-light)', marginBottom: 12 }}>
            QUICK START
          </p>
          <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 36px)', fontWeight: 800, letterSpacing: '-0.025em', marginBottom: 16 }}>
            Running in under five minutes
          </h2>
          <p style={{ fontSize: 15, color: 'var(--fg-muted)', marginBottom: 36, lineHeight: 1.6 }}>
            Clone the repo, set three environment variables, and start the stack with Docker Compose.
            Your first charts are ready before the backfill finishes.
          </p>

          <div className="lp-code-scroll" style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 12, overflow: 'hidden', textAlign: 'left',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 16px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)',
            }}>
              <span style={{ fontSize: 11, color: 'var(--fg-subtle)', fontFamily: 'monospace' }}>Terminal</span>
              <div style={{ display: 'flex', gap: 5 }}>
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#ef4444', opacity: 0.6 }} />
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#f59e0b', opacity: 0.6 }} />
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#22c55e', opacity: 0.6 }} />
              </div>
            </div>
            <div style={{ padding: '20px 24px', fontFamily: 'ui-monospace, "Cascadia Code", Menlo, monospace', fontSize: 13, lineHeight: 2 }}>
              {[
                { cmd: 'git clone https://github.com/kingztech2019/cadence-plane-analytics.git' },
                { cmd: 'cd cadence-plane-analytics' },
                { cmd: 'cp .env.example .env' },
                { isComment: true, text: '# Set POSTGRES_PASSWORD, JWT_SECRET, ENCRYPTION_KEY in .env' },
                { cmd: 'docker compose up -d' },
                { isComment: true, text: '# Open http://localhost:3001 and connect your Plane workspace' },
              ].map((line, i) => (
                <div key={i} className="lp-code-line">
                  {line.isComment ? (
                    <span style={{ color: 'var(--fg-subtle)' }}>{line.text}</span>
                  ) : (
                    <>
                      <span style={{ color: 'var(--accent-violet)', userSelect: 'none', flexShrink: 0 }}>$</span>
                      <span style={{ color: 'var(--fg)' }}>{line.cmd}</span>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 32 }}>
            <WaitlistForm size="large" />
          </div>
        </div>
      </section>

      {/* ─── Footer ──────────────────────────────────────────────────── */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '36px 20px', background: 'var(--surface)' }}>
        <div className="lp-footer-row" style={{ maxWidth: 1120, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{
              width: 26, height: 26, borderRadius: 7,
              background: 'var(--brand-gradient)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <BarChart2 size={13} color="#fff" strokeWidth={2.5} />
            </div>
            <span style={{ fontSize: 14, fontWeight: 700 }}>Cadence</span>
            <span style={{ fontSize: 12, color: 'var(--fg-subtle)' }}>Delivery analytics for Plane</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            {[
              { label: 'GitHub',       href: 'https://github.com/kingztech2019/cadence-plane-analytics' },
              { label: 'Contributing', href: 'https://github.com/kingztech2019/cadence-plane-analytics/blob/main/CONTRIBUTING.md' },
              { label: 'License',      href: 'https://github.com/kingztech2019/cadence-plane-analytics/blob/main/LICENSE' },
              { label: 'Issues',       href: 'https://github.com/kingztech2019/cadence-plane-analytics/issues' },
            ].map((link) => (
              <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 13, color: 'var(--fg-subtle)', textDecoration: 'none' }}>
                {link.label}
              </a>
            ))}
          </div>
          <p style={{ fontSize: 12, color: 'var(--fg-subtle)' }}>MIT License. Copyright 2025 Cadence Contributors.</p>
        </div>
      </footer>

    </div>
  );
}

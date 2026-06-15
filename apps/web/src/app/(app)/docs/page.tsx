'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Timer, Clock, AlertTriangle, BarChart2, Zap, RefreshCw,
  Activity, Telescope, ShieldAlert, TrendingUp, GitBranch,
  ClipboardList, FileBarChart2, BarChart3, Archive, BookOpen,
} from 'lucide-react';

// ─── types ────────────────────────────────────────────────────────────────────

type Section = { id: string; label: string };

// ─── data ─────────────────────────────────────────────────────────────────────

const ANALYTICS: Array<{
  id: string;
  icon: React.ElementType;
  name: string;
  path: string;
  color: string;
  tagline: string;
  analogy: string;
  explanation: string;
  healthy: string;
  watchFor: string;
}> = [
  {
    id: 'cycle-time',
    icon: Timer,
    name: 'Cycle Time',
    path: 'projects → [project] → Cycle Time',
    color: '#6366f1',
    tagline: 'How fast does work actually move once someone starts it?',
    analogy: 'You order a custom t-shirt. Cycle time is how long it takes from the moment a worker picks up your order and starts printing it, to the moment it ships. Not the waiting room — just the actual work time.',
    explanation: 'Cadence measures from when a task enters an "In Progress" state to when it moves to "Done". It shows you P50 (half of tasks finish faster than this) and P85 (90% of tasks finish faster than this). The scatter plot shows every individual task as a dot — outlier dots way above the line are your problem children.',
    healthy: 'P50 under 5 days for most software teams. P85 under 14 days. Consistent dots close together means a predictable team.',
    watchFor: 'A rising P85 over time means your hardest tasks are getting harder. Dots scattered all over the place means work sizes are wildly inconsistent — break big tasks into smaller ones.',
  },
  {
    id: 'lead-time',
    icon: Clock,
    name: 'Lead Time',
    path: 'projects → [project] → Lead Time',
    color: '#8b5cf6',
    tagline: 'How long does a task exist before it actually ships?',
    analogy: 'Same t-shirt order. Lead time counts from the moment you clicked "Buy" — including all the time it sat in a queue before anyone touched it. Lead time is always longer than cycle time.',
    explanation: 'Measures from task creation to completion. The gap between lead time and cycle time tells you how long tasks wait in the backlog before someone starts them. A large gap = a congested queue. You can reduce lead time either by working faster (cycle time) or by starting tasks sooner (smaller backlog).',
    healthy: 'Lead time 1.5–2× cycle time is normal. A huge gap (e.g. cycle time = 3 days, lead time = 30 days) means your backlog is massive and tasks wait weeks to be picked up.',
    watchFor: 'Lead time increasing while cycle time stays flat = your backlog is growing faster than your team can handle it. Time to either hire or cut scope.',
  },
  {
    id: 'bottleneck',
    icon: AlertTriangle,
    name: 'Bottleneck',
    path: 'projects → [project] → Bottleneck',
    color: '#f59e0b',
    tagline: 'Which stage in your workflow is slowing everything down?',
    analogy: 'Think of a water bottle. Water flows fine until it hits the narrow neck. Your workflow is the same — tasks might fly through "In Progress" but pile up for days in "Review". The bottleneck chart shows exactly which stage is the narrow neck.',
    explanation: 'Shows the average and P85 time tasks spend in each state (Todo, In Progress, Review, Staging, Production). The longest bar is your bottleneck. If "Review" averages 8 days but "In Progress" averages 2 days, your review process is 4× slower than development.',
    healthy: 'Each stage roughly similar in duration, or stages getting faster as work moves toward done. No single stage should be dramatically longer than the others.',
    watchFor: 'One stage that is 3–5× longer than all others. Common culprits: a review process gated on one person, a staging environment with manual QA, or a "Ready for Production" state nobody checks regularly.',
  },
  {
    id: 'cfd',
    icon: BarChart2,
    name: 'CFD — Cumulative Flow',
    path: 'projects → [project] → CFD',
    color: '#14b8a6',
    tagline: 'Is work flowing smoothly or building up like a traffic jam?',
    analogy: 'Imagine a highway with lanes for each stage of your workflow. A healthy highway has smooth, even traffic in every lane. A CFD where one lane (like "In Review") keeps getting thicker is like a lane closure — everything backs up behind it.',
    explanation: 'A stacked area chart showing how many tasks are in each state every day over your selected date range. The total height of the chart grows as new work is added. The thickness of each band is the count in that state. Bands that stay thin and parallel mean smooth flow. Bands that bulge and grow mean tasks are stuck there.',
    healthy: 'All bands roughly parallel and even. The "Done" band (usually at the bottom) grows steadily every day — that means you\'re shipping consistently.',
    watchFor: 'Any band that widens significantly over time — work is accumulating there. Also watch for the total height growing much faster than the "Done" band — you\'re adding work faster than you\'re finishing it.',
  },
  {
    id: 'throughput',
    icon: Zap,
    name: 'Throughput',
    path: 'projects → [project] → Throughput',
    color: '#22c55e',
    tagline: 'How many tasks does the team actually finish per week?',
    analogy: 'A factory that makes 200 cars per week has a throughput of 200. If next month it only makes 120, something changed — a machine broke, workers called in sick, or they\'re working on a custom order that takes longer. Throughput is the simplest measure of output.',
    explanation: 'A bar chart showing tasks completed per week (or day/month depending on your filter). No complex maths — just count of tasks that crossed the finish line. Good for spotting trends: is the team shipping more or less than 3 months ago? Did output drop after a team member left?',
    healthy: 'Consistent bars of similar height, with a gradual upward trend over months. Some week-to-week variation is normal (holidays, incidents).',
    watchFor: 'A sudden sustained drop that doesn\'t recover. Or very spikey output (0 for 2 weeks then 30 in one week) which means work is batched rather than flowing continuously.',
  },
  {
    id: 'sprints',
    icon: RefreshCw,
    name: 'Sprints',
    path: 'projects → [project] → Sprints',
    color: '#6366f1',
    tagline: 'Are sprint commitments being kept?',
    analogy: 'Your team says "this week we\'ll bake 20 cakes." At the end of the week: did they bake 20? 10? 30? Sprints show the difference between what was promised and what was delivered — every cycle.',
    explanation: 'For each sprint (cycle) in Plane, shows planned tasks vs completed tasks, plus cycle time and throughput metrics for that sprint. The AI retrospective button generates a written summary of what happened in the sprint. Historical comparison lets you see if planning accuracy is improving over time.',
    healthy: 'Completion rate above 80%. Small sprint-to-sprint variation. Cycle time P50 stable or improving.',
    watchFor: 'Consistently completing less than 70% of planned work — the team is over-committing. Or always completing 100% — they might be sandbagging. The sweet spot is honest planning with a slight stretch.',
  },
  {
    id: 'flow-efficiency',
    icon: Activity,
    name: 'Flow Efficiency',
    path: 'projects → [project] → Flow Efficiency',
    color: '#ec4899',
    tagline: 'What percentage of a task\'s life is someone actually working on it?',
    analogy: 'A task takes 10 days from creation to done. But the developer only spent 2 days actually coding — the other 8 days it sat waiting for a review, waiting for a decision, waiting in a queue. Flow efficiency = 2 ÷ 10 = 20%. The remaining 80% was pure waiting.',
    explanation: 'Calculated as active time (in "In Progress" states) divided by total lead time. Shows what fraction of a task\'s existence someone was actually doing work on it, vs the task just sitting idle. High flow efficiency means your team works in a focused, unblocked way without long waits between stages.',
    healthy: '40–60% is good for most software teams. Above 60% is excellent. Most teams discover they\'re at 15–25% when they first measure this.',
    watchFor: 'Anything below 20% means most of your "speed problem" is actually a waiting problem, not a working-too-slow problem. The fix is removing handoff delays, not pressuring people to work faster.',
  },
  {
    id: 'forecast',
    icon: Telescope,
    name: 'Forecast',
    path: 'projects → [project] → Forecast',
    color: '#f59e0b',
    tagline: 'When will the backlog be done at the team\'s current pace?',
    analogy: 'You have 90 pages left in a book. You\'ve been reading 15 pages a day for the past two weeks. Forecast: 6 days. It doesn\'t care that you hoped to finish in 3 days — it uses your real recent pace, not your wishful thinking.',
    explanation: 'Uses the team\'s recent throughput (last 4–8 weeks) to project when the current backlog will be completed. Shows a confidence range — an optimistic date (if recent pace continues or improves) and a pessimistic date (if pace drops slightly). Based entirely on data, not estimates from developers.',
    healthy: 'Forecast dates that get closer over time (the backlog is shrinking). A narrow confidence range (optimistic and pessimistic dates are close together) means consistent throughput.',
    watchFor: 'Forecast dates that keep moving further away — you\'re adding work faster than you\'re finishing it. Or a very wide confidence range, which means throughput is unpredictable and planning is unreliable.',
  },
  {
    id: 'at-risk',
    icon: ShieldAlert,
    name: 'At Risk',
    path: 'projects → [project] → At Risk',
    color: '#ef4444',
    tagline: 'What needs your attention right now?',
    analogy: 'Instead of you scanning 200 tasks every Monday looking for problems, Cadence does it automatically and hands you a short list: "Hey, these 7 things look like they\'re going to cause trouble." Like a smoke detector — it goes off before there\'s a real fire.',
    explanation: 'Automatically surfaces tasks that match risk patterns: stuck in the same state for too many days, high-priority with no assignee, items that haven\'t been touched in 2+ weeks, or tasks that were supposed to be done by now. Each flagged item shows why it was flagged.',
    healthy: 'Zero or very few items, or items that are flagged and then resolved quickly. If the list is always empty, your team is managing work well.',
    watchFor: 'The same tasks appearing on this list week after week — they\'re either genuinely blocked and need escalation, or they\'re low-priority tasks nobody wants to do. Both are worth a conversation.',
  },
  {
    id: 'scope-creep',
    icon: TrendingUp,
    name: 'Scope Creep',
    path: 'projects → [project] → Scope Creep',
    color: '#94a3b8',
    tagline: 'Is the project growing beyond what was originally planned?',
    analogy: 'You\'re building a house. The plan said 3 bedrooms. Halfway through, the client asks for a 4th bedroom, then a garage, then a pool. The original plan is now unrecognisable. Scope creep is when tasks keep being added after work has started, pushing the finish line further away.',
    explanation: 'Tracks how many tasks existed at the start of a sprint or time period vs how many exist now. Shows the net growth of the backlog over time. A flat line means scope is controlled. A rising line means new work is being added continuously — which pushes deadlines without anyone explicitly agreeing to that.',
    healthy: 'A flat or slightly declining line. New tasks being added should be matched by old tasks being completed.',
    watchFor: 'A line that rises steadily without corresponding completion. This is often the hidden reason why projects take twice as long as planned — not because the team is slow, but because the scope doubled mid-flight.',
  },
];

const REPORTS: Array<{
  id: string;
  icon: React.ElementType;
  name: string;
  path: string;
  color: string;
  tagline: string;
  explanation: string;
  bestFor: string;
}> = [
  {
    id: 'status-report',
    icon: ClipboardList,
    name: 'Status Report',
    path: 'Status Report (sidebar)',
    color: '#6366f1',
    tagline: 'A real-time snapshot of all tasks by status for your Monday meetings.',
    explanation: 'Shows all work items grouped by their current state (Todo, In Progress, Review, Production etc.) for a date range you pick. Includes a summary bar at the top (total items, shipped, stale, high priority), week-over-week comparison so you can see if you shipped more or less than last week, stale item flagging (amber rows for tasks stuck too long), and an assignee breakdown table showing each person\'s workload. Print or share your screen directly — no PDF export needed.',
    bestFor: 'Weekly Monday management meeting. Open it on your screen, walk through the stats bar, then scroll through the stale items to decide what to discuss.',
  },
  {
    id: 'monthly-report',
    icon: FileBarChart2,
    name: 'Monthly Report',
    path: 'Monthly Report (sidebar)',
    color: '#22c55e',
    tagline: 'Your Monthly Performance Review, auto-filled from Plane data.',
    explanation: 'One section per project. Cadence auto-fills the item counts and groups them by state (Production, Staging, QA, In Progress). You write the Goal and Projections text, and click "AI Draft" for the Activities section — Claude reads your completed tasks and writes the bullet points for you. Everything saves automatically. A velocity sparkline shows the last 6 months of shipped items at a glance. Print-ready for board decks.',
    bestFor: 'Monthly board or management review. Write once, print, done. No more manually building the MPR slide deck from scratch.',
  },
  {
    id: 'quarterly-report',
    icon: BarChart3,
    name: 'Quarterly Report',
    path: 'Quarterly Report (sidebar)',
    color: '#f59e0b',
    tagline: 'Three months of every project side by side — the board-level view.',
    explanation: 'Shows Q1/Q2/Q3/Q4 data across all your projects. A summary grid at the top shows each project\'s monthly shipped counts and whether velocity is trending up or down. Below that, every project gets a row with three month columns — each cell shows items shipped, the goal you set, and the activities summary from your monthly reports. The quarterly report is built on top of your monthly report entries, so if you fill in monthly reports consistently, the quarterly view builds itself.',
    bestFor: 'End-of-quarter investor updates, board meetings, or annual planning. Shows growth trajectory across all products without needing a separate spreadsheet.',
  },
  {
    id: 'report-archive',
    icon: Archive,
    name: 'Report Archive',
    path: 'Report Archive (sidebar)',
    color: '#8b5cf6',
    tagline: 'Browse and compare every saved monthly report.',
    explanation: 'A grid of every month that has saved report entries. Each card shows the quarter, how many items shipped that month, and how many project sections were actually written up. Click any card to go straight to that month\'s report. Select two cards and click Compare to see them side by side — goals, activities, and shipped counts for every project in both months on one screen. Useful for showing growth to stakeholders: "Compare May vs November to see how far we\'ve come."',
    bestFor: 'Preparing for annual reviews, investor due diligence, or retrospective conversations. Shows the full history of written reports without needing to dig through old PDFs.',
  },
];

// ─── section component ────────────────────────────────────────────────────────

function MetricCard({ metric }: { metric: typeof ANALYTICS[0] }) {
  const Icon = metric.icon;
  return (
    <div
      id={metric.id}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: '24px 26px',
        marginBottom: 20,
        borderLeft: `4px solid ${metric.color}`,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 11, flexShrink: 0,
          background: `${metric.color}18`, border: `1px solid ${metric.color}44`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={18} style={{ color: metric.color }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: 'var(--fg)', letterSpacing: '-0.01em' }}>
              {metric.name}
            </h3>
            <code style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 5,
              background: 'var(--surface-2)', color: 'var(--fg-subtle)',
              border: '1px solid var(--border)',
            }}>
              {metric.path}
            </code>
          </div>
          <p style={{ fontSize: 13, color: metric.color, fontWeight: 600, margin: 0 }}>
            {metric.tagline}
          </p>
        </div>
      </div>

      {/* Analogy */}
      <div style={{
        background: `${metric.color}0d`,
        border: `1px solid ${metric.color}33`,
        borderRadius: 10, padding: '12px 16px',
        marginBottom: 14,
      }}>
        <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: metric.color, margin: '0 0 5px' }}>
          Think of it like this
        </p>
        <p style={{ fontSize: 13, color: 'var(--fg-muted)', margin: 0, lineHeight: 1.65 }}>
          {metric.analogy}
        </p>
      </div>

      {/* Explanation */}
      <p style={{ fontSize: 13, color: 'var(--fg-muted)', lineHeight: 1.7, margin: '0 0 14px' }}>
        {metric.explanation}
      </p>

      {/* Healthy / Watch for */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{
          background: 'rgba(34,197,94,0.07)',
          border: '1px solid rgba(34,197,94,0.25)',
          borderRadius: 9, padding: '10px 14px',
        }}>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#22c55e', margin: '0 0 4px' }}>
            ✓ Healthy sign
          </p>
          <p style={{ fontSize: 12, color: 'var(--fg-muted)', margin: 0, lineHeight: 1.55 }}>
            {metric.healthy}
          </p>
        </div>
        <div style={{
          background: 'rgba(239,68,68,0.07)',
          border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: 9, padding: '10px 14px',
        }}>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#ef4444', margin: '0 0 4px' }}>
            ⚠ Watch for
          </p>
          <p style={{ fontSize: 12, color: 'var(--fg-muted)', margin: 0, lineHeight: 1.55 }}>
            {metric.watchFor}
          </p>
        </div>
      </div>
    </div>
  );
}

function ReportCard({ report }: { report: typeof REPORTS[0] }) {
  const Icon = report.icon;
  return (
    <div
      id={report.id}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: '24px 26px',
        marginBottom: 20,
        borderLeft: `4px solid ${report.color}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 11, flexShrink: 0,
          background: `${report.color}18`, border: `1px solid ${report.color}44`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={18} style={{ color: report.color }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: 'var(--fg)', letterSpacing: '-0.01em' }}>
              {report.name}
            </h3>
            <code style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 5,
              background: 'var(--surface-2)', color: 'var(--fg-subtle)',
              border: '1px solid var(--border)',
            }}>
              {report.path}
            </code>
          </div>
          <p style={{ fontSize: 13, color: report.color, fontWeight: 600, margin: 0 }}>
            {report.tagline}
          </p>
        </div>
      </div>

      <p style={{ fontSize: 13, color: 'var(--fg-muted)', lineHeight: 1.7, margin: '0 0 14px' }}>
        {report.explanation}
      </p>

      <div style={{
        background: `${report.color}0d`,
        border: `1px solid ${report.color}33`,
        borderRadius: 9, padding: '10px 14px',
      }}>
        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: report.color, margin: '0 0 4px' }}>
          Best used for
        </p>
        <p style={{ fontSize: 12, color: 'var(--fg-muted)', margin: 0, lineHeight: 1.55 }}>
          {report.bestFor}
        </p>
      </div>
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

const ALL_SECTIONS: Section[] = [
  { id: 'overview',       label: 'Overview'        },
  { id: 'speed',          label: 'Speed'           },
  { id: 'flow',           label: 'Flow'            },
  { id: 'output',         label: 'Output'          },
  { id: 'health',         label: 'Health'          },
  { id: 'reporting',      label: 'Reporting'       },
];

const SPEED_IDS    = ['cycle-time', 'lead-time'];
const FLOW_IDS     = ['bottleneck', 'cfd', 'flow-efficiency'];
const OUTPUT_IDS   = ['throughput', 'sprints', 'forecast'];
const HEALTH_IDS   = ['at-risk', 'scope-creep'];

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState('overview');
  const observer = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const ids = ['overview', ...ANALYTICS.map(a => a.id), ...REPORTS.map(r => r.id),
      'speed', 'flow', 'output', 'health', 'reporting'];

    observer.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            if (ALL_SECTIONS.find(s => s.id === id)) setActiveSection(id);
          }
        }
      },
      { rootMargin: '-20% 0px -70% 0px' }
    );

    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) observer.current!.observe(el);
    });
    return () => observer.current?.disconnect();
  }, []);

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <>
      {/* Sticky top bar */}
      <div style={{
        position: 'sticky', top: -28, zIndex: 10,
        background: 'var(--bg)',
        marginLeft: -32, marginRight: -32, paddingLeft: 32, paddingRight: 32,
        paddingTop: 20, paddingBottom: 0,
        marginTop: -28,
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <BookOpen size={18} style={{ color: 'var(--accent)' }} />
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: 'var(--fg)', letterSpacing: '-0.015em' }}>
            Documentation
          </h1>
          <span style={{ fontSize: 12, color: 'var(--fg-subtle)' }}>— What every metric and report actually means</span>
        </div>

        {/* Jump nav */}
        <div style={{ display: 'flex', gap: 2 }}>
          {ALL_SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              style={{
                padding: '6px 14px',
                border: 'none',
                borderBottom: `2px solid ${activeSection === s.id ? 'var(--accent)' : 'transparent'}`,
                background: 'transparent',
                color: activeSection === s.id ? 'var(--accent)' : 'var(--fg-subtle)',
                fontSize: 13, fontWeight: activeSection === s.id ? 700 : 500,
                cursor: 'pointer', borderRadius: '6px 6px 0 0',
                transition: 'all 120ms ease',
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ paddingTop: 32, paddingBottom: 64, maxWidth: 860 }}>

        {/* ── Overview ── */}
        <section id="overview" style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--fg)', margin: '0 0 10px', letterSpacing: '-0.01em' }}>
            What is Cadence?
          </h2>
          <p style={{ fontSize: 14, color: 'var(--fg-muted)', lineHeight: 1.75, margin: '0 0 16px' }}>
            Cadence connects to your Plane workspace and turns raw task data into delivery analytics and management reports. Instead of manually counting tasks or building spreadsheets before every meeting, Cadence answers your most important questions automatically: <em>Are we shipping faster or slower? Where is work getting stuck? Will we hit the deadline?</em>
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
            {[
              { label: '10 analytics tabs', desc: 'Per-project views covering speed, flow, output, and health', color: '#6366f1' },
              { label: '4 report types',    desc: 'Weekly, monthly, quarterly, and archived — all print-ready', color: '#22c55e' },
              { label: 'AI-assisted',       desc: 'AI drafts your monthly report narratives from Plane data',  color: '#f59e0b' },
            ].map((c) => (
              <div key={c.label} style={{
                background: 'var(--surface)', border: `1px solid ${c.color}44`,
                borderRadius: 12, padding: '14px 16px',
              }}>
                <p style={{ fontSize: 13, fontWeight: 800, color: c.color, margin: '0 0 4px' }}>{c.label}</p>
                <p style={{ fontSize: 12, color: 'var(--fg-muted)', margin: 0, lineHeight: 1.5 }}>{c.desc}</p>
              </div>
            ))}
          </div>
          <div style={{
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '16px 20px',
          }}>
            <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--fg-subtle)', margin: '0 0 8px' }}>
              How work flows through your team
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 0, flexWrap: 'wrap' }}>
              {['Backlog', 'Todo', 'In Progress', 'Review / QA', 'Staging', 'Production'].map((stage, i, arr) => (
                <div key={stage} style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{
                    padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                    background: ['#94a3b822','#94a3b833','#6366f122','#f59e0b22','#f59e0b33','#22c55e22'][i],
                    color: ['#94a3b8','#94a3b8','#6366f1','#f59e0b','#f59e0b','#22c55e'][i],
                    border: `1px solid ${['#94a3b844','#94a3b844','#6366f144','#f59e0b44','#f59e0b44','#22c55e44'][i]}`,
                  }}>
                    {stage}
                  </div>
                  {i < arr.length - 1 && (
                    <span style={{ color: 'var(--fg-subtle)', fontSize: 14, padding: '0 6px' }}>→</span>
                  )}
                </div>
              ))}
            </div>
            <p style={{ fontSize: 11, color: 'var(--fg-subtle)', margin: '8px 0 0', lineHeight: 1.5 }}>
              Cadence measures time spent at each stage. <strong style={{ color: 'var(--fg-muted)' }}>Cycle time</strong> = In Progress → Production. <strong style={{ color: 'var(--fg-muted)' }}>Lead time</strong> = Backlog → Production. <strong style={{ color: 'var(--fg-muted)' }}>Bottleneck</strong> = the stage where items spend the most time.
            </p>
          </div>
        </section>

        {/* ── Speed ── */}
        <section id="speed" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ height: 1, flex: 1, background: 'var(--border)' }} />
            <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--fg-subtle)', margin: 0, whiteSpace: 'nowrap' }}>
              Speed — how fast work moves
            </h2>
            <div style={{ height: 1, flex: 1, background: 'var(--border)' }} />
          </div>
          {ANALYTICS.filter(a => SPEED_IDS.includes(a.id)).map(a => <MetricCard key={a.id} metric={a} />)}
        </section>

        {/* ── Flow ── */}
        <section id="flow" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ height: 1, flex: 1, background: 'var(--border)' }} />
            <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--fg-subtle)', margin: 0, whiteSpace: 'nowrap' }}>
              Flow — where work gets stuck
            </h2>
            <div style={{ height: 1, flex: 1, background: 'var(--border)' }} />
          </div>
          {ANALYTICS.filter(a => FLOW_IDS.includes(a.id)).map(a => <MetricCard key={a.id} metric={a} />)}
        </section>

        {/* ── Output ── */}
        <section id="output" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ height: 1, flex: 1, background: 'var(--border)' }} />
            <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--fg-subtle)', margin: 0, whiteSpace: 'nowrap' }}>
              Output — how much is getting done
            </h2>
            <div style={{ height: 1, flex: 1, background: 'var(--border)' }} />
          </div>
          {ANALYTICS.filter(a => OUTPUT_IDS.includes(a.id)).map(a => <MetricCard key={a.id} metric={a} />)}
        </section>

        {/* ── Health ── */}
        <section id="health" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ height: 1, flex: 1, background: 'var(--border)' }} />
            <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--fg-subtle)', margin: 0, whiteSpace: 'nowrap' }}>
              Health — early warning signals
            </h2>
            <div style={{ height: 1, flex: 1, background: 'var(--border)' }} />
          </div>
          {ANALYTICS.filter(a => HEALTH_IDS.includes(a.id)).map(a => <MetricCard key={a.id} metric={a} />)}
        </section>

        {/* ── Reporting ── */}
        <section id="reporting">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ height: 1, flex: 1, background: 'var(--border)' }} />
            <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--fg-subtle)', margin: 0, whiteSpace: 'nowrap' }}>
              Reporting — for meetings and management
            </h2>
            <div style={{ height: 1, flex: 1, background: 'var(--border)' }} />
          </div>
          {REPORTS.map(r => <ReportCard key={r.id} report={r} />)}
        </section>

      </div>
    </>
  );
}

import { env } from '../config/env.js';

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

async function fetchWithRetry(url: string, options: RequestInit, retries = 3): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fetch(url, options);
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      // Only retry on transient network errors (DNS, connection reset)
      if (!msg.includes('EAI_AGAIN') && !msg.includes('ECONNRESET') && !msg.includes('ETIMEDOUT')) throw err;
      if (attempt < retries - 1) await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw lastErr;
}

interface SprintRetroInput {
  cycleName: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  itemsCompleted: number;
  p50Hours: number | null;
  p85Hours: number | null;
  prevCycleName?: string;
  prevItemsCompleted?: number;
  prevP50Hours?: number | null;
  prevP85Hours?: number | null;
}

function buildRetroPrompt(data: SprintRetroInput): string {
  const p50d = data.p50Hours ? (data.p50Hours / 24).toFixed(1) : null;
  const p85d = data.p85Hours ? (data.p85Hours / 24).toFixed(1) : null;
  const pp50d = data.prevP50Hours ? (data.prevP50Hours / 24).toFixed(1) : null;
  const pp85d = data.prevP85Hours ? (data.prevP85Hours / 24).toFixed(1) : null;

  const throughputDelta =
    data.prevItemsCompleted
      ? Math.round(((data.itemsCompleted - data.prevItemsCompleted) / data.prevItemsCompleted) * 100)
      : null;

  const p50Delta =
    data.prevP50Hours && data.p50Hours
      ? Math.round(((data.p50Hours - data.prevP50Hours) / data.prevP50Hours) * 100)
      : null;

  let prompt = `You are a software delivery coach writing a concise sprint retrospective for an engineering team. Use only the data provided — do not invent metrics.

Sprint: "${data.cycleName}" (${data.startDate} → ${data.endDate}, ${data.durationDays} days)
Issues shipped: ${data.itemsCompleted}${throughputDelta !== null ? ` (${throughputDelta > 0 ? '+' : ''}${throughputDelta}% vs previous sprint "${data.prevCycleName ?? ''}")` : ''}
Typical cycle time (P50): ${p50d ? `${p50d} days` : 'insufficient data'}${pp50d && p50d ? ` (was ${pp50d}d last sprint, ${p50Delta !== null ? `${p50Delta > 0 ? '+' : ''}${p50Delta}%` : 'unchanged'})` : ''}
Slowest 15% (P85): ${p85d ? `${p85d} days` : 'insufficient data'}${pp85d && p85d ? ` (was ${pp85d}d last sprint)` : ''}`;

  if (data.prevCycleName) {
    prompt += `\nPrevious sprint "${data.prevCycleName}" shipped ${data.prevItemsCompleted ?? 0} issues.`;
  }

  prompt += `

Write a 150–200 word sprint retrospective in plain English. Be specific with numbers. Lead with what happened this sprint, note what's improving or needs attention, and end with one concrete action for next sprint. Direct, data-driven tone. Two or three short paragraphs — no bullet points, no headers.`;

  return prompt;
}

const FLOW_LABEL: Record<string, string> = {
  done:        'shipped to production',
  review:      'in staging / QA review',
  in_progress: 'in active development',
  todo:        'queued / ready to start',
};

interface MonthlyActivitiesInput {
  projectName: string;
  monthLabel: string; // e.g. 'May 2026'
  stateGroups: Array<{
    state_name: string;
    flow_category: string;
    items: Array<{ title: string; priority: string }>;
  }>;
}

function buildMonthlyActivitiesPrompt(data: MonthlyActivitiesInput): string {
  const groupLines = data.stateGroups.map((g) => {
    const label = FLOW_LABEL[g.flow_category] ?? g.flow_category;
    const items = g.items.map((i) => `    - ${i.title}`).join('\n');
    return `${g.state_name} — ${label} (${g.items.length} items):\n${items}`;
  }).join('\n\n');

  const totalItems = data.stateGroups.reduce((s, g) => s + g.items.length, 0);

  return `You are a CTO writing a brief activities summary for a monthly performance review. Audience is senior management — no technical jargon, focus on outcomes and delivery status.

Project: ${data.projectName}
Month: ${data.monthLabel}
Total items tracked: ${totalItems}

Work items grouped by status:

${groupLines || '(no items recorded)'}

Write 3–5 concise bullet points summarising what the team accomplished in ${data.monthLabel}. Where relevant, mention which items are in production vs staging vs in progress — this context matters to management. Group related items into themes. Each bullet: one sentence, action verb, clear outcome.

Format: bullet points starting with "•", no headers, no preamble.`;
}

interface MonthlyProjectionsInput {
  projectName: string;
  monthLabel: string;      // current month, e.g. 'June 2026'
  nextMonthLabel: string;  // projection target, e.g. 'July 2026'
  stateGroups: Array<{
    state_name: string;
    flow_category: string;
    items: Array<{ title: string; priority: string }>;
  }>;
}

function buildMonthlyProjectionsPrompt(data: MonthlyProjectionsInput): string {
  const groupLines = data.stateGroups.map((g) => {
    const label = FLOW_LABEL[g.flow_category] ?? g.flow_category;
    const items = g.items.map((i) => `    - ${i.title}`).join('\n');
    return `${g.state_name} — ${label} (${g.items.length} items):\n${items}`;
  }).join('\n\n');

  const totalItems = data.stateGroups.reduce((s, g) => s + g.items.length, 0);

  return `You are a CTO writing the "Projected activities for ${data.nextMonthLabel}" section of a monthly performance review. Audience is senior management.

Project: ${data.projectName}
Current month: ${data.monthLabel}
Items currently in active development (${totalItems} total):

${groupLines || '(no active items)'}

Based on what is currently in progress, write 3–5 concise forward-looking bullet points projecting what the team expects to accomplish in ${data.nextMonthLabel}. Use future tense ("The team will...", "Planned completion of...", "Focus will be on..."). Be specific about outcomes, not just activities. Prioritise items in staging/review as they are closest to completion.

Format: bullet points starting with "•", no headers, no preamble.`;
}

export const aiService = {
  async generateMonthlyProjections(input: MonthlyProjectionsInput): Promise<string> {
    if (!env.OPENROUTER_API_KEY) {
      throw new Error('OpenRouter API key not configured. Set OPENROUTER_API_KEY in the API environment.');
    }

    const response = await fetchWithRetry(`${OPENROUTER_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': env.FRONTEND_URL,
        'X-Title': 'Cadence Monthly Report',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-haiku',
        messages: [{ role: 'user', content: buildMonthlyProjectionsPrompt(input) }],
        max_tokens: 500,
        temperature: 0.6,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`OpenRouter error ${response.status}: ${errText}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    const content = data.choices[0]?.message.content;
    if (!content) throw new Error('Empty response from OpenRouter');
    return content.trim();
  },

  async generateMonthlyActivities(input: MonthlyActivitiesInput): Promise<string> {
    if (!env.OPENROUTER_API_KEY) {
      throw new Error('OpenRouter API key not configured. Set OPENROUTER_API_KEY in the API environment.');
    }

    const response = await fetchWithRetry(`${OPENROUTER_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': env.FRONTEND_URL,
        'X-Title': 'Cadence Monthly Report',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-haiku',
        messages: [{ role: 'user', content: buildMonthlyActivitiesPrompt(input) }],
        max_tokens: 500,
        temperature: 0.6,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`OpenRouter error ${response.status}: ${errText}`);
    }

    const rawText = await response.text();
    let data: { choices?: Array<{ message?: { content?: string } }> };
    try { data = JSON.parse(rawText); }
    catch { throw new Error(`OpenRouter non-JSON response: ${rawText.slice(0, 200)}`); }

    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error(`Empty response from OpenRouter (weekly summary): ${rawText.slice(0, 300)}`);
    return content.trim();
  },

  async generateSprintRetro(input: SprintRetroInput): Promise<string> {
    if (!env.OPENROUTER_API_KEY) {
      throw new Error('OpenRouter API key not configured. Set OPENROUTER_API_KEY in the API environment.');
    }

    const response = await fetchWithRetry(`${OPENROUTER_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': env.FRONTEND_URL,
        'X-Title': 'Cadence Sprint Analytics',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-haiku',
        messages: [{ role: 'user', content: buildRetroPrompt(input) }],
        max_tokens: 400,
        temperature: 0.65,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`OpenRouter error ${response.status}: ${errText}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    const content = data.choices[0]?.message.content;
    if (!content) throw new Error('Empty response from OpenRouter');
    return content.trim();
  },

  async generateWeeklyProjectSummary(input: WeeklyProjectSummaryInput): Promise<string> {
    if (!env.OPENROUTER_API_KEY) {
      throw new Error('OpenRouter API key not configured. Set OPENROUTER_API_KEY in the API environment.');
    }

    const response = await fetchWithRetry(`${OPENROUTER_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': env.FRONTEND_URL,
        'X-Title': 'Cadence Weekly Status Report',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [{ role: 'user', content: buildWeeklySummaryPrompt(input) }],
        max_tokens: 4000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`OpenRouter error ${response.status}: ${errText}`);
    }

    const rawText = await response.text();
    let data: { choices?: Array<{ message?: { content?: string }; finish_reason?: string }> } = {};
    try { data = JSON.parse(rawText); } catch { /* fall through to error below */ }

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error(`OpenRouter returned no content for weekly summary. Response: ${rawText.slice(0, 400)}`);
    }
    return content.trim();
  },
};

// ─── Weekly project summary ────────────────────────────────────────────────────

export interface WeeklyProjectSummaryInput {
  projectName: string;
  dateFrom: string;
  dateTo: string;
  totalItems: number;
  completedItems: number;
  inProgressItems: number;
  reviewItems: number;
  staleItems: number;
  highPriorityItems: number;
  assigneeStats: Array<{
    name: string;
    completed: number;
    inProgress: number;
    stale: number;
    totalActive: number;
  }>;
  completedTitles: string[];
  staleTitles: string[];
  blockedTitles: string[];
}

function buildWeeklySummaryPrompt(input: WeeklyProjectSummaryInput): string {
  const {
    projectName, dateFrom, dateTo, totalItems, completedItems,
    inProgressItems, reviewItems, staleItems, highPriorityItems,
    assigneeStats, completedTitles, staleTitles, blockedTitles,
  } = input;

  const topPerformers = [...assigneeStats]
    .sort((a, b) => b.completed - a.completed)
    .slice(0, 5)
    .filter(a => a.totalActive > 0);

  const assigneeLines = topPerformers.length > 0
    ? topPerformers.map(a =>
        `  - ${a.name}: ${a.completed} completed, ${a.inProgress} in progress${a.stale > 0 ? `, ${a.stale} stale` : ''}`
      ).join('\n')
    : '  - No assignee data available';

  const completedLines = completedTitles.slice(0, 8).map(t => `  • ${t}`).join('\n') || '  • None';
  const staleLines = staleTitles.slice(0, 5).map(t => `  • ${t}`).join('\n') || '  • None';
  const blockedLines = blockedTitles.slice(0, 5).map(t => `  • ${t}`).join('\n') || '  • None';

  return `You are writing a weekly status summary for the CTO of a software company. Write a clear, confident, executive-level paragraph summary of what happened in the "${projectName}" project during ${dateFrom} to ${dateTo}.

DATA:
- Total active items this week: ${totalItems}
- Completed/shipped: ${completedItems}
- In active development: ${inProgressItems}
- In review/staging: ${reviewItems}
- Stale items (stuck too long): ${staleItems}
- High-priority items active: ${highPriorityItems}

COMPLETED THIS WEEK:
${completedLines}

STALE / AT RISK:
${staleLines}

BLOCKED ITEMS:
${blockedLines}

TEAM PERFORMANCE:
${assigneeLines}

INSTRUCTIONS:
Write exactly 3 paragraphs separated by blank lines. Plain professional English only. No bullet points, no markdown, no headings, no repetition.

Paragraph 1 (3-4 sentences): Overall health and momentum. Cover the total items active, how many were completed, the completion rate as a percentage, and a clear verdict on whether this was a strong, average, or slow week. Mention any notable patterns in the pipeline.

Paragraph 2 (4-6 sentences): Name every team member who completed items — call out each person specifically with what they shipped. For top performers (most completions), describe the impact of their work in context. Do not generalise — use names and task titles from the data.

Paragraph 3 (3-4 sentences): Deep dive on stale items — name each one, how long it has been stuck, which state it is in, and who owns it. Explain the downstream risk of leaving these unresolved.

Paragraph 4 (2-3 sentences): High-priority items currently active — are they moving fast enough? Name any urgent or high-priority items that are not progressing and the risk they pose.

Paragraph 5 (2-3 sentences): Clear recommendation for next week — what should the team focus on first, second, and third to restore or maintain velocity?

Critical rules: Do not repeat any word or phrase twice in the same sentence. Write at least 400 words total. Be specific, not vague.`;
}

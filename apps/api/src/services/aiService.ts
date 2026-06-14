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

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    const content = data.choices[0]?.message.content;
    if (!content) throw new Error('Empty response from OpenRouter');
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
};

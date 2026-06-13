import { env } from '../config/env.js';

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

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

export const aiService = {
  async generateSprintRetro(input: SprintRetroInput): Promise<string> {
    if (!env.OPENROUTER_API_KEY) {
      throw new Error('OpenRouter API key not configured. Set OPENROUTER_API_KEY in the API environment.');
    }

    const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
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

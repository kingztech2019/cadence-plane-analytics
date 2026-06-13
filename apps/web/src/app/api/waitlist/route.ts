import { Resend } from 'resend';
import { NextRequest, NextResponse } from 'next/server';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { email?: unknown };
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }

    if (!process.env.RESEND_API_KEY) {
      // Dev mode or build time: just log it
      console.log('[waitlist] new signup:', email);
      return NextResponse.json({ ok: true });
    }

    // Lazy init — only runs at request time, never at build time
    const resend = new Resend(process.env.RESEND_API_KEY);

    await resend.emails.send({
      from: 'Cadence Waitlist <onboarding@resend.dev>',
      to: process.env.WAITLIST_NOTIFY_EMAIL ?? 'oluwajuwon.falore@sagegreytech.com',
      subject: `New waitlist signup: ${email}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
          <h2 style="margin:0 0 8px;font-size:20px;color:#111">New Cadence waitlist signup</h2>
          <p style="margin:0 0 24px;color:#555;font-size:15px">Someone just joined the waitlist.</p>
          <div style="background:#f5f5f5;border-radius:8px;padding:16px 20px;font-size:16px;font-weight:600;color:#111">
            ${email}
          </div>
          <p style="margin:24px 0 0;color:#999;font-size:12px">
            Sent by the Cadence waitlist form at cadence-plane-analytics.vercel.app
          </p>
        </div>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[waitlist] error:', err);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}

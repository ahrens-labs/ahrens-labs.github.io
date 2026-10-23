// "It's your move" reminder emails for long online board games.
// Each game record keeps record.nag = { [seat]: { since, check, done } }: when that player's move came due, when to
// look next, and whether this wait has already been reminded. A player's settings (userData.gamesSettings) decide
// whether they get reminders and after how many days, so the first look is after a day and the real due time is
// worked out then. One email per wait; moving (or the turn passing) starts a new wait.
const DAY = 86400000;
const FIRST_LOOK_MS = DAY;
export const REMINDER_DAYS = [1, 2, 3, 5, 7];
export const DEFAULT_REMINDER_DAYS = 3;

// Seats whose move it is now (people only). `movedBy`: the seat that just acted, whose wait starts over.
export function trackTurns(record, seats, movedBy) {
  const now = Date.now();
  const nag = record.nag || {};
  const want = new Set(record.status === 'active' && (record.mode || 'long') === 'long' ? seats.filter((s) => s != null) : []);
  Object.keys(nag).forEach((k) => {
    if (!want.has(Number(k))) delete nag[k];
  });
  want.forEach((s) => {
    if (!nag[s] || s === movedBy) nag[s] = { since: now, check: now + FIRST_LOOK_MS, done: false };
  });
  if (Object.keys(nag).length) record.nag = nag;
  else delete record.nag;
}

// When the game object should next wake up for reminders (or null).
export function nextReminderAt(record) {
  if (!record.nag) return null;
  const times = Object.values(record.nag).filter((n) => !n.done).map((n) => n.check);
  return times.length ? Math.min(...times) : null;
}

export const remindersDue = (record) => {
  const t = nextReminderAt(record);
  return t != null && t <= Date.now() + 1000;
};

async function profileOf(env, userId) {
  try {
    const res = await env.USER_ACCOUNT.get(env.USER_ACCOUNT.idFromName(userId)).fetch(new Request('http://do/getData'));
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export function reminderDaysOf(settings) {
  const d = Number(settings && settings.reminderDays);
  return REMINDER_DAYS.includes(d) ? d : DEFAULT_REMINDER_DAYS;
}

// Sends the reminders that are due. `game`: { title, page, id, userIdOf(seat), others(seat) → names }.
export async function sendDueReminders(env, record, game) {
  const now = Date.now();
  const nag = record.nag || {};
  const seats = Object.keys(nag).map(Number).filter((s) => !nag[s].done && nag[s].check <= now + 1000);
  await Promise.all(seats.map(async (s) => {
    const n = nag[s];
    const userId = game.userIdOf(s);
    const p = userId ? await profileOf(env, userId) : null;
    const settings = (p && p.gamesSettings) || {};
    if (!p || settings.turnReminders === false || !p.email || p.emailVerified === false) {
      n.done = true;
      return;
    }
    const days = reminderDaysOf(settings);
    const due = n.since + days * DAY;
    if (now < due - 60000) {
      n.check = due;
      return;
    }
    n.done = true;
    try {
      await sendReminderEmail(env, { to: p.email, name: p.username, days, ...game, others: game.others(s) });
    } catch (e) {
      console.error('turn reminder email failed', e && e.message);
    }
  }));
}

async function sendReminderEmail(env, { to, name, days, title, page, id, others }) {
  const mail = globalThis.__ahrensMail;
  if (!mail || !mail.real(to)) return;
  const esc = mail.esc;
  const site = mail.site(env);
  const who = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 40) || 'there';
  const gameTitle = String(title || 'your game').slice(0, 60);
  const rivals = (others || []).filter(Boolean).slice(0, 4);
  const against = rivals.length ? ` with ${rivals.join(', ')}` : '';
  const url = `${site}/${String(page || 'ahrens-games').replace(/[^a-z0-9._-]/gi, '')}?game=${encodeURIComponent(id)}`;
  const settingsUrl = `${site}/ahrens-games/settings`;
  const waited = days === 1 ? 'a day' : `${days} days`;
  const subject = `It’s your move in ${gameTitle}`;
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:24px 14px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
        <tr>
          <td style="padding:22px 28px;background:linear-gradient(120deg,#0b1530 0%,#004cd6 100%);">
            <p style="margin:0;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#ffd21f;">${esc(gameTitle)} · Ahrens Games</p>
            <p style="margin:8px 0 0 0;font-size:22px;font-weight:900;line-height:1.25;color:#ffffff;">It’s your move!</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 28px;">
            <p style="margin:0 0 12px 0;font-size:16px;font-weight:700;">Hi ${esc(who)},</p>
            <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#334155;">Your game of ${esc(gameTitle)}${esc(against)} has been waiting on you for ${waited}. Jump back in whenever you’re ready.</p>
            <div style="text-align:center;">
              <a href="${esc(url)}" style="display:inline-block;padding:13px 26px;background:#004cd6;color:#ffffff !important;text-decoration:none;border-radius:999px;font-weight:800;font-size:15px;">Take your turn</a>
            </div>
            <p style="margin:22px 0 0 0;font-size:12px;line-height:1.5;color:#64748b;">You get one reminder per turn. To change when they come or turn them off, visit your <a href="${esc(settingsUrl)}" style="color:#004cd6;">Ahrens Games settings</a>.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  const text = [
    `Hi ${who},`,
    '',
    `Your game of ${gameTitle}${against} has been waiting on you for ${waited}.`,
    '',
    `Take your turn: ${url}`,
    '',
    `Change or turn off these reminders: ${settingsUrl}`,
  ].join('\n');
  await mail.send(env, { to, subject, html, text });
}

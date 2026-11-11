import { createClient } from 'npm:@supabase/supabase-js@2';

const url = Deno.env.get('SUPABASE_URL') ?? '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '';
const botUsername = Deno.env.get('TELEGRAM_BOT_USERNAME') ?? '';
const telegramSecret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET') ?? '';
const notifySecret = Deno.env.get('CHECKIN_WEBHOOK_SECRET') ?? '';
const admin = url && serviceKey ? createClient(url, serviceKey, { auth: { persistSession: false } }) : null;

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8' },
});

async function hash(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), x => x.toString(16).padStart(2, '0')).join('');
}

async function sendMessage(chatId: number, message: string) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: message }),
  });
  if (!response.ok) throw new Error(`Telegram HTTP ${response.status}`);
  const result = await response.json();
  if (!result.ok) throw new Error('Telegram did not accept the message');
}

async function link(req: Request) {
  if (!admin) return json({ error: 'Function is not configured' }, 503);
  const jwt = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!jwt) return json({ error: 'Sign in first' }, 401);
  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data.user || data.user.app_metadata?.role !== 'hr') return json({ error: 'HR access required' }, 403);

  const token = Array.from(crypto.getRandomValues(new Uint8Array(24)), x => x.toString(16).padStart(2, '0')).join('');
  const tokenHash = await hash(token);
  const { error: insertError } = await admin.from('telegram_link_codes').insert({
    token_hash: tokenHash,
    hr_id: data.user.id,
    expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
  });
  if (insertError) return json({ error: 'Could not create link' }, 500);
  return json({ url: `https://t.me/${botUsername}?start=${token}` });
}

async function telegramUpdate(req: Request, body: any) {
  if (!admin) return json({ error: 'Function is not configured' }, 503);
  if (!telegramSecret || req.headers.get('x-telegram-bot-api-secret-token') !== telegramSecret) return json({ error: 'Forbidden' }, 403);
  const message = body?.message;
  const chatId = Number(message?.chat?.id);
  const startToken = String(message?.text ?? '').match(/^\/start\s+([a-f0-9]{48})$/)?.[1];
  if (!chatId || message?.chat?.type !== 'private' || !startToken) return json({ ok: true });

  const tokenHash = await hash(startToken);
  const { data: code } = await admin.from('telegram_link_codes').select('hr_id,expires_at').eq('token_hash', tokenHash).maybeSingle();
  if (!code || Date.parse(code.expires_at) < Date.now()) {
    await sendMessage(chatId, 'Ссылка устарела. Создайте новую в кабинете HR.');
    return json({ ok: true });
  }
  const { error } = await admin.from('hr_shifts').upsert({ hr_id: code.hr_id, telegram_chat_id: chatId }, { onConflict: 'hr_id' });
  if (error) return json({ error: 'Could not link chat' }, 500);
  await admin.from('telegram_link_codes').delete().eq('token_hash', tokenHash);
  await sendMessage(chatId, 'Бот подключён. Срочные сигналы будут приходить только во время вашей смены.');
  return json({ ok: true });
}

async function notifyCheckin(req: Request, body: any) {
  if (!admin) return json({ error: 'Function is not configured' }, 503);
  if (!notifySecret || req.headers.get('x-notify-secret') !== notifySecret) return json({ error: 'Forbidden' }, 403);
  if (body?.type !== 'INSERT' || body?.table !== 'checkins') return json({ ok: true, skipped: true });
  const item = body.record;
  if (!item?.id || !item?.employee_id || !(item.mood <= 2 || item.access_ready === false || item.wants_contact === true)) return json({ ok: true, skipped: true });

  const [{ data: person }, { data: shifts }] = await Promise.all([
    admin.from('profiles').select('full_name,role_title,team').eq('id', item.employee_id).maybeSingle(),
    admin.from('hr_shifts').select('hr_id,telegram_chat_id').eq('on_shift', true).not('telegram_chat_id', 'is', null),
  ]);
  if (!person || !shifts?.length) return json({ ok: true, sent: 0 });

  let sent = 0;
  for (const shift of shifts) {
    const { error: claimError } = await admin.from('telegram_deliveries').insert({ checkin_id: item.id, hr_id: shift.hr_id });
    if (claimError) continue;
    try {
      await sendMessage(Number(shift.telegram_chat_id),
        `⚠️ Новичку нужна помощь\n${person.full_name} · ${person.role_title} · ${person.team}\nСамочувствие: ${item.mood}/5 · Ясность задач: ${item.clarity}/5\nДоступы: ${item.access_ready ? 'есть' : 'не хватает'} · Просит связи: ${item.wants_contact ? 'да' : 'нет'}\nОткройте очередь сигналов в рабочем кабинете.`);
      sent++;
    } catch (error) {
      console.error('Telegram delivery failed', error);
      await admin.from('telegram_deliveries').delete().eq('checkin_id', item.id).eq('hr_id', shift.hr_id);
    }
  }
  return json({ ok: true, sent });
}

Deno.serve(async req => {
  if (req.method !== 'POST') return json({ error: 'POST required' }, 405);
  if (!url || !serviceKey || !botToken) return json({ error: 'Function is not configured' }, 503);
  try {
    const body = await req.json();
    const action = new URL(req.url).searchParams.get('action') ?? body?.action;
    if (action === 'link') return await link(req);
    if (action === 'telegram-update') return await telegramUpdate(req, body);
    if (action === 'checkin') return await notifyCheckin(req, body);
    return json({ error: 'Unknown action' }, 400);
  } catch (error) {
    console.error('Telegram function error', error);
    return json({ error: 'Request failed' }, 500);
  }
});

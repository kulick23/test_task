import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type Role = 'newcomer' | 'hr';
export type Profile = { id: string; role: Role; full_name: string; role_title: string; team: string; start_date: string; work_email?: string };
export type Checkin = { id: string; employee_id: string; day: string; mood: number; clarity: number; access_ready: boolean; wants_contact: boolean; note: string; status: 'new' | 'contacted' | 'resolved'; profiles?: Profile };
export type Article = { id: string; category: string; title: string; summary: string; body: string; reading_minutes: number };
export type Contact = { id: string; full_name: string; role_title: string; team: string; work_email: string; work_phone?: string; telegram_username?: string };
export const supabase: SupabaseClient | null = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY ? createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY) : null;
export const demoProfiles: Profile[] = [
  { id: 'egor', role: 'newcomer', full_name: 'Егор Сидоров', role_title: 'Продавец-консультант', team: 'Магазин · Минск', start_date: '2026-11-04', work_email: 'egor@example.test' },
  { id: 'alina', role: 'newcomer', full_name: 'Алина Петрова', role_title: 'Специалист склада', team: 'Логистика', start_date: '2026-10-28', work_email: 'alina@example.test' },
  { id: 'maksim', role: 'newcomer', full_name: 'Максим Орлов', role_title: 'Менеджер продаж', team: 'B2B продажи', start_date: '2026-10-15', work_email: 'maksim@example.test' },
];
export const demoArticles: Article[] = [
  { id: '1', category: 'ПЕРВЫЙ ДЕНЬ', title: 'С чего начать в первую неделю', summary: 'План без перегруза: люди, доступы и первые задачи.', body: 'В первый день познакомьтесь с руководителем и наставником. Проверьте доступ к рабочей почте и нужным системам. К концу недели уточните задачи и критерии результата. Если что-то не получается, расскажите об этом в ежедневном чек-ине.', reading_minutes: 3 },
  { id: '2', category: 'РАБОЧИЕ ПРОЦЕССЫ', title: 'Как попросить помощь и не ждать ответа днями', summary: 'К кому обратиться с вопросом о задачах, доступах или графике.', body: 'По задачам обратитесь к наставнику или руководителю. По доступам — к IT-поддержке. По документам, адаптации и графику — к HR. Если вопрос блокирует работу, отметьте это в чек-ине: HR увидит сигнал и свяжется с вами.', reading_minutes: 2 },
  { id: '3', category: 'ИНСТРУМЕНТЫ', title: 'Рабочая почта, Битрикс24 и заявки', summary: 'Где искать задачи и как сообщить о технической проблеме.', body: 'Задачи по приёму и рабочие поручения приходят через Битрикс24. Проверьте уведомления и доступ к нужным группам. Если вход не работает, напишите IT-поддержке и отметьте отсутствие доступа в чек-ине.', reading_minutes: 4 },
  { id: '4', category: 'КОМАНДА', title: 'Первые разговоры с коллегами', summary: 'Короткий способ запомнить, кто за что отвечает.', body: 'Откройте справочник команды и сохраните контакты наставника, руководителя и HR. Начните с простого вопроса: какой результат важен в первую неделю? Не нужно пытаться запомнить все процессы сразу.', reading_minutes: 2 },
];
export const demoContacts: Contact[] = [
  { id: '1', full_name: 'Виктория Ковалёва', role_title: 'HR-партнёр', team: 'Поддержка новичков', work_email: 'hr@example.test', work_phone: '+375 00 000-00-01', telegram_username: '' },
  { id: '2', full_name: 'Анна Белова', role_title: 'Наставник', team: 'Розница', work_email: 'mentor@example.test', work_phone: '+375 00 000-00-02' },
  { id: '3', full_name: 'Илья Мороз', role_title: 'IT-поддержка', team: 'Доступы и оборудование', work_email: 'support@example.test', work_phone: '+375 00 000-00-03' },
  { id: '4', full_name: 'Ольга Жук', role_title: 'Руководитель магазина', team: 'Розница · Минск', work_email: 'manager@example.test', work_phone: '+375 00 000-00-04' },
];
const demoSeed: Checkin[] = [
  { id: 'seed-1', employee_id: 'alina', day: today(), mood: 2, clarity: 2, access_ready: false, wants_contact: true, note: 'Не хватает доступа к учётной системе, из-за этого не могу закончить задачу.', status: 'new' },
  { id: 'seed-2', employee_id: 'maksim', day: today(), mood: 4, clarity: 3, access_ready: true, wants_contact: false, note: 'Есть вопрос по приоритетам на эту неделю.', status: 'new' },
];
const key = 'novichok-pulse-checkins-v2';
export function getDemoCheckins(): Checkin[] { try { return JSON.parse(localStorage.getItem(key) || 'null') || demoSeed; } catch { return demoSeed; } }
export function saveDemoCheckins(items: Checkin[]) { localStorage.setItem(key, JSON.stringify(items)); }
export function severity(item: Checkin): 'critical' | 'attention' | 'stable' { return item.mood <= 2 || !item.access_ready || item.wants_contact ? 'critical' : item.mood === 3 || item.clarity <= 2 ? 'attention' : 'stable'; }
export function profileFor(item: Checkin, profiles: Profile[]) { return item.profiles || profiles.find(p => p.id === item.employee_id); }
export function today() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

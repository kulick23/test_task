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
  { id: '1', category: 'ПЕРВЫЙ ДЕНЬ', title: 'Как устроены GoSports и Ragex', summary: 'Кто мы, что производим и кому помогаем.', body: 'GoSports — экипировочный центр спортивных товаров: здесь помогают подобрать форму и инвентарь для спортсменов, команд и клубов. Ragex — белорусский бренд техники и товаров для дома. В работе ориентируйся на потребность клиента: уточни задачу, предложи подходящий товар и проверь наличие и условия у команды.', reading_minutes: 3 },
  { id: '2', category: 'КЛИЕНТСКИЙ СЕРВИС', title: 'Как помочь покупателю выбрать товар', summary: 'Уточни назначение, параметры и срок покупки.', body: 'Сначала выясни, для кого и для чего выбирают товар. Для спортивной формы уточни вид спорта, команду, размеры и сроки; для техники — нужные функции, условия использования и бюджет. Не обещай наличие, срок доставки или характеристики, если не проверил их в актуальном каталоге или у коллег.', reading_minutes: 3 },
  { id: '3', category: 'КОМАНДЫ И КЛУБЫ', title: 'Запросы на экипировку и оптовые поставки', summary: 'Как обработать обращение от команды или организации.', body: 'Запиши название клуба или организации, контактное лицо, вид спорта, список товаров, размеры и желаемый срок. Передай запрос ответственному за оптовые продажи. Условия скидок и сроки подтверждай только после согласования.', reading_minutes: 2 },
  { id: '4', category: 'ТОВАР И КАЧЕСТВО', title: 'Как отвечать на вопросы о Ragex', summary: 'Проверяй характеристики, гарантию и комплектацию.', body: 'Ragex предлагает бытовую технику и электронику для кухни и дома. Подбирай модель по задаче клиента и сверяй характеристики с карточкой товара. По вопросам гарантии, комплектации, возврата или неисправности направляй покупателя к ответственному сотруднику и действующим правилам компании.', reading_minutes: 2 },
  { id: '5', category: 'РАБОЧИЕ ПРОЦЕССЫ', title: 'Если не знаешь ответ или не хватает доступа', summary: 'Не гадай — зафиксируй вопрос и обратись к команде.', body: 'Если не можешь подтвердить наличие, цену, срок, гарантийные условия или характеристику, скажи клиенту, что уточнишь информацию. Запиши вопрос и обратись к наставнику или руководителю. Если проблема блокирует работу, отметь её в чек-ине и попроси HR о контакте.', reading_minutes: 2 },
];
export const demoContacts: Contact[] = [
  { id: '1', full_name: 'HR-команда', role_title: 'Адаптация и рабочие вопросы', team: 'Люди и команда', work_email: 'info@ragexstore.by', work_phone: '+375 44 796-20-00' },
  { id: '2', full_name: 'GoSports — розница', role_title: 'Подбор спортивных товаров', team: 'Клиентский сервис', work_email: 'info@goodsports.by', work_phone: '+375 25 797-77-77' },
  { id: '3', full_name: 'GoSports — оптовые продажи', role_title: 'Команды, клубы и дилеры', team: 'Оптовое направление', work_email: 'info@goodsports.by', work_phone: '+375 29 263-99-99' },
  { id: '4', full_name: 'Ragex', role_title: 'Техника и товары для дома', team: 'Клиентский сервис', work_email: 'info@ragexstore.by', work_phone: '+375 44 796-20-00' },
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

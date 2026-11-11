import { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowLeft, ArrowRight, BookOpen, Check, ChevronRight, CircleAlert, Clock3, LogOut, Mail, Menu, MessageCircle, Phone, ShieldCheck, Users, X } from 'lucide-react';
import { supabase, demoProfiles, demoArticles, demoContacts, getDemoCheckins, saveDemoCheckins, severity, profileFor, today, type Role, type Profile, type Checkin, type Article, type Contact } from './data';
import './styles.css';

type Page = 'today' | 'knowledge' | 'people' | 'overview' | 'signals';
type Form = { mood: number; clarity: number; access_ready?: boolean; wants_contact?: boolean; note: string };
const blank: Form = { mood: 0, clarity: 0, note: '' };
const rolePages: Record<Role, Page[]> = { newcomer: ['today', 'knowledge', 'people'], hr: ['overview', 'signals'] };
const titles: Record<Page, string> = { today: 'Сегодня', knowledge: 'Материалы', people: 'Контакты', overview: 'Обзор', signals: 'Сигналы' };
const todayDate = today();
function initials(name: string) { return name.split(' ').slice(0, 2).map(s => s[0]).join(''); }

function App() {
  const [role, setRole] = useState<Role | null>(null);
  const [demo, setDemo] = useState(!supabase);
  const [page, setPage] = useState<Page>('today');
  const [profile, setProfile] = useState<Profile>(demoProfiles[0]);
  const [profiles, setProfiles] = useState<Profile[]>(demoProfiles);
  const [checkins, setCheckins] = useState<Checkin[]>(getDemoCheckins);
  const [articles, setArticles] = useState<Article[]>(demoArticles);
  const [contacts, setContacts] = useState<Contact[]>(demoContacts);
  const [onShift, setOnShift] = useState(localStorage.getItem('novichok-on-shift') === 'true');
  const [chatLinked, setChatLinked] = useState(false);
  const [form, setForm] = useState<Form>(blank);
  const [selected, setSelected] = useState<Checkin | null>(null);
  const [openedArticle, setOpenedArticle] = useState<Article | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function navigate(next: Page, activeRole = role) {
    if (!activeRole || !rolePages[activeRole].includes(next)) return;
    setPage(next); setMenuOpen(false);
    history.pushState({}, '', `/${activeRole}/${next}`);
  }
  function enterDemo(nextRole: Role) {
    setDemo(true); setRole(nextRole); setError('');
    const nextPage = rolePages[nextRole][0]; setPage(nextPage);
    history.replaceState({}, '', `/${nextRole}/${nextPage}`);
  }
  useEffect(() => {
    const onPop = () => {
      const [, pathRole, pathPage] = location.pathname.split('/');
      if (role && pathRole === role && rolePages[role].includes(pathPage as Page)) setPage(pathPage as Page);
      else if (role) history.replaceState({}, '', `/${role}/${page}`);
    };
    addEventListener('popstate', onPop); return () => removeEventListener('popstate', onPop);
  }, [role, page]);
  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    client.auth.getUser().then(({ data }) => {
      const user = data.user;
      const actualRole = user?.app_metadata?.role as Role | undefined;
      if (user && (actualRole === 'hr' || actualRole === 'newcomer')) {
        setDemo(false); setPage(rolePages[actualRole][0]);
        history.replaceState({}, '', `/${actualRole}/${rolePages[actualRole][0]}`);
        void loadCloud(actualRole, user.id);
      }
    });
  }, []);
  async function loadCloud(activeRole: Role, userId: string) {
    if (!supabase) return;
    const client = supabase;
    const [p, a, c, q] = await Promise.all([
      client.from('profiles').select('*'), client.from('articles').select('*').eq('published', true).order('sort_order'),
      client.from('contacts').select('*').order('sort_order'), client.from('checkins').select('*, profiles!checkins_employee_id_fkey(*)').order('day', { ascending: false })
    ]);
    if (p.error || a.error || c.error || q.error) { setError('Не удалось загрузить данные. Проверьте доступ и настройки Supabase.'); setRole(null); return; }
    const fetchedProfiles = (p.data || []) as Profile[];
    const ownProfile = fetchedProfiles.find(x => x.id === userId);
    if (!ownProfile || ownProfile.role !== activeRole) { setError('Профиль не найден или роль не совпадает. Обратитесь к администратору.'); setRole(null); return; }
    setProfiles(fetchedProfiles); setProfile(ownProfile); setRole(activeRole);
    setArticles((a.data || []) as Article[]); setContacts((c.data || []) as Contact[]); setCheckins((q.data || []) as Checkin[]);
    if (activeRole === 'hr') {
      const shift = await client.from('hr_shifts').select('on_shift,telegram_chat_id').eq('hr_id', userId).maybeSingle();
      setOnShift(!!shift.data?.on_shift); setChatLinked(!!shift.data?.telegram_chat_id);
    }
  }
  async function signIn(event: React.FormEvent) {
    event.preventDefault(); if (!supabase) return;
    setBusy(true); setError('');
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    const actualRole = data.user?.app_metadata?.role as Role | undefined;
    if (authError || !data.user || (actualRole !== 'hr' && actualRole !== 'newcomer')) setError(authError?.message || 'Роль не назначена администратором.');
    else { setDemo(false); setPage(rolePages[actualRole][0]); history.replaceState({}, '', `/${actualRole}/${rolePages[actualRole][0]}`); await loadCloud(actualRole, data.user.id); }
    setBusy(false);
  }
  async function leave() {
    if (!demo) await supabase?.auth.signOut();
    setRole(null); setSelected(null); setOpenedArticle(null); history.replaceState({}, '', '/');
  }
  async function submit() {
    if (!role || role !== 'newcomer' || !form.mood || !form.clarity || form.access_ready === undefined || form.wants_contact === undefined) return;
    const entry: Checkin = { id: crypto.randomUUID(), employee_id: profile.id, day: todayDate, mood: form.mood, clarity: form.clarity, access_ready: form.access_ready, wants_contact: form.wants_contact, note: form.note.trim(), status: 'new' };
    setBusy(true); setError('');
    if (demo) { const updated = [entry, ...checkins.filter(x => !(x.employee_id === profile.id && x.day === todayDate))]; setCheckins(updated); saveDemoCheckins(updated); }
    else {
      const { data, error: saveError } = await supabase!.from('checkins').insert({ employee_id: entry.employee_id, day: entry.day, mood: entry.mood, clarity: entry.clarity, access_ready: entry.access_ready, wants_contact: entry.wants_contact, note: entry.note }).select().single();
      if (saveError) setError(saveError.message); else setCheckins(current => [data as Checkin, ...current.filter(x => !(x.employee_id === profile.id && x.day === todayDate))]);
    }
    setBusy(false);
  }
  async function changeStatus(item: Checkin, status: Checkin['status']) {
    if (role !== 'hr') return;
    setBusy(true); setError('');
    if (demo) { const updated = checkins.map(x => x.id === item.id ? { ...x, status } : x); setCheckins(updated); saveDemoCheckins(updated); setSelected({ ...item, status }); }
    else {
      const { error: changeError } = await supabase!.from('checkins').update({ status }).eq('id', item.id);
      if (changeError) setError(changeError.message); else { setCheckins(current => current.map(x => x.id === item.id ? { ...x, status } : x)); setSelected({ ...item, status }); }
    }
    setBusy(false);
  }
  async function toggleShift() {
    if (role !== 'hr') return;
    const next = !onShift; setBusy(true); setError('');
    if (demo) { setOnShift(next); localStorage.setItem('novichok-on-shift', String(next)); }
    else {
      const { data: auth } = await supabase!.auth.getUser();
      if (!auth.user) setError('Сессия завершилась. Войдите снова.');
      else { const { error: shiftError } = await supabase!.from('hr_shifts').upsert({ hr_id: auth.user.id, on_shift: next }, { onConflict: 'hr_id' }); if (shiftError) setError(shiftError.message); else setOnShift(next); }
    }
    setBusy(false);
  }
  async function linkTelegram() {
    if (!supabase || role !== 'hr' || demo) return;
    setBusy(true); setError('');
    const { data, error: linkError } = await supabase.functions.invoke('telegram', { body: { action: 'link' } });
    if (linkError || !data?.url) setError('Не удалось создать ссылку. Проверьте настройки Telegram-бота.');
    else window.open(data.url, '_blank', 'noopener,noreferrer');
    setBusy(false);
  }
  function resetDemoCheckin(item: Checkin) {
    if (!demo) return;
    const updated = checkins.filter(x => x.id !== item.id);
    setCheckins(updated); saveDemoCheckins(updated); setForm(blank);
  }
  const ownToday = checkins.find(x => x.employee_id === profile.id && x.day === todayDate);
  const enriched = useMemo(() => checkins.map(x => ({ ...x, profiles: profileFor(x, profiles) })), [checkins, profiles]);
  const critical = enriched.filter(x => severity(x) === 'critical' && x.status === 'new');
  const attention = enriched.filter(x => severity(x) === 'attention' && x.status === 'new');
  const latest = enriched.filter(x => x.day === todayDate);

  if (!role) return <div className="welcome"><div className="welcome-inner"><div className="brand dark"><span className="brand-mark">✳</span><span>первый<span>день</span></span></div><span className="eyebrow">АДАПТАЦИЯ СОТРУДНИКОВ</span><h1>Внимание к человеку<br /><em>с первого дня.</em></h1><p>Короткий ежедневный диалог помогает новичку освоиться, а HR — вовремя заметить вопрос и помочь.</p>{supabase && <form className="login-form" onSubmit={signIn}><h2>Войти в рабочее пространство</h2><input aria-label="Рабочая почта" type="email" required placeholder="Рабочая почта" value={email} onChange={e => setEmail(e.target.value)} /><input aria-label="Пароль" type="password" required placeholder="Пароль" value={password} onChange={e => setPassword(e.target.value)} /><button className="primary-button" disabled={busy}>Войти <ArrowRight size={16} /></button></form>}{error && <p className="error">{error}</p>}<div className="demo-entry"><span>ПОСМОТРЕТЬ ДЕМО</span><div><button onClick={() => enterDemo('newcomer')}>Я новичок <ArrowRight size={16} /></button><button onClick={() => enterDemo('hr')}>Я HR <ArrowRight size={16} /></button></div></div></div><div className="welcome-art"><span className="art-kicker">01 / 90</span><div className="art-card"><span>Как проходит твой день?</span><strong>Нужна помощь?</strong><i>Ответ занимает одну минуту.</i></div><div className="art-ring" /></div></div>;

  const nav = role === 'newcomer' ? [{ page: 'today' as Page, icon: Activity }, { page: 'knowledge' as Page, icon: BookOpen }, { page: 'people' as Page, icon: Users }] : [{ page: 'overview' as Page, icon: Activity }, { page: 'signals' as Page, icon: CircleAlert }];
  return <div className="app-shell"><aside className={`sidebar ${menuOpen ? 'open' : ''}`}><div className="brand"><span className="brand-mark">✳</span><span>первый<span>день</span></span></div><div className="workspace"><span className="workspace-icon">Т</span><span>ТГТ<small>{role === 'hr' ? 'HR-пространство' : 'Пространство новичка'}</small></span></div><span className="nav-caption">РАБОЧЕЕ ПРОСТРАНСТВО</span><nav aria-label="Разделы">{nav.map(({ page: p, icon: Icon }) => <button key={p} className={`nav-item ${page === p ? 'active' : ''}`} onClick={() => navigate(p)}><Icon size={19} />{titles[p]}{p === 'signals' && critical.length > 0 && <b>{critical.length}</b>}</button>)}</nav><div className="sidebar-bottom"><ShieldCheck size={19} /><span>{role === 'hr' ? 'Сначала контакт, потом статус.' : 'Ответы помогают команде помочь тебе.'}</span></div></aside><div className="main-column"><header className="topbar"><div><button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Открыть меню"><Menu size={21} /></button><span>ТГТ</span><ChevronRight size={15} /><strong>{titles[page]}</strong></div><div><span className="mode-label">{demo ? 'ДЕМО' : 'РАБОЧЕЕ ПРОСТРАНСТВО'}</span><span className="avatar">{role === 'hr' ? 'HR' : initials(profile.full_name)}</span><button className="icon-button" onClick={leave} title="Выйти" aria-label="Выйти"><LogOut size={18} /></button></div></header><main className="main-content">
    {role === 'newcomer' && page === 'today' && <><div className="hero-row"><div><span className="eyebrow">ТВОЙ ПЕРВЫЙ МЕСЯЦ</span><h1>Привет, {profile.full_name.split(' ')[0]}.</h1><p>Один короткий ответ в день помогает убрать препятствия вовремя. Здесь можно говорить прямо.</p></div><div className="day-badge"><strong>{Math.max(1, Math.floor((Date.now() - new Date(profile.start_date).getTime()) / 86400000) + 1)}</strong><span>день в команде</span></div></div><div className="newcomer-grid"><section className="panel checkin-panel"><div className="panel-top"><span>ЕЖЕДНЕВНЫЙ ЧЕК-ИН</span><span>{new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</span></div>{ownToday ? <div className="submitted"><span className="round-icon green"><Check size={24} /></span><h2>Спасибо за ответ</h2><p>Сегодняшний чек-ин отправлен. Если ты попросил помощь, HR увидит сигнал и свяжется с тобой.</p><div className="own-summary"><span>Настроение: {ownToday.mood} / 5</span><span>Задачи: {ownToday.clarity} / 5</span></div><button className="text-button" onClick={() => resetDemoCheckin(ownToday)} disabled={!demo}> {demo ? 'Заполнить демо снова' : 'Один ответ в день'} </button></div> : <div className="checkin-form"><h2>Как проходит твой день?</h2><p>Ответ увидит только HR-команда. Это не оценка твоей работы.</p><label>Как ты себя чувствуешь сегодня?</label><div className="scale" role="group" aria-label="Самочувствие">{[1,2,3,4,5].map(n => <button key={n} aria-pressed={form.mood === n} className={form.mood === n ? 'selected' : ''} onClick={() => setForm({ ...form, mood: n })}>{n}</button>)}</div><div className="scale-labels"><span>Сложно</span><span>Отлично</span></div><label>Насколько понятны текущие задачи?</label><div className="scale" role="group" aria-label="Ясность задач">{[1,2,3,4,5].map(n => <button key={n} aria-pressed={form.clarity === n} className={form.clarity === n ? 'selected' : ''} onClick={() => setForm({ ...form, clarity: n })}>{n}</button>)}</div><div className="scale-labels"><span>Пока не понимаю</span><span>Всё понятно</span></div><label>Есть всё необходимое для работы?</label><div className="choice-row"><button className={form.access_ready === true ? 'chosen' : ''} onClick={() => setForm({ ...form, access_ready: true })}>Да, всё есть</button><button className={form.access_ready === false ? 'chosen' : ''} onClick={() => setForm({ ...form, access_ready: false })}>Нет, чего-то не хватает</button></div><label>Нужен разговор с HR?</label><div className="choice-row"><button className={form.wants_contact === true ? 'chosen' : ''} onClick={() => setForm({ ...form, wants_contact: true })}>Да, свяжитесь со мной</button><button className={form.wants_contact === false ? 'chosen' : ''} onClick={() => setForm({ ...form, wants_contact: false })}>Пока не нужен</button></div><label htmlFor="note">Что ещё важно знать? <small>необязательно</small></label><textarea id="note" maxLength={600} placeholder="Опиши вопрос или ситуацию своими словами…" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />{error && <p className="error">{error}</p>}<button className="primary-button" disabled={busy || !form.mood || !form.clarity || form.access_ready === undefined || form.wants_contact === undefined} onClick={submit}>Отправить ответ <ArrowRight size={17} /></button></div>}</section><div className="side-stack"><div className="support-card"><MessageCircle size={27} /><h2>Не нужно разбираться одному.</h2><p>Если вопрос мешает работе, отметь его в чек-ине или напиши человеку из команды.</p><button onClick={() => navigate('people')}>Найти контакт <ArrowRight size={15} /></button></div><div className="mini-panel"><span>ПОЛЕЗНО СЕЙЧАС</span>{articles.slice(0,2).map(a => <button key={a.id} onClick={() => { setOpenedArticle(a); navigate('knowledge'); }}>{a.title}<ChevronRight size={16} /></button>)}</div></div></div></>}
    {role === 'newcomer' && page === 'knowledge' && <><div className="page-heading"><span className="eyebrow">БАЗА ЗНАНИЙ</span><h1>Освоиться проще,<br />когда всё под рукой.</h1><p>Короткие материалы для первых недель. Выбирай то, что нужно сейчас.</p></div><div className="article-grid">{articles.map((a,i) => <button className="article-card" key={a.id} onClick={() => setOpenedArticle(a)}><span>{String(i+1).padStart(2,'0')} / {a.category}</span><h2>{a.title}</h2><p>{a.summary}</p><small><Clock3 size={14} /> {a.reading_minutes} мин <ArrowRight size={17} /></small></button>)}</div></>}
    {role === 'newcomer' && page === 'people' && <><div className="page-heading"><span className="eyebrow">ЛЮДИ РЯДОМ</span><h1>Знай, к кому обратиться.</h1><p>Рабочие контакты команды для вопросов по задачам, документам и доступам.</p></div><div className="contact-grid">{contacts.map(c => <div className="contact-card" key={c.id}><span className="person-avatar">{initials(c.full_name)}</span><div><h2>{c.full_name}</h2><p>{c.role_title}<br /><small>{c.team}</small></p></div><div className="contact-actions"><a href={`mailto:${c.work_email}`}><Mail size={17} /> Написать</a>{c.work_phone && <a href={`tel:${c.work_phone.replace(/\s/g,'')}`}><Phone size={17} /> Позвонить</a>}</div></div>)}</div></>}
    {role === 'hr' && page === 'overview' && <><div className="hero-row"><div><span className="eyebrow">АДАПТАЦИЯ / ПЕРВЫЕ 90 ДНЕЙ</span><h1>Кому помочь сегодня?</h1><p>Сигналы основаны на ответах сотрудников: самочувствие, ясность задач, доступы и просьба о контакте.</p></div><div className="shift-control"><span className={`shift-dot ${onShift ? 'live' : ''}`} />{onShift ? 'Вы на смене' : 'Вы вне смены'}<button onClick={toggleShift} disabled={busy}>{onShift ? 'Завершить смену' : 'Начать смену'}</button></div></div><div className="metric-grid"><div className="metric-card urgent"><span>СРОЧНЫЙ КОНТАКТ</span><strong>{critical.length}</strong><p>Попросили помощь, нет доступа или низкая оценка дня</p></div><div className="metric-card"><span>НУЖНО ВНИМАНИЕ</span><strong>{attention.length}</strong><p>Есть вопросы, которые стоит уточнить</p></div><div className="metric-card"><span>ОТВЕТОВ СЕГОДНЯ</span><strong>{latest.length}</strong><p>Ежедневные чек-ины команды</p></div><div className="metric-card"><span>НОВИЧКОВ В КОМАНДЕ</span><strong>{profiles.filter(x => x.role === 'newcomer').length}</strong><p>Профили в рабочем пространстве</p></div></div><div className="section-heading"><div><span className="eyebrow">ПЕРВЫМ ДЕЛОМ</span><h2>Требуют связи</h2></div><button onClick={() => navigate('signals')}>Все сигналы <ArrowRight size={16} /></button></div><SignalList items={critical} profiles={profiles} onSelect={setSelected} /><div className="telegram-panel"><div><MessageCircle size={24} /><span><strong>Уведомления в Telegram</strong><small>{demo ? 'В демоверсии сообщения не отправляются.' : chatLinked ? 'Бот привязан к вашему аккаунту.' : 'Привяжите бота, чтобы получать срочные сигналы во время смены.'}</small></span></div>{!demo && !chatLinked && <button onClick={linkTelegram} disabled={busy}>Подключить бота <ArrowRight size={15} /></button>}<p>Уведомления отправляются только HR, у которого включена смена. Ответы всегда остаются в интерфейсе.</p></div></>}
    {role === 'hr' && page === 'signals' && <><div className="page-heading"><span className="eyebrow">ОЧЕРЕДЬ ДЕЙСТВИЙ</span><h1>Сигналы новичков.</h1><p>Сначала свяжитесь с человеком, затем отметьте статус. Оценки служат подсказкой, а не диагнозом.</p></div><SignalList items={[...enriched].sort((a,b) => (severity(a) === 'critical' ? -1 : 0) - (severity(b) === 'critical' ? -1 : 0))} profiles={profiles} onSelect={setSelected} /></>}
  </main></div>{menuOpen && <button className="mobile-scrim" aria-label="Закрыть меню" onClick={() => setMenuOpen(false)} />}
  {openedArticle && role === 'newcomer' && <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setOpenedArticle(null)}><div className="article-modal" role="dialog" aria-modal="true" aria-label={openedArticle.title}><button className="modal-close" onClick={() => setOpenedArticle(null)} aria-label="Закрыть"><X size={20} /></button><span className="eyebrow">{openedArticle.category} · {openedArticle.reading_minutes} МИН</span><h2>{openedArticle.title}</h2><p>{openedArticle.body}</p><button className="text-button" onClick={() => setOpenedArticle(null)}><ArrowLeft size={16} /> Ко всем материалам</button></div></div>}
  {selected && role === 'hr' && <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setSelected(null)}><div className="detail-modal" role="dialog" aria-modal="true" aria-label="Ответ новичка"><button className="modal-close" onClick={() => setSelected(null)} aria-label="Закрыть"><X size={20} /></button><span className="eyebrow">ЧЕК-ИН · {new Date(selected.day).toLocaleDateString('ru-RU')}</span><h2>{profileFor(selected, profiles)?.full_name || 'Сотрудник'}</h2><p className="muted">{profileFor(selected, profiles)?.role_title} · {profileFor(selected, profiles)?.team}</p><span className={`severity ${severity(selected)}`}>{severity(selected) === 'critical' ? 'Нужен срочный контакт' : severity(selected) === 'attention' ? 'Стоит уточнить' : 'Стабильно'}</span><div className="answer-grid"><div><span>САМОЧУВСТВИЕ</span><strong>{selected.mood} / 5</strong></div><div><span>ЯСНОСТЬ ЗАДАЧ</span><strong>{selected.clarity} / 5</strong></div><div><span>ДОСТУПЫ</span><strong>{selected.access_ready ? 'Есть' : 'Нужна помощь'}</strong></div><div><span>ПРОСЬБА О КОНТАКТЕ</span><strong>{selected.wants_contact ? 'Да' : 'Нет'}</strong></div></div>{selected.note && <blockquote>«{selected.note}»</blockquote>}{error && <p className="error">{error}</p>}<div className="modal-actions">{selected.status === 'new' && <button className="primary-button" disabled={busy} onClick={() => changeStatus(selected, 'contacted')}>Связались с сотрудником <Check size={17} /></button>}{selected.status === 'contacted' && <button className="primary-button" disabled={busy} onClick={() => changeStatus(selected, 'resolved')}>Вопрос решён <Check size={17} /></button>}{selected.status === 'resolved' && <span className="resolved-text"><Check size={17} /> Вопрос закрыт</span>}</div></div></div>}
  </div>;
}
function SignalList({ items, profiles, onSelect }: { items: Checkin[]; profiles: Profile[]; onSelect: (item: Checkin) => void }) { return <div className="signal-list">{items.length === 0 ? <div className="empty-state">Сейчас в этой категории нет сигналов.</div> : items.map(item => { const person = profileFor(item, profiles); return <button className="signal-row" key={item.id} onClick={() => onSelect(item)}><span className="person-avatar">{initials(person?.full_name || 'Н С')}</span><span className="signal-person"><strong>{person?.full_name || 'Сотрудник'}</strong><small>{person?.role_title} · {person?.team}</small></span><span className={`severity ${severity(item)}`}>{severity(item) === 'critical' ? 'Срочно' : severity(item) === 'attention' ? 'Внимание' : 'Стабильно'}</span><span className="signal-status">{item.status === 'new' ? 'Новый' : item.status === 'contacted' ? 'В работе' : 'Решено'}</span><ChevronRight size={17} /></button>; })}</div>; }
export default App;

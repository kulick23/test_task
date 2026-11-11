# Первый день — прототип адаптации новичков

Рабочий сценарий для тестового задания ТГТ: новичок раз в день отвечает на четыре коротких вопроса, а HR видит сигналы и может вовремя связаться с человеком. Статьи и справочник контактов доступны только в пространстве новичка. Метрики, очередь сигналов и переключатель смены доступны только HR.

## Посмотреть локально

```bash
npm install
npm run dev
```

Без `.env` открывается демоверсия с вымышленными людьми и данными. Выберите роль на экране входа. Ответы демоверсии хранятся только в `localStorage` браузера. В демо Telegram не отправляет сообщения.

## Подключить Supabase

1. Создайте проект Supabase и скопируйте `.env.example` в `.env.local`. Заполните `VITE_SUPABASE_URL` и **публичный** `VITE_SUPABASE_ANON_KEY`. Service role key в браузер не добавляйте.
2. Примените миграцию `supabase/migrations/20261111000000_initial.sql` через Supabase CLI или SQL Editor.
3. Создайте пользователей через Supabase Auth. Администратор должен задать каждому `app_metadata.role` со значением `newcomer` или `hr` и создать запись `public.profiles` с тем же `id` и ролью. Поле `user_metadata` для доступа не используется.
4. Добавьте статьи в `public.articles` (`published = true`) и рабочие контакты в `public.contacts`. До подключения настоящего проекта оставьте тестовые адреса.
5. Разверните Edge Function `telegram` из `supabase/functions/telegram` с `verify_jwt = false`. Функция проверяет JWT самостоятельно для привязки HR и отдельные секреты для вебхуков.

Для CLI, если он установлен:

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase functions deploy telegram --no-verify-jwt
```

## Telegram

Создайте бота через BotFather. В секретах Edge Function задайте `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET` и `CHECKIN_WEBHOOK_SECRET` (два случайных независимых значения). `SUPABASE_URL` и `SUPABASE_SERVICE_ROLE_KEY` должны оставаться секретами функции.

Настройте Telegram webhook на `https://YOUR_PROJECT_REF.supabase.co/functions/v1/telegram?action=telegram-update`, передав `TELEGRAM_WEBHOOK_SECRET` как `secret_token` в `setWebhook`. Настройте Database Webhook для **INSERT** в `public.checkins` на `https://YOUR_PROJECT_REF.supabase.co/functions/v1/telegram?action=checkin` с заголовком `x-notify-secret: CHECKIN_WEBHOOK_SECRET`. Не помещайте секреты в репозиторий.

HR нажимает «Подключить бота», открывает одноразовую ссылку и отправляет `/start` боту. Ссылка действует 10 минут. Затем HR включает смену в интерфейсе. Бот отправляет краткое сообщение только по новым срочным чек-инам (`mood ≤ 2`, нет доступа или просьба о контакте), только привязанным HR со включённой сменой. Полный текст ответа остаётся в защищённом HR-интерфейсе. Повторная отправка одного чек-ина одному HR блокируется таблицей `telegram_deliveries`.

## Что проверить перед использованием с реальными людьми

- Создать два тестовых аккаунта с разными ролями и убедиться, что новичок не может читать чужие чек-ины, а HR не может писать ответ от его имени.
- Проверить привязку Telegram, включение и выключение смены, доставку срочного сигнала и отсутствие уведомления вне смены.
- Заменить демонстрационные статьи и контакты на утверждённые компанией; согласовать хранение и доступ к ответам сотрудников.

Прототип не развёрнут и не подключён к реальному Supabase-проекту или Telegram-боту. Сообщение «начато» работодателю не отправлялось.

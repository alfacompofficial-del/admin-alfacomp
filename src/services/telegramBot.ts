// ── Telegram Bot Order Sender & CRM Chat Service ──────────────────────────
// Bot Token: 8508090986:AAFdA3MX80GuDeBHvMT2LZHA9Pm9Wtnj-IY

const BOT_TOKEN = "8508090986:AAFdA3MX80GuDeBHvMT2LZHA9Pm9Wtnj-IY";
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// ⚠️ ВАЖНО: Этот ID получает ВСЕ уведомления о заказах всегда, независимо от других настроек.
// Изменить только здесь в коде.
const OWNER_CHAT_ID = "8871425569"; // Владелец магазина AlfaComp

const DEFAULT_ADMIN_CHAT_IDS = [OWNER_CHAT_ID]; // Список администраторов по умолчанию

// ── Types ──
export interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

export interface CustomerInfo {
  firstName: string;
  lastName: string;
  phone: string;
  username?: string; // Telegram username if user provides it
}

export interface StoredTelegramMessage {
  message_id: number;
  chat_id: string;
  from_user: boolean; // true: sent by client, false: sent by bot/admin
  sender_name: string;
  sender_username?: string;
  text: string;
  date: number; // Unix timestamp
  is_edited?: boolean;
}

export interface TelegramUser {
  chat_id: string;
  first_name: string;
  last_name?: string;
  username?: string;
  last_active: number;
  last_message?: string;
  total_messages: number;
}

const STORAGE_MESSAGES_KEY = "alfacomp_telegram_messages_store_v2";

/**
 * Загрузить сохранённую историю сообщений из локального хранилища (24/7 доступ)
 */
export function loadStoredTelegramMessages(): StoredTelegramMessage[] {
  try {
    if (typeof window === "undefined") return [];
    const raw = localStorage.getItem(STORAGE_MESSAGES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Сохранить сообщения в локальное хранилище
 */
export function saveStoredTelegramMessages(messages: StoredTelegramMessage[]): void {
  try {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_MESSAGES_KEY, JSON.stringify(messages));
  } catch (e) {
    console.warn("[TelegramBot] Error saving messages store:", e);
  }
}

// ── Send message to a specific chat (admin group or user) ──
export async function sendTelegramMessage(chatId: string | number, text: string): Promise<boolean> {
  try {
    const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Отправить сообщение с получением message_id и автоматическим сохранением в историю
 */
export async function sendTelegramMessageWithDetails(
  chatId: string | number,
  text: string
): Promise<{ success: boolean; message?: StoredTelegramMessage; error?: string }> {
  try {
    const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
      }),
    });
    const data = await res.json();
    if (!data.ok || !data.result) {
      return { success: false, error: data.description || "Ошибка отправки" };
    }

    const storedMsg: StoredTelegramMessage = {
      message_id: data.result.message_id,
      chat_id: String(chatId),
      from_user: false,
      sender_name: "AlfaComp Admin (Бот)",
      text,
      date: data.result.date || Math.floor(Date.now() / 1000),
      is_edited: false,
    };

    const current = loadStoredTelegramMessages();
    const updated = [...current, storedMsg];
    saveStoredTelegramMessages(updated);

    return { success: true, message: storedMsg };
  } catch (err: any) {
    return { success: false, error: err.message || "Сетевая ошибка" };
  }
}

/**
 * Редактировать ранее отправленное ботом сообщение в Telegram
 */
export async function editTelegramMessage(
  chatId: string | number,
  messageId: number,
  newText: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${TELEGRAM_API}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text: newText,
        parse_mode: "HTML",
      }),
    });
    const data = await res.json();
    if (!data.ok) {
      return { success: false, error: data.description || "Не удалось отредактировать сообщение" };
    }

    // Обновляем локальную историю
    const current = loadStoredTelegramMessages();
    const updated = current.map((m) => {
      if (m.chat_id === String(chatId) && m.message_id === messageId) {
        return { ...m, text: newText, is_edited: true };
      }
      return m;
    });
    saveStoredTelegramMessages(updated);

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Ошибка редактирования" };
  }
}

/**
 * Удалить сообщение из Telegram (и для бота, и для пользователя)
 */
export async function deleteTelegramMessage(
  chatId: string | number,
  messageId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${TELEGRAM_API}/deleteMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
      }),
    });
    const data = await res.json();
    if (!data.ok) {
      return { success: false, error: data.description || "Не удалось удалить сообщение" };
    }

    // Удаляем из локальной истории
    const current = loadStoredTelegramMessages();
    const updated = current.filter(
      (m) => !(m.chat_id === String(chatId) && m.message_id === messageId)
    );
    saveStoredTelegramMessages(updated);

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Ошибка удаления" };
  }
}

/**
 * Синхронизировать входящие сообщения от пользователей через getUpdates
 * и сохранить их навсегда (чтобы история не терялась при выключенном боте)
 */
export async function syncTelegramUpdates(): Promise<StoredTelegramMessage[]> {
  try {
    const res = await fetch(`${TELEGRAM_API}/getUpdates?limit=100&offset=-100`);
    const data = await res.json();
    if (!data.ok || !Array.isArray(data.result)) {
      return loadStoredTelegramMessages();
    }

    const current = loadStoredTelegramMessages();
    const mapById = new Map<string, StoredTelegramMessage>();
    current.forEach((m) => {
      mapById.set(`${m.chat_id}_${m.message_id}`, m);
    });

    // Check which chats already have replies from the bot
    const chatHasBotReply = new Set<string>();
    current.forEach((m) => {
      if (!m.from_user) chatHasBotReply.add(m.chat_id);
    });

    data.result.forEach((update: any) => {
      const msg = update.message;
      if (!msg || !msg.chat) return;

      const chatId = String(msg.chat.id);
      const msgId = msg.message_id;
      const key = `${chatId}_${msgId}`;

      const senderName = [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(" ") || "Пользователь";
      const senderUsername = msg.from?.username;
      const text = msg.text || (msg.caption ? `[Фото] ${msg.caption}` : "[Медиасообщение]");

      mapById.set(key, {
        message_id: msgId,
        chat_id: chatId,
        from_user: !msg.from?.is_bot,
        sender_name: senderName,
        sender_username: senderUsername,
        text,
        date: msg.date || Math.floor(Date.now() / 1000),
        is_edited: !!msg.edit_date,
      });

      // Auto-greeting for /start if user hasn't received any bot reply yet
      if (text.startsWith("/start") && !chatHasBotReply.has(chatId)) {
        chatHasBotReply.add(chatId);
        const firstName = msg.from?.first_name || "друг";
        const greeting = `Здравствуйте, ${firstName}! 👋\n` +
          `Добро пожаловать в интернет-магазин <b>AlfaComp.uz</b> (Ташкент).\n\n` +
          `🖥 <b>Наш сайт:</b> https://alfacomp.uz\n` +
          `📞 <b>Телефон:</b> +998 (90) 000-00-00\n` +
          `📦 <b>Доставка:</b> по Ташкенту и всему Узбекистану\n` +
          `🛡 <b>Гарантия:</b> официальная до 3 лет\n\n` +
          `💬 Напишите нам, что вас интересует, и наш менеджер ответит вам в ближайшее время!`;

        // Send via bot API in background
        sendTelegramMessageWithDetails(chatId, greeting).then((res) => {
          if (res.success && res.message) {
            const fresh = loadStoredTelegramMessages();
            const freshMap = new Map(fresh.map((m) => [`${m.chat_id}_${m.message_id}`, m]));
            freshMap.set(`${res.message.chat_id}_${res.message.message_id}`, res.message);
            saveStoredTelegramMessages(Array.from(freshMap.values()).sort((a, b) => a.date - b.date));
          }
        });
      }
    });

    const merged = Array.from(mapById.values()).sort((a, b) => a.date - b.date);
    saveStoredTelegramMessages(merged);
    return merged;
  } catch (err) {
    console.warn("[TelegramBot] syncUpdates error:", err);
    return loadStoredTelegramMessages();
  }
}

/**
 * Получить список всех пользователей, когда-либо писавших боту
 */
export function extractTelegramUsers(messages: StoredTelegramMessage[]): TelegramUser[] {
  const usersMap = new Map<string, TelegramUser>();

  messages.forEach((m) => {
    const existing = usersMap.get(m.chat_id);
    if (!existing) {
      usersMap.set(m.chat_id, {
        chat_id: m.chat_id,
        first_name: m.from_user ? m.sender_name : `Чат ${m.chat_id}`,
        username: m.sender_username,
        last_active: m.date,
        last_message: m.text,
        total_messages: 1,
      });
    } else {
      if (m.from_user && m.sender_name && m.sender_name !== "AlfaComp Admin (Бот)") {
        existing.first_name = m.sender_name;
      }
      if (m.sender_username) {
        existing.username = m.sender_username;
      }
      if (m.date >= existing.last_active) {
        existing.last_active = m.date;
        existing.last_message = m.text;
      }
      existing.total_messages += 1;
    }
  });

  return Array.from(usersMap.values()).sort((a, b) => b.last_active - a.last_active);
}

// ── Get bot's admin/owner chat_id from updates (for finding the admin chat) ──
export async function getBotUpdates(): Promise<any[]> {
  try {
    const res = await fetch(`${TELEGRAM_API}/getUpdates?limit=50&offset=-50`);
    const data = await res.json();
    return data.ok ? data.result : [];
  } catch {
    return [];
  }
}

// ── Генерация номера заказа ──
function generateOrderNumber(): string {
  const date = new Date();
  const yy = date.getFullYear().toString().slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `AC-${yy}${mm}${dd}-${rand}`;
}

// ── Send order notification to all admin chats ──
export async function sendOrderToAdmin(
  customer: CustomerInfo,
  items: OrderItem[],
  totalUZS: number,
  exchangeRate: number
): Promise<boolean> {
  const orderNumber = generateOrderNumber();

  // Список товаров
  const itemsList = items
    .map(
      (i, idx) =>
        `  ${idx + 1}. <b>${i.name}</b>\n` +
        `     ${i.quantity} шт. × ${formatUZS(i.price)} сум = <b>${formatUZS(i.price * i.quantity)} сум</b>`
    )
    .join("\n\n");

  const totalUSD = exchangeRate > 0 ? Math.round(totalUZS / exchangeRate) : null;

  const telegramUsername = customer.username
    ? `\n     🔗 Telegram: <a href="https://t.me/${customer.username.replace("@", "")}">@${customer.username.replace("@", "")}</a>`
    : "";

  const now = new Date().toLocaleString("ru-RU", {
    timeZone: "Asia/Tashkent",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const message =
`🔔 <b>НОВЫЙ ЗАКАЗ НА САЙТЕ ALFACOMP</b>
━━━━━━━━━━━━━━━━━━━━
🔖 Заказ: <code>${orderNumber}</code>
⏰ Дата: ${now}
━━━━━━━━━━━━━━━━━━━━

👤 <b>Покупатель:</b>
     Имя: <b>${customer.firstName} ${customer.lastName}</b>
     📞 Тел: <a href="tel:${customer.phone}">${customer.phone}</a>${telegramUsername}

📦 <b>Товары (${items.length} позиций):</b>

${itemsList}

━━━━━━━━━━━━━━━━━━━━
💰 <b>ИТОГО: ${formatUZS(totalUZS)} сум${totalUSD ? ` (≈ $${totalUSD})` : ""}</b>
━━━━━━━━━━━━━━━━━━━━
✅ Покупатель подтвердил заказ через сайт alfacomp.uz
📲 Свяжитесь с покупателем для подтверждения доставки!`;

  // Получатели: владелец (OWNER) всегда включён + дополнительные администраторы
  const adminChatIds = getAdminChatIds();
  // Гарантируем что OWNER_CHAT_ID всегда в списке
  const recipients = Array.from(new Set([OWNER_CHAT_ID, ...adminChatIds]));

  const results = await Promise.all(
    recipients.map(async (chatId) => {
      const res = await sendTelegramMessageWithDetails(chatId, message);
      if (!res.success) {
        console.warn(`[TelegramBot] Failed to send order to chat ${chatId}:`, res.error);
      }
      return res.success;
    })
  );

  return results.some(Boolean);
}

// ── Format UZS ──
function formatUZS(amount: number): string {
  return new Intl.NumberFormat("ru-RU").format(Math.round(amount));
}

// ── Admin chat IDs management ──
export function getAdminChatIds(): string[] {
  try {
    const stored = localStorage.getItem("alfacomp_bot_admin_chats");
    // Всегда включаем OWNER_CHAT_ID независимо от хранилища
    if (!stored) return [...DEFAULT_ADMIN_CHAT_IDS];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed) || parsed.length === 0) return [...DEFAULT_ADMIN_CHAT_IDS];
    // OWNER_CHAT_ID всегда первым и всегда присутствует
    return Array.from(new Set([OWNER_CHAT_ID, ...DEFAULT_ADMIN_CHAT_IDS, ...parsed.map(String)]));
  } catch {
    return [OWNER_CHAT_ID, ...DEFAULT_ADMIN_CHAT_IDS];
  }
}

export function setAdminChatIds(ids: string[]): void {
  try {
    // OWNER_CHAT_ID нельзя убрать из списка
    const merged = Array.from(new Set([OWNER_CHAT_ID, ...DEFAULT_ADMIN_CHAT_IDS, ...ids.map(String)]));
    localStorage.setItem("alfacomp_bot_admin_chats", JSON.stringify(merged));
  } catch {
    // ignore
  }
}

// ── Экспортировать OWNER_CHAT_ID для использования в других частях приложения ──
export { OWNER_CHAT_ID };

// ── Get bot info ──
export async function getBotInfo(): Promise<{ username: string; first_name: string } | null> {
  try {
    const res = await fetch(`${TELEGRAM_API}/getMe`);
    const data = await res.json();
    return data.ok ? data.result : null;
  } catch {
    return null;
  }
}

// ── Send admin message FROM the bot (for admin-to-user messaging) ──
export async function sendMessageAsAdmin(chatId: string | number, text: string): Promise<boolean> {
  const res = await sendTelegramMessageWithDetails(chatId, text);
  return res.success;
}

// ── Get recent messages to bot (for backward-compatibility) ──
export async function getRecentBotMessages(): Promise<any[]> {
  try {
    const res = await fetch(`${TELEGRAM_API}/getUpdates?limit=100&offset=-100`);
    const data = await res.json();
    if (!data.ok) return [];
    return data.result.filter((u: any) => u.message);
  } catch {
    return [];
  }
}

export const BOT_LINK = `https://t.me/alfacomp_ordersbot`;

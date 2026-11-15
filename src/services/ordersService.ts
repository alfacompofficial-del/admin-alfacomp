// ── AlfaComp Orders & CRM Service ──────────────────────────────────────────
// Управление реальными заказами клиентов с сайта и Telegram-анкеты
// Синхронизация между вкладками через StorageEvent & BroadcastChannel

import { logAdminAction } from "./auditLogger";

export type OrderStatus = "new" | "assembling" | "ready" | "completed" | "cancelled";

export interface OrderItemEntry {
  id?: number;
  name: string;
  price: number; // in UZS
  priceUSD?: number;
  quantity: number;
  image?: string;
  category?: string;
}

export interface ClientOrder {
  id: string; // e.g. "AC-261115-4921"
  customerName: string;
  phone: string;
  telegramUsername?: string;
  chatId?: string;
  source: "telegram_bot" | "website_form" | "in_store";
  items: OrderItemEntry[];
  totalUZS: number;
  totalUSD: number;
  status: OrderStatus;
  createdAt: string; // ISO string
  pickupLocation: string; // "г. Ташкент, базар «Малика», блок А27"
  warrantyYears: number; // 3
  adminNotes?: string;
}

export const STORAGE_ORDERS_KEY = "alfacomp_client_orders_crm_v1";
const BROADCAST_CHANNEL_NAME = "alfacomp_orders_sync";

// Проверка и фильтрация моковых/старых демо-заказов (Сардор, Билол, Джамшид)
const MOCK_IDS = new Set(["AC-1048", "AC-1047", "AC-1046", "AC-1042"]);

/**
 * Получить список всех заказов из хранилища.
 * Автоматически очищает старые тестовые демо-заказы.
 */
export function getOrders(): ClientOrder[] {
  try {
    const raw = localStorage.getItem(STORAGE_ORDERS_KEY);
    if (!raw) return [];
    const parsed: ClientOrder[] = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Отфильтровываем старые захардкоженные демо-заказы
    const cleaned = parsed.filter(
      (o) =>
        !MOCK_IDS.has(o.id) &&
        o.customerName !== "Сардор Рахимов" &&
        o.customerName !== "Билол Алимов" &&
        o.customerName !== "Джамшид Каримов"
    );

    // Если список очистился, сохраняем чистую версию
    if (cleaned.length !== parsed.length) {
      localStorage.setItem(STORAGE_ORDERS_KEY, JSON.stringify(cleaned));
    }

    return cleaned;
  } catch (e) {
    console.error("[OrdersService] Error reading orders:", e);
    return [];
  }
}

/**
 * Сохранить заказы в localStorage и уведомить все вкладки в реальном времени.
 */
export function saveOrders(orders: ClientOrder[]): void {
  try {
    localStorage.setItem(STORAGE_ORDERS_KEY, JSON.stringify(orders));

    // Уведомление через CustomEvent внутри текущей вкладки
    window.dispatchEvent(
      new CustomEvent("alfacomp_orders_updated", { detail: orders })
    );

    // Уведомление через BroadcastChannel между разными вкладками и окнами браузера
    if (typeof BroadcastChannel !== "undefined") {
      try {
        const bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        bc.postMessage({ type: "ORDERS_UPDATED", orders });
        bc.close();
      } catch {}
    }
  } catch (e) {
    console.error("[OrdersService] Error saving orders:", e);
  }
}

/**
 * Генерация красивого уникального номера заказа: AC-YYMMDD-XXXX
 */
export function generateOrderId(): string {
  const d = new Date();
  const yy = d.getFullYear().toString().slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `AC-${yy}${mm}${dd}-${rand}`;
}

export interface CreateOrderParams {
  firstName: string;
  lastName: string;
  phone: string;
  telegramUsername?: string;
  items: {
    id?: number;
    name: string;
    price: number;
    quantity: number;
    image?: string;
    category?: string;
  }[];
  totalUZS: number;
  exchangeRate: number;
  source?: "telegram_bot" | "website_form" | "in_store";
  adminNotes?: string;
}

/**
 * Создать заказ при заполнении анкеты и нажатии "Оформить заказ" на сайте.
 */
export function createOrderFromCart(params: CreateOrderParams): ClientOrder {
  const orderId = generateOrderId();
  const rate = params.exchangeRate > 0 ? params.exchangeRate : 12800;
  const totalUSD = Math.round(params.totalUZS / rate);

  const cleanTg = (params.telegramUsername || "").replace("@", "").trim();

  const fullName = `${params.firstName || ""} ${params.lastName || ""}`.trim() || "Покупатель AlfaComp";

  const newOrder: ClientOrder = {
    id: orderId,
    customerName: fullName,
    phone: params.phone.trim(),
    telegramUsername: cleanTg || undefined,
    source: params.source || "telegram_bot",
    items: params.items.map((i) => ({
      id: i.id,
      name: i.name,
      price: i.price,
      priceUSD: Math.round(i.price / rate),
      quantity: i.quantity,
      image: i.image,
      category: i.category,
    })),
    totalUZS: params.totalUZS,
    totalUSD,
    status: "new",
    createdAt: new Date().toISOString(),
    pickupLocation: "г. Ташкент, базар «Малика», блок А27",
    warrantyYears: 3,
    adminNotes: params.adminNotes,
  };

  const current = getOrders();
  const updated = [newOrder, ...current];
  saveOrders(updated);

  // Логирование в аудит админки
  try {
    logAdminAction({
      action: "Новый заказ с сайта",
      actionType: "create",
      details: `Заказ #${orderId} от ${fullName} (@${cleanTg || "нет"}) на сумму ${params.totalUZS.toLocaleString("ru-RU")} сум`,
    });
  } catch {}

  // Звуковой сигнал о новом заказе
  playOrderNotificationSound();

  return newOrder;
}

/**
 * Обновить статус заказа (new -> assembling -> ready -> completed -> cancelled)
 */
export function updateOrderStatus(orderId: string, status: OrderStatus): ClientOrder[] {
  const orders = getOrders();
  const updated = orders.map((o) => (o.id === orderId ? { ...o, status } : o));
  saveOrders(updated);

  try {
    logAdminAction({
      action: "Смена статуса заказа",
      actionType: "system",
      details: `Заказ #${orderId} переведен в статус "${status}"`,
    });
  } catch {}

  return updated;
}

/**
 * Обновить заметки оператора к заказу
 */
export function updateOrderNotes(orderId: string, adminNotes: string): ClientOrder[] {
  const orders = getOrders();
  const updated = orders.map((o) => (o.id === orderId ? { ...o, adminNotes } : o));
  saveOrders(updated);
  return updated;
}

/**
 * Удалить заказ по ID
 */
export function deleteOrder(orderId: string): ClientOrder[] {
  const orders = getOrders();
  const updated = orders.filter((o) => o.id !== orderId);
  saveOrders(updated);

  try {
    logAdminAction({
      action: "Удаление заказа",
      actionType: "delete",
      details: `Заказ #${orderId} удален из CRM`,
    });
  } catch {}

  return updated;
}

/**
 * Полная очистка всех заказов ("убери и все очисти")
 */
export function clearAllOrders(): void {
  saveOrders([]);
  try {
    logAdminAction({
      action: "Очистка заказов",
      actionType: "delete",
      details: "Список заказов полностью очищен администратором",
    });
  } catch {}
}

/**
 * Подписка на обновление заказов в реальном времени (Storage + CustomEvent + BroadcastChannel)
 */
export function subscribeToOrders(callback: (orders: ClientOrder[]) => void): () => void {
  // Вызываем сразу текущие
  callback(getOrders());

  const handleCustom = (e: any) => {
    callback(e.detail || getOrders());
  };

  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_ORDERS_KEY) {
      callback(getOrders());
    }
  };

  window.addEventListener("alfacomp_orders_updated", handleCustom as EventListener);
  window.addEventListener("storage", handleStorage);

  let bc: BroadcastChannel | null = null;
  if (typeof BroadcastChannel !== "undefined") {
    try {
      bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      bc.onmessage = (event) => {
        if (event.data?.type === "ORDERS_UPDATED") {
          callback(event.data.orders || getOrders());
          playOrderNotificationSound();
        }
      };
    } catch {}
  }

  return () => {
    window.removeEventListener("alfacomp_orders_updated", handleCustom as EventListener);
    window.removeEventListener("storage", handleStorage);
    if (bc) {
      try {
        bc.close();
      } catch {}
    }
  };
}

/**
 * Приятный звуковой сигнал (Web Audio API) при поступлении нового заказа
 */
export function playOrderNotificationSound() {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5

    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  } catch {}
}

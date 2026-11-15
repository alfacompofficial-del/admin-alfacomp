import React, { useState, useEffect, useMemo } from "react";
import {
  ShoppingCart, Printer, Send, Phone, User, CheckCircle2,
  Clock, Package, AlertCircle, Plus, Search, Filter,
  DollarSign, TrendingUp, Calendar, MapPin, ShieldCheck, X, FileText,
  ChevronDown, ChevronUp, Trash2, ExternalLink, Copy, Check, Sparkles, MessageSquare
} from "lucide-react";
import { toast } from "sonner";
import { Product } from "./ProductDrawerEditor";
import { sendTelegramMessageWithDetails } from "../services/telegramBot";
import { logAdminAction } from "../services/auditLogger";
import {
  ClientOrder,
  OrderStatus,
  OrderItemEntry,
  getOrders,
  saveOrders,
  updateOrderStatus,
  updateOrderNotes,
  deleteOrder,
  clearAllOrders,
  subscribeToOrders,
  generateOrderId,
  createOrderFromCart
} from "../services/ordersService";

const formatPrice = (val: number) => new Intl.NumberFormat("ru-RU").format(val);

const STATUS_LABELS: Record<OrderStatus, { label: string; color: string; badge: string }> = {
  new: { label: "Новый заказ", color: "#3b82f6", badge: "bg-blue-500/15 border-blue-500/30 text-blue-400" },
  assembling: { label: "В сборке / Комплектация", color: "#f59e0b", badge: "bg-amber-500/15 border-amber-500/30 text-amber-400" },
  ready: { label: "Готов к выдаче (Малика А27)", color: "#10b981", badge: "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" },
  completed: { label: "Выдан & Оплачен", color: "#8b5cf6", badge: "bg-purple-500/15 border-purple-500/30 text-purple-400" },
  cancelled: { label: "Отменен", color: "#ef4444", badge: "bg-red-500/15 border-red-500/30 text-red-400" }
};

interface OrdersCrmTabProps {
  products: Product[];
  exchangeRate: number;
}

export const OrdersCrmTab: React.FC<OrdersCrmTabProps> = ({ products, exchangeRate }) => {
  const [orders, setOrders] = useState<ClientOrder[]>(() => getOrders());
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [printOrder, setPrintOrder] = useState<ClientOrder | null>(null);

  // Множество ID раскрытых карточек (чтобы видеть что заказали)
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  // Состояние скопированного телефона
  const [copiedPhoneId, setCopiedPhoneId] = useState<string | null>(null);

  // Создание нового заказа (модалка)
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("+998 ");
  const [newCustTg, setNewCustTg] = useState("");
  const [newSelectedProdId, setNewSelectedProdId] = useState<number | null>(null);
  const [newOrderItems, setNewOrderItems] = useState<OrderItemEntry[]>([]);

  const rate = exchangeRate || 12850;

  // Подписка на обновление заказов в реальном времени (Storage + BroadcastChannel + CustomEvent)
  useEffect(() => {
    const unsubscribe = subscribeToOrders((latestOrders) => {
      setOrders(latestOrders);
    });
    return () => unsubscribe();
  }, []);

  // Переключение раскрытия состава заказа
  const toggleOrderExpand = (orderId: string) => {
    setExpandedOrders((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  // Раскрыть или свернуть все
  const toggleExpandAll = () => {
    if (expandedOrders.size === filteredOrders.length) {
      setExpandedOrders(new Set());
    } else {
      setExpandedOrders(new Set(filteredOrders.map((o) => o.id)));
    }
  };

  // Смена статуса
  const handleUpdateStatus = (orderId: string, newStatus: OrderStatus) => {
    const updated = updateOrderStatus(orderId, newStatus);
    setOrders(updated);
    toast.success(`Статус заказа #${orderId} изменен на: ${STATUS_LABELS[newStatus].label}`);
  };

  // Удаление заказа
  const handleDeleteOrder = (orderId: string) => {
    if (window.confirm(`Вы уверены, что хотите удалить заказ #${orderId}?`)) {
      const updated = deleteOrder(orderId);
      setOrders(updated);
      toast.success(`Заказ #${orderId} удален`);
    }
  };

  // Полная очистка списка
  const handleClearAll = () => {
    if (window.confirm("Вы точно хотите очистить всю базу заказов? Это действие удалит все сохраненные заказы.")) {
      clearAllOrders();
      setOrders([]);
      setExpandedOrders(new Set());
      toast.success("Все заказы очищены!");
    }
  };

  // Создать тестовый заказ для быстрой проверки
  const handleCreateTestOrder = () => {
    const randomProduct = products.length > 0 ? products[Math.floor(Math.random() * products.length)] : null;
    const testItems: OrderItemEntry[] = randomProduct
      ? [
          {
            id: randomProduct.id,
            name: randomProduct.name,
            price: randomProduct.price,
            priceUSD: Math.round(randomProduct.price / rate),
            quantity: 1,
            image: (randomProduct as any).image_url || randomProduct.image,
            category: randomProduct.category,
          },
        ]
      : [
          {
            name: "ASUS Dual GeForce RTX 4060 EVO OC 8GB",
            price: 4620000,
            priceUSD: 360,
            quantity: 1,
            image: "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=500&auto=format&fit=crop",
            category: "Видеокарты",
          },
        ];

    const totalUZS = testItems.reduce((acc, i) => acc + i.price * i.quantity, 0);

    const testNames = ["Алишер Усманов", "Темурбек Рахимов", "Фарход Каримов", "Шохрух Мирзаев", "Дмитрий Ким"];
    const testTg = ["alisher_dev", "temur_pc", "farxod_it", "shohruh_uz", "dmitry_kim"];
    const randIdx = Math.floor(Math.random() * testNames.length);

    const newOrder = createOrderFromCart({
      firstName: testNames[randIdx].split(" ")[0],
      lastName: testNames[randIdx].split(" ")[1] || "",
      phone: "+998 90 987 65 43",
      telegramUsername: testTg[randIdx],
      items: testItems,
      totalUZS,
      exchangeRate: rate,
      source: "telegram_bot",
      adminNotes: "Тестовый заказ для проверки анкеты и раскрытия товаров.",
    });

    setExpandedOrders((prev) => new Set(prev).add(newOrder.id));
    toast.success(`Тестовый заказ #${newOrder.id} создан и раскрыт!`);
  };

  // Копирование номера телефона
  const handleCopyPhone = (orderId: string, phone: string) => {
    navigator.clipboard.writeText(phone);
    setCopiedPhoneId(orderId);
    toast.success("Номер телефона скопирован в буфер");
    setTimeout(() => setCopiedPhoneId(null), 2000);
  };

  // Добавление товара при ручном создании заказа
  const handleAddItemToNewOrder = () => {
    if (!newSelectedProdId) return;
    const prod = products.find((p) => p.id === newSelectedProdId);
    if (!prod) return;

    setNewOrderItems((prev) => {
      const existing = prev.find((i) => i.id === prod.id);
      if (existing) {
        return prev.map((i) => (i.id === prod.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [
        ...prev,
        {
          id: prod.id,
          name: prod.name,
          price: prod.price,
          quantity: 1,
          image: (prod as any).image_url || prod.image,
          category: prod.category,
        },
      ];
    });
    setNewSelectedProdId(null);
  };

  // Отправка формы ручного создания заказа
  const handleCreateOrderSubmit = () => {
    if (!newCustName.trim()) {
      toast.error("Укажите имя покупателя");
      return;
    }
    if (newOrderItems.length === 0) {
      toast.error("Добавьте хотя бы один товар в заказ");
      return;
    }

    const totalUZS = newOrderItems.reduce((acc, i) => acc + i.price * i.quantity, 0);
    const names = newCustName.trim().split(" ");
    const firstName = names[0] || "Покупатель";
    const lastName = names.slice(1).join(" ") || "";

    const newOrder = createOrderFromCart({
      firstName,
      lastName,
      phone: newCustPhone.trim(),
      telegramUsername: newCustTg.replace("@", "").trim(),
      items: newOrderItems,
      totalUZS,
      exchangeRate: rate,
      source: "in_store",
      adminNotes: "Оформлен вручную в магазине на Малике А27",
    });

    setIsNewOrderModalOpen(false);
    setNewCustName("");
    setNewCustPhone("+998 ");
    setNewCustTg("");
    setNewOrderItems([]);

    setExpandedOrders((prev) => new Set(prev).add(newOrder.id));
    toast.success(`Заказ #${newOrder.id} успешно оформлен!`);
  };

  // Уведомить клиента в Telegram
  const handleNotifyCustomer = async (order: ClientOrder) => {
    if (order.telegramUsername) {
      const tgUrl = `https://t.me/${order.telegramUsername.replace("@", "")}`;
      window.open(tgUrl, "_blank", "noopener,noreferrer");
      toast.success(`Открыт чат с клиентом: @${order.telegramUsername}`);
      return;
    }

    if (!order.chatId) {
      toast.info(`У клиента не указан ник Telegram. Телефон: ${order.phone}`);
      return;
    }

    const message =
      `Уважаемый(ая) <b>${order.customerName}</b>! 👋\n\n` +
      `Ваш заказ <b>#${order.id}</b> переведен в статус: <b>${STATUS_LABELS[order.status].label}</b>! ✅\n\n` +
      `📍 <b>Пункт самовывоза:</b> ${order.pickupLocation}\n` +
      `⏰ <b>Режим работы:</b> ежедневно с 09:00 до 19:00\n` +
      `📞 <b>Телефон:</b> +998 (88) 320-33-33\n` +
      `🛡️ <b>Официальная гарантия:</b> ${order.warrantyYears} года\n\n` +
      `Сумма к оплате: <b>${formatPrice(order.totalUZS)} сум</b> (~$${order.totalUSD})\n` +
      `Ждем вас в магазине AlfaComp! 🚀`;

    try {
      const res = await sendTelegramMessageWithDetails(order.chatId, message);
      if (res.success) {
        toast.success(`Уведомление успешно отправлено клиенту в Telegram!`);
      } else {
        toast.error(`Ошибка отправки: ${res.error}`);
      }
    } catch (e: any) {
      toast.error(`Ошибка сети: ${e.message}`);
    }
  };

  // Печать гарантийного чека
  const handlePrintReceipt = (order: ClientOrder) => {
    setPrintOrder(order);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  // Фильтрация
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchStatus = filterStatus === "all" || o.status === filterStatus;
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        o.id.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.phone.includes(q) ||
        (o.telegramUsername && o.telegramUsername.toLowerCase().includes(q)) ||
        o.items.some((it) => it.name.toLowerCase().includes(q));
      return matchStatus && matchQuery;
    });
  }, [orders, filterStatus, searchQuery]);

  // Сводка KPI
  const stats = useMemo(() => {
    const totalRevUZS = orders
      .filter((o) => o.status === "completed" || o.status === "ready")
      .reduce((acc, o) => acc + o.totalUZS, 0);
    const activeCount = orders.filter((o) => o.status === "new" || o.status === "assembling").length;
    const readyCount = orders.filter((o) => o.status === "ready").length;

    return {
      totalRevUZS,
      totalRevUSD: Math.round(totalRevUZS / rate),
      activeCount,
      readyCount,
      totalOrders: orders.length,
    };
  }, [orders, rate]);

  return (
    <div className="space-y-6">
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#0088cc] via-[#0052cc] to-[#0099ff] flex items-center justify-center shadow-[0_0_25px_rgba(0,136,204,0.4)]">
            <ShoppingCart className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span>Заказы & CRM AlfaComp</span>
              <span className="text-xs font-mono font-normal px-2.5 py-0.5 rounded-full bg-[#0088cc]/15 text-[#38bdf8] border border-[#0088cc]/30 flex items-center gap-1">
                <Send className="w-3 h-3 text-[#38bdf8]" />
                Telegram Синхронизация
              </span>
            </h1>
            <p className="text-xs text-[#7a8fa6]">
              Анкеты клиентов из Telegram-бота, моментальный просмотр состава заказа, печать чека и самовывоз на Малике А27
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {orders.length > 0 && (
            <button
              onClick={handleClearAll}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-bold transition-all"
              title="Очистить все заказы"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Очистить все</span>
            </button>
          )}

          <button
            onClick={handleCreateTestOrder}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0e223d] hover:bg-[#15345d] text-[#38bdf8] border border-[#1f4b82] text-xs font-bold transition-all shadow-md active:scale-95"
            title="Создать тестовый заказ, как будто клиент только что заполнил анкету на сайте"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>+ Тестовый заказ</span>
          </button>

          <button
            onClick={() => setIsNewOrderModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#0052cc] to-[#0099ff] hover:from-[#0066ff] hover:to-[#1a75ff] text-white text-xs font-bold transition-all shadow-lg shadow-[#0066ff]/30 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>+ Создать заказ вручную</span>
          </button>
        </div>
      </div>

      {/* ── KPI STATS CARDS ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-[#0b1528] border border-[#16274a] rounded-2xl p-4 space-y-1 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-blue-500/10 transition-all" />
          <div className="text-[11px] font-mono uppercase text-[#7a8fa6]">Всего заказов</div>
          <div className="text-2xl font-black font-mono text-white tracking-tight flex items-center gap-2">
            <span>{stats.totalOrders}</span>
            {stats.totalOrders > 0 && (
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
            )}
          </div>
          <div className="text-[11px] text-[#7a8fa6]">В базе магазина</div>
        </div>

        <div className="bg-[#0b1528] border border-[#16274a] rounded-2xl p-4 space-y-1 relative overflow-hidden group">
          <div className="text-[11px] font-mono uppercase text-[#7a8fa6]">В работе / Сборка</div>
          <div className="text-2xl font-black font-mono text-amber-400 tracking-tight">
            {stats.activeCount}
          </div>
          <div className="text-[11px] text-[#7a8fa6]">Собираются мастерами</div>
        </div>

        <div className="bg-[#0b1528] border border-[#16274a] rounded-2xl p-4 space-y-1 relative overflow-hidden group">
          <div className="text-[11px] font-mono uppercase text-[#7a8fa6]">Готовы к выдаче</div>
          <div className="text-2xl font-black font-mono text-emerald-400 tracking-tight">
            {stats.readyCount}
          </div>
          <div className="text-[11px] text-[#7a8fa6]">На витрине Малика А27</div>
        </div>

        <div className="bg-[#0b1528] border border-[#16274a] rounded-2xl p-4 space-y-1 relative overflow-hidden group">
          <div className="text-[11px] font-mono uppercase text-[#7a8fa6]">Общий оборот</div>
          <div className="text-xl sm:text-2xl font-black font-mono text-[#0099ff] tracking-tight">
            {formatPrice(stats.totalRevUZS)} сум
          </div>
          <div className="text-[11px] text-[#7a8fa6] font-mono">≈ ${stats.totalRevUSD}</div>
        </div>
      </div>

      {/* ── FILTER & SEARCH BAR ──────────────────────────────────────────── */}
      <div className="bg-[#0b1528] border border-[#16274a] rounded-2xl p-3 sm:p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-lg">
        {/* Status Filters */}
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setFilterStatus("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterStatus === "all"
                ? "bg-[#0066ff] text-white shadow-md shadow-[#0066ff]/30"
                : "bg-[#070e1b] text-[#7a8fa6] hover:text-white border border-[#16274a]"
            }`}
          >
            Все заказы ({orders.length})
          </button>
          <button
            onClick={() => setFilterStatus("new")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterStatus === "new"
                ? "bg-blue-500 text-white shadow-md shadow-blue-500/30"
                : "bg-[#070e1b] text-[#7a8fa6] hover:text-white border border-[#16274a]"
            }`}
          >
            Новые ({orders.filter((o) => o.status === "new").length})
          </button>
          <button
            onClick={() => setFilterStatus("assembling")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterStatus === "assembling"
                ? "bg-amber-500 text-white shadow-md shadow-amber-500/30"
                : "bg-[#070e1b] text-[#7a8fa6] hover:text-white border border-[#16274a]"
            }`}
          >
            В сборке
          </button>
          <button
            onClick={() => setFilterStatus("ready")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterStatus === "ready"
                ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/30"
                : "bg-[#070e1b] text-[#7a8fa6] hover:text-white border border-[#16274a]"
            }`}
          >
            Готовы на Малике
          </button>
          <button
            onClick={() => setFilterStatus("completed")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterStatus === "completed"
                ? "bg-purple-500 text-white shadow-md shadow-purple-500/30"
                : "bg-[#070e1b] text-[#7a8fa6] hover:text-white border border-[#16274a]"
            }`}
          >
            Выданы
          </button>
          <button
            onClick={() => setFilterStatus("cancelled")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterStatus === "cancelled"
                ? "bg-red-500 text-white shadow-md shadow-red-500/30"
                : "bg-[#070e1b] text-[#7a8fa6] hover:text-white border border-[#16274a]"
            }`}
          >
            Отменены
          </button>
        </div>

        {/* Search input & Toggle all items */}
        <div className="flex items-center gap-2">
          {filteredOrders.length > 0 && (
            <button
              onClick={toggleExpandAll}
              className="px-3 py-1.5 rounded-xl bg-[#070e1b] hover:bg-[#101e38] text-white/70 hover:text-white border border-[#16274a] text-xs font-medium transition-all whitespace-nowrap"
              title="Развернуть или свернуть состав всех заказов"
            >
              {expandedOrders.size === filteredOrders.length ? "Свернуть все" : "Раскрыть все"}
            </button>
          )}

          <div className="relative flex-1 md:w-64">
            <Search className="w-3.5 h-3.5 text-[#7a8fa6] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Поиск по номеру, имени, тел или товару..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[#070e1b] border border-[#16274a] text-xs text-white placeholder-[#7a8fa6] focus:outline-none focus:border-[#0066ff]"
            />
          </div>
        </div>
      </div>

      {/* ── ORDERS LIST ─────────────────────────────────────────────────── */}
      <div className="space-y-4">
        {filteredOrders.length === 0 ? (
          <div className="bg-[#0b1528] border border-[#16274a] rounded-3xl p-12 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-[#070e1b] border border-[#16274a] flex items-center justify-center mx-auto text-[#0088cc] shadow-inner">
              <Send className="w-8 h-8 text-[#0088cc]" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white">Список заказов пуст</h3>
              <p className="text-xs text-[#7a8fa6] max-w-md mx-auto">
                Когда клиент на сайте положит товары в корзину и заполнит анкету («Оформить заказ»),
                заказ мгновенно появится здесь в реальном времени с контактами из Telegram и точным списком товаров.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                onClick={handleCreateTestOrder}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0088cc]/20 hover:bg-[#0088cc]/30 text-[#38bdf8] border border-[#0088cc]/30 text-xs font-bold transition-all"
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Создать тестовый заказ для проверки</span>
              </button>
              <button
                onClick={() => setIsNewOrderModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0052cc] hover:bg-[#0066ff] text-white text-xs font-bold transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Оформить заказ вручную</span>
              </button>
            </div>
          </div>
        ) : (
          filteredOrders.map((order) => {
            const isExpanded = expandedOrders.has(order.id);
            const stMeta = STATUS_LABELS[order.status] || STATUS_LABELS.new;
            const totalItemsCount = order.items.reduce((acc, i) => acc + (i.quantity || 1), 0);

            return (
              <div
                key={order.id}
                className="bg-[#0b1528] border border-[#16274a] hover:border-[#1e3c72] rounded-2xl p-4 sm:p-5 shadow-xl transition-all space-y-3"
              >
                {/* ── Order Header Row ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#16274a]">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <span className="text-base font-black font-mono text-[#0099ff] tracking-tight">
                      #{order.id}
                    </span>

                    {/* Telegram Source Badge */}
                    <span className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-gradient-to-r from-[#0088cc]/20 to-[#0099ff]/20 text-[#38bdf8] border border-[#0088cc]/30">
                      <Send className="w-3 h-3 text-[#38bdf8]" />
                      <span>{order.source === "in_store" ? "Магазин (Малика А27)" : "Telegram / Анкета сайта"}</span>
                    </span>

                    {/* Status Badge */}
                    <span className={`text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${stMeta.badge}`}>
                      {stMeta.label}
                    </span>

                    <span className="text-xs text-[#7a8fa6] font-mono">
                      {new Date(order.createdAt).toLocaleString("ru-RU")}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Notify / Chat in Telegram */}
                    {order.telegramUsername ? (
                      <a
                        href={`https://t.me/${order.telegramUsername.replace("@", "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0088cc]/15 hover:bg-[#0088cc]/25 border border-[#0088cc]/30 text-xs font-bold text-[#38bdf8] transition-all"
                        title="Написать клиенту в Telegram"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Чат @{order.telegramUsername}</span>
                      </a>
                    ) : (
                      <button
                        onClick={() => handleNotifyCustomer(order)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#070e1b] border border-[#16274a] hover:border-[#0066ff] text-xs font-bold text-[#0066ff] transition-all"
                        title="Отправить статус клиенту"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>В Telegram</span>
                      </button>
                    )}

                    {/* Print Receipt Button */}
                    <button
                      onClick={() => handlePrintReceipt(order)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#070e1b] border border-[#16274a] hover:border-[#0066ff] text-xs font-bold text-white transition-all shadow-md"
                      title="Печать товарного чека и гарантии на 3 года"
                    >
                      <Printer className="w-3.5 h-3.5 text-amber-400" />
                      <span>Чек & Гарантия</span>
                    </button>

                    {/* Delete button */}
                    <button
                      onClick={() => handleDeleteOrder(order.id)}
                      className="p-1.5 rounded-xl text-white/30 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all"
                      title="Удалить заказ"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* ── Order Body (Client Details & Price) ── */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                  {/* Customer Information (Telegram lead card style) */}
                  <div className="md:col-span-5 space-y-1.5 text-xs bg-[#070e1b] p-3 rounded-xl border border-[#16274a]">
                    <div className="font-bold text-white flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-sm">
                        <User className="w-4 h-4 text-[#0099ff]" />
                        <span>{order.customerName}</span>
                      </div>
                      {order.telegramUsername && (
                        <a
                          href={`https://t.me/${order.telegramUsername.replace("@", "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#38bdf8] hover:underline font-mono text-[11px] flex items-center gap-1 bg-[#0088cc]/10 px-2 py-0.5 rounded-md border border-[#0088cc]/20"
                        >
                          <Send className="w-2.5 h-2.5" />
                          @{order.telegramUsername}
                        </a>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[#a0b3c6] font-mono">
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-emerald-400" />
                        <a href={`tel:${order.phone}`} className="hover:text-white transition-colors">
                          {order.phone}
                        </a>
                      </div>
                      <button
                        onClick={() => handleCopyPhone(order.id, order.phone)}
                        className="text-[11px] text-[#7a8fa6] hover:text-white flex items-center gap-1"
                        title="Скопировать телефон"
                      >
                        {copiedPhoneId === order.id ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>{copiedPhoneId === order.id ? "Скопировано" : "Копировать"}</span>
                      </button>
                    </div>

                    <div className="text-[11px] text-[#7a8fa6] flex items-center gap-1 pt-0.5 border-t border-white/[0.04]">
                      <MapPin className="w-3 h-3 text-red-400 shrink-0" />
                      <span className="truncate">{order.pickupLocation}</span>
                      <span className="ml-auto text-emerald-400 font-mono">3 года гарантии</span>
                    </div>
                  </div>

                  {/* Summary of items count & preview */}
                  <div className="md:col-span-4 space-y-1">
                    <div className="text-xs text-white/90 font-medium">
                      Состав: <span className="font-bold text-amber-400">{order.items.length} поз.</span> ({totalItemsCount} шт.)
                    </div>
                    <div className="text-[11px] text-[#7a8fa6] truncate">
                      {order.items.map((i) => `${i.name} (x${i.quantity})`).join(", ")}
                    </div>
                    <div className="text-[10px] text-blue-400 font-mono">
                      Нажмите на заказ ниже, чтобы просмотреть фото и характеристики
                    </div>
                  </div>

                  {/* Pricing & Status Switcher */}
                  <div className="md:col-span-3 flex flex-col items-end justify-center space-y-2 text-right">
                    <div>
                      <div className="text-base sm:text-lg font-black font-mono text-white">
                        {formatPrice(order.totalUZS)} сум
                      </div>
                      <div className="text-xs font-mono text-[#0099ff] font-bold">
                        ≈ ${order.totalUSD}
                      </div>
                    </div>

                    <select
                      value={order.status}
                      onChange={(e) => handleUpdateStatus(order.id, e.target.value as OrderStatus)}
                      className="px-2.5 py-1.5 rounded-xl bg-[#070e1b] border border-[#16274a] text-xs font-bold text-white focus:outline-none focus:border-[#0066ff] cursor-pointer"
                    >
                      <option value="new">🟡 Новый заказ</option>
                      <option value="assembling">🔵 В сборке</option>
                      <option value="ready">🟢 Готов к выдаче</option>
                      <option value="completed">🟣 Выдан & Оплачен</option>
                      <option value="cancelled">🔴 Отменен</option>
                    </select>
                  </div>
                </div>

                {/* ── EXPAND TOGGLE BAR: «При нажатии показать что заказали» ── */}
                <button
                  type="button"
                  onClick={() => toggleOrderExpand(order.id)}
                  className={`w-full py-2.5 px-4 rounded-xl flex items-center justify-between text-xs font-bold transition-all cursor-pointer ${
                    isExpanded
                      ? "bg-[#0e223d] text-[#38bdf8] border border-[#1f4b82]"
                      : "bg-[#070e1b] hover:bg-[#0c182c] text-[#7a8fa6] hover:text-white border border-[#16274a]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-amber-400" />
                    <span>
                      {isExpanded
                        ? `Скрыть состав заказа (${order.items.length} товаров)`
                        : `📦 Посмотреть что заказали: ${order.items.length} позиций на ${formatPrice(order.totalUZS)} сум`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] font-mono">
                    <span>{isExpanded ? "Свернуть" : "Показать детали"}</span>
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                {/* ── EXPANDED DETAILED ITEMS VIEW ─────────────────────────── */}
                {isExpanded && (
                  <div className="p-4 rounded-2xl bg-[#070e1b] border border-[#1f4b82] space-y-4 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between pb-2 border-b border-[#16274a]">
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        <Package className="w-4 h-4 text-[#0099ff]" />
                        <span>Детальный состав заказа #{order.id}</span>
                      </div>
                      <div className="text-[11px] text-[#7a8fa6] font-mono">
                        Официальная гарантия магазина: 3 года (36 мес.)
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2.5">
                      {order.items.map((item, idx) => {
                        const itemTotal = item.price * (item.quantity || 1);
                        return (
                          <div
                            key={idx}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-[#0b1528] border border-[#16274a] hover:border-[#1e3c72] transition-all"
                          >
                            <div className="flex items-center gap-3">
                              {/* Product Image */}
                              <div className="w-14 h-14 rounded-xl bg-[#070e1b] border border-[#16274a] overflow-hidden shrink-0 flex items-center justify-center p-1">
                                {item.image ? (
                                  <img
                                    src={item.image}
                                    alt={item.name}
                                    className="w-full h-full object-contain"
                                    onError={(e) => {
                                      (e.target as HTMLElement).style.display = "none";
                                    }}
                                  />
                                ) : (
                                  <Package className="w-6 h-6 text-[#7a8fa6]" />
                                )}
                              </div>

                              {/* Product Info */}
                              <div className="space-y-0.5">
                                <div className="text-xs font-bold text-white leading-snug">
                                  {item.name}
                                </div>
                                <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#7a8fa6]">
                                  {item.category && (
                                    <span className="px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-[#38bdf8] font-mono text-[10px]">
                                      {item.category}
                                    </span>
                                  )}
                                  <span className="font-mono">
                                    Цена: {formatPrice(item.price)} сум
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Quantity & Item Total */}
                            <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#16274a]">
                              <div className="px-2.5 py-1 rounded-lg bg-[#070e1b] border border-[#16274a] text-xs font-mono font-bold text-white">
                                x{item.quantity} шт.
                              </div>
                              <div className="text-right">
                                <div className="text-xs font-black font-mono text-amber-400">
                                  {formatPrice(itemTotal)} сум
                                </div>
                                {item.priceUSD && (
                                  <div className="text-[10px] font-mono text-[#7a8fa6]">
                                    ≈ ${item.priceUSD * (item.quantity || 1)}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Order Notes Field */}
                    <div className="pt-2 border-t border-[#16274a] space-y-1.5">
                      <label className="text-[11px] font-bold text-[#7a8fa6] block">
                        Заметка оператора к заказу:
                      </label>
                      <input
                        type="text"
                        placeholder="Например: клиент заберет после 18:00, оплатит переводом..."
                        defaultValue={order.adminNotes || ""}
                        onBlur={(e) => {
                          const val = e.target.value.trim();
                          if (val !== (order.adminNotes || "")) {
                            const updated = updateOrderNotes(order.id, val);
                            setOrders(updated);
                            toast.success("Заметка сохранена");
                          }
                        }}
                        className="w-full px-3 py-1.5 rounded-xl bg-[#0b1528] border border-[#16274a] text-xs text-white focus:outline-none focus:border-[#0066ff]"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ── MODAL: CREATE QUICK ORDER ────────────────────────────────────── */}
      {isNewOrderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0b1528] border border-[#16274a] rounded-3xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#16274a]">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-[#0066ff]" />
                <span>Новый заказ в магазине (Малика А27)</span>
              </h3>
              <button
                onClick={() => setIsNewOrderModalOpen(false)}
                className="p-1 rounded-lg text-white/50 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[#7a8fa6] block mb-1">Имя покупателя *</label>
                <input
                  type="text"
                  placeholder="Ф.И.О. клиента..."
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#070e1b] border border-[#16274a] rounded-xl text-white focus:border-[#0066ff] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[#7a8fa6] block mb-1">Телефон *</label>
                  <input
                    type="text"
                    value={newCustPhone}
                    onChange={(e) => setNewCustPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-[#070e1b] border border-[#16274a] rounded-xl text-white font-mono focus:border-[#0066ff] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[#7a8fa6] block mb-1">Telegram @username</label>
                  <input
                    type="text"
                    placeholder="@username"
                    value={newCustTg}
                    onChange={(e) => setNewCustTg(e.target.value)}
                    className="w-full px-3 py-2 bg-[#070e1b] border border-[#16274a] rounded-xl text-white font-mono focus:border-[#0066ff] focus:outline-none"
                  />
                </div>
              </div>

              {/* Add Product from Catalog */}
              <div className="pt-2 border-t border-[#16274a] space-y-2">
                <label className="text-[#7a8fa6] block font-bold">Выбрать товар из каталога AlfaComp:</label>
                <div className="flex items-center gap-2">
                  <select
                    value={newSelectedProdId || ""}
                    onChange={(e) => setNewSelectedProdId(Number(e.target.value))}
                    className="flex-1 px-3 py-2 bg-[#070e1b] border border-[#16274a] rounded-xl text-white focus:border-[#0066ff] focus:outline-none"
                  >
                    <option value="">-- Выберите товар из каталога --</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({formatPrice(p.price)} сум)
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAddItemToNewOrder}
                    disabled={!newSelectedProdId}
                    className="px-4 py-2 bg-[#0066ff] text-white font-bold rounded-xl disabled:opacity-40"
                  >
                    + Добавить
                  </button>
                </div>

                {newOrderItems.length > 0 && (
                  <div className="p-3 bg-[#070e1b] rounded-xl space-y-1.5 border border-[#16274a]">
                    {newOrderItems.map((it, idx) => (
                      <div key={idx} className="flex items-center justify-between text-white text-[11px]">
                        <span>• {it.name} (x{it.quantity})</span>
                        <span className="font-mono text-amber-400">{formatPrice(it.price * it.quantity)} сум</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#16274a]">
              <button
                type="button"
                onClick={() => setIsNewOrderModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-white/[0.05] text-white/70 text-xs font-semibold"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleCreateOrderSubmit}
                className="px-5 py-2 rounded-xl bg-[#0066ff] hover:bg-[#1a75ff] text-white text-xs font-bold shadow-md"
              >
                Оформить заказ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PRINT-ONLY OFFICIAL WARRANTY & RECEIPT TEMPLATE (FOR window.print()) ── */}
      {printOrder && (
        <div id="alfacomp-print-receipt" className="hidden print:block fixed inset-0 bg-white text-black p-8 font-sans z-[9999]">
          <div className="max-w-2xl mx-auto border-2 border-black p-6 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b-2 border-black pb-4">
              <div>
                <h1 className="text-2xl font-black tracking-tight">ALFACOMP.UZ</h1>
                <p className="text-xs font-bold uppercase tracking-wider">Магазин компьютерной техники и сборки ПК</p>
                <p className="text-xs">г. Ташкент, базар «Малика», блок А27 | Тел: +998 (88) 320-33-33</p>
              </div>
              <div className="text-right">
                <div className="text-lg font-black font-mono">#{printOrder.id}</div>
                <div className="text-xs text-gray-600">{new Date(printOrder.createdAt).toLocaleDateString("ru-RU")}</div>
                <div className="text-xs font-bold uppercase mt-1 px-2 py-0.5 bg-black text-white inline-block">
                  Товарный чек & Гарантия
                </div>
              </div>
            </div>

            {/* Customer Info */}
            <div className="grid grid-cols-2 gap-4 text-xs bg-gray-50 p-3 border border-gray-200">
              <div>
                <span className="font-bold text-gray-500">Покупатель:</span>
                <p className="font-bold text-sm">{printOrder.customerName}</p>
                <p>Тел: {printOrder.phone}</p>
                {printOrder.telegramUsername && <p>Telegram: @{printOrder.telegramUsername}</p>}
              </div>
              <div>
                <span className="font-bold text-gray-500">Пункт выдачи (Самовывоз):</span>
                <p className="font-bold">{printOrder.pickupLocation}</p>
                <p className="text-gray-600">Доставка: отсутствует (только самовывоз)</p>
                <p className="font-bold text-emerald-700">Срок гарантии: 3 года (36 месяцев)</p>
              </div>
            </div>

            {/* Table of items */}
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-black text-left">
                  <th className="py-2">№</th>
                  <th className="py-2">Наименование товара / Комплектующие</th>
                  <th className="py-2 text-center">Кол-во</th>
                  <th className="py-2 text-right">Цена (UZS)</th>
                  <th className="py-2 text-right">Сумма (UZS)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {printOrder.items.map((it, idx) => (
                  <tr key={idx}>
                    <td className="py-2">{idx + 1}</td>
                    <td className="py-2 font-medium">{it.name}</td>
                    <td className="py-2 text-center font-mono">{it.quantity} шт.</td>
                    <td className="py-2 text-right font-mono">{formatPrice(it.price)} сум</td>
                    <td className="py-2 text-right font-mono font-bold">
                      {formatPrice(it.price * it.quantity)} сум
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="border-t-2 border-black pt-3 flex justify-between items-center text-sm">
              <span className="font-bold">ИТОГО К ОПЛАТЕ:</span>
              <div className="text-right">
                <div className="text-xl font-black font-mono">
                  {formatPrice(printOrder.totalUZS)} сум
                </div>
                <div className="text-xs text-gray-600 font-mono">
                  ≈ ${printOrder.totalUSD} USD
                </div>
              </div>
            </div>

            {/* Warranty Terms */}
            <div className="text-[10px] text-gray-600 border border-gray-300 p-3 rounded space-y-1">
              <p className="font-bold text-black uppercase">Условия гарантийного обслуживания (36 месяцев):</p>
              <p>1. Гарантия действует в течение 3 лет со дня покупки при сохранении настоящего чека и гарантийных пломб.</p>
              <p>2. Гарантийный ремонт и диагностика производятся в сервисном центре магазина AlfaComp: г. Ташкент, базар «Малика», блок А27.</p>
              <p>3. Гарантия не распространяется на механические повреждения, следы попадания жидкости и следы самостоятельного вскрытия.</p>
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-8 pt-6 text-xs">
              <div className="border-t border-black pt-1">
                <p className="font-bold">Продавец (AlfaComp):</p>
                <p className="text-gray-500 mt-4">М.П. ____________________ / Подпись</p>
              </div>
              <div className="border-t border-black pt-1">
                <p className="font-bold">Покупатель:</p>
                <p className="text-gray-500 mt-4">Товар получен, претензий не имею: _________</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

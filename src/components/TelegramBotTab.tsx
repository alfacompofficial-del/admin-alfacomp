import React, { useState, useEffect, useRef } from "react";
import {
  Send, Bot, MessageSquare, Users, Sparkles, Smile,
  Plus, Trash2, Check, RefreshCw, AlertCircle, Shield,
  ChevronRight, Phone, MapPin, Clock, ExternalLink, Zap
} from "lucide-react";
import { toast } from "sonner";
import {
  syncTelegramUpdates, sendTelegramMessageWithDetails,
  extractTelegramUsers, StoredTelegramMessage, TelegramUser,
  getBotToken, OWNER_CHAT_ID, setCustomBotToken
} from "../services/telegramBot";
import { logAdminAction } from "../services/auditLogger";

export interface BotCustomCommand {
  id: string;
  command: string;
  description: string;
  scope: "all" | "admin";
  adminChatId?: string;
  responseText: string;
  isEnabled: boolean;
}

const STORAGE_COMMANDS_KEY = "alfacomp_bot_custom_commands_v1";

const DEFAULT_COMMANDS: BotCustomCommand[] = [
  {
    id: "cmd_start",
    command: "/start",
    description: "Начать диалог и главное меню",
    scope: "all",
    responseText: "Здравствуйте! 👋 Добро пожаловать в интернет-магазин AlfaComp.uz (Ташкент, базар «Малика», блок А27). Чем можем помочь?",
    isEnabled: true,
  },
  {
    id: "cmd_catalog",
    command: "/catalog",
    description: "Каталог ПК и комплектующих",
    scope: "all",
    responseText: "🖥 Наш актуальный каталог на сайте: https://alfacomp.uz\n\nВ наличии: готовые игровые сборки ПК, видеокарты RTX, мониторы 144/240 Гц, ИБП Ion, SSD и комплектующие с гарантией до 3 лет!",
    isEnabled: true,
  },
  {
    id: "cmd_location",
    command: "/location",
    description: "Адрес магазина и самовывоз",
    scope: "all",
    responseText: "📍 <b>Наш адрес:</b> г. Ташкент, базар «Малика», блок А27.\n⏰ Режим работы: ежедневно с 09:00 до 19:00.\n📞 Телефон: +998 (88) 320-33-33\n🚗 Удобная парковка рядом с блоком А.",
    isEnabled: true,
  },
  {
    id: "cmd_contacts",
    command: "/contacts",
    description: "Контакты магазина и менеджера",
    scope: "all",
    responseText: "📞 Телефон: +998 (88) 320-33-33\nTelegram: @ALIBABO777\n📍 г. Ташкент, базар «Малика», блок А27",
    isEnabled: true,
  },
  {
    id: "cmd_admin",
    command: "/admin",
    description: "Панель администратора (только для владельца)",
    scope: "admin",
    adminChatId: OWNER_CHAT_ID,
    responseText: "🔐 <b>Панель управления AlfaComp:</b>\nАдминка доступна по ссылке: https://admin.alfacomp.uz\nСтатус системы: ONLINE\nТовары синхронизированы с Supabase.",
    isEnabled: true,
  },
];

// Категоризированная коллекция стикеров и эмодзи для быстрой отправки клиентам
// Расширенная категоризированная коллекция стикеров и эмодзи для отправки клиентам
const STICKER_PACKS = [
  {
    name: "🖥️ ПК & Железо",
    items: ["🖥️", "💻", "⚡", "🎮", "🕹️", "🔌", "💾", "💽", "🖱️", "⌨️", "🎧", "🖨️", "📱", "📡", "🚀", "⚙️", "🔧", "🔋"],
  },
  {
    name: "📦 Заказы & Доставка",
    items: ["📦", "🛒", "🏷️", "💸", "💵", "💳", "🧾", "🚚", "📍", "⏱️", "🛡️", "⭐", "💎", "✅", "🤝", "🏪", "🎁", "📝"],
  },
  {
    name: "🔥 Реакции & Эмодзи",
    items: ["🔥", "👍", "💯", "🎯", "🎉", "👏", "😎", "🤖", "💪", "🤩", "👌", "❤️", "🙌", "✨", "❗", "🏆", "👀", "🥳"],
  },
  {
    name: "💬 Поддержка & Статус",
    items: ["👋", "⏳", "🔔", "📞", "🤝", "🔍", "🆗", "ℹ️", "⚠️", "🆘", "🛠️", "💬", "💡", "📢", "📨", "📬", "✅", "❌"],
  },
  {
    name: "⚡ Gaming & RTX",
    items: ["🕹️", "👾", "🎯", "🔥", "⚡", "💥", "🚀", "👑", "🥇", "🏆", "🏅", "⚔️", "🛡️", "💎", "🔮", "✨", "🌟", "⭐"],
  },
];

export const TelegramBotTab: React.FC = () => {
  const [messages, setMessages] = useState<StoredTelegramMessage[]>([]);
  const [users, setUsers] = useState<TelegramUser[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(OWNER_CHAT_ID);
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [activeStickerTab, setActiveStickerTab] = useState(0);

  const [commands, setCommands] = useState<BotCustomCommand[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_COMMANDS_KEY);
      return raw ? JSON.parse(raw) : DEFAULT_COMMANDS;
    } catch {
      return DEFAULT_COMMANDS;
    }
  });

  const [isCreatingCommand, setIsCreatingCommand] = useState(false);
  const [cmdName, setCmdName] = useState("");
  const [cmdDesc, setCmdDesc] = useState("");
  const [cmdScope, setCmdScope] = useState<"all" | "admin">("all");
  const [cmdAdminId, setCmdAdminId] = useState(OWNER_CHAT_ID);
  const [cmdResponse, setCmdResponse] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const refreshMessages = async (showToast = false) => {
    setIsSyncing(true);
    try {
      const allMsgs = await syncTelegramUpdates();
      setMessages(allMsgs);
      const userList = extractTelegramUsers(allMsgs);
      setUsers(userList);

      if (!selectedChatId && userList.length > 0) {
        setSelectedChatId(userList[0].chat_id);
      }
      if (showToast) {
        toast.success(`Сообщения обновлены: получено ${allMsgs.length} сообщений`);
      }
    } catch (e: any) {
      if (showToast) toast.error("Ошибка синхронизации: " + e.message);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    refreshMessages(false);
    const interval = setInterval(() => {
      refreshMessages(false);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, selectedChatId]);

  const saveCommands = (newCmds: BotCustomCommand[]) => {
    setCommands(newCmds);
    localStorage.setItem(STORAGE_COMMANDS_KEY, JSON.stringify(newCmds));
  };

  // Синхронизация подсказок команд с Telegram Bot API (/setMyCommands)
  const handleSyncTelegramCommands = async (cmdsToSync = commands) => {
    const token = getBotToken();
    if (!token) {
      toast.error("Токен бота не настроен");
      return;
    }

    try {
      const publicCommands = cmdsToSync
        .filter((c) => c.isEnabled && c.scope === "all")
        .map((c) => ({
          command: c.command.replace(/^\//, "").toLowerCase().trim(),
          description: (c.description || `Команда ${c.command}`).slice(0, 256),
        }));

      const res = await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commands: publicCommands }),
      });
      const data = await res.json();

      if (data.ok) {
        toast.success(`Подсказки команд (/setMyCommands) успешно синхронизированы в Telegram! (${publicCommands.length} шт.)`);
        logAdminAction({
          action: "Синхронизация команд бота",
          actionType: "telegram",
          details: `Зарегистрировано ${publicCommands.length} подсказок в Telegram Bot API`,
        });
      } else {
        toast.error(`Ошибка Telegram API: ${data.description}`);
      }
    } catch (e: any) {
      toast.error(`Ошибка сети при синхронизации: ${e.message}`);
    }
  };

  const handleCreateCommand = async () => {
    const rawCmd = cmdName.trim();
    if (!rawCmd) {
      toast.error("Укажите имя команды");
      return;
    }
    const cleanCmd = rawCmd.startsWith("/") ? rawCmd : `/${rawCmd}`;
    if (!cmdResponse.trim()) {
      toast.error("Укажите ответ бота");
      return;
    }

    const newCmd: BotCustomCommand = {
      id: `cmd_${Date.now()}`,
      command: cleanCmd,
      description: cmdDesc.trim() || `Команда ${cleanCmd}`,
      scope: cmdScope,
      adminChatId: cmdScope === "admin" ? cmdAdminId.trim() : undefined,
      responseText: cmdResponse.trim(),
      isEnabled: true,
    };

    const updated = [...commands, newCmd];
    saveCommands(updated);
    setIsCreatingCommand(false);
    setCmdName("");
    setCmdDesc("");
    setCmdResponse("");
    toast.success(`Команда ${cleanCmd} создана! Синхронизируем подсказку с Telegram...`);

    // Автоматическая отправка команды в Telegram Bot API /setMyCommands
    await handleSyncTelegramCommands(updated);

    logAdminAction({
      action: "Создание команды бота",
      actionType: "telegram",
      details: `Создана команда ${cleanCmd} (доступ: ${cmdScope === "all" ? "для всех" : "только админ"})`,
    });
  };

  const handleDeleteCommand = (id: string, name: string) => {
    if (!window.confirm(`Удалить команду ${name}?`)) return;
    const updated = commands.filter((c) => c.id !== id);
    saveCommands(updated);
    handleSyncTelegramCommands(updated);
    toast.success(`Команда ${name} удалена`);
  };

  const handleToggleCommand = (id: string) => {
    const updated = commands.map((c) => (c.id === id ? { ...c, isEnabled: !c.isEnabled } : c));
    saveCommands(updated);
    handleSyncTelegramCommands(updated);
  };

  // Отправка текстового сообщения или стикера
  const handleSendReply = async (customText?: string) => {
    const textToSend = (customText || replyText).trim();
    if (!selectedChatId || !textToSend) return;
    setIsSending(true);

    try {
      const res = await sendTelegramMessageWithDetails(selectedChatId, textToSend);
      if (res.success && res.message) {
        setMessages((prev) => [...prev, res.message!]);
        if (!customText) setReplyText("");
        setShowStickers(false);
        toast.success("Ответ отправлен пользователю в Telegram!");

        logAdminAction({
          action: "Ответ в Telegram",
          actionType: "telegram",
          targetId: selectedChatId,
          details: `Отправлено сообщение в чат ${selectedChatId}`,
        });
      } else {
        toast.error(`Не удалось отправить: ${res.error || "Ошибка"}`);
      }
    } catch (e: any) {
      toast.error(`Ошибка сети: ${e.message}`);
    } finally {
      setIsSending(false);
    }
  };

  const currentChatMessages = messages.filter((m) => m.chat_id === selectedChatId);
  const activeUser = users.find((u) => u.chat_id === selectedChatId);

  return (
    <div className="space-y-6">
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#0052cc] to-[#0099ff] flex items-center justify-center shadow-[0_0_20px_rgba(0,102,255,0.4)]">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span>Telegram CRM & Управление ботом</span>
              <span className="text-xs font-mono font-normal px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                @alfacomp_ordersbot ONLINE
              </span>
            </h1>
            <p className="text-xs text-[#7a8fa6]">
              Двусторонний диалог с покупателями, отправка стикеров и настройка команд (/setcommand)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refreshMessages(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0b1528] border border-[#16274a] hover:border-[#0066ff] text-white text-xs font-bold transition-all shadow-md active:scale-95"
          >
            <RefreshCw className={`w-4 h-4 text-[#0066ff] ${isSyncing ? "animate-spin" : ""}`} />
            <span>Синхронизировать</span>
          </button>
        </div>
      </div>

      {/* ── TWO-COLUMN LAYOUT: CHATS & MESSAGES ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[640px]">
        {/* Left: Chat Users List */}
        <div className="lg:col-span-4 bg-[#0b1528] border border-[#16274a] rounded-2xl flex flex-col overflow-hidden shadow-xl">
          <div className="p-4 bg-[#080f1e] border-b border-[#16274a] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#0066ff]" />
              <span className="text-xs font-bold text-white uppercase font-mono tracking-wider">
                Покупатели в Telegram ({users.length})
              </span>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[#142340]">
            {users.length === 0 ? (
              <div className="p-8 text-center text-[#7a8fa6] font-mono text-xs">
                Сообщений пока нет. Ожидание входящих запросов от @alfacomp_ordersbot...
              </div>
            ) : (
              users.map((u) => {
                const isSelected = u.chat_id === selectedChatId;
                return (
                  <div
                    key={u.chat_id}
                    onClick={() => setSelectedChatId(u.chat_id)}
                    className={`p-3.5 cursor-pointer transition-all ${
                      isSelected
                        ? "bg-[#102244] border-l-4 border-l-[#0066ff]"
                        : "hover:bg-white/[0.03]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#0052cc] to-[#0088ff] text-white flex items-center justify-center font-bold text-xs shadow-md">
                          {u.first_name[0]?.toUpperCase() || "U"}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white">{u.first_name}</div>
                          <div className="text-[10px] text-[#7a8fa6] font-mono">
                            {u.username ? `@${u.username}` : `ID: ${u.chat_id}`}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] text-[#7a8fa6] font-mono">
                        {new Date(u.last_active * 1000).toLocaleTimeString("ru-RU", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div className="text-xs text-[#a0b3c6] truncate mt-1.5 line-clamp-1 pl-11">
                      {u.last_message}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Two-Way Message Feed & Chat Console */}
        <div className="lg:col-span-8 bg-[#0b1528] border border-[#16274a] rounded-2xl flex flex-col overflow-hidden shadow-xl">
          {/* Active Chat Header */}
          <div className="p-4 bg-[#080f1e] border-b border-[#16274a] flex items-center justify-between">
            {activeUser ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#0066ff] text-white flex items-center justify-center font-bold text-sm shadow-md">
                  {activeUser.first_name[0]?.toUpperCase() || "U"}
                </div>
                <div>
                  <div className="text-sm font-bold text-white flex items-center gap-2">
                    <span>{activeUser.first_name}</span>
                    {activeUser.username && (
                      <a
                        href={`https://t.me/${activeUser.username}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-[#0066ff] hover:underline font-mono"
                      >
                        @{activeUser.username}
                      </a>
                    )}
                  </div>
                  <div className="text-[10px] text-[#7a8fa6] font-mono">
                    Telegram Chat ID: {activeUser.chat_id} · Прямой диалог
                  </div>
                </div>
              </div>
            ) : (
              <span className="text-xs text-[#7a8fa6] font-mono">Выберите чат слева</span>
            )}

            {activeUser && (
              <a
                href={`https://t.me/${activeUser.username || ""}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#070e1b] border border-[#16274a] hover:border-[#0066ff] text-[11px] text-[#0066ff] font-bold"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Открыть в Telegram</span>
              </a>
            )}
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#070e1b]/50">
            {currentChatMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-[#7a8fa6]">
                <MessageSquare className="w-10 h-10 mb-2 opacity-30 text-[#0066ff]" />
                <span className="text-xs font-mono">В этом диалоге пока нет сообщений</span>
              </div>
            ) : (
              currentChatMessages.map((m, idx) => {
                const isFromUser = m.from_user;
                return (
                  <div
                    key={`${m.message_id}_${idx}`}
                    className={`flex flex-col ${isFromUser ? "items-start" : "items-end"}`}
                  >
                    <div
                      className={`max-w-[78%] rounded-2xl p-3.5 shadow-md ${
                        isFromUser
                          ? "bg-[#0e1b33] border border-[#1b3668] text-white"
                          : "bg-gradient-to-r from-[#0052cc] to-[#0077ff] text-white font-medium"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4 mb-1 text-[10px] font-mono opacity-70">
                        <span>{isFromUser ? m.sender_name : "AlfaComp Admin (Бот)"}</span>
                        <span>
                          {new Date(m.date * 1000).toLocaleTimeString("ru-RU", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <div
                        className="text-xs leading-relaxed whitespace-pre-wrap break-words"
                        dangerouslySetInnerHTML={{ __html: m.text }}
                      />
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Replies Bar */}
          <div className="px-4 py-2 bg-[#080f1e] border-t border-[#16274a] flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setShowStickers(!showStickers)}
              className={`p-1.5 rounded-lg border transition-all shrink-0 flex items-center gap-1 text-xs font-bold ${
                showStickers
                  ? "bg-[#0066ff] border-[#0066ff] text-white"
                  : "bg-[#0b1528] border-[#16274a] text-amber-400 hover:bg-[#142340]"
              }`}
              title="Открыть стикеры и эмодзи"
            >
              <Smile className="w-4 h-4" />
              <span className="text-[11px] font-mono">Стикеры</span>
            </button>

            <button
              onClick={() => setReplyText("📍 Наш адрес: Ташкент, базар «Малика», блок А27 (самовывоз)")}
              className="px-2.5 py-1 rounded-lg bg-[#0b1528] text-[#7a8fa6] hover:text-white text-[11px] font-medium whitespace-nowrap border border-[#16274a]"
            >
              📍 Малика А27
            </button>
            <button
              onClick={() => setReplyText("📞 Наш телефон: +998 (88) 320-33-33 (Telegram/звонки)")}
              className="px-2.5 py-1 rounded-lg bg-[#0b1528] text-[#7a8fa6] hover:text-white text-[11px] font-medium whitespace-nowrap border border-[#16274a]"
            >
              📞 Контакты
            </button>
            <button
              onClick={() => setReplyText("🛡 Официальная гарантия на все ПК и комплектующие — до 3 лет!")}
              className="px-2.5 py-1 rounded-lg bg-[#0b1528] text-[#7a8fa6] hover:text-white text-[11px] font-medium whitespace-nowrap border border-[#16274a]"
            >
              🛡 Гарантия 3 года
            </button>
            <button
              onClick={() => setReplyText("✅ Товар в наличии на складе! Можете приехать и забрать.")}
              className="px-2.5 py-1 rounded-lg bg-[#0b1528] text-[#7a8fa6] hover:text-white text-[11px] font-medium whitespace-nowrap border border-[#16274a]"
            >
              ✅ В наличии
            </button>
          </div>

          {/* ── EXPANDED STICKER & EMOJI DRAWER (MORE STICKERS) ── */}
          {showStickers && (
            <div className="p-3 bg-[#070e1b] border-t border-[#16274a] space-y-2">
              <div className="flex items-center gap-2 border-b border-[#142340] pb-1.5">
                {STICKER_PACKS.map((pack, idx) => (
                  <button
                    key={pack.name}
                    onClick={() => setActiveStickerTab(idx)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      activeStickerTab === idx
                        ? "bg-[#0066ff] text-white"
                        : "text-[#7a8fa6] hover:text-white"
                    }`}
                  >
                    {pack.name}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-1">
                {STICKER_PACKS[activeStickerTab].items.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleSendReply(emoji)}
                    className="text-2xl p-2 rounded-xl hover:bg-white/10 active:scale-95 transition-all"
                    title={`Отправить стикер ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message Input Box */}
          <div className="p-3 bg-[#080f1e] border-t border-[#16274a] flex items-center gap-2">
            <input
              type="text"
              placeholder={
                selectedChatId
                  ? "Написать ответ клиенту от имени бота..."
                  : "Выберите диалог..."
              }
              disabled={!selectedChatId || isSending}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendReply();
                }
              }}
              className="flex-1 bg-[#0b1528] border border-[#16274a] rounded-xl px-4 py-2.5 text-xs text-white placeholder-[#7a8fa6] focus:outline-none focus:border-[#0066ff]"
            />
            <button
              onClick={() => handleSendReply()}
              disabled={!selectedChatId || !replyText.trim() || isSending}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#0052cc] to-[#0099ff] hover:from-[#0066ff] hover:to-[#1a75ff] disabled:opacity-40 text-white text-xs font-bold transition-all shadow-md active:scale-95 flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSending ? "..." : "Отправить"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── BOT COMMANDS MANAGER & /setcommand ── */}
      <div className="bg-[#0b1528] border border-[#16274a] rounded-2xl p-6 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#16274a]">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#0066ff]" />
              <h3 className="text-base font-bold text-white">
                Конструктор команд бота (/setcommand)
              </h3>
            </div>
            <p className="text-xs text-[#7a8fa6] mt-0.5">
              Создавайте команды и ответы бота с разделением доступа: для всех клиентов или только для ID админа
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSyncTelegramCommands()}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#0f2142] border border-[#1b3668] hover:border-[#0066ff] text-white text-xs font-bold transition-all"
              title="Отправить список команд в Telegram API /setMyCommands"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#0066ff]" />
              <span>Синхронизировать с Telegram (/setMyCommands)</span>
            </button>

            <button
              onClick={() => setIsCreatingCommand(!isCreatingCommand)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0066ff] hover:bg-[#1a75ff] text-white text-xs font-bold transition-all shadow-md active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Создать команду</span>
            </button>
          </div>
        </div>

        {/* Create Command Form */}
        {isCreatingCommand && (
          <div className="p-5 rounded-2xl bg-[#070e1b] border border-[#1b3668] space-y-4 animate-in fade-in duration-200">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
              Новая команда бота
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] text-[#7a8fa6] block mb-1">
                  Команда (напр. /skidka или /bonus)
                </label>
                <input
                  type="text"
                  placeholder="/command"
                  value={cmdName}
                  onChange={(e) => setCmdName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#0b1528] border border-[#16274a] text-xs text-white focus:border-[#0066ff] focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] text-[#7a8fa6] block mb-1">
                  Краткое описание (для подсказки в Telegram)
                </label>
                <input
                  type="text"
                  placeholder="Описание для подсказки..."
                  value={cmdDesc}
                  onChange={(e) => setCmdDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#0b1528] border border-[#16274a] text-xs text-white focus:border-[#0066ff] focus:outline-none"
                />
              </div>
            </div>

            {/* Scope Selection */}
            <div>
              <label className="text-[11px] text-[#7a8fa6] block mb-1">
                Для кого доступна команда?
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setCmdScope("all")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                    cmdScope === "all"
                      ? "bg-[#0066ff] border-[#0066ff] text-white shadow-md shadow-[#0066ff]/30"
                      : "bg-[#0b1528] border-[#16274a] text-[#7a8fa6] hover:text-white"
                  }`}
                >
                  Для всех клиентов (публичная подсказка)
                </button>
                <button
                  type="button"
                  onClick={() => setCmdScope("admin")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                    cmdScope === "admin"
                      ? "bg-amber-600 border-amber-500 text-white shadow-md"
                      : "bg-[#0b1528] border-[#16274a] text-[#7a8fa6] hover:text-white"
                  }`}
                >
                  Только для ID админа ({cmdAdminId})
                </button>
              </div>
            </div>

            {/* Response Text */}
            <div>
              <label className="text-[11px] text-[#7a8fa6] block mb-1">
                Что должен ответить бот при вводе команды?
              </label>
              <textarea
                rows={3}
                placeholder="Текст ответа бота на эту команду (поддерживает эмодзи и HTML)..."
                value={cmdResponse}
                onChange={(e) => setCmdResponse(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#0b1528] border border-[#16274a] text-xs text-white focus:border-[#0066ff] focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsCreatingCommand(false)}
                className="px-4 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-semibold text-white/80"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleCreateCommand}
                className="px-5 py-2 rounded-xl bg-[#0066ff] hover:bg-[#1a75ff] text-xs font-bold text-white shadow-md"
              >
                Сохранить и активировать в Telegram
              </button>
            </div>
          </div>
        )}

        {/* Commands List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {commands.map((cmd) => (
            <div
              key={cmd.id}
              className="p-4 rounded-xl bg-[#070e1b] border border-[#16274a] space-y-2 text-xs"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-[#4ea1ff] text-sm">
                    {cmd.command}
                  </span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                      cmd.scope === "all"
                        ? "bg-blue-500/15 text-blue-400"
                        : "bg-amber-500/15 text-amber-400"
                    }`}
                  >
                    {cmd.scope === "all" ? "Для всех" : "Только админ"}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleCommand(cmd.id)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono transition-colors ${
                      cmd.isEnabled
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-white/10 text-white/40"
                    }`}
                  >
                    {cmd.isEnabled ? "Включена" : "Отключена"}
                  </button>
                  <button
                    onClick={() => handleDeleteCommand(cmd.id, cmd.command)}
                    className="p-1 rounded text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="text-[#a0b3c6]">{cmd.description}</div>
              <div className="p-2.5 rounded-lg bg-[#0b1528] text-white/90 font-mono text-[11px] whitespace-pre-wrap border border-[#16274a]">
                {cmd.responseText}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
export default TelegramBotTab;


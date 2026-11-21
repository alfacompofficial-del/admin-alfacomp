import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Trash2, Search, Upload, Check, X, Pencil,
  BarChart3, Package, Plus, Eye, Heart, Download,
  ToggleLeft, ToggleRight, RefreshCw, TrendingUp, Users,
  Globe, AlertTriangle, Copy, LogOut,
  Layers, Star, Send, Bot, MessageSquare,
  LayoutDashboard, Compass, Settings, Bell, ChevronLeft, ChevronRight, Menu,
  Monitor, CheckCircle2, ExternalLink, History as HistoryIcon, Sparkles, FileSpreadsheet, MapPin, ShoppingCart
} from "lucide-react";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import { supabase } from "../lib/supabase";
import { formatPrice, resolveProductPrices } from "../lib/constants";
import ProductDrawerEditor, { Product } from "./ProductDrawerEditor";
import { BulkEditModal } from "./BulkEditModal";
import { ExportModal } from "./ExportModal";
import { SeoAuditTab } from "./SeoAuditTab";
import { ChangeHistoryTab } from "./ChangeHistoryTab";
import { UserGeographyTab } from "./UserGeographyTab";
import { TelegramBotTab } from "./TelegramBotTab";
import { SettingsTab } from "./SettingsTab";
import { OrdersCrmTab } from "./OrdersCrmTab";
import { logAdminAction } from "../services/auditLogger";

type VisitorRow = {
  id: number;
  ip: string;
  country: string | null;
  country_code: string | null;
  city: string | null;
  region: string | null;
  user_agent: string | null;
  path: string | null;
  referrer: string | null;
  created_at: string;
};

const flagEmoji = (code?: string | null) => {
  if (!code || code.length !== 2) return "🌐";
  const cc = code.toUpperCase();
  return String.fromCodePoint(...[...cc].map((c) => 127397 + c.charCodeAt(0)));
};

type AdminTab = "products" | "orders" | "seo" | "history" | "stats" | "telegram" | "analytics" | "settings";

interface AdminDashboardProps {
  onLogout: () => void;
}

export default function AdminDashboard({ onLogout }: AdminDashboardProps) {
  // ── Core Navigation Tabs ──────────────────────────────────
  const [tab, setTab] = useState<AdminTab>("products");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // ── Product States ────────────────────────────────────────
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [stockFilter, setStockFilter] = useState<"all" | "in_stock" | "out_of_stock">("all");
  const [sortBy, setSortBy] = useState<"priority" | "price_asc" | "price_desc" | "views" | "likes" | "name">("priority");

  // Selection for bulk actions
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);

  // Pagination for products table
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(15);

  // ── Inline Editing States ─────────────────────────────────
  // ── Multi-Product Inline Editing System ──────────────────────────────
  const [activeEditingIds, setActiveEditingIds] = useState<Set<number>>(new Set());
  const [inlineEdits, setInlineEdits] = useState<Record<number, { name: string; priceUSD: string; originalName: string; originalPriceUSD: string }>>({});
  const [isSavingAllInline, setIsSavingAllInline] = useState(false);

  // ── Image Upload Ref ──────────────────────────────────────
  const [uploadingImageId, setUploadingImageId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentUploadProductId = useRef<number | null>(null);

  // ── Drag & Drop Reorder ───────────────────────────────────
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);

  // ── Drawer Editor State ───────────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerProduct, setDrawerProduct] = useState<Product | null>(null);

  // ── Bulk Edit & Export Modal States ───────────────────────
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  // ── Exchange Rate State ───────────────────────────────────
  const [exchangeRate, setExchangeRate] = useState<number>(12800);
  const [editingRate, setEditingRate] = useState(false);
  const [rateInputValue, setRateInputValue] = useState("");

  // ── Visitor Telemetry ─────────────────────────────────────
  const [visitors, setVisitors] = useState<VisitorRow[]>([]);
  const [visitorsLoading, setVisitorsLoading] = useState(false);
  const [visitorSearch, setVisitorSearch] = useState("");

  // ── Telegram Bot State ────────────────────────────────────
  const [botAdminChats, setBotAdminChats] = useState<string[]>(["6936307137"]);
  const [newChatId, setNewChatId] = useState("");
  const [botCommands, setBotCommands] = useState<{ [key: string]: boolean }>({
    "/start": true,
    "/catalog": true,
    "/info": true,
    "/support": true,
    "/order": true,
  });

  // ── Fetch Products from Supabase ──────────────────────────
  const fetchProducts = useCallback(async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true);
    else setLoading(true);

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("priority", { ascending: true })
      .order("id", { ascending: true });

    if (!error && data) {
      setProducts(data as Product[]);
    } else if (error) {
      toast.error("Ошибка загрузки данных из Supabase: " + error.message);
    }

    if (showRefresh) setIsRefreshing(false);
    else setLoading(false);
  }, []);

  const fetchExchangeRate = useCallback(async () => {
    try {
      const { data } = await supabase.from("exchange_rate" as any).select("rate").single();
      if (data && (data as any).rate) setExchangeRate((data as any).rate);
    } catch {}
  }, []);

  const updateExchangeRate = async (newVal: number) => {
    try {
      await supabase.from("exchange_rate" as any).upsert({ id: 1, rate: newVal } as any);
      setExchangeRate(newVal);
      return true;
    } catch {
      setExchangeRate(newVal);
      return true;
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchExchangeRate();
  }, [fetchProducts, fetchExchangeRate]);

  // ── Fetch Visitors for Telemetry Tab ──────────────────────
  const fetchVisitors = useCallback(async () => {
    setVisitorsLoading(true);
    const { data, error } = await supabase
      .from("visitors" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(2000);

    if (!error && data) {
      setVisitors((data as unknown) as VisitorRow[]);
    }
    setVisitorsLoading(false);
  }, []);

  useEffect(() => {
    if (tab === "stats" || tab === "analytics") {
      fetchVisitors();
    }
  }, [tab, fetchVisitors]);

  // ── Categories List ───────────────────────────────────────
  const allCategories = useMemo(() => {
    const defaultCats = [
      "ИБП", "Мониторы", "Сеть", "Комплектующие", "Моноблоки",
      "Аксессуары", "Колонки", "Кронштейны", "Deco", "Wi-Fi роутеры", "Видеокарты"
    ];
    const found = [...new Set(products.map((p) => p.category).filter(Boolean))];
    return [...new Set([...defaultCats, ...found])];
  }, [products]);

  // ── Filtered & Sorted Products ────────────────────────────
  const filteredProducts = useMemo(() => {
    let list = [...products];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.brand || "").toLowerCase().includes(q) ||
          (p.category || "").toLowerCase().includes(q) ||
          String(p.id).includes(q)
      );
    }

    if (selectedCategory !== "all") {
      list = list.filter((p) => p.category === selectedCategory);
    }

    if (stockFilter === "in_stock") {
      list = list.filter((p) => p.in_stock);
    } else if (stockFilter === "out_of_stock") {
      list = list.filter((p) => !p.in_stock);
    }

    list.sort((a, b) => {
      if (sortBy === "priority") return (a.priority ?? 999) - (b.priority ?? 999);
      if (sortBy === "price_asc") return a.price - b.price;
      if (sortBy === "price_desc") return b.price - a.price;
      if (sortBy === "views") return (b.views || 0) - (a.views || 0);
      if (sortBy === "likes") return (b.likes || 0) - (a.likes || 0);
      if (sortBy === "name") return a.name.localeCompare(b.name, "ru");
      return 0;
    });

    return list;
  }, [products, searchQuery, selectedCategory, stockFilter, sortBy]);

  // Paginated list
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, currentPage, pageSize]);

  const totalPages = useMemo(() => {
    if (filteredProducts.length === 0) return 1;
    return Math.ceil(filteredProducts.length / pageSize);
  }, [filteredProducts, pageSize]);

  // ── Metrics & Analytics ───────────────────────────────────
  const metrics = useMemo(() => {
    const totalCount = products.length;
    const inStockCount = products.filter((p) => p.in_stock).length;
    const outOfStockCount = totalCount - inStockCount;
    const categoryCounts: Record<string, number> = {};
    products.forEach((p) => {
      categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
    });
    const totalViews = products.reduce((acc, p) => acc + (p.views || 0), 0);
    const totalLikes = products.reduce((acc, p) => acc + (p.likes || 0), 0);

    const topByViews = [...products].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 8);
    const topByLikes = [...products].sort((a, b) => (b.likes || 0) - (a.likes || 0)).slice(0, 8);

    return {
      totalCount,
      inStockCount,
      outOfStockCount,
      categoryCounts,
      categoriesCount: Object.keys(categoryCounts).length,
      totalViews,
      totalLikes,
      topByViews,
      topByLikes,
    };
  }, [products]);

  // ── Visitor Statistics ────────────────────────────────────
  const visitorStats = useMemo(() => {
    const q = visitorSearch.trim().toLowerCase();
    const filtered = q
      ? visitors.filter(
          (v) =>
            v.ip.toLowerCase().includes(q) ||
            (v.country || "").toLowerCase().includes(q) ||
            (v.city || "").toLowerCase().includes(q)
        )
      : visitors;

    const uniqueIps = new Set(visitors.map((v) => v.ip)).size;
    const countryCounts: Record<string, number> = {};
    for (const v of visitors) {
      const k = v.country || "Неизвестно";
      countryCounts[k] = (countryCounts[k] || 0) + 1;
    }
    const topCountries = Object.entries(countryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
    const today = new Date().toISOString().slice(0, 10);
    const todayCount = visitors.filter((v) => v.created_at.startsWith(today)).length;

    return { filtered, uniqueIps, topCountries, todayCount };
  }, [visitors, visitorSearch]);

  // ── Product CRUD Handlers ─────────────────────────────────
  const handleSaveDrawerProduct = async (productData: Partial<Product>, isNew: boolean): Promise<boolean> => {
    try {
      if (isNew) {
        const { error } = await supabase.from("products").insert([productData as any]);
        if (error) throw error;
        toast.success("Товар успешно создан!");
      } else if (drawerProduct) {
        const { error } = await supabase.from("products").update(productData as any).eq("id", drawerProduct.id);
        if (error) throw error;
        toast.success("Товар успешно обновлен!");
      }
      fetchProducts();
      return true;
    } catch (err: any) {
      toast.error(`Ошибка: ${err.message || "Не удалось сохранить"}`);
      return false;
    }
  };

  const handleDeleteProduct = async (id: number, name: string) => {
    if (!window.confirm(`Удалить товар «${name}» (#${id})?`)) return;
    try {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
      toast.success("Товар удален");
      setProducts((prev) => prev.filter((p) => p.id !== id));
      logAdminAction({
        action: "Удаление товара",
        actionType: "delete",
        targetId: id,
        targetName: name,
        details: `Товар «${name}» (#${id}) удален из каталога`,
      });
    } catch {
      toast.error("Ошибка при удалении товара");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedProductIds.length === 0) return;
    if (!window.confirm(`Вы уверены, что хотите удалить ${selectedProductIds.length} выбранных товаров?`)) return;
    try {
      const { error } = await supabase.from("products").delete().in("id", selectedProductIds);
      if (error) throw error;
      toast.success(`Удалено ${selectedProductIds.length} товаров`);
      logAdminAction({
        action: "Массовое удаление",
        actionType: "delete",
        details: `Удалено ${selectedProductIds.length} товаров с ID: ${selectedProductIds.join(", ")}`,
      });
      setSelectedProductIds([]);
      fetchProducts();
    } catch (err: any) {
      toast.error("Ошибка при удалении товаров: " + (err.message || ""));
    }
  };

  const handleDuplicateProduct = async (p: Product) => {
    try {
      const duplicateData = {
        name: `${p.name} (Копия)`,
        category: p.category,
        brand: p.brand || "AlfaComp",
        price: p.price,
        old_price: p.old_price,
        image: p.image,
        in_stock: p.in_stock,
        priority: (p.priority ?? 999) + 1,
        specs: p.specs,
      };
      const { error } = await supabase.from("products").insert([duplicateData as any]);
      if (error) throw error;
      toast.success(`Товар продублирован: ${duplicateData.name}`);
      logAdminAction({
        action: "Дублирование товара",
        actionType: "create",
        targetName: duplicateData.name,
        details: `Создана копия товара «${p.name}» (#${p.id})`,
      });
      fetchProducts();
    } catch {
      toast.error("Не удалось продублировать товар");
    }
  };

  const handleToggleStock = async (id: number, current: boolean) => {
    try {
      const { error } = await supabase.from("products").update({ in_stock: !current }).eq("id", id);
      if (error) throw error;
      toast.success(!current ? "Товар переведен в наличие!" : "Товар снят с продажи");
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, in_stock: !current } : p)));
      logAdminAction({
        action: "Смена статуса наличия",
        actionType: "stock",
        targetId: id,
        details: `Товар #${id} переведен в статус «${!current ? "В наличии" : "Не в наличии"}»`,
      });
    } catch {
      toast.error("Ошибка переключения статуса наличия");
    }
  };

  const startEditProduct = (p: Product, _fieldToFocus?: "name" | "price") => {
    const { priceUSD } = resolveProductPrices(p.price, exchangeRate || 14000);
    setActiveEditingIds((prev) => new Set([...prev, p.id]));
    setInlineEdits((prev) => ({
      ...prev,
      [p.id]: prev[p.id] || {
        name: p.name,
        priceUSD: String(priceUSD),
        originalName: p.name,
        originalPriceUSD: String(priceUSD),
      },
    }));
  };

  const updateInlineField = (id: number, field: "name" | "priceUSD", value: string) => {
    setInlineEdits((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || { name: "", priceUSD: "", originalName: "", originalPriceUSD: "" }),
        [field]: value,
      },
    }));
  };

  const cancelEditProduct = (id: number) => {
    setActiveEditingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setInlineEdits((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const cancelAllInlineEdits = () => {
    setActiveEditingIds(new Set());
    setInlineEdits({});
  };

  const saveSingleProductInline = async (id: number) => {
    const edit = inlineEdits[id];
    const targetProduct = products.find((p) => p.id === id);
    if (!edit || !targetProduct) return;

    const nameVal = edit.name.trim();
    if (!nameVal) {
      toast.error("Название не может быть пустым");
      return;
    }
    const usdVal = parseFloat(edit.priceUSD);
    if (isNaN(usdVal) || usdVal <= 0) {
      toast.error("Введите корректную цену в USD ($)");
      return;
    }

    const currentRate = exchangeRate > 0 ? exchangeRate : 14000;
    const finalUZS = Math.round(usdVal * currentRate);

    const { error } = await supabase
      .from("products")
      .update({ name: nameVal, price: finalUZS })
      .eq("id", id);

    if (!error) {
      toast.success(`Товар #${id} сохранен: ${nameVal} (${usdVal})`);
      setProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, name: nameVal, price: finalUZS } : p))
      );
      cancelEditProduct(id);
      if (typeof clearProductsCache === "function") await clearProductsCache();
      if (typeof broadcastProductsUpdate === "function") broadcastProductsUpdate();
    } else {
      toast.error(`Ошибка сохранения товара #${id}`);
    }
  };

  const saveAllInlineEdits = async () => {
    const ids = Array.from(activeEditingIds);
    if (!ids.length) return;

    setIsSavingAllInline(true);
    let successCount = 0;
    const currentRate = exchangeRate > 0 ? exchangeRate : 14000;
    const updatedMap: Record<number, { name: string; price: number }> = {};

    for (const id of ids) {
      const edit = inlineEdits[id];
      const targetProduct = products.find((p) => p.id === id);
      if (!edit || !targetProduct) continue;

      const nameVal = edit.name.trim() || edit.originalName;
      const usdVal = parseFloat(edit.priceUSD);
      const finalUSD = !isNaN(usdVal) && usdVal > 0 ? usdVal : parseFloat(edit.originalPriceUSD);
      const finalUZS = Math.round(finalUSD * currentRate);

      const { error } = await supabase
        .from("products")
        .update({ name: nameVal, price: finalUZS })
        .eq("id", id);

      if (!error) {
        successCount++;
        updatedMap[id] = { name: nameVal, price: finalUZS };
      }
    }

    if (successCount > 0) {
      setProducts((prev) =>
        prev.map((p) => (updatedMap[p.id] ? { ...p, ...updatedMap[p.id] } : p))
      );
      toast.success(`Успешно сохранено товаров: ${successCount}!`);
      cancelAllInlineEdits();
      if (typeof clearProductsCache === "function") await clearProductsCache();
      if (typeof broadcastProductsUpdate === "function") broadcastProductsUpdate();
    } else {
      toast.error("Не удалось сохранить изменения");
    }
    setIsSavingAllInline(false);
  };

  // ── Image Upload Handling
  const handleImageClick = (productId: number) => {
    currentUploadProductId.current = productId;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const productId = currentUploadProductId.current;
    if (!file || !productId) return;
    e.target.value = "";

    if (!file.type.startsWith("image/")) {
      toast.error("Выберите файл изображения");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Файл слишком большой (макс. 5MB)");
      return;
    }

    setUploadingImageId(productId);
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const dataUrl = ev.target?.result as string;
        const { error } = await supabase.from("products").update({ image: dataUrl }).eq("id", productId);
        if (!error) {
          toast.success("Фото обновлено!");
          setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, image: dataUrl } : p)));
        } else {
          toast.error("Ошибка загрузки фото в базу");
        }
        setUploadingImageId(null);
        currentUploadProductId.current = null;
      };
      reader.readAsDataURL(file);
    } catch {
      toast.error("Ошибка при обработке файла");
      setUploadingImageId(null);
    }
  };

  // Drag & drop
  const handleDragStart = (e: React.DragEvent, id: number) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragOver = (e: React.DragEvent, id: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (id !== draggedId) setDragOverId(id);
  };
  const handleDrop = async (e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }
    const list = [...products];
    const fromIdx = list.findIndex((p) => p.id === draggedId);
    const toIdx = list.findIndex((p) => p.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    const reordered = [...list];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);

    const updates = reordered.map((p, idx) => ({ id: p.id, priority: idx + 1 }));
    setProducts(reordered.map((p, idx) => ({ ...p, priority: idx + 1 })));
    setDraggedId(null);
    setDragOverId(null);

    try {
      await Promise.all(
        updates.map(({ id, priority }) => supabase.from("products").update({ priority }).eq("id", id))
      );
      toast.success("Порядок товаров сохранен!");
    } catch {
      toast.error("Ошибка при сохранении порядка");
      fetchProducts();
    }
  };
  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  const handleExportCSV = () => {
    if (!products || products.length === 0) {
      toast.error("Товары для экспорта не найдены");
      return;
    }
    const headers = ["ID", "Название", "Бренд", "Категория", "Цена (сум)", "В наличии", "Приоритет"];
    const escapeCsv = (val: any) => `"${String(val ?? "").replace(/"/g, '""')}"`;
    const rows = products.map((p) => [
      p.id,
      escapeCsv(p.name),
      escapeCsv(p.brand || ""),
      escapeCsv(p.category || ""),
      p.price,
      p.in_stock ? "Да" : "Нет",
      p.priority ?? ""
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `alfacomp_products_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Скачано ${products.length} товаров в формате CSV!`);
  };

  const NAV_ITEMS = [
    { id: "products" as AdminTab, label: "Товары и каталог", icon: Package },
    { id: "orders" as AdminTab, label: "Заказы & CRM", icon: ShoppingCart },
    { id: "seo" as AdminTab, label: "SEO Центр", icon: Search },
    { id: "history" as AdminTab, label: "История изменений", icon: HistoryIcon },
    { id: "stats" as AdminTab, label: "Откуда пользователи", icon: Compass },
    { id: "telegram" as AdminTab, label: "Telegram / Бот", icon: Send },
    { id: "analytics" as AdminTab, label: "Аналитика витрины", icon: BarChart3 },
    { id: "settings" as AdminTab, label: "Настройки & Курс", icon: Settings },
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#060b14] text-white font-sans antialiased select-none">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Mobile Backdrop */}
      {mobileNavOpen && (
        <div
          onClick={() => setMobileNavOpen(false)}
          className="md:hidden fixed inset-0 bg-black/70 backdrop-blur-sm z-50 transition-opacity"
        />
      )}

      {/* ── 1. LEFT SIDEBAR ─────────────────────────────────── */}
      <aside
        className={`fixed md:static top-0 bottom-0 left-0 z-50 w-64 bg-[#080f1e] border-r border-[#142340] flex flex-col justify-between p-4 transition-transform duration-300 md:translate-x-0 ${
          mobileNavOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
      >
        <div>
          {/* Brand Logo */}
          <div className="flex items-center justify-between px-2 py-3 mb-6 border-b border-[#142340]/60">
            <div
              onClick={() => { setTab("products"); setMobileNavOpen(false); }}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#0052cc] to-[#0088ff] flex items-center justify-center shadow-[0_0_15px_rgba(0,102,255,0.4)] group-hover:scale-105 transition-transform">
                <span className="font-black text-white text-base tracking-tighter">▲</span>
              </div>
              <div>
                <span className="font-extrabold tracking-tight text-base text-white block">ALFACOMP</span>
                <span className="text-[10px] font-mono text-[#0066ff] tracking-widest block -mt-1 font-semibold">
                  CONTROL PANEL
                </span>
              </div>
            </div>
            <button
              onClick={() => setMobileNavOpen(false)}
              className="md:hidden p-1 rounded-lg text-white/50 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  onClick={() => {
                    setTab(id);
                    setMobileNavOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                    active
                      ? "bg-[#0066ff] text-white shadow-[0_4px_16px_rgba(0,102,255,0.35)]"
                      : "text-[#7a8fa6] hover:text-white hover:bg-[#0d1830]"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${active ? "text-white" : "text-[#7a8fa6]"}`} />
                  <span className="truncate">{label}</span>
                  {id === "products" && (
                    <span className={`ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded ${
                      active ? "bg-white/20 text-white" : "bg-[#142340] text-white/60"
                    }`}>
                      {products.length}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* System Health Footer */}
        <div className="pt-4 border-t border-[#142340]/60 space-y-3">
          <div className="bg-[#0b162c] rounded-xl p-3 border border-[#16274a]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-semibold text-white/90">Система работает</span>
            </div>
            <div className="text-[10px] font-mono text-[#5a6f8a] mt-1 flex items-center justify-between">
              <span>admin.alfacomp.uz</span>
              <span className="text-emerald-400 font-bold">ONLINE</span>
            </div>
          </div>

          <a
            href="https://alfacomp.uz"
            target="_blank"
            rel="noreferrer"
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] text-[#7a8fa6] hover:text-white text-xs font-medium transition-all"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Открыть витрину магазина</span>
          </a>
        </div>
      </aside>

      {/* ── 2. MAIN APP CONTENT CONTAINER ──────────────────── */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-[#060b14]">
        {/* Header */}
        <header className="h-16 bg-[#080f1e] border-b border-[#142340] px-4 md:px-8 flex items-center justify-between shrink-0 z-40">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileNavOpen(true)}
              className="md:hidden p-2 rounded-xl bg-[#0d1830] border border-[#16274a] text-white/80 hover:text-white"
            >
              <Menu className="w-4 h-4" />
            </button>

            <div className="relative hidden md:block w-80 lg:w-96">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5a6f8a]" />
              <input
                type="text"
                placeholder="Поиск по товарам, бренду, категории или ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#0b162c] border border-[#16274a] rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-[#5a6f8a] outline-none focus:border-[#0066ff] transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            {/* USD Currency Rate */}
            <div className="hidden sm:flex items-center">
              {editingRate ? (
                <div className="flex items-center gap-1.5 bg-[#0b162c] px-2.5 py-1.5 rounded-xl border border-[#0066ff]">
                  <span className="text-[11px] font-mono text-white/60">1$ =</span>
                  <input
                    type="number"
                    value={rateInputValue}
                    onChange={(e) => setRateInputValue(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === "Enter") {
                        const val = parseInt(rateInputValue);
                        if (!isNaN(val) && val > 0) {
                          await updateExchangeRate(val);
                          toast.success(`Курс: 1$ = ${val.toLocaleString()} UZS`);
                        }
                        setEditingRate(false);
                      } else if (e.key === "Escape") setEditingRate(false);
                    }}
                    autoFocus
                    className="w-20 bg-transparent text-xs font-mono font-bold text-[#0066ff] outline-none text-right"
                  />
                  <button
                    onClick={async () => {
                      const val = parseInt(rateInputValue);
                      if (!isNaN(val) && val > 0) {
                        await updateExchangeRate(val);
                        toast.success(`Курс: 1$ = ${val.toLocaleString()} UZS`);
                      }
                      setEditingRate(false);
                    }}
                    className="text-emerald-400"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setEditingRate(false)} className="text-red-400">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setRateInputValue(String(exchangeRate));
                    setEditingRate(true);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 bg-[#0b162c] border border-[#16274a] hover:border-[#0066ff]/50 rounded-xl text-xs font-mono transition-all group"
                  title="Нажмите чтобы изменить курс USD/UZS"
                >
                  <span className="text-[#5a6f8a]">1$ =</span>
                  <span className="font-bold text-[#0066ff]">{exchangeRate.toLocaleString()} UZS</span>
                  <Pencil className="w-2.5 h-2.5 text-[#5a6f8a] opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              )}
            </div>

            <button
              onClick={() => fetchProducts(true)}
              className="w-9 h-9 rounded-xl bg-[#0b162c] border border-[#16274a] hover:border-[#0066ff]/60 flex items-center justify-center text-white/70 hover:text-white transition-all"
              title="Синхронизировать с Supabase"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-[#0066ff]" : ""}`} />
            </button>

            <button
              onClick={() => toast.info("Все системы работают в штатном режиме")}
              className="relative w-9 h-9 rounded-xl bg-[#0b162c] border border-[#16274a] hover:border-[#0066ff]/60 flex items-center justify-center text-white/70 hover:text-white transition-all"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-[#0066ff] rounded-full" />
            </button>

            <div className="flex items-center gap-2.5 pl-2 border-l border-[#142340]">
              <div className="w-8 h-8 rounded-full bg-[#0066ff] flex items-center justify-center text-white text-xs font-bold shadow-md shadow-[#0066ff]/30">
                A
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-bold text-white leading-tight">admin</div>
                <div className="text-[10px] text-[#7a8fa6]">Администратор</div>
              </div>
              <button
                onClick={onLogout}
                className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors ml-1"
                title="Выйти"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6 pb-24 md:pb-8">
          {tab === "products" && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#0066ff]/20 text-[#0066ff] flex items-center justify-center shadow-lg shadow-[#0066ff]/15">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                      Товары и каталог
                    </h1>
                    <div className="text-[11px] font-mono text-[#7a8fa6]">
                      База данных AlfaComp · {products.length} позиций
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setDrawerProduct(null);
                    setDrawerOpen(true);
                  }}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#0066ff] hover:bg-[#1a75ff] text-white text-xs sm:text-sm font-bold uppercase tracking-wider transition-all shadow-lg shadow-[#0066ff]/30 active:scale-95 shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Добавить товар</span>
                </button>
              </div>

              {/* 4 KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                <div className="bg-[#0b1528] border border-[#16274a] rounded-2xl p-4 md:p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[#7a8fa6]">Всего товаров</span>
                    <div className="p-2 rounded-xl bg-[#0066ff]/15 text-[#3b82f6]">
                      <Package className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl md:text-3xl font-bold font-mono text-white mt-2">
                    {metrics.totalCount}
                  </div>
                  <div className="text-[11px] font-mono text-[#3b82f6] mt-1">+12 за неделю</div>
                </div>

                <div
                  onClick={() => setStockFilter(stockFilter === "in_stock" ? "all" : "in_stock")}
                  className={`bg-[#0b1528] border rounded-2xl p-4 md:p-5 cursor-pointer transition-all ${
                    stockFilter === "in_stock" ? "border-emerald-500 bg-emerald-500/[0.06]" : "border-[#16274a]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[#7a8fa6]">В наличии</span>
                    <div className="p-2 rounded-xl bg-[#00c853]/15 text-[#00c853]">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl md:text-3xl font-bold font-mono text-[#00c853] mt-2">
                    {metrics.inStockCount}
                  </div>
                  <div className="text-[11px] font-mono text-[#00c853] mt-1">
                    {Math.round((metrics.inStockCount / (metrics.totalCount || 1)) * 100)}%
                  </div>
                </div>

                <div
                  onClick={() => setStockFilter(stockFilter === "out_of_stock" ? "all" : "out_of_stock")}
                  className={`bg-[#0b1528] border rounded-2xl p-4 md:p-5 cursor-pointer transition-all ${
                    stockFilter === "out_of_stock" ? "border-amber-500 bg-amber-500/[0.06]" : "border-[#16274a]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[#7a8fa6]">Не в наличии</span>
                    <div className="p-2 rounded-xl bg-[#ff9100]/15 text-[#ff9100]">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl md:text-3xl font-bold font-mono text-[#ff9100] mt-2">
                    {metrics.outOfStockCount}
                  </div>
                  <div className="text-[11px] font-mono text-[#ff9100] mt-1">
                    {Math.round((metrics.outOfStockCount / (metrics.totalCount || 1)) * 100)}%
                  </div>
                </div>

                <div className="bg-[#0b1528] border border-[#16274a] rounded-2xl p-4 md:p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[#7a8fa6]">Категорий</span>
                    <div className="p-2 rounded-xl bg-[#7c4dff]/15 text-[#a855f7]">
                      <Layers className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl md:text-3xl font-bold font-mono text-[#a855f7] mt-2">
                    {metrics.categoriesCount}
                  </div>
                  <div className="text-[11px] font-mono text-[#a855f7] mt-1">+2 за неделю</div>
                </div>
              </div>

              {/* Filter Box */}
              <div className="bg-[#0b1528] border border-[#16274a] rounded-2xl p-4 space-y-3.5 shadow-xl">
                <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5a6f8a]" />
                    <input
                      placeholder="Поиск по названию, бренду, категории или ID..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-full bg-[#070e1b] border border-[#16274a] rounded-xl pl-10 pr-8 py-2.5 outline-none focus:border-[#0066ff] text-xs sm:text-sm text-white transition-all"
                    />
                  </div>

                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                    <select
                      value={selectedCategory}
                      onChange={(e) => {
                        setSelectedCategory(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="bg-[#070e1b] border border-[#16274a] rounded-xl px-3 py-2 text-xs font-medium text-white outline-none cursor-pointer"
                    >
                      <option value="all">Все категории</option>
                      {allCategories.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>

                    <select
                      value={stockFilter}
                      onChange={(e) => {
                        setStockFilter(e.target.value as any);
                        setCurrentPage(1);
                      }}
                      className="bg-[#070e1b] border border-[#16274a] rounded-xl px-3 py-2 text-xs font-medium text-white outline-none cursor-pointer"
                    >
                      <option value="all">Все статусы</option>
                      <option value="in_stock">В наличии</option>
                      <option value="out_of_stock">Не в наличии</option>
                    </select>

                    <button
                      onClick={() => setExportModalOpen(true)}
                      className="flex items-center gap-2 px-3.5 py-2 bg-[#070e1b] border border-[#16274a] hover:border-[#0066ff] text-white text-xs font-bold rounded-xl transition-all shadow-md"
                      title="Скачать Excel или все фото в ZIP"
                    >
                      <Download className="w-4 h-4 text-[#0066ff]" />
                      <span>Экспорт / Фото</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
                  <button
                    onClick={() => {
                      setSelectedCategory("all");
                      setCurrentPage(1);
                    }}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 ${
                      selectedCategory === "all"
                        ? "bg-[#0066ff] text-white shadow-md shadow-[#0066ff]/25 font-bold"
                        : "bg-[#070e1b] text-[#7a8fa6] border border-[#16274a] hover:text-white"
                    }`}
                  >
                    Все ({products.length})
                  </button>
                  {allCategories.map((c) => {
                    const count = metrics.categoryCounts[c] || 0;
                    const isSel = selectedCategory === c;
                    return (
                      <button
                        key={c}
                        onClick={() => {
                          setSelectedCategory(c);
                          setCurrentPage(1);
                        }}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 whitespace-nowrap ${
                          isSel
                            ? "bg-[#0066ff] text-white shadow-md shadow-[#0066ff]/25 font-bold"
                            : "bg-[#070e1b] text-[#7a8fa6] border border-[#16274a] hover:text-white"
                        }`}
                      >
                        {c} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Bulk Selection Actions Bar */}
              {selectedProductIds.length > 0 && (
                <div className="bg-[#0b1528] border-2 border-[#0066ff] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-[0_0_25px_rgba(0,102,255,0.25)] animate-in fade-in duration-200">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#0066ff] flex items-center justify-center font-black text-white text-sm shadow-md shadow-[#0066ff]/40">
                      {selectedProductIds.length}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        <span>Выделено товаров: {selectedProductIds.length}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#0066ff]/20 text-[#4ea1ff]">
                          Пакетное действие
                        </span>
                      </div>
                      <div className="text-[11px] text-[#7a8fa6] mt-0.5">
                        Редактируйте цены, названия, категории, фото или удаляйте выбранные позиции в 1 клик
                      </div>
                    </div>
                  </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setBulkModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0066ff] hover:bg-[#1a75ff] text-white text-xs font-bold transition-all shadow-lg shadow-[#0066ff]/30 active:scale-95"
                      >
                        <Sparkles className="w-4 h-4" />
                        <span>Массовое редактирование</span>
                      </button>
                      <button
                        onClick={handleBulkDelete}
                        className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500 hover:text-white text-xs font-semibold transition-all active:scale-95"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Удалить выбранные</span>
                      </button>
                      <button
                        onClick={() => setSelectedProductIds([])}
                        className="px-3 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs text-white/70 hover:text-white transition-all"
                      >
                        Снять выделение
                      </button>
                    </div>
                  </div>
              )}

              {/* Desktop Table */}
              <div className="bg-[#0b1528] rounded-2xl border border-[#16274a] overflow-hidden shadow-2xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#080f1e] text-[10px] uppercase font-mono tracking-wider text-[#7a8fa6] border-b border-[#16274a]">
                      <th className="p-4 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={
                            paginatedProducts.length > 0 &&
                            paginatedProducts.every((p) => selectedProductIds.includes(p.id))
                          }
                          onChange={(e) => {
                            if (e.target.checked) {
                              const ids = paginatedProducts.map((p) => p.id);
                              setSelectedProductIds((prev) => [...new Set([...prev, ...ids])]);
                            } else {
                              const ids = new Set(paginatedProducts.map((p) => p.id));
                              setSelectedProductIds((prev) => prev.filter((id) => !ids.has(id)));
                            }
                          }}
                          className="rounded border-[#16274a] text-[#0066ff] cursor-pointer"
                        />
                      </th>
                      <th className="p-4 w-12 text-center">#</th>
                      <th className="p-4 w-16">Фото</th>
                      <th className="p-4">Товар</th>
                      <th className="p-4">Категория</th>
                      <th className="p-4">Наличие</th>
                      <th className="p-4 text-right">Цена (USD)</th>
                      <th className="p-4 text-right">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#142340]">
                    {loading && (
                      <tr>
                        <td colSpan={8} className="p-12 text-center text-[#7a8fa6] font-mono text-xs">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#0066ff]" />
                          Синхронизация с базой данных Supabase...
                        </td>
                      </tr>
                    )}
                    {!loading && filteredProducts.length === 0 && (
                      <tr>
                        <td colSpan={8} className="p-12 text-center text-[#7a8fa6] font-mono text-xs">
                          По вашему запросу ничего не найдено
                        </td>
                      </tr>
                    )}
                    {paginatedProducts.map((p) => {
                      const isSelected = selectedProductIds.includes(p.id);
                      const { priceUSD, priceUZS } = resolveProductPrices(p.price, exchangeRate || 12800);
                      return (
                        <tr
                          key={p.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, p.id)}
                          onDragOver={(e) => handleDragOver(e, p.id)}
                          onDrop={(e) => handleDrop(e, p.id)}
                          onDragEnd={handleDragEnd}
                          className={`transition-colors group hover:bg-[#0d1a33] ${
                            isSelected ? "bg-[#0066ff]/10" : ""
                          }`}
                        >
                          <td className="p-4 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedProductIds((prev) => [...prev, p.id]);
                                else setSelectedProductIds((prev) => prev.filter((id) => id !== p.id));
                              }}
                              className="rounded border-[#16274a] text-[#0066ff] cursor-pointer"
                            />
                          </td>

                          <td className="p-4 text-center font-mono text-xs text-[#5a6f8a] cursor-grab">
                            {p.priority ?? "—"}
                          </td>

                          <td className="p-4">
                            <div
                              onClick={() => handleImageClick(p.id)}
                              className="relative w-12 h-12 rounded-xl overflow-hidden border border-[#16274a] bg-[#070e1b] cursor-pointer group/img shrink-0"
                            >
                              {uploadingImageId === p.id ? (
                                <div className="w-full h-full flex items-center justify-center bg-black/80">
                                  <div className="w-4 h-4 border-2 border-[#0066ff] border-t-transparent rounded-full animate-spin" />
                                </div>
                              ) : (
                                <>
                                  <img
                                    src={p.image}
                                    alt={p.name}
                                    className="w-full h-full object-cover group-hover/img:brightness-50 transition-all"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src = "https://via.placeholder.com/48?text=HW";
                                    }}
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity">
                                    <Upload className="w-4 h-4 text-white" />
                                  </div>
                                </>
                              )}
                            </div>
                          </td>

                          <td className="p-4">
                            <div className="min-w-0">
                              {activeEditingIds.has(p.id) ? (
                                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="text"
                                    value={inlineEdits[p.id]?.name ?? p.name}
                                    onChange={(e) => updateInlineField(p.id, "name", e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") saveSingleProductInline(p.id);
                                      if (e.key === "Escape") cancelEditProduct(p.id);
                                    }}
                                    className="w-56 bg-[#070e1b] border border-[#0066ff] rounded px-2 py-1 text-xs font-bold text-white outline-none focus:ring-1 focus:ring-[#0066ff]"
                                  />
                                  <button
                                    onClick={() => saveSingleProductInline(p.id)}
                                    className="p-1 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                                    title="Сохранить этот товар"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => cancelEditProduct(p.id)}
                                    className="p-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                                    title="Отменить"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <div
                                  onClick={() => startEditProduct(p, "name")}
                                  className="font-bold text-white text-xs sm:text-sm truncate max-w-[260px] cursor-pointer hover:text-[#3b82f6] transition-colors flex items-center gap-1.5 group/title"
                                  title="Кликните чтобы редактировать название (можно открыть сразу несколько)"
                                >
                                  <span>{p.name}</span>
                                  <Pencil className="w-2.5 h-2.5 opacity-0 group-hover/title:opacity-100 text-[#5a6f8a]" />
                                </div>
                              )}
                              <div className="text-[10px] font-mono text-[#7a8fa6] mt-0.5 flex items-center gap-2">
                                <span>ID #{p.id}</span>
                                <span>·</span>
                                <span>Бренд: <strong className="text-white/80">{p.brand || "AlfaComp"}</strong></span>
                              </div>
                            </div>
                          </td>

                          <td className="p-4">
                            <span className="px-3 py-1 rounded-full bg-[#0a1733] border border-[#1b3668] text-[#4ea1ff] text-xs font-medium whitespace-nowrap">
                              {p.category}
                            </span>
                          </td>

                          <td className="p-4">
                            <button
                              onClick={() => handleToggleStock(p.id, p.in_stock)}
                              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all border ${
                                p.in_stock
                                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                  : "bg-amber-500/15 text-amber-400 border-amber-500/30"
                              }`}
                            >
                              <span>{p.in_stock ? "● В наличии" : "○ Не в наличии"}</span>
                            </button>
                          </td>

                          <td className="p-4 text-right font-mono">
                            {activeEditingIds.has(p.id) ? (
                              <div className="flex flex-col items-end gap-1" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-end gap-1.5">
                                  <span className="text-[#0066ff] font-bold text-sm">$</span>
                                  <input
                                    type="number"
                                    step="any"
                                    value={inlineEdits[p.id]?.priceUSD ?? String(priceUSD)}
                                    onChange={(e) => updateInlineField(p.id, "priceUSD", e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") saveSingleProductInline(p.id);
                                      if (e.key === "Escape") cancelEditProduct(p.id);
                                    }}
                                    className="w-24 bg-[#070e1b] border border-[#0066ff] rounded px-2 py-1 text-sm font-mono font-bold text-white text-right outline-none focus:ring-1 focus:ring-[#0066ff]"
                                  />
                                </div>
                                <div className="text-[10px] text-[#7a8fa6] mt-0.5 font-mono">
                                  ≈ {formatPrice(Math.round((parseFloat(inlineEdits[p.id]?.priceUSD) || priceUSD) * (exchangeRate || 14000)))} сум
                                </div>
                              </div>
                            ) : (
                              <div>
                                <button
                                  onClick={() => startEditProduct(p, "price")}
                                  className="font-bold text-sm text-white hover:text-[#3b82f6] transition-colors flex items-center justify-end gap-1 ml-auto group/price"
                                  title="Кликните чтобы изменить цену"
                                >
                                  <span>$ {priceUSD}</span>
                                  <Pencil className="w-2.5 h-2.5 opacity-0 group-hover/price:opacity-100 text-[#5a6f8a]" />
                                </button>
                                <div className="text-[11px] text-[#7a8fa6] mt-0.5 font-mono">
                                  ~ {formatPrice(priceUZS)} сум
                                </div>
                              </div>
                            )}
                          </td>

                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  setDrawerProduct(p);
                                  setDrawerOpen(true);
                                }}
                                className="p-2 rounded-xl bg-[#070e1b] border border-[#16274a] hover:border-[#0066ff] text-white/70 hover:text-white"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDuplicateProduct(p)}
                                className="p-2 rounded-xl bg-[#070e1b] border border-[#16274a] hover:border-[#0066ff] text-white/70 hover:text-white"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteProduct(p.id, p.name)}
                                className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Floating Multi-Edit Action Bar */}
                {activeEditingIds.size > 0 && (
                  <div className="sticky bottom-4 z-40 mx-auto my-3 max-w-xl bg-[#0b162c]/95 border border-[#0066ff] shadow-2xl backdrop-blur-md rounded-2xl px-5 py-3 flex items-center justify-between gap-4 text-white animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#0066ff] animate-pulse" />
                      <span className="text-xs sm:text-sm font-semibold">
                        Редактируется товаров: <strong className="text-[#3b82f6] font-mono text-sm">{activeEditingIds.size}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={cancelAllInlineEdits}
                        className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-medium text-white/80 transition-colors"
                      >
                        Отменить все
                      </button>
                      <button
                        onClick={saveAllInlineEdits}
                        disabled={isSavingAllInline}
                        className="px-4 py-1.5 rounded-xl bg-[#0066ff] hover:bg-[#0052cc] text-xs font-bold text-white flex items-center gap-1.5 shadow-lg shadow-[#0066ff]/30 transition-all disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5" />
                        {isSavingAllInline ? "Сохранение..." : `Сохранить все (${activeEditingIds.size})`}
                      </button>
                    </div>
                  </div>
                )}

                {/* Table Footer */}
                <div className="bg-[#080f1e] px-5 py-3.5 border-t border-[#16274a] flex items-center justify-between text-xs font-mono text-[#7a8fa6]">
                  <div>
                    Показано{" "}
                    <strong className="text-white">
                      {filteredProducts.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}-
                      {Math.min(currentPage * pageSize, filteredProducts.length)}
                    </strong>{" "}
                    из <strong className="text-white">{filteredProducts.length}</strong>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                      className="p-1.5 rounded-lg bg-[#0b1528] border border-[#16274a] disabled:opacity-30 text-white"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages}
                      className="p-1.5 rounded-lg bg-[#0b1528] border border-[#16274a] disabled:opacity-30 text-white"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Orders & CRM Tab */}
          {tab === "orders" && <OrdersCrmTab products={products} exchangeRate={exchangeRate} />}

          {/* SEO Audit Tab */}
          {tab === "seo" && <SeoAuditTab />}

          {/* Change History Tab */}
          {tab === "history" && <ChangeHistoryTab />}

          {/* User Geography & World Map Tab */}
          {tab === "stats" && (
            <UserGeographyTab
              visitors={visitors}
              loading={visitorsLoading}
              onRefresh={fetchVisitors}
            />
          )}

          {/* Telegram / Bot Management Tab */}
          {tab === "telegram" && <TelegramBotTab />}

          {/* Analytics tab */}
          {tab === "analytics" && (
            <div className="space-y-6">
              <h1 className="text-2xl font-black text-white">Аналитика витрины</h1>
              <div className="bg-[#0b1528] border border-[#16274a] rounded-2xl p-6">
                <h3 className="font-mono text-xs text-white font-bold mb-4 uppercase">
                  Товары по категориям
                </h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={Object.entries(metrics.categoryCounts).map(([name, value]) => ({ name, value }))}
                    margin={{ top: 10, right: 10, left: -20, bottom: 40 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" tick={{ fill: "#7a8fa6", fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
                    <YAxis tick={{ fill: "#7a8fa6", fontSize: 10 }} allowDecimals={false} />
                    <Tooltip contentStyle={{ backgroundColor: "#070e1b", border: "1px solid #16274a", borderRadius: 12, color: "#fff" }} />
                    <Bar dataKey="value" name="Товаров" fill="#0066ff" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Settings & CBU Exchange Rate Tab */}
          {tab === "settings" && (
            <SettingsTab
              currentExchangeRate={exchangeRate}
              onUpdateExchangeRate={updateExchangeRate}
            />
          )}
        </main>
      </div>

      {/* Bulk Edit Modal */}
      <BulkEditModal
        isOpen={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        selectedIds={selectedProductIds}
        allProducts={products}
        categories={allCategories}
        exchangeRate={exchangeRate}
        onSuccess={() => {
          setSelectedProductIds([]);
          fetchProducts();
        }}
      />

      {/* Export Options Modal (Excel / ZIP Photos) */}
      <ExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        products={products}
        exchangeRate={exchangeRate}
      />

      {/* Product Drawer Editor */}
      <ProductDrawerEditor
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        product={drawerProduct}
        categories={allCategories}
        exchangeRate={exchangeRate}
        onSave={handleSaveDrawerProduct}
      />
    </div>
  );
}

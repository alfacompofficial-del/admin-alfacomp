import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";
import {
  Package, BarChart3, Users, LogOut, RefreshCw, Plus, Search, X, Check, Pencil,
  Upload, Download, Trash2, TrendingUp, AlertTriangle
} from "lucide-react";
import { supabase } from "../lib/supabase";

interface Product {
  id: number; name: string; brand?: string; category: string; price: number;
  old_price?: number; image?: string; in_stock: boolean; priority?: number;
  views?: number; likes?: number; specs?: Record<string, string>;
}
interface Visitor {
  id: number; ip: string; country?: string; country_code?: string;
  city?: string; region?: string; user_agent?: string; path?: string; created_at: string;
}

const CHART_COLORS = ["#FF5A00","#3B82F6","#10B981","#F59E0B","#8B5CF6","#EC4899","#06B6D4","#84CC16","#F97316","#FF8C42"];
const TT_STYLE = { backgroundColor: "#0f1219", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 11, fontFamily: "monospace" };
const flag = (code?: string | null) => {
  if (!code || code.length !== 2) return "🌐";
  return String.fromCodePoint(...[...code.toUpperCase()].map(c => 127397 + c.charCodeAt(0)));
};

interface Props { onLogout: () => void; }

export default function AdminDashboard({ onLogout }: Props) {
  const [tab, setTab] = useState<"products"|"analytics"|"visitors">("products");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState<"all"|"in"|"out">("all");
  const [sortBy, setSortBy] = useState<"priority"|"price_asc"|"price_desc"|"views"|"likes"|"name">("priority");
  const [editPriceId, setEditPriceId] = useState<number|null>(null);
  const [editPriceVal, setEditPriceVal] = useState("");
  const [editNameId, setEditNameId] = useState<number|null>(null);
  const [editNameVal, setEditNameVal] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadPid = useRef<number|null>(null);
  const [uploading, setUploading] = useState<number|null>(null);
  const [dragId, setDragId] = useState<number|null>(null);
  const [dragOverId, setDragOverId] = useState<number|null>(null);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [visitorsLoading, setVisitorsLoading] = useState(false);
  const [visSearch, setVisSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalProduct, setModalProduct] = useState<Partial<Product>>({});
  const [modalIsNew, setModalIsNew] = useState(true);
  const [modalSaving, setModalSaving] = useState(false);
  const [rate, setRate] = useState(12700);

  const fetchProducts = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true); else setLoading(true);
    const { data, error } = await supabase.from("products").select("*").order("priority").order("id");
    if (!error && data) setProducts(data as Product[]);
    else if (error) toast.error("Ошибка: " + error.message);
    if (showRefresh) setRefreshing(false); else setLoading(false);
  }, []);

  const fetchRate = useCallback(async () => {
    const { data } = await supabase.from("exchange_rate" as any).select("rate").single();
    if (data && (data as any).rate) setRate((data as any).rate);
  }, []);

  useEffect(() => { fetchProducts(); fetchRate(); }, [fetchProducts, fetchRate]);

  const fetchVisitors = useCallback(async () => {
    setVisitorsLoading(true);
    const { data } = await supabase.from("visitors" as any).select("*").order("created_at", { ascending: false }).limit(2000);
    if (data) setVisitors(data as Visitor[]);
    setVisitorsLoading(false);
  }, []);

  useEffect(() => { if (tab === "visitors") fetchVisitors(); }, [tab, fetchVisitors]);

  const categories = useMemo(() => {
    const base = ["ИБП","Мониторы","Сеть","Комплектующие","Моноблоки","Аксессуары","Колонки","Кронштейны","Deco","Wi-Fi роутеры"];
    const found = [...new Set(products.map(p => p.category).filter(Boolean))];
    return [...new Set([...base, ...found])];
  }, [products]);

  const filtered = useMemo(() => {
    let list = [...products];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || (p.brand||"").toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
    }
    if (catFilter !== "all") list = list.filter(p => p.category === catFilter);
    if (stockFilter === "in") list = list.filter(p => p.in_stock);
    if (stockFilter === "out") list = list.filter(p => !p.in_stock);
    list.sort((a, b) => {
      if (sortBy === "priority") return (a.priority ?? 999) - (b.priority ?? 999);
      if (sortBy === "price_asc") return a.price - b.price;
      if (sortBy === "price_desc") return b.price - a.price;
      if (sortBy === "views") return (b.views||0) - (a.views||0);
      if (sortBy === "likes") return (b.likes||0) - (a.likes||0);
      if (sortBy === "name") return a.name.localeCompare(b.name, "ru");
      return 0;
    });
    return list;
  }, [products, search, catFilter, stockFilter, sortBy]);

  const metrics = useMemo(() => {
    const catCounts: Record<string,number> = {};
    products.forEach(p => { catCounts[p.category] = (catCounts[p.category]||0)+1; });
    return {
      total: products.length,
      inStock: products.filter(p => p.in_stock).length,
      outStock: products.filter(p => !p.in_stock).length,
      totalViews: products.reduce((s,p)=>s+(p.views||0),0),
      totalLikes: products.reduce((s,p)=>s+(p.likes||0),0),
      catCounts,
      topViews: [...products].sort((a,b)=>(b.views||0)-(a.views||0)).slice(0,6),
    };
  }, [products]);

  const visitorStats = useMemo(() => {
    const q = visSearch.toLowerCase();
    const list = q ? visitors.filter(v => v.ip.includes(q)||(v.country||"").toLowerCase().includes(q)) : visitors;
    const uniq = new Set(visitors.map(v=>v.ip)).size;
    const cCounts: Record<string,number> = {};
    visitors.forEach(v => { const k = v.country||"Неизвестно"; cCounts[k]=(cCounts[k]||0)+1; });
    const topC = Object.entries(cCounts).sort((a,b)=>b[1]-a[1]).slice(0,6);
    const today = new Date().toISOString().slice(0,10);
    return { list, uniq, topC, todayN: visitors.filter(v=>v.created_at.startsWith(today)).length };
  }, [visitors, visSearch]);

  const handleToggleStock = async (id: number, cur: boolean) => {
    const { error } = await supabase.from("products").update({ in_stock: !cur }).eq("id", id);
    if (!error) { setProducts(prev => prev.map(p => p.id===id ? {...p, in_stock: !cur} : p)); toast.success(cur ? "Снято с продажи" : "В наличии!"); }
  };
  const handleDelete = async (id: number, name: string) => {
    if (!confirm("Удалить " + name + "?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (!error) { setProducts(prev => prev.filter(p => p.id !== id)); toast.success("Удалено"); }
  };
  const handleSavePrice = async (id: number) => {
    const val = parseFloat(editPriceVal);
    if (isNaN(val)||val<=0) return;
    const { error } = await supabase.from("products").update({ price: val }).eq("id", id);
    if (!error) { setProducts(prev => prev.map(p => p.id===id ? {...p, price: val} : p)); setEditPriceId(null); toast.success("Цена обновлена"); }
  };
  const handleSaveName = async (id: number) => {
    const val = editNameVal.trim();
    if (!val) return;
    const { error } = await supabase.from("products").update({ name: val }).eq("id", id);
    if (!error) { setProducts(prev => prev.map(p => p.id===id ? {...p, name: val} : p)); setEditNameId(null); toast.success("Название обновлено"); }
  };
  const handleImageClick = (id: number) => { uploadPid.current = id; fileRef.current?.click(); };
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; const id = uploadPid.current;
    if (!file || !id) return; e.target.value = "";
    if (file.size > 5*1024*1024) { toast.error("Файл > 5MB"); return; }
    setUploading(id);
    const reader = new FileReader();
    reader.onload = async ev => {
      const url = ev.target?.result as string;
      const { error } = await supabase.from("products").update({ image: url }).eq("id", id);
      if (!error) { setProducts(prev => prev.map(p => p.id===id ? {...p, image: url} : p)); toast.success("Фото обновлено"); }
      setUploading(null); uploadPid.current = null;
    };
    reader.readAsDataURL(file);
  };
  const handleDrop = async (e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    if (!dragId || dragId === targetId) { setDragId(null); setDragOverId(null); return; }
    const list = [...products];
    const fi = list.findIndex(p => p.id === dragId), ti = list.findIndex(p => p.id === targetId);
    if (fi===-1||ti===-1) return;
    const reordered = [...list]; const [moved] = reordered.splice(fi, 1); reordered.splice(ti, 0, moved);
    setProducts(reordered.map((p,i) => ({...p, priority: i+1})));
    setDragId(null); setDragOverId(null);
    await Promise.all(reordered.map((p,i) => supabase.from("products").update({ priority: i+1 }).eq("id", p.id)));
    toast.success("Порядок сохранён");
  };
  const handleSaveModal = async () => {
    if (!modalProduct.name?.trim() || !modalProduct.category) { toast.error("Заполните обязательные поля"); return; }
    setModalSaving(true);
    const data = { ...modalProduct, price: Number(modalProduct.price)||0, in_stock: modalProduct.in_stock ?? true };
    if (modalIsNew) {
      const { error } = await supabase.from("products").insert([data as any]);
      if (!error) { toast.success("Товар добавлен!"); fetchProducts(true); setModalOpen(false); }
      else toast.error(error.message);
    } else {
      const { error } = await supabase.from("products").update(data as any).eq("id", (modalProduct as any).id);
      if (!error) { toast.success("Товар обновлён!"); fetchProducts(true); setModalOpen(false); }
      else toast.error(error.message);
    }
    setModalSaving(false);
  };
  const openAdd = () => { setModalProduct({ in_stock: true, category: categories[0] }); setModalIsNew(true); setModalOpen(true); };
  const openEdit = (p: Product) => { setModalProduct({ ...p }); setModalIsNew(false); setModalOpen(true); };
  const exportCSV = () => {
    const rows = products.map(p => [p.id, p.name, p.brand||"", p.category, p.price, p.in_stock?"Да":"Нет", p.priority||"", p.views||0, p.likes||0]);
    const csv = [["ID","Название","Бренд","Категория","Цена","В наличии","Приоритет","Просмотры","Лайки"].join(","), ...rows.map(r=>r.join(","))].join("\n");
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob(["\uFEFF"+csv],{type:"text/csv"})), download: "alfacomp.csv" });
    a.click(); toast.success("CSV экспортирован");
  };
  const handleLogout = () => { try { sessionStorage.removeItem("_afc_auth"); } catch {} toast.success("Выход выполнен"); onLogout(); };

  const catChartData = Object.entries(metrics.catCounts).sort((a,b)=>b[1]-a[1]).map(([name,value])=>({name,value}));
  const stockPie = [{name:"В наличии",value:metrics.inStock},{name:"Нет",value:metrics.outStock}].filter(d=>d.value>0);
  const topChart = metrics.topViews.map(p=>({name:p.name.length>16?p.name.slice(0,14)+"...":p.name,views:p.views||0,likes:p.likes||0}));

  const TABS = [{id:"products",label:"Товары",icon:Package},{id:"analytics",label:"Аналитика",icon:BarChart3},{id:"visitors",label:"Посетители",icon:Users}];

  return (
    <div className="min-h-screen bg-[#08090d] text-white antialiased select-none">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      <header className="sticky top-0 z-50 bg-[#0c0e14]/95 backdrop-blur-xl border-b border-white/[0.07] h-16 flex items-center px-4 sm:px-8 justify-between">
        <div>
          <h1 className="font-extrabold tracking-tight text-sm flex items-center gap-2">
            <span>ALFACOMP</span><span className="text-[#FF5A00] font-mono text-xs">// CONTROL CENTER</span>
          </h1>
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-white/40 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400">ONLINE</span><span>· SUPABASE SYNCED</span>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button onClick={()=>fetchProducts(true)} className="w-8 h-8 bg-[#141720] border border-white/10 rounded-lg flex items-center justify-center hover:border-white/20 transition-all">
            <RefreshCw className={"w-3.5 h-3.5 text-white/60"+(refreshing?" animate-spin text-[#FF5A00]":"")} />
          </button>
          <button onClick={exportCSV} className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-[#141720] border border-white/10 rounded-lg text-xs font-mono text-white/70 hover:border-white/20 transition-all">
            <Download className="w-3.5 h-3.5 text-[#FF5A00]" /> CSV
          </button>
          <button onClick={handleLogout} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-mono transition-all">
            <LogOut className="w-3.5 h-3.5" /><span className="hidden sm:inline">Выход</span>
          </button>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="flex items-center justify-between gap-4 border-b border-white/[0.07] pb-3 overflow-x-auto">
          <div className="flex items-center gap-2">
            {TABS.map(({id,label,icon:Icon})=>(
              <button key={id} onClick={()=>setTab(id as any)} className={"flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all whitespace-nowrap "+(tab===id?"bg-[#FF5A00] text-white border-[#FF5A00] shadow-md shadow-[#FF5A00]/20":"bg-[#11141c] text-white/60 border-white/[0.07] hover:text-white hover:border-white/15")}>
                <Icon className="w-3.5 h-3.5" />{label}
              </button>
            ))}
          </div>
          {tab==="products" && (
            <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#FF5A00] hover:bg-[#FF6A15] text-white text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-[#FF5A00]/20 shrink-0">
              <Plus className="w-4 h-4" /> Добавить
            </button>
          )}
        </div>

        {tab==="products" && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                {label:"Всего",value:metrics.total,color:"text-white",click:undefined},
                {label:"В наличии",value:metrics.inStock,color:"text-emerald-400",click:()=>setStockFilter(stockFilter==="in"?"all":"in")},
                {label:"Нет в наличии",value:metrics.outStock,color:"text-yellow-400",click:()=>setStockFilter(stockFilter==="out"?"all":"out")},
                {label:"Категорий",value:Object.keys(metrics.catCounts).length,color:"text-[#FF5A00]",click:undefined},
              ].map(({label,value,color,click})=>(
                <div key={label} onClick={click} className={"bg-[#0f1219] border border-white/[0.08] rounded-xl p-4"+(click?" cursor-pointer hover:border-white/20 transition-all":"")}>
                  <div className="text-[10px] font-mono uppercase text-white/40 tracking-wider">{label}</div>
                  <div className={"text-2xl sm:text-3xl font-mono font-extrabold mt-1 "+color}>{value}</div>
                </div>
              ))}
            </div>
            <div className="bg-[#0f1219] rounded-xl border border-white/[0.08] p-4 space-y-3">
              <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Поиск по названию, бренду, категории..." className="w-full bg-[#141722] border border-white/10 focus:border-[#FF5A00] rounded-lg pl-10 pr-4 py-2.5 text-sm text-white outline-none transition-all" />
                  {search && <button onClick={()=>setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"><X className="w-3.5 h-3.5" /></button>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-white/40">Сортировка:</span>
                  <select value={sortBy} onChange={e=>setSortBy(e.target.value as any)} className="bg-[#141722] border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#FF5A00] cursor-pointer">
                    <option value="priority">Приоритет</option>
                    <option value="price_asc">Цена ↑</option>
                    <option value="price_desc">Цена ↓</option>
                    <option value="views">Просмотры</option>
                    <option value="likes">Лайки</option>
                    <option value="name">Алфавит</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
                <button onClick={()=>setCatFilter("all")} className={"px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider border transition-all "+(catFilter==="all"?"bg-white/10 text-white border-white/30":"bg-[#141722] text-white/50 border-white/5 hover:text-white")}>Все ({products.length})</button>
                {categories.map(c=>(
                  <button key={c} onClick={()=>setCatFilter(c)} className={"px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider border whitespace-nowrap transition-all "+(catFilter===c?"bg-[#FF5A00]/20 text-[#FF5A00] border-[#FF5A00]/50":"bg-[#141722] text-white/50 border-white/5 hover:text-white")}>
                    {c} ({metrics.catCounts[c]||0})
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-[#0f1219] rounded-xl border border-white/[0.08] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-white/[0.02] text-[10px] uppercase font-mono tracking-widest text-white/40 border-b border-white/[0.06]">
                      <th className="p-4 w-10 text-center">#</th>
                      <th className="p-4">Товар</th>
                      <th className="p-4 hidden md:table-cell">Категория</th>
                      <th className="p-4">Наличие</th>
                      <th className="p-4 text-right">Цена ($)</th>
                      <th className="p-4 text-center hidden lg:table-cell">👁️/❤️</th>
                      <th className="p-4 text-right">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {loading && <tr><td colSpan={7} className="p-12 text-center text-white/40 font-mono text-xs">Загрузка...</td></tr>}
                    {!loading && filtered.length===0 && <tr><td colSpan={7} className="p-12 text-center text-white/40 font-mono text-xs">Ничего не найдено</td></tr>}
                    {filtered.map(p=>(
                      <tr key={p.id} draggable onDragStart={e=>{setDragId(p.id);e.dataTransfer.effectAllowed="move";}} onDragOver={e=>{e.preventDefault();if(p.id!==dragId)setDragOverId(p.id);}} onDrop={e=>handleDrop(e,p.id)} onDragEnd={()=>{setDragId(null);setDragOverId(null);}}
                        className={"group transition-all cursor-grab active:cursor-grabbing hover:bg-white/[0.02] "+(dragId===p.id?"opacity-30":dragOverId===p.id?"bg-[#FF5A00]/10 border-l-2 border-[#FF5A00]":"")}>
                        <td className="p-4 text-center font-mono text-xs text-white/30 group-hover:text-white/60">{p.priority??"-"}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div onClick={()=>handleImageClick(p.id)} className="relative w-11 h-11 rounded-lg overflow-hidden border border-white/10 bg-[#090b10] cursor-pointer shrink-0 group/img">
                              {uploading===p.id?<div className="w-full h-full flex items-center justify-center"><div className="w-4 h-4 border-2 border-[#FF5A00] border-t-transparent rounded-full animate-spin"/></div>:<>
                                <img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover/img:brightness-50 transition-all" onError={e=>{(e.target as HTMLImageElement).src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='44' height='44'%3E%3Crect width='44' height='44' fill='%23141722'/%3E%3C/svg%3E";}} />
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity"><Upload className="w-4 h-4 text-white"/></div>
                              </>}
                            </div>
                            <div className="min-w-0">
                              {editNameId===p.id?<div className="flex items-center gap-1.5"><input value={editNameVal} onChange={e=>setEditNameVal(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")handleSaveName(p.id);if(e.key==="Escape")setEditNameId(null);}} autoFocus className="w-40 bg-white/10 border border-[#FF5A00]/70 rounded px-2 py-1 text-xs font-bold text-white outline-none"/><button onClick={()=>handleSaveName(p.id)} className="text-emerald-400"><Check className="w-3.5 h-3.5"/></button><button onClick={()=>setEditNameId(null)} className="text-red-400"><X className="w-3.5 h-3.5"/></button></div>
                              :<div className="flex items-center gap-1.5"><span className="text-sm font-semibold text-white/90 truncate max-w-[180px]">{p.name}</span><button onClick={()=>{setEditNameId(p.id);setEditNameVal(p.name);}} className="opacity-0 group-hover:opacity-50 hover:opacity-100 transition-opacity"><Pencil className="w-3 h-3 text-white/50"/></button></div>}
                              <div className="text-[11px] text-white/35 font-mono">{p.brand||"-"} · #{p.id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 hidden md:table-cell"><span className="text-xs font-mono text-white/50 bg-white/5 px-2 py-1 rounded">{p.category}</span></td>
                        <td className="p-4"><button onClick={()=>handleToggleStock(p.id,p.in_stock)} className={"text-[11px] font-mono px-2.5 py-1 rounded-lg border transition-all "+(p.in_stock?"bg-emerald-500/10 border-emerald-500/30 text-emerald-400":"bg-yellow-500/10 border-yellow-500/30 text-yellow-400")}>{p.in_stock?"В наличии":"Нет"}</button></td>
                        <td className="p-4 text-right">
                          {editPriceId===p.id?<div className="flex items-center justify-end gap-1"><input type="number" value={editPriceVal} onChange={e=>setEditPriceVal(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")handleSavePrice(p.id);if(e.key==="Escape")setEditPriceId(null);}} autoFocus className="w-20 bg-white/10 border border-[#FF5A00]/70 rounded px-2 py-1 text-xs font-mono text-white text-right outline-none"/><button onClick={()=>handleSavePrice(p.id)} className="text-emerald-400"><Check className="w-3.5 h-3.5"/></button><button onClick={()=>setEditPriceId(null)} className="text-red-400"><X className="w-3.5 h-3.5"/></button></div>
                          :<button onClick={()=>{setEditPriceId(p.id);setEditPriceVal(String(p.price));}} className="text-right group/price"><div className="text-sm font-mono font-bold text-[#FF5A00] flex items-center justify-end gap-1">{p.price.toFixed(0)}<Pencil className="w-3 h-3 opacity-0 group-hover/price:opacity-60 transition-opacity"/></div><div className="text-[10px] text-white/30 font-mono">{(p.price*rate).toLocaleString()} UZS</div></button>}
                        </td>
                        <td className="p-4 text-center hidden lg:table-cell text-xs font-mono text-white/40">{p.views||0} · <span className="text-rose-400">{p.likes||0}</span></td>
                        <td className="p-4">
                          <div className="flex items-center justify-end gap-1.5">
                            <button onClick={()=>openEdit(p)} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-blue-500/20 hover:text-blue-400 flex items-center justify-center text-white/50 transition-all"><Pencil className="w-3.5 h-3.5"/></button>
                            <button onClick={()=>handleDelete(p.id,p.name)} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-red-500/20 hover:text-red-400 flex items-center justify-center text-white/50 transition-all"><Trash2 className="w-3.5 h-3.5"/></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab==="analytics" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[{label:"Всего",value:metrics.total,color:"text-white",b:"border-white/10"},{label:"В наличии",value:metrics.inStock,color:"text-emerald-400",b:"border-emerald-500/20"},{label:"Просмотры",value:metrics.totalViews.toLocaleString(),color:"text-[#FF5A00]",b:"border-[#FF5A00]/20"},{label:"Лайки",value:metrics.totalLikes.toLocaleString(),color:"text-rose-400",b:"border-rose-500/20"}].map(({label,value,color,b})=>(
                <div key={label} className={"bg-[#0f1219] border "+b+" rounded-xl p-5"}>
                  <div className={"text-2xl sm:text-3xl font-mono font-bold "+color}>{value}</div>
                  <div className="text-[10px] font-mono uppercase text-white/40 tracking-wider mt-1">{label}</div>
                </div>
              ))}
            </div>
            {metrics.outStock>0&&<div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-4 flex items-center gap-3"><AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0"/><p className="text-xs text-yellow-400">{metrics.outStock} товаров сняты с продажи.</p></div>}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
              <div className="bg-[#0f1219] border border-white/[0.08] rounded-xl p-6 lg:col-span-3">
                <div className="flex items-center gap-2 mb-5"><BarChart3 className="w-4 h-4 text-[#FF5A00]"/><h3 className="font-mono uppercase text-xs text-white/80 font-bold">Товары по категориям</h3></div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={catChartData} margin={{top:0,right:0,left:-20,bottom:40}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
                    <XAxis dataKey="name" tick={{fill:"rgba(255,255,255,0.45)",fontSize:10,fontFamily:"monospace"}} angle={-35} textAnchor="end" interval={0}/>
                    <YAxis tick={{fill:"rgba(255,255,255,0.35)",fontSize:10,fontFamily:"monospace"}} allowDecimals={false}/>
                    <Tooltip contentStyle={TT_STYLE} labelStyle={{color:"rgba(255,255,255,0.7)"}} itemStyle={{color:"#FF5A00"}} cursor={{fill:"rgba(255,90,0,0.06)"}}/>
                    <Bar dataKey="value" name="Товаров" radius={[4,4,0,0]}>
                      {catChartData.map((_,i)=><Cell key={i} fill={CHART_COLORS[i%CHART_COLORS.length]}/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-[#0f1219] border border-white/[0.08] rounded-xl p-6 lg:col-span-2">
                <div className="flex items-center gap-2 mb-5"><Package className="w-4 h-4 text-emerald-400"/><h3 className="font-mono uppercase text-xs text-white/80 font-bold">Наличие</h3></div>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={stockPie} cx="50%" cy="45%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value" stroke="none">
                      <Cell fill="#10B981"/><Cell fill="#F59E0B"/>
                    </Pie>
                    <Tooltip contentStyle={TT_STYLE}/>
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{fontSize:10,fontFamily:"monospace",color:"rgba(255,255,255,0.5)",paddingTop:8}}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-[#0f1219] border border-white/[0.08] rounded-xl p-6">
              <div className="flex items-center gap-2 mb-5"><TrendingUp className="w-4 h-4 text-[#FF5A00]"/><h3 className="font-mono uppercase text-xs text-white/80 font-bold">Топ-6: просмотры и лайки</h3></div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={topChart} margin={{top:0,right:10,left:-20,bottom:40}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
                  <XAxis dataKey="name" tick={{fill:"rgba(255,255,255,0.4)",fontSize:9,fontFamily:"monospace"}} angle={-30} textAnchor="end" interval={0}/>
                  <YAxis tick={{fill:"rgba(255,255,255,0.35)",fontSize:10,fontFamily:"monospace"}} allowDecimals={false}/>
                  <Tooltip contentStyle={TT_STYLE} cursor={{fill:"rgba(255,255,255,0.03)"}}/>
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{fontSize:10,fontFamily:"monospace",color:"rgba(255,255,255,0.5)",paddingTop:8}}/>
                  <Bar dataKey="views" name="Просмотры" fill="#FF5A00" radius={[3,3,0,0]}/>
                  <Bar dataKey="likes" name="Лайки" fill="#F43F5E" radius={[3,3,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-[#0f1219] border border-white/[0.08] rounded-xl p-6">
              <h3 className="font-mono uppercase text-xs text-white/80 font-bold mb-4">Распределение по категориям</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {Object.entries(metrics.catCounts).sort((a,b)=>b[1]-a[1]).map(([cat,count],i)=>(
                  <div key={cat} className="bg-[#141722] border border-white/[0.06] rounded-lg p-3" style={{borderTopColor:CHART_COLORS[i%CHART_COLORS.length],borderTopWidth:2}}>
                    <div className="text-xl font-mono font-extrabold" style={{color:CHART_COLORS[i%CHART_COLORS.length]}}>{count}</div>
                    <div className="text-xs text-white/50 mt-0.5 truncate">{cat}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab==="visitors" && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[{label:"Всего визитов",value:visitors.length,color:"text-white"},{label:"Уникальных IP",value:visitorStats.uniq,color:"text-blue-400"},{label:"Сегодня",value:visitorStats.todayN,color:"text-emerald-400"},{label:"Топ страна",value:visitorStats.topC[0]?.[0]??"—",color:"text-[#FF5A00]"}].map(({label,value,color})=>(
                <div key={label} className="bg-[#0f1219] border border-white/[0.08] rounded-xl p-5">
                  <div className="text-[10px] font-mono uppercase text-white/40 tracking-wider mb-1">{label}</div>
                  <div className={"text-xl font-mono font-bold "+color}>{value}</div>
                </div>
              ))}
            </div>
            <div className="relative"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40"/><input value={visSearch} onChange={e=>setVisSearch(e.target.value)} placeholder="Поиск по IP, стране..." className="w-full bg-[#0f1219] border border-white/[0.08] focus:border-[#FF5A00] rounded-lg pl-10 pr-4 py-2.5 text-sm text-white outline-none font-mono transition-all"/></div>
            <div className="bg-[#0f1219] rounded-xl border border-white/[0.08] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead><tr className="bg-white/[0.02] text-[10px] uppercase font-mono tracking-wider text-white/40 border-b border-white/[0.06]"><th className="p-4">IP</th><th className="p-4">Страна</th><th className="p-4 hidden sm:table-cell">Путь</th><th className="p-4 hidden md:table-cell">User Agent</th><th className="p-4 text-right">Время</th></tr></thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {visitorsLoading&&<tr><td colSpan={5} className="p-10 text-center text-white/40 font-mono text-xs">Загрузка...</td></tr>}
                    {!visitorsLoading&&visitorStats.list.length===0&&<tr><td colSpan={5} className="p-10 text-center text-white/40 font-mono text-xs">Нет данных</td></tr>}
                    {visitorStats.list.map(v=>(
                      <tr key={v.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="p-4 font-mono text-xs font-bold text-[#FF5A00]">{v.ip}</td>
                        <td className="p-4 text-xs"><div className="font-semibold">{flag(v.country_code)} {v.country||"—"}</div><div className="text-white/40 text-[11px] font-mono">{[v.city,v.region].filter(Boolean).join(", ")||"—"}</div></td>
                        <td className="p-4 text-xs text-white/60 font-mono hidden sm:table-cell">{v.path||"/"}</td>
                        <td className="p-4 text-xs text-white/40 max-w-[240px] truncate font-mono hidden md:table-cell">{v.user_agent||"—"}</td>
                        <td className="p-4 text-right text-xs font-mono text-white/40 whitespace-nowrap">{new Date(v.created_at).toLocaleString("ru-RU")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {modalOpen&&(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={e=>{if(e.target===e.currentTarget)setModalOpen(false);}}>
          <div className="bg-[#0d0f18] border border-white/[0.09] rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-white/[0.07]">
              <h2 className="font-bold text-sm uppercase tracking-wider">{modalIsNew?"Добавить товар":"Редактировать товар"}</h2>
              <button onClick={()=>setModalOpen(false)} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 transition-all"><X className="w-4 h-4"/></button>
            </div>
            <div className="p-6 space-y-4">
              {[{key:"name",label:"Название *",type:"text",ph:"Монитор LG 27..."},{key:"brand",label:"Бренд",type:"text",ph:"LG, Samsung..."},{key:"price",label:"Цена (USD) *",type:"number",ph:"299"},{key:"old_price",label:"Старая цена",type:"number",ph:"349"},{key:"image",label:"URL изображения",type:"text",ph:"https://..."}].map(({key,label,type,ph})=>(
                <div key={key}>
                  <label className="text-[10px] font-mono uppercase tracking-wider text-white/40 block mb-1.5">{label}</label>
                  <input type={type} value={(modalProduct as any)[key]??""} onChange={e=>setModalProduct(prev=>({...prev,[key]:e.target.value}))} placeholder={ph} className="w-full bg-[#141720] border border-white/10 focus:border-[#FF5A00] rounded-xl px-4 py-2.5 text-sm text-white outline-none transition-all"/>
                </div>
              ))}
              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-white/40 block mb-1.5">Категория *</label>
                <select value={modalProduct.category??""} onChange={e=>setModalProduct(prev=>({...prev,category:e.target.value}))} className="w-full bg-[#141720] border border-white/10 focus:border-[#FF5A00] rounded-xl px-4 py-2.5 text-sm text-white outline-none cursor-pointer">
                  {categories.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <button onClick={()=>setModalProduct(prev=>({...prev,in_stock:!prev.in_stock}))} className={"px-4 py-2 rounded-xl text-xs font-mono border transition-all "+(modalProduct.in_stock?"bg-emerald-500/20 border-emerald-500/40 text-emerald-400":"bg-white/5 border-white/10 text-white/50")}>
                {modalProduct.in_stock?"✓ В наличии":"✗ Нет в наличии"}
              </button>
            </div>
            <div className="p-6 pt-0 flex gap-3 justify-end">
              <button onClick={()=>setModalOpen(false)} className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white/70 hover:text-white transition-all">Отмена</button>
              <button onClick={handleSaveModal} disabled={modalSaving} className="px-5 py-2.5 rounded-xl bg-[#FF5A00] hover:bg-[#FF6A15] text-white text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2">
                {modalSaving?<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>:<Check className="w-4 h-4"/>}
                {modalIsNew?"Добавить":"Сохранить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Upload, Check, Trash2, Plus, Image as ImageIcon,
  DollarSign, Package, Sliders
} from "lucide-react";
import { toast } from "sonner";
import { formatPrice, resolveProductPrices } from "../lib/constants";

export interface Product {
  id: number;
  name: string;
  brand?: string;
  category: string;
  price: number;
  old_price?: number | null;
  image?: string;
  in_stock: boolean;
  priority?: number;
  views?: number;
  likes?: number;
  rating?: number;
  rating_count?: number;
  specs?: Record<string, string>;
}

interface ProductDrawerEditorProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  categories: string[];
  exchangeRate: number;
  onSave: (productData: Partial<Product>, isNew: boolean) => Promise<boolean>;
}

export const ProductDrawerEditor: React.FC<ProductDrawerEditorProps> = ({
  isOpen,
  onClose,
  product,
  categories,
  exchangeRate,
  onSave,
}) => {
  const [activeTab, setActiveTab] = useState<"general" | "pricing" | "media" | "specs">("general");
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState(categories[0] || "ИБП");
  const [priority, setPriority] = useState("999");
  const [inStock, setInStock] = useState(true);
  const [price, setPrice] = useState("");
  const [oldPrice, setOldPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [specs, setSpecs] = useState<Array<{ key: string; value: string }>>([]);
  const [newSpecKey, setNewSpecKey] = useState("");
  const [newSpecValue, setNewSpecValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (product) {
      setName(product.name || "");
      setBrand(product.brand || "AlfaComp");
      setCategory(product.category || categories[0] || "ИБП");
      setPriority(String(product.priority ?? 999));
      setInStock(product.in_stock ?? true);
      const { priceUSD } = resolveProductPrices(product.price, exchangeRate || 14000);
      setPrice(priceUSD > 0 ? String(priceUSD) : "");

      if (product.old_price) {
        const { priceUSD: oldUSD } = resolveProductPrices(product.old_price, exchangeRate || 14000);
        setOldPrice(oldUSD > 0 ? String(oldUSD) : "");
      } else {
        setOldPrice("");
      }
      setImageUrl(product.image || "");

      const specList: Array<{ key: string; value: string }> = [];
      if (product.specs) {
        if (Array.isArray(product.specs)) {
          (product.specs as any).forEach((s: any) => {
            if (s && s.key) specList.push({ key: s.key, value: s.value || "" });
          });
        } else if (typeof product.specs === "object") {
          Object.entries(product.specs).forEach(([k, v]) => {
            specList.push({ key: k, value: String(v) });
          });
        }
      }
      setSpecs(specList);
    } else {
      setName("");
      setBrand("AlfaComp");
      setCategory(categories[0] || "ИБП");
      setPriority("1");
      setInStock(true);
      setPrice("");
      setOldPrice("");
      setImageUrl("");
      setSpecs([]);
    }
    setActiveTab("general");
  }, [product, categories, isOpen, exchangeRate]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (!file.type.startsWith("image/")) {
      toast.error("Выберите файл изображения (PNG, JPG, WebP)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Файл слишком большой (максимум 5 МБ)");
      return;
    }

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        setImageUrl(dataUrl);
        setIsUploading(false);
        toast.success("Изображение загружено!");
      };
      reader.onerror = () => {
        toast.error("Ошибка при чтении файла");
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      toast.error("Не удалось обработать изображение");
      setIsUploading(false);
    }
  };

  const handleAddSpec = () => {
    if (!newSpecKey.trim()) {
      toast.error("Укажите параметр");
      return;
    }
    setSpecs((prev) => [...prev, { key: newSpecKey.trim(), value: newSpecValue.trim() }]);
    setNewSpecKey("");
    setNewSpecValue("");
  };

  const handleRemoveSpec = (index: number) => {
    setSpecs((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Укажите наименование оборудования");
      setActiveTab("general");
      return;
    }
    const numPriceUSD = parseFloat(price);
    if (isNaN(numPriceUSD) || numPriceUSD <= 0) {
      toast.error("Укажите корректную цену в долларах ($ USD)");
      setActiveTab("pricing");
      return;
    }

    const currentRate = exchangeRate > 0 ? exchangeRate : 12700;
    const finalPriceUZS = Math.round(numPriceUSD * currentRate);
    const finalOldPriceUZS =
      oldPrice && !isNaN(parseFloat(oldPrice)) && parseFloat(oldPrice) > 0
        ? Math.round(parseFloat(oldPrice) * currentRate)
        : null;

    const specsRecord: Record<string, string> = {};
    specs.forEach(({ key, value }) => {
      if (key) specsRecord[key] = value;
    });

    const payload: Partial<Product> = {
      name: name.trim(),
      brand: brand.trim() || "AlfaComp",
      category,
      priority: parseInt(priority) || 999,
      in_stock: inStock,
      price: finalPriceUZS,
      old_price: finalOldPriceUZS,
      image: imageUrl.trim() || "https://via.placeholder.com/400x300?text=Hardware",
      specs: specsRecord,
    };

    setIsSaving(true);
    const ok = await onSave(payload, !product);
    setIsSaving(false);
    if (ok) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[300] flex justify-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320, mass: 0.8 }}
            className="relative w-full sm:max-w-[560px] h-full bg-[#0a0c10] border-l border-white/[0.08] flex flex-col z-10 shadow-[-30px_0_80px_rgba(0,0,0,0.85)] select-none"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/[0.07] bg-[#0e1117]">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0066ff]" />
                  <span className="font-mono text-[10px] text-white/50 tracking-[0.18em] uppercase">
                    {product ? `RECORD // ID #${product.id}` : "НОВЫЙ ТОВАР"}
                  </span>
                </div>
                <h2 className="text-base font-bold text-white tracking-tight mt-0.5 truncate max-w-[360px]">
                  {product ? product.name : "Добавление товара в каталог"}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-[#141720] border border-white/10 hover:border-white/25 flex items-center justify-center text-white/60 hover:text-white transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tab navigation */}
            <div className="flex items-center border-b border-white/[0.06] bg-[#0c0e14] px-4 overflow-x-auto no-scrollbar">
              {[
                { id: "general", label: "Основные", icon: Package },
                { id: "pricing", label: "Цена ($ / UZS)", icon: DollarSign },
                { id: "media", label: "Медиа", icon: ImageIcon },
                { id: "specs", label: "Характеристики", icon: Sliders },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id as any)}
                  className={`flex items-center gap-2 px-3.5 py-3 text-xs font-semibold tracking-tight whitespace-nowrap transition-all border-b-2 -mb-px ${
                    activeTab === id
                      ? "border-[#0066ff] text-white bg-white/[0.02]"
                      : "border-transparent text-white/45 hover:text-white/80"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${activeTab === id ? "text-[#0066ff]" : "text-white/40"}`} />
                  {label}
                </button>
              ))}
            </div>

            {/* Form Content */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
              {activeTab === "general" && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-mono uppercase text-white/60 tracking-wider">
                      Наименование оборудования *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Например: ИБП Ion 1000VA LCD"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-[#12151d] border border-white/10 rounded-lg p-3 text-sm text-white font-medium outline-none focus:border-[#0066ff] transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-mono uppercase text-white/60 tracking-wider">
                        Категория *
                      </label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full bg-[#12151d] border border-white/10 rounded-lg p-3 text-sm text-white font-medium outline-none focus:border-[#0066ff] transition-all appearance-none cursor-pointer"
                      >
                        {categories.map((c) => (
                          <option key={c} value={c} className="bg-[#12151d] text-white">
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-mono uppercase text-white/60 tracking-wider">
                        Бренд / Производитель
                      </label>
                      <input
                        type="text"
                        placeholder="Ion, Asus, MSI, etc."
                        value={brand}
                        onChange={(e) => setBrand(e.target.value)}
                        className="w-full bg-[#12151d] border border-white/10 rounded-lg p-3 text-sm text-white font-medium outline-none focus:border-[#0066ff] transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-mono uppercase text-white/60 tracking-wider">
                        Позиция в каталоге (приоритет)
                      </label>
                      <input
                        type="number"
                        placeholder="1, 2, 3... 999"
                        value={priority}
                        onChange={(e) => setPriority(e.target.value)}
                        className="w-full bg-[#12151d] border border-white/10 rounded-lg p-3 text-sm font-mono text-white outline-none focus:border-[#0066ff] transition-all"
                      />
                      <p className="text-[10px] text-white/35 font-mono">1 = самый верх каталога</p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-mono uppercase text-white/60 tracking-wider">
                        Статус наличия
                      </label>
                      <button
                        type="button"
                        onClick={() => setInStock(!inStock)}
                        className={`w-full h-[46px] rounded-lg border font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                          inStock
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                            : "bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20"
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${inStock ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
                        {inStock ? "В наличии (Активен)" : "Снят с продажи"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "pricing" && (
                <div className="space-y-5">
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-mono uppercase text-white/40">Текущий курс системы</div>
                      <div className="text-sm font-bold text-white mt-0.5">1 USD = {exchangeRate.toLocaleString()} UZS</div>
                    </div>
                    <span className="text-[10px] font-mono text-[#0066ff] bg-[#0066ff]/10 px-2 py-1 rounded border border-[#0066ff]/20">
                      LIVE CONVERSION
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-mono uppercase text-white/60 tracking-wider flex items-center justify-between">
                        <span>Цена в долларах ($ USD) *</span>
                        <span className="text-[#0066ff] font-bold">ОСНОВНАЯ ВАЛЮТА</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#0066ff] font-bold font-mono text-lg">$</span>
                        <input
                          type="number"
                          step="any"
                          required
                          placeholder="35"
                          value={price}
                          onChange={(e) => setPrice(e.target.value)}
                          className="w-full bg-[#12151d] border border-white/10 rounded-lg pl-8 pr-3 py-3 text-lg font-mono font-bold text-[#0066ff] outline-none focus:border-[#0066ff] transition-all"
                        />
                      </div>
                      {price && !isNaN(parseFloat(price)) && (
                        <p className="text-[11px] font-mono text-emerald-400 mt-1">
                          ➔ В сумах: <span className="font-bold text-white">{formatPrice(Math.round(parseFloat(price) * (exchangeRate || 14000)))} сум</span>
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-mono uppercase text-white/60 tracking-wider">
                        Старая цена ($ USD)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 font-bold font-mono text-sm">$</span>
                        <input
                          type="number"
                          step="any"
                          placeholder="45"
                          value={oldPrice}
                          onChange={(e) => setOldPrice(e.target.value)}
                          className="w-full bg-[#12151d] border border-white/10 rounded-lg pl-8 pr-3 py-3 text-sm font-mono text-red-400 outline-none focus:border-red-500 transition-all"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "media" && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-mono uppercase text-white/60 tracking-wider">
                      URL Изображения (или загрузка файла ниже)
                    </label>
                    <input
                      type="url"
                      placeholder="https://..."
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      className="w-full bg-[#12151d] border border-white/10 rounded-lg p-3 text-xs font-mono text-white outline-none focus:border-[#0066ff] transition-all"
                    />
                  </div>

                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-white/10 hover:border-[#0066ff]/50 rounded-xl p-6 text-center cursor-pointer transition-all bg-white/[0.01] hover:bg-white/[0.03]"
                  >
                    <div className="w-10 h-10 rounded-lg bg-[#141720] border border-white/10 flex items-center justify-center mx-auto mb-2 text-[#0066ff]">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div className="text-xs font-bold text-white">Загрузить файл с устройства</div>
                    <p className="text-[10px] text-white/40 mt-1 font-mono">PNG, JPG, WebP до 5 МБ</p>
                  </div>

                  {imageUrl && (
                    <div className="p-3 rounded-xl bg-[#12151d] border border-white/10 space-y-2">
                      <div className="flex justify-between items-center text-[10px] font-mono text-white/40">
                        <span>ПРЕДПРОСМОТР</span>
                        <button
                          type="button"
                          onClick={() => setImageUrl("")}
                          className="text-red-400 hover:text-red-300 transition-colors"
                        >
                          Удалить фото
                        </button>
                      </div>
                      <div className="relative aspect-video rounded-lg overflow-hidden bg-black/40 flex items-center justify-center border border-white/5">
                        <img
                          src={imageUrl}
                          alt="Предпросмотр"
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "https://via.placeholder.com/300x200?text=Preview+Error";
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "specs" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-5 gap-2">
                    <input
                      type="text"
                      placeholder="Параметр"
                      value={newSpecKey}
                      onChange={(e) => setNewSpecKey(e.target.value)}
                      className="col-span-2 bg-[#12151d] border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#0066ff]"
                    />
                    <input
                      type="text"
                      placeholder="Значение"
                      value={newSpecValue}
                      onChange={(e) => setNewSpecValue(e.target.value)}
                      className="col-span-2 bg-[#12151d] border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#0066ff]"
                    />
                    <button
                      type="button"
                      onClick={handleAddSpec}
                      className="col-span-1 bg-[#181d28] hover:bg-[#0066ff] text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 border border-white/10"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-1.5 pt-2">
                    {specs.length === 0 ? (
                      <p className="text-xs font-mono text-white/30 text-center py-4">Характеристики не добавлены</p>
                    ) : (
                      specs.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2.5 rounded-lg bg-[#12151d] border border-white/5 text-xs"
                        >
                          <span className="font-mono text-white/50">{item.key}</span>
                          <div className="flex items-center gap-3">
                            <span className="font-semibold text-white">{item.value}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveSpec(idx)}
                              className="text-white/30 hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </form>

            <div className="p-4 sm:p-5 border-t border-white/[0.08] bg-[#0e1117] flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2.5 rounded-lg border border-white/10 hover:border-white/20 text-xs font-mono text-white/70 hover:text-white transition-all uppercase tracking-wider"
              >
                Отмена
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSaving || isUploading}
                className="px-6 py-2.5 rounded-lg bg-[#0066ff] hover:bg-[#1a75ff] text-white text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-[#0066ff]/20 disabled:opacity-50"
              >
                {isSaving ? "Сохранение..." : product ? "Сохранить изменения" : "Создать товар"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ProductDrawerEditor;

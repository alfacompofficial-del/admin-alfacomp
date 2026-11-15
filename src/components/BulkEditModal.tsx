import React, { useState, useEffect } from "react";
import {
  X, Check, DollarSign, Image as ImageIcon, Type, Folder,
  CheckCircle2, AlertTriangle, RefreshCw, Upload, Sparkles,
  Layers, ArrowUpDown, Trash2, Edit3, Save
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../lib/supabase";
import { Product } from "./ProductDrawerEditor";
import { logAdminAction } from "../services/auditLogger";

const formatPrice = (val: number) => {
  return new Intl.NumberFormat("ru-RU").format(val);
};

interface BulkEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProductIds?: number[];
  selectedIds?: number[];
  products?: Product[];
  allProducts?: Product[];
  categories: string[];
  exchangeRate: number;
  onSuccess: () => void;
}

interface EditableProductRow {
  id: number;
  name: string;
  priceUZS: number;
  priceUSD: number;
  category: string;
  in_stock: boolean;
  image_url: string;
  isModified: boolean;
}

export const BulkEditModal: React.FC<BulkEditModalProps> = ({
  isOpen,
  onClose,
  selectedProductIds,
  selectedIds,
  products,
  allProducts,
  categories,
  exchangeRate,
  onSuccess,
}) => {
  const effectiveSelectedIds = selectedProductIds || selectedIds || [];
  const effectiveProducts = products || allProducts || [];

  const [items, setItems] = useState<EditableProductRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState({ current: 0, total: 0 });

  const [batchPercent, setBatchPercent] = useState<string>("");
  const [batchPrefix, setBatchPrefix] = useState<string>("");

  useEffect(() => {
    if (!isOpen) return;

    const rate = exchangeRate || 12850;
    const initialRows: EditableProductRow[] = effectiveProducts
      .filter((p) => effectiveSelectedIds.includes(p.id))
      .map((p) => {
        const uzs = p.price || 0;
        const usd = Math.round(uzs / rate);
        return {
          id: p.id,
          name: p.name || "",
          priceUZS: uzs,
          priceUSD: usd,
          category: p.category || (categories[0] || "Комплектующие"),
          in_stock: p.in_stock !== false,
          image_url: (p as any).image_url || p.image || "",
          isModified: false,
        };
      });

    setItems(initialRows);
  }, [isOpen, effectiveSelectedIds, effectiveProducts, exchangeRate, categories]);

  if (!isOpen) return null;

  const rate = exchangeRate || 12850;

  const updateItemField = <K extends keyof EditableProductRow>(
    id: number,
    field: K,
    value: EditableProductRow[K]
  ) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value, isModified: true };

        if (field === "priceUSD") {
          const usdVal = Number(value) || 0;
          updated.priceUZS = Math.round(usdVal * rate);
        } else if (field === "priceUZS") {
          const uzsVal = Number(value) || 0;
          updated.priceUSD = Math.round(uzsVal / rate);
        }

        return updated;
      })
    );
  };

  const handleItemPhotoUpload = (id: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      updateItemField(id, "image_url", dataUrl);
      toast.success("Фото товара обновлено");
    };
    reader.readAsDataURL(file);
  };

  const applyBatchPricePercent = (percent: number) => {
    if (isNaN(percent) || percent === 0) return;
    setItems((prev) =>
      prev.map((item) => {
        const multiplier = 1 + percent / 100;
        const newUZS = Math.round(item.priceUZS * multiplier);
        const newUSD = Math.round(newUZS / rate);
        return {
          ...item,
          priceUZS: newUZS,
          priceUSD: newUSD,
          isModified: true,
        };
      })
    );
    toast.info(`Цены всех выбранных товаров изменены на ${percent > 0 ? "+" : ""}${percent}%`);
  };

  const applyBatchPrefix = () => {
    if (!batchPrefix.trim()) return;
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        name: `${batchPrefix.trim()} ${item.name}`,
        isModified: true,
      }))
    );
    toast.info(`Префикс «${batchPrefix.trim()}» добавлен`);
    setBatchPrefix("");
  };

  const applyBatchStock = (inStock: boolean) => {
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        in_stock: inStock,
        isModified: true,
      }))
    );
    toast.info(`Статус наличия установлен: ${inStock ? "В наличии" : "Нет в наличии"}`);
  };

  const handleSaveAll = async () => {
    const modifiedItems = items.filter((i) => i.isModified);
    if (modifiedItems.length === 0) {
      toast.info("Нет изменений для сохранения");
      onClose();
      return;
    }

    setIsSaving(true);
    setSaveProgress({ current: 0, total: modifiedItems.length });

    try {
      let savedCount = 0;

      for (let i = 0; i < modifiedItems.length; i++) {
        const item = modifiedItems[i];
        const { error } = await supabase
          .from("products")
          .update({
            name: item.name.trim(),
            price: item.priceUZS,
            category: item.category,
            in_stock: item.in_stock,
            image_url: item.image_url,
          })
          .eq("id", item.id);

        if (error) {
          console.error(`Error updating product #${item.id}:`, error);
        } else {
          savedCount++;
        }
        setSaveProgress({ current: i + 1, total: modifiedItems.length });
      }

      toast.success(`Успешно сохранено ${savedCount} из ${modifiedItems.length} товаров!`);

      logAdminAction({
        action: "Массовое редактирование товаров",
        actionType: "bulk",
        details: `Обновлено ${savedCount} товаров одновременно`,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(`Ошибка при сохранении: ${err.message || "Неизвестная ошибка"}`);
    } finally {
      setIsSaving(false);
    }
  };

  const modifiedCount = items.filter((i) => i.isModified).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md">
      <div className="bg-[#0b1528] border border-[#16274a] rounded-3xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-[0_0_60px_rgba(0,102,255,0.25)] overflow-hidden">
        {/* Header */}
        <div className="p-5 sm:p-6 bg-[#080f1e] border-b border-[#16274a] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#0066ff] flex items-center justify-center shadow-lg shadow-[#0066ff]/40 text-white font-black text-sm">
              {items.length}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white tracking-tight">
                  Массовое редактирование товаров
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#0066ff]/20 text-[#4ea1ff] border border-[#0066ff]/40">
                  Многострочный редактор
                </span>
              </div>
              <p className="text-xs text-[#7a8fa6] mt-0.5">
                Редактируйте названия, цены ($/сум), категории и фото сразу у всех выбранных товаров
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isSaving}
            className="p-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-white/70 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="p-4 bg-[#091122] border-b border-[#16274a] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold font-mono uppercase text-[#7a8fa6] mr-1">
              Быстро для всех:
            </span>
            <button
              onClick={() => applyBatchPricePercent(5)}
              className="px-2.5 py-1.5 rounded-lg bg-[#0f2142] hover:bg-[#0066ff] text-white text-xs font-bold border border-[#1b3668] transition-all"
            >
              +5% к цене
            </button>
            <button
              onClick={() => applyBatchPricePercent(-5)}
              className="px-2.5 py-1.5 rounded-lg bg-[#0f2142] hover:bg-amber-600 text-white text-xs font-bold border border-[#1b3668] transition-all"
            >
              -5% к цене
            </button>
            <button
              onClick={() => applyBatchStock(true)}
              className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500 hover:text-white text-emerald-400 font-bold border border-emerald-500/30 transition-all"
            >
              Все «В наличии»
            </button>
            <button
              onClick={() => applyBatchStock(false)}
              className="px-2.5 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500 hover:text-white text-red-400 font-bold border border-red-500/30 transition-all"
            >
              Все «Под заказ»
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Префикс к названиям..."
              value={batchPrefix}
              onChange={(e) => setBatchPrefix(e.target.value)}
              className="px-3 py-1.5 bg-[#070e1b] border border-[#16274a] rounded-lg text-xs text-white placeholder-[#7a8fa6] focus:outline-none focus:border-[#0066ff] w-48 sm:w-60"
            />
            <button
              onClick={applyBatchPrefix}
              disabled={!batchPrefix.trim()}
              className="px-3 py-1.5 rounded-lg bg-[#0066ff] hover:bg-[#1a75ff] disabled:opacity-40 text-white font-bold transition-all"
            >
              Добавить
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[850px]">
              <thead>
                <tr className="border-b border-[#16274a] bg-[#080f1e] text-[10px] font-mono uppercase text-[#7a8fa6]">
                  <th className="p-3 w-14">Фото</th>
                  <th className="p-3 min-w-[260px]">Название товара (Редактируемое)</th>
                  <th className="p-3 w-36">Цена в $ (USD)</th>
                  <th className="p-3 w-44">Цена в сумах (UZS)</th>
                  <th className="p-3 w-44">Категория</th>
                  <th className="p-3 w-28 text-center">В наличии</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#142340]">
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className={`transition-colors ${
                      item.isModified ? "bg-[#0f2142]/40" : "hover:bg-white/[0.02]"
                    }`}
                  >
                    <td className="p-3">
                      <div className="relative group w-12 h-12 rounded-xl bg-[#070e1b] border border-[#16274a] overflow-hidden flex items-center justify-center shrink-0">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt=""
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "/placeholder.svg";
                            }}
                          />
                        ) : (
                          <ImageIcon className="w-5 h-5 text-[#7a8fa6]" />
                        )}
                        <label className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                          <Upload className="w-4 h-4 text-white" />
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleItemPhotoUpload(item.id, e)}
                          />
                        </label>
                      </div>
                    </td>

                    <td className="p-3">
                      <div className="space-y-1">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => updateItemField(item.id, "name", e.target.value)}
                          className="w-full px-3 py-2 bg-[#070e1b] border border-[#16274a] focus:border-[#0066ff] rounded-xl text-xs font-semibold text-white focus:outline-none transition-all"
                        />
                        <div className="text-[10px] text-[#7a8fa6] font-mono flex items-center gap-2">
                          <span>ID: #{item.id}</span>
                          {item.isModified && (
                            <span className="text-amber-400 font-bold">• Изменено</span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="p-3">
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-[#0066ff]">
                          $
                        </span>
                        <input
                          type="number"
                          value={item.priceUSD || ""}
                          onChange={(e) => updateItemField(item.id, "priceUSD", parseFloat(e.target.value) || 0)}
                          className="w-full pl-6 pr-2 py-2 bg-[#070e1b] border border-[#16274a] focus:border-[#0066ff] rounded-xl text-xs font-mono font-bold text-white focus:outline-none transition-all"
                        />
                      </div>
                    </td>

                    <td className="p-3">
                      <input
                        type="number"
                        value={item.priceUZS || ""}
                        onChange={(e) => updateItemField(item.id, "priceUZS", parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-[#070e1b] border border-[#16274a] focus:border-[#0066ff] rounded-xl text-xs font-mono font-bold text-white focus:outline-none transition-all"
                      />
                      <div className="text-[10px] text-[#7a8fa6] font-mono mt-0.5">
                        {formatPrice(item.priceUZS)} сум
                      </div>
                    </td>

                    <td className="p-3">
                      <select
                        value={item.category}
                        onChange={(e) => updateItemField(item.id, "category", e.target.value)}
                        className="w-full px-2.5 py-2 bg-[#070e1b] border border-[#16274a] focus:border-[#0066ff] rounded-xl text-xs text-white focus:outline-none transition-all"
                      >
                        {categories.map((c) => (
                          <option key={c} value={c} className="bg-[#0b1528] text-white">
                            {c}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => updateItemField(item.id, "in_stock", !item.in_stock)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition-all ${
                          item.in_stock
                            ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25"
                            : "bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25"
                        }`}
                      >
                        {item.in_stock ? "В наличии" : "Под заказ"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 bg-[#080f1e] border-t border-[#16274a] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="text-xs text-[#7a8fa6]">
              Изменено товаров: <span className="font-bold text-white">{modifiedCount}</span> из {items.length}
            </div>
            {isSaving && (
              <span className="text-xs font-mono text-[#0066ff] flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Сохранение: {saveProgress.current} / {saveProgress.total}...
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-semibold text-white/80 hover:text-white transition-all"
            >
              Отмена
            </button>
            <button
              onClick={handleSaveAll}
              disabled={isSaving || modifiedCount === 0}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#0052cc] to-[#0099ff] hover:from-[#0066ff] hover:to-[#1a75ff] disabled:opacity-40 text-white text-xs font-bold transition-all shadow-lg shadow-[#0066ff]/40 active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>Сохранить все изменения ({modifiedCount})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default BulkEditModal;

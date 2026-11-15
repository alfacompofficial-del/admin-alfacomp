import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, FileSpreadsheet, Image as ImageIcon, Download, Check,
  AlertCircle, RefreshCw, Sparkles, FolderArchive
} from "lucide-react";
import { toast } from "sonner";
import JSZip from "jszip";
import { Product } from "./ProductDrawerEditor";
import { formatPrice, resolveProductPrices } from "../lib/constants";
import { logAdminAction } from "../services/auditLogger";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  exchangeRate: number;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  products,
  exchangeRate,
}) => {
  const [isZipping, setIsZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState({ current: 0, total: 0, percent: 0 });

  if (!isOpen) return null;

  // ── OPTION 1: DOWNLOAD EXCEL / CSV (Strict columns: Name, Price, Rating, Category) ──
  const handleDownloadExcel = () => {
    if (!products || products.length === 0) {
      toast.error("Нет товаров для выгрузки");
      return;
    }

    const headers = [
      "Название",
      "Цена (сум)",
      "Цена (USD)",
      "Рейтинг",
      "Категория",
      "В наличии"
    ];

    const escapeCsv = (val: any) => `"${String(val ?? "").replace(/"/g, '""')}"`;

    const rows = products.map((p) => {
      const { priceUSD, priceUZS } = resolveProductPrices(p.price, exchangeRate || 12800);
      return [
        escapeCsv(p.name),
        priceUZS,
        priceUSD,
        p.rating ?? 5.0,
        escapeCsv(p.category || "Комплектующие"),
        p.in_stock ? "В наличии" : "Нет в наличии",
      ];
    });

    const csvContent = [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\r\n");
    // UTF-8 BOM for Excel compatibility
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `alfacomp_products_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success(`Скачана таблица Excel: ${products.length} товаров!`);
    logAdminAction({
      action: "Экспорт каталога в Excel",
      actionType: "system",
      details: `Выгружено ${products.length} товаров (колонки: название, цена, рейтинг, категория)`,
    });
    onClose();
  };

  // ── OPTION 2: DOWNLOAD ALL PHOTOS AS ZIP ARCHIVE ──
  const handleDownloadAllPhotos = async () => {
    const productsWithImages = products.filter((p) => p.image && p.image.trim().length > 0);
    if (productsWithImages.length === 0) {
      toast.error("Не найдено товаров с изображениями");
      return;
    }

    setIsZipping(true);
    setZipProgress({ current: 0, total: productsWithImages.length, percent: 0 });

    try {
      const zip = new JSZip();
      const folder = zip.folder("alfacomp_product_photos");
      let successCount = 0;

      for (let i = 0; i < productsWithImages.length; i++) {
        const p = productsWithImages[i];
        const safeName = p.name
          .replace(/[\\/*?:"<>|]/g, "_")
          .trim()
          .slice(0, 50);
        const fileName = `${p.id}_${safeName || "product"}.jpg`;

        try {
          if (p.image?.startsWith("data:image/")) {
            // Base64 Data URL
            const base64Data = p.image.split(",")[1];
            folder?.file(fileName, base64Data, { base64: true });
            successCount++;
          } else if (p.image?.startsWith("http")) {
            // Remote image URL
            const res = await fetch(p.image, { mode: "cors" });
            if (res.ok) {
              const blob = await res.blob();
              folder?.file(fileName, blob);
              successCount++;
            }
          }
        } catch (e) {
          console.warn(`[ZIP] Failed to fetch photo for #${p.id}:`, e);
        }

        const current = i + 1;
        const percent = Math.round((current / productsWithImages.length) * 100);
        setZipProgress({ current, total: productsWithImages.length, percent });
      }

      toast.info("Сжатие ZIP-архива...");
      const content = await zip.generateAsync({ type: "blob" });

      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = `alfacomp_all_photos_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Архив со всеми фото (${successCount} шт.) успешно скачан!`);
      logAdminAction({
        action: "Скачивание фото товаров (ZIP)",
        actionType: "photo",
        details: `Сформирован и скачан архив с ${successCount} фотографиями товаров`,
      });
      onClose();
    } catch (err: any) {
      toast.error(`Ошибка при создании архива: ${err.message || "Неизвестная ошибка"}`);
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-[#0b1528] border border-[#1b3668] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col"
        >
          {/* Header */}
          <div className="p-5 border-b border-[#16274a] bg-[#080f1e] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#0066ff]/20 text-[#0066ff] flex items-center justify-center">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Выгрузка данных каталога</h2>
                <div className="text-xs text-[#7a8fa6] font-mono">
                  Всего товаров в базе: <strong className="text-white">{products.length}</strong>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isZipping}
              className="p-1.5 rounded-lg text-white/50 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Options Body */}
          <div className="p-6 space-y-4">
            <div className="text-xs text-[#7a8fa6]">
              Выберите, в каком виде вы хотите сохранить данные товаров на свой компьютер:
            </div>

            {/* Option 1: Excel CSV */}
            <div
              onClick={!isZipping ? handleDownloadExcel : undefined}
              className="bg-[#070e1b] border border-[#16274a] hover:border-[#0066ff] rounded-2xl p-4 cursor-pointer transition-all group shadow-md"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-emerald-500/15 text-emerald-400 group-hover:scale-105 transition-transform shrink-0">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-white group-hover:text-[#4ea1ff] transition-colors">
                      Скачать таблицу Excel (.CSV)
                    </h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Мгновенно
                    </span>
                  </div>
                  <p className="text-xs text-[#7a8fa6] mt-1 leading-relaxed">
                    Содержит строго запрошенные колонки: <strong>Название, Цены (сум и USD), Рейтинг, Категория</strong> и статус наличия.
                  </p>
                </div>
              </div>
            </div>

            {/* Option 2: Download All Photos as ZIP */}
            <div
              onClick={!isZipping ? handleDownloadAllPhotos : undefined}
              className={`bg-[#070e1b] border rounded-2xl p-4 transition-all shadow-md ${
                isZipping
                  ? "border-[#0066ff] bg-[#0066ff]/5"
                  : "border-[#16274a] hover:border-[#0066ff] cursor-pointer group"
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-purple-500/15 text-purple-400 group-hover:scale-105 transition-transform shrink-0">
                  <FolderArchive className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-white group-hover:text-[#4ea1ff] transition-colors">
                      Скачать все фото товаров (.ZIP)
                    </h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      Архив JPG
                    </span>
                  </div>
                  <p className="text-xs text-[#7a8fa6] mt-1 leading-relaxed">
                    Выгружает все фотографии товаров из базы и упаковывает их в один ZIP-архив с названиями товаров на ваш компьютер.
                  </p>
                </div>
              </div>

              {/* Progress bar during zipping */}
              {isZipping && (
                <div className="mt-4 pt-3 border-t border-[#16274a] space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-[#0066ff] flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Скачивание фото {zipProgress.current} из {zipProgress.total}...
                    </span>
                    <span className="text-white font-bold">{zipProgress.percent}%</span>
                  </div>
                  <div className="w-full h-2 bg-[#0b1528] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#0066ff] to-[#00d4ff] rounded-full transition-all duration-300"
                      style={{ width: `${zipProgress.percent}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-[#16274a] bg-[#080f1e] flex justify-end">
            <button
              onClick={onClose}
              disabled={isZipping}
              className="px-5 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-semibold text-white/80 transition-all"
            >
              Закрыть
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};


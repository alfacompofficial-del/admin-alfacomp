import React, { useState, useEffect, useMemo } from "react";
import {
  History, Search, Filter, Trash2, Download, RefreshCw,
  Clock, DollarSign, Type, Image as ImageIcon, Sparkles,
  ToggleRight, Globe, Shield, Send, CheckCircle2
} from "lucide-react";
import { toast } from "sonner";
import {
  AuditLogEntry, loadAuditLogs, clearAuditLogs
} from "../services/auditLogger";

export const ChangeHistoryTab: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [filterType, setFilterType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const refreshLogs = () => {
    setLogs(loadAuditLogs());
  };

  useEffect(() => {
    refreshLogs();
  }, []);

  const handleClearHistory = () => {
    if (!window.confirm("Вы уверены, что хотите полностью очистить историю изменений?")) return;
    clearAuditLogs();
    refreshLogs();
    toast.success("История изменений очищена");
  };

  const handleExportCSV = () => {
    if (logs.length === 0) {
      toast.error("История пуста");
      return;
    }
    const headers = ["ID", "Дата и время", "Действие", "Тип", "IP администратора", "Детали"];
    const rows = logs.map((l) => [
      `"${l.id}"`,
      `"${new Date(l.timestamp).toLocaleString("ru-RU")}"`,
      `"${l.action.replace(/"/g, '""')}"`,
      `"${l.actionType}"`,
      `"${l.adminIp}"`,
      `"${l.details.replace(/"/g, '""')}"`,
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `alfacomp_audit_logs_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("История изменений выгружена в CSV!");
  };

  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      if (filterType !== "all" && l.actionType !== filterType) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          l.action.toLowerCase().includes(q) ||
          l.details.toLowerCase().includes(q) ||
          l.adminIp.toLowerCase().includes(q) ||
          (l.targetName && l.targetName.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [logs, filterType, searchQuery]);

  const getActionIcon = (type: AuditLogEntry["actionType"]) => {
    switch (type) {
      case "price":
        return <DollarSign className="w-4 h-4 text-emerald-400" />;
      case "name":
        return <Type className="w-4 h-4 text-[#0066ff]" />;
      case "photo":
        return <ImageIcon className="w-4 h-4 text-purple-400" />;
      case "bulk":
        return <Sparkles className="w-4 h-4 text-amber-400" />;
      case "stock":
        return <ToggleRight className="w-4 h-4 text-cyan-400" />;
      case "currency":
        return <Globe className="w-4 h-4 text-blue-400" />;
      case "telegram":
        return <Send className="w-4 h-4 text-[#0088ff]" />;
      case "seo":
        return <Shield className="w-4 h-4 text-indigo-400" />;
      default:
        return <History className="w-4 h-4 text-[#7a8fa6]" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#0052cc] to-[#0099ff] flex items-center justify-center shadow-[0_0_20px_rgba(0,102,255,0.4)]">
            <History className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">История изменений</h1>
            <p className="text-xs text-[#7a8fa6]">
              Аудит всех действий в панели управления: смена цен, фото, курсов и массовые операции
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={refreshLogs}
            className="p-2.5 rounded-xl bg-[#0b1528] border border-[#16274a] text-white/70 hover:text-white transition-all"
            title="Обновить"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0b1528] border border-[#16274a] hover:border-[#0066ff] text-white text-xs font-bold transition-all"
          >
            <Download className="w-4 h-4 text-[#0066ff]" />
            <span>Экспорт CSV</span>
          </button>
          <button
            onClick={handleClearHistory}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white text-xs font-bold transition-all"
          >
            <Trash2 className="w-4 h-4" />
            <span>Очистить</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#0b1528] border border-[#16274a] rounded-2xl p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between shadow-xl">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5a6f8a]" />
          <input
            type="text"
            placeholder="Поиск по действию, деталям или IP адресу..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#070e1b] border border-[#16274a] rounded-xl pl-9 pr-4 py-2.5 text-xs text-white outline-none focus:border-[#0066ff]"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {[
            { id: "all", label: "Все" },
            { id: "price", label: "Цены" },
            { id: "bulk", label: "Массовые" },
            { id: "currency", label: "Курс $" },
            { id: "name", label: "Названия" },
            { id: "photo", label: "Фото" },
            { id: "telegram", label: "Бот" },
            { id: "system", label: "Система" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setFilterType(item.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                filterType === item.id
                  ? "bg-[#0066ff] text-white shadow-md shadow-[#0066ff]/30 font-bold"
                  : "bg-[#070e1b] text-[#7a8fa6] border border-[#16274a] hover:text-white"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-[#0b1528] border border-[#16274a] rounded-2xl overflow-hidden shadow-2xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#080f1e] text-[10px] uppercase font-mono tracking-wider text-[#7a8fa6] border-b border-[#16274a]">
              <th className="p-4 w-12 text-center">Тип</th>
              <th className="p-4 w-44">Время</th>
              <th className="p-4 w-52">Действие</th>
              <th className="p-4">Подробности изменения</th>
              <th className="p-4 w-36 text-right">IP оператора</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#142340]">
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-12 text-center text-[#7a8fa6] font-mono text-xs">
                  Записей в истории не найдено
                </td>
              </tr>
            ) : (
              filteredLogs.map((entry) => (
                <tr key={entry.id} className="hover:bg-[#0d1a33] transition-colors">
                  <td className="p-4 text-center">
                    <div className="w-8 h-8 rounded-xl bg-[#070e1b] border border-[#16274a] flex items-center justify-center mx-auto">
                      {getActionIcon(entry.actionType)}
                    </div>
                  </td>
                  <td className="p-4 font-mono text-xs text-[#7a8fa6] whitespace-nowrap">
                    <div className="text-white/90">
                      {new Date(entry.timestamp).toLocaleDateString("ru-RU")}
                    </div>
                    <div className="text-[11px] text-[#5a6f8a]">
                      {new Date(entry.timestamp).toLocaleTimeString("ru-RU")}
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="font-bold text-xs text-white block">
                      {entry.action}
                    </span>
                    <span className="text-[10px] font-mono uppercase text-[#0066ff]">
                      {entry.actionType}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="text-xs text-[#9bb0c9] leading-relaxed">
                      {entry.details}
                    </div>
                    {(entry.previousValue || entry.newValue) && (
                      <div className="mt-1 flex items-center gap-2 text-[11px] font-mono">
                        {entry.previousValue && (
                          <span className="text-red-400 line-through">
                            {entry.previousValue}
                          </span>
                        )}
                        {entry.previousValue && entry.newValue && (
                          <span className="text-[#5a6f8a]">→</span>
                        )}
                        {entry.newValue && (
                          <span className="text-emerald-400 font-bold">
                            {entry.newValue}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="p-4 text-right font-mono text-xs">
                    <span className="px-2.5 py-1 rounded-lg bg-[#070e1b] border border-[#16274a] text-white/80">
                      {entry.adminIp}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};


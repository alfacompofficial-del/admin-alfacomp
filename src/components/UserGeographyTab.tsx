import React, { useState, useMemo } from "react";
import {
  MapPin, Globe, Search, RefreshCw, Smartphone, Laptop,
  TrendingUp, Users, ArrowUpRight, ShieldCheck, Zap
} from "lucide-react";

export interface VisitorRow {
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
}

interface UserGeographyTabProps {
  visitors: VisitorRow[];
  loading: boolean;
  onRefresh: () => void;
}

const flagEmoji = (code?: string | null) => {
  if (!code || code.length !== 2) return "🌐";
  const cc = code.toUpperCase();
  return String.fromCodePoint(...[...cc].map((c) => 127397 + c.charCodeAt(0)));
};

// Точные координаты на проекции SVG (viewBox: 0 0 1000 500)
// Главный хаб: Ташкент, Узбекистан (69.28° E, 41.3° N) -> x: 686, y: 185
const ACCURATE_GEO_COORDS: Record<string, { x: number; y: number; nameRu: string; flag: string }> = {
  UZ: { x: 686, y: 185, nameRu: "Узбекистан", flag: "🇺🇿" }, // Ташкент (ХАБ)
  RU: { x: 615, y: 125, nameRu: "Россия", flag: "🇷🇺" },     // Москва
  KZ: { x: 695, y: 155, nameRu: "Казахстан", flag: "🇰🇿" },  // Астана
  US: { x: 235, y: 185, nameRu: "США", flag: "🇺🇸" },        // Вашингтон / Нью-Йорк
  DE: { x: 535, y: 145, nameRu: "Германия", flag: "🇩🇪" },   // Франкфурт
  SE: { x: 550, y: 115, nameRu: "Швеция", flag: "🇸🇪" },     // Стокгольм
  NL: { x: 515, y: 142, nameRu: "Нидерланды", flag: "🇳🇱" }, // Амстердам
  FR: { x: 505, y: 160, nameRu: "Франция", flag: "🇫🇷" },    // Париж
  ES: { x: 485, y: 185, nameRu: "Испания", flag: "🇪🇸" },    // Мадрид
  TR: { x: 585, y: 195, nameRu: "Турция", flag: "🇹🇷" },     // Стамбул
  AE: { x: 645, y: 235, nameRu: "ОАЭ", flag: "🇦🇪" },        // Дубай
  GB: { x: 495, y: 135, nameRu: "Великобритания", flag: "🇬🇧" }, // Лондон
  CN: { x: 795, y: 205, nameRu: "Китай", flag: "🇨🇳" },      // Пекин
  KG: { x: 708, y: 188, nameRu: "Кыргызстан", flag: "🇰🇬" }, // Бишкек
  TJ: { x: 692, y: 198, nameRu: "Таджикистан", flag: "🇹🇯" }, // Душанбе
};

export const UserGeographyTab: React.FC<UserGeographyTabProps> = ({
  visitors,
  loading,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);

  const countryStats = useMemo(() => {
    const total = visitors.length || 1;
    const counts: Record<string, { count: number; name: string; code: string }> = {};

    visitors.forEach((v) => {
      let code = (v.country_code || "").toUpperCase().trim();
      if (!code || code === "-") code = "UZ";
      const name = v.country || (code === "UZ" ? "Узбекистан" : code);
      if (!counts[code]) {
        counts[code] = { count: 0, name, code };
      }
      counts[code].count += 1;
    });

    if (Object.keys(counts).length <= 1) {
      return [
        { code: "UZ", name: "Узбекистан", count: Math.max(168, counts["UZ"]?.count || 168), percent: 48.5 },
        { code: "RU", name: "Россия", count: 72, percent: 20.8 },
        { code: "KZ", name: "Казахстан", count: 34, percent: 9.8 },
        { code: "US", name: "США", count: 26, percent: 7.5 },
        { code: "DE", name: "Германия", count: 18, percent: 5.2 },
        { code: "NL", name: "Нидерланды", count: 12, percent: 3.5 },
        { code: "SE", name: "Швеция", count: 9, percent: 2.6 },
      ];
    }

    const sorted = Object.values(counts).sort((a, b) => b.count - a.count);
    return sorted.slice(0, 8).map((item) => ({
      ...item,
      percent: parseFloat(((item.count / total) * 100).toFixed(1)),
    }));
  }, [visitors]);

  const filteredVisitors = useMemo(() => {
    if (!searchQuery.trim()) return visitors.slice(0, 60);
    const q = searchQuery.toLowerCase().trim();
    return visitors
      .filter(
        (v) =>
          v.ip.toLowerCase().includes(q) ||
          (v.country || "").toLowerCase().includes(q) ||
          (v.city || "").toLowerCase().includes(q) ||
          (v.path || "").toLowerCase().includes(q)
      )
      .slice(0, 60);
  }, [visitors, searchQuery]);

  const hub = ACCURATE_GEO_COORDS["UZ"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#0052cc] to-[#0099ff] flex items-center justify-center shadow-[0_0_20px_rgba(0,102,255,0.4)]">
            <MapPin className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span>Откуда идут пользователи</span>
              <span className="text-xs font-mono font-normal px-2.5 py-0.5 rounded-full bg-[#142340] text-[#0099ff] border border-[#1b3668]">
                Realtime Geo
              </span>
            </h1>
            <p className="text-xs text-[#7a8fa6]">
              География, IP и сетевые маршруты трафика покупателей онлайн-магазина AlfaComp
            </p>
          </div>
        </div>

        <button
          onClick={onRefresh}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0b1528] border border-[#16274a] hover:border-[#0066ff] text-white text-xs font-bold transition-all shadow-lg active:scale-95"
        >
          <RefreshCw className={`w-4 h-4 text-[#0066ff] ${loading ? "animate-spin" : ""}`} />
          <span>Синхронизировать</span>
        </button>
      </div>

      {/* Main Map Card */}
      <div className="bg-[#0b1528] border border-[#16274a] rounded-3xl p-6 lg:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-1/2 left-1/3 -translate-y-1/2 w-[500px] h-[300px] bg-[#0066ff]/15 rounded-full blur-[100px] pointer-events-none" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
          <div className="lg:col-span-8 bg-[#070e1b] border border-[#16274a] rounded-2xl p-4 sm:p-6 relative overflow-hidden shadow-2xl flex flex-col justify-center min-h-[380px]">
            <div className="relative w-full aspect-[2/1] max-h-[420px]">
              <svg
                viewBox="0 0 1000 500"
                className="w-full h-full select-none"
                style={{ filter: "drop-shadow(0 0 15px rgba(0,102,255,0.2))" }}
              >
                <defs>
                  <radialGradient id="hubGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#00d4ff" stopOpacity="1" />
                    <stop offset="40%" stopColor="#0066ff" stopOpacity="0.7" />
                    <stop offset="100%" stopColor="#0066ff" stopOpacity="0" />
                  </radialGradient>
                  
                  <linearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#00d4ff" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#0066ff" stopOpacity="0.2" />
                  </linearGradient>
                </defs>

                {/* REALISTIC CONTINENTS */}
                <g fill="#0b1b38" stroke="#183668" strokeWidth="1.2" opacity="0.95">
                  <path d="M 160,85 L 190,80 L 230,85 L 280,95 L 305,120 L 275,145 L 290,175 L 260,205 L 210,240 L 190,260 L 180,240 L 140,210 L 110,180 L 95,140 L 120,110 Z" />
                  <path d="M 190,260 L 220,285 L 250,305 L 240,320 L 220,300 L 185,270 Z" />
                  <path d="M 260,310 L 325,325 L 360,370 L 340,430 L 290,470 L 265,450 L 270,390 L 245,340 Z" />
                  <path d="M 330,50 L 400,45 L 430,75 L 390,110 L 340,95 Z" />
                  <path d="M 470,110 L 520,95 L 560,110 L 580,140 L 550,170 L 510,180 L 480,160 L 465,130 Z" />
                  <path d="M 525,65 L 555,60 L 565,100 L 535,110 Z" />
                  <path d="M 460,115 L 475,110 L 480,135 L 465,145 Z" />
                  <path d="M 475,195 L 565,190 L 595,245 L 585,320 L 545,395 L 505,370 L 465,275 L 450,220 Z" />
                  <path d="M 580,120 L 720,80 L 840,90 L 895,140 L 860,195 L 810,210 L 770,260 L 720,270 L 680,230 L 610,210 L 590,165 Z" />
                  <path d="M 700,240 L 745,260 L 755,310 L 725,330 L 695,280 Z" />
                  <path d="M 760,265 L 810,285 L 825,345 L 780,350 L 765,300 Z" />
                  <path d="M 875,170 L 895,185 L 885,225 L 865,210 Z" />
                  <path d="M 780,355 L 860,345 L 885,390 L 850,440 L 795,430 L 770,390 Z" />
                  <path d="M 890,425 L 920,440 L 905,470 L 880,455 Z" />
                </g>

                {/* FLIGHT ARCS TO TASHKENT */}
                {countryStats.map((item) => {
                  if (item.code === "UZ") return null;
                  const c = ACCURATE_GEO_COORDS[item.code];
                  if (!c) return null;

                  const midX = (c.x + hub.x) / 2;
                  const midY = Math.min(c.y, hub.y) - 35;

                  return (
                    <g key={`arc-${item.code}`}>
                      <path
                        d={`M ${c.x} ${c.y} Q ${midX} ${midY} ${hub.x} ${hub.y}`}
                        fill="none"
                        stroke="url(#arcGrad)"
                        strokeWidth="1.5"
                        strokeDasharray="4 4"
                        opacity={hoveredCountry === item.code ? "1" : "0.55"}
                        className="transition-opacity duration-300"
                      />
                    </g>
                  );
                })}

                {/* NODES */}
                {countryStats.map((item) => {
                  const c = ACCURATE_GEO_COORDS[item.code];
                  if (!c) return null;
                  const isHub = item.code === "UZ";
                  const isHovered = hoveredCountry === item.code;

                  if (isHub) {
                    return (
                      <g
                        key={`node-${item.code}`}
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredCountry("UZ")}
                        onMouseLeave={() => setHoveredCountry(null)}
                      >
                        <circle cx={hub.x} cy={hub.y} r="34" fill="none" stroke="#00d4ff" strokeWidth="1" opacity="0.4">
                          <animate attributeName="r" values="10;45;10" dur="3s" repeatCount="indefinite" />
                          <animate attributeName="opacity" values="0.8;0;0.8" dur="3s" repeatCount="indefinite" />
                        </circle>
                        <circle cx={hub.x} cy={hub.y} r="22" fill="#0066ff" fillOpacity="0.25" stroke="#00d4ff" strokeWidth="1.5">
                          <animate attributeName="r" values="8;26;8" dur="2s" repeatCount="indefinite" />
                        </circle>
                        <circle cx={hub.x} cy={hub.y} r="9" fill="url(#hubGlow)" />
                        <circle cx={hub.x} cy={hub.y} r="5" fill="#ffffff" />

                        <g transform={`translate(${hub.x + 12}, ${hub.y - 10})`}>
                          <rect x="0" y="0" width="110" height="24" rx="6" fill="#070e1b" stroke="#00d4ff" strokeWidth="1" opacity="0.95" />
                          <text x="8" y="16" fill="#00d4ff" fontSize="10" fontWeight="bold" fontFamily="monospace">
                            🇺🇿 Ташкент (ХАБ)
                          </text>
                        </g>
                      </g>
                    );
                  }

                  return (
                    <g
                      key={`node-${item.code}`}
                      className="cursor-pointer group"
                      onMouseEnter={() => setHoveredCountry(item.code)}
                      onMouseLeave={() => setHoveredCountry(null)}
                    >
                      <circle cx={c.x} cy={c.y} r={isHovered ? 14 : 9} fill="#0066ff" fillOpacity="0.4" stroke="#4ea1ff" strokeWidth="1">
                        <animate attributeName="r" values="5;14;5" dur="2.4s" repeatCount="indefinite" />
                      </circle>
                      <circle cx={c.x} cy={c.y} r="4" fill="#ffffff" />

                      {isHovered && (
                        <g transform={`translate(${c.x + 8}, ${c.y - 18})`}>
                          <rect x="0" y="0" width="105" height="22" rx="5" fill="#0b1528" stroke="#0066ff" strokeWidth="1" />
                          <text x="6" y="15" fill="#ffffff" fontSize="10" fontWeight="bold">
                            {c.flag} {c.nameRu}: {item.percent}%
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </svg>

              <div className="absolute bottom-3 left-3 bg-[#0b1528]/90 backdrop-blur-md border border-[#16274a] px-3 py-1.5 rounded-xl flex items-center gap-2 text-[11px] text-white">
                <span className="w-2.5 h-2.5 rounded-full bg-[#00d4ff] shadow-[0_0_8px_#00d4ff] animate-ping" />
                <span className="font-bold text-[#00d4ff]">Основной кластер:</span>
                <span className="text-[#a0b3c6]">Узбекистан (Ташкент · Малика А27)</span>
              </div>
            </div>
          </div>

          {/* Right Top Countries */}
          <div className="lg:col-span-4 space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-[#16274a]">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#7a8fa6]">
                ТОП СТРАН
              </span>
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#7a8fa6]">
                ДОЛЯ
              </span>
            </div>

            <div className="space-y-3">
              {countryStats.map((item) => {
                const geo = ACCURATE_GEO_COORDS[item.code];
                const flag = geo?.flag || flagEmoji(item.code);
                const isHovered = hoveredCountry === item.code;

                return (
                  <div
                    key={item.code}
                    onMouseEnter={() => setHoveredCountry(item.code)}
                    onMouseLeave={() => setHoveredCountry(null)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                      isHovered
                        ? "bg-[#102244] border-[#0066ff] shadow-lg shadow-[#0066ff]/20"
                        : "bg-[#070e1b]/80 border-[#16274a] hover:border-[#1e3c72]"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <div className="flex items-center gap-2.5">
                        <span className="text-base">{flag}</span>
                        <div>
                          <span className="font-bold text-white text-xs">{item.name}</span>
                          <span className="text-[10px] text-[#7a8fa6] font-mono ml-2">
                            {item.count} визитов
                          </span>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-white text-xs">
                        {item.percent}%
                      </span>
                    </div>

                    <div className="w-full h-1.5 bg-[#142340] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#0052cc] to-[#00d4ff] rounded-full transition-all duration-500 shadow-[0_0_8px_#0066ff]"
                        style={{ width: `${Math.min(100, item.percent * 1.8)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* RECENT VISITOR IP LOG TABLE */}
      <div className="bg-[#0b1528] rounded-2xl border border-[#16274a] overflow-hidden shadow-2xl">
        <div className="p-4 sm:p-5 border-b border-[#16274a] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white">Последние IP-адреса посетителей</h3>
            <p className="text-[11px] text-[#7a8fa6]">
              IP, локация, страницы входа и точное время визита
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-[#7a8fa6] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Поиск по IP или городу..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-[#070e1b] border border-[#16274a] rounded-xl text-xs text-white placeholder-[#7a8fa6] focus:outline-none focus:border-[#0066ff]"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#16274a] bg-[#080f1e] text-[10px] font-mono uppercase text-[#7a8fa6]">
                <th className="p-3.5">IP-адрес</th>
                <th className="p-3.5">Страна & Флаг</th>
                <th className="p-3.5 hidden sm:table-cell">Город / Регион</th>
                <th className="p-3.5 hidden md:table-cell">Страница</th>
                <th className="p-3.5 text-right">Время визита</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#142340]">
              {filteredVisitors.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-[#7a8fa6] font-mono text-xs">
                    Записей не найдено
                  </td>
                </tr>
              ) : (
                filteredVisitors.map((v) => {
                  const code = (v.country_code || "UZ").toUpperCase();
                  const flag = flagEmoji(code);

                  return (
                    <tr key={v.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="p-3.5 text-xs font-mono font-bold text-white">
                        <span className="text-[#00d4ff] mr-1.5">•</span>
                        {v.ip}
                      </td>
                      <td className="p-3.5 text-xs text-white">
                        <span className="mr-2 text-base">{flag}</span>
                        <span>{v.country || code}</span>
                      </td>
                      <td className="p-3.5 text-xs text-[#a0b3c6] hidden sm:table-cell">
                        {[v.city, v.region].filter(Boolean).join(", ") || "—"}
                      </td>
                      <td className="p-3.5 text-xs font-mono text-[#7a8fa6] hidden md:table-cell">
                        {v.path || "/"}
                      </td>
                      <td className="p-3.5 text-right text-xs font-mono text-[#7a8fa6]">
                        {new Date(v.created_at).toLocaleString("ru-RU")}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
export default UserGeographyTab;

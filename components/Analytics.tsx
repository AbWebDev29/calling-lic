"use client";

import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell, Legend
} from "recharts";
import SafeDate from "./SafeDate";

interface Lead {
  id: number;
  status: string;
}

interface CallLog {
  id: number;
  lead_id: number;
  lead_name: string;
  company: string;
  disposition: string;
  notes?: string;
  called_at: string;
}

interface AnalyticsProps {
  logs: CallLog[];
  leads: Lead[];
  onExport: () => void;
}

const DISP_COLORS: Record<string, string> = {
  "Interested": "#10b981",
  "Not Interested": "#ef4444",
  "No Answer": "#94a3b8",
  "Voicemail": "#8b5cf6",
  "Follow Up": "#f59e0b",
  "Do Not Call": "#dc2626",
};

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 text-slate-100 px-3.5 py-2 rounded-lg text-xs">
      <div className="font-bold mb-0.5">{label}</div>
      <div>{payload[0].value} call{payload[0].value !== 1 ? "s" : ""}</div>
    </div>
  );
}

function StatCard({ icon, label, value, accent }: { icon: string; label: string; value: string | number; accent: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-3.5 p-4.5 flex items-center gap-4" style={{ borderLeft: `4px solid ${accent}` } as React.CSSProperties}>
      <div className="text-2xl leading-none">{icon}</div>
      <div>
        <div className="text-xs text-slate-600 font-medium mb-0.75">{label}</div>
        <div className="text-2xl font-black text-slate-900 leading-none">{value}</div>
      </div>
    </div>
  );
}

export default function Analytics({ logs, leads, onExport }: AnalyticsProps) {
  const activeLogs = logs.filter(l => l.disposition !== "Pending");

  const weekData = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return {
        day: d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric" }),
        calls: activeLogs.filter(
          l => new Date(l.called_at).toDateString() === d.toDateString()
        ).length
      };
    });
  }, [activeLogs]);

  const dispData = useMemo(() => {
    const counts: Record<string, number> = {};
    activeLogs.forEach(l => {
      counts[l.disposition] = (counts[l.disposition] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({
      name,
      value,
      fill: DISP_COLORS[name] || "#94a3b8"
    }));
  }, [activeLogs]);

  const totalCalls = activeLogs.length;
  const hotLeads = leads.filter(l => l.status === "Interested").length;
  const callsToday = activeLogs.filter(
    l => new Date(l.called_at).toDateString() === new Date().toDateString()
  ).length;
  const convRate = leads.length ? Math.round((hotLeads / leads.length) * 100) : 0;

  const topPerformers = Object.values(
    activeLogs.reduce((acc: Record<number, { leadId: number; leadName: string; company: string; count: number; lastDisp: string; lastTs: string }>, l) => {
      if (!acc[l.lead_id]) {
        acc[l.lead_id] = {
          leadId: l.lead_id,
          leadName: l.lead_name,
          company: l.company,
          count: 0,
          lastDisp: l.disposition,
          lastTs: l.called_at
        };
      }
      acc[l.lead_id].count++;
      if (l.called_at > acc[l.lead_id].lastTs) {
        acc[l.lead_id].lastTs = l.called_at;
        acc[l.lead_id].lastDisp = l.disposition;
      }
      return acc;
    }, {})
  ).sort((a, b) => b.count - a.count).slice(0, 5);

  return (
    <div>
      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5 mb-7">
        <StatCard icon="📞" label="Total Calls Logged" value={totalCalls} accent="#6366f1" />
        <StatCard icon="🔥" label="Interested Leads" value={hotLeads} accent="#10b981" />
        <StatCard icon="📅" label="Calls Today" value={callsToday} accent="#f59e0b" />
        <StatCard icon="📈" label="Conversion Rate" value={`${convRate}%`} accent="#ec4899" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        {/* Bar chart: calls per day */}
        <div className="bg-white border border-slate-200 rounded-3.5 p-5.5">
          <div className="flex justify-between items-center mb-4.5">
            <div>
              <div className="font-black text-base text-slate-900">Calls — Last 7 Days</div>
              <div className="text-xs text-slate-400 mt-0.5">Daily call volume</div>
            </div>
            <button
              onClick={onExport}
              className="px-3.5 py-1.75 bg-slate-900 text-white border-none rounded-lg text-xs font-bold cursor-pointer hover:bg-slate-800 transition-colors"
            >
              ⬇️ Export
            </button>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weekData} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f8fafc" }} />
              <Bar dataKey="calls" fill="#6366f1" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart: disposition breakdown */}
        <div className="bg-white border border-slate-200 rounded-3.5 p-5.5">
          <div className="font-black text-base text-slate-900 mb-1">Disposition Breakdown</div>
          <div className="text-xs text-slate-400 mb-3.5">All logged calls</div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={dispData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={52}
                outerRadius={80}
                paddingAngle={3}
              >
                {dispData.map((entry, i) => (
                  <Cell key={`cell-${i}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip formatter={(v, n) => [`${v} calls`, n]} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Performers Table */}
      <div className="bg-white border border-slate-200 rounded-3.5 p-5.5">
        <div className="font-black text-base text-slate-900 mb-4">Top Performing Leads</div>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-100">
              {["Lead", "Company", "Total Calls", "Last Disposition", "Last Call"].map(h => (
                <th
                  key={h}
                  className="px-3 py-2 text-left font-black text-slate-400 text-2xs uppercase tracking-tighter"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {topPerformers.map((row, i) => (
              <tr key={row.leadId} className={`${i < 4 ? "border-b border-slate-50" : ""}`}>
                <td className="px-3 py-2.5 font-bold text-slate-900">{row.leadName}</td>
                <td className="px-3 py-2.5 text-slate-600">{row.company}</td>
                <td className="px-3 py-2.5 font-black text-indigo-600">{row.count}</td>
                <td className="px-3 py-2.5">
                  <span className="inline-block px-2 py-0.75 bg-emerald-50 text-emerald-700 border border-emerald-200 text-2xs font-bold rounded-full">
                    {row.lastDisp}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-slate-400 text-2xs">
                  <SafeDate date={row.lastTs} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

"use client";

import { useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import ExcelInfo from "./ExcelInfo";
import * as XLSX from "xlsx";

interface Lead {
  id: number;
  name: string;
  phone: string;
  email: string;
  company?: string;
  leader_code?: string;
  nop?: number;
  prem?: number;
  utsaav?: number;
  ulip?: number;
  cat1?: string;
  cat2?: number;
  status: string;
  source: string;
}

type FilterCondition = {
  id: string;
  column: keyof Lead;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than';
  value: string;
};

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "New": { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  "Contacted": { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  "Interested": { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  "Follow Up": { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  "Not Interested": { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  "Voicemail": { bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200" },
  "No Answer": { bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200" },
  "Pending": { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
  "Do Not Call": { bg: "bg-red-50", text: "text-red-900", border: "border-red-200" },
};

interface LeadsTableProps {
  leads: Lead[];
  onRefresh: () => void;
  onCall: (lead: Lead) => void;
}

export default function LeadsTable({ leads, onRefresh, onCall }: LeadsTableProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [draftFilters, setDraftFilters] = useState<FilterCondition[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const statusOptions = ["All", "New", "Interested", "Follow Up", "Contacted", "Not Interested"];

  const addFilter = () => setDraftFilters([...draftFilters, { id: Math.random().toString(), column: 'name', operator: 'contains', value: '' }]);
  const removeFilter = (id: string) => setDraftFilters(draftFilters.filter(f => f.id !== id));
  const updateFilter = (id: string, field: keyof FilterCondition, val: string) => setDraftFilters(draftFilters.map(f => f.id === id ? { ...f, [field]: val } : f));
  const applyFilters = () => { setFilters(draftFilters); setShowFilters(false); };
  const clearFilters = () => { setDraftFilters([]); setFilters([]); setShowFilters(false); };

  const visible = leads
    .filter(l => {
      const matchSearch = !search ||
        l.name.toLowerCase().includes(search.toLowerCase()) ||
        (l.company && l.company.toLowerCase().includes(search.toLowerCase())) ||
        (l.leader_code && l.leader_code.toLowerCase().includes(search.toLowerCase())) ||
        l.phone.includes(search);
      const matchStatus = statusFilter === "All" || l.status === statusFilter;
      
      const matchFilters = filters.every(f => {
        if (!f.value) return true;
        const val = l[f.column];
        if (val === undefined || val === null) return false;
        
        const numVal = Number(val);
        const filterNum = Number(f.value);

        switch (f.operator) {
          case 'equals': return String(val).toLowerCase() === String(f.value).toLowerCase();
          case 'contains': return String(val).toLowerCase().includes(String(f.value).toLowerCase());
          case 'greater_than': return !isNaN(numVal) && !isNaN(filterNum) && numVal > filterNum;
          case 'less_than': return !isNaN(numVal) && !isNaN(filterNum) && numVal < filterNum;
          default: return true;
        }
      });

      return matchSearch && matchStatus && matchFilters;
    })
    .slice(0, 5000);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: "binary" });
        const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          alert("Not authenticated");
          return;
        }

        const leads = (data as Record<string, any>[]).map((r: any, i: number) => ({
          name: r.NAME || r.Name || r.name || r["Full Name"] || "Unknown",
          phone: String(r.PHONE || r.Phone || r.phone || r["Phone Number"] || ""),
          email: r.Email || r.email || r.EMAIL || "",
          leader_code: r["leader code"] || r.leader_code || r.LEADER_CODE || "",
          nop: r.NOP || r.nop || 0,
          prem: r.PREM || r.prem || 0,
          utsaav: r.UTSAAV || r.utsaav || 0,
          ulip: r.ULIP || r.ulip || 0,
          cat1: r.CAT1 || r.cat1 || "",
          cat2: r.CAT2 || r.cat2 || 0,
          status: "New",
          source: "Excel",
          user_id: userData.user.id,
        }));

        const { error } = await supabase
          .from("leads")
          .insert(leads as never);

        if (error) throw error;
        onRefresh();
      } catch (error) {
        console.error(error);
        alert("Parse error — check column headers: NAME, PHONE, Email, leader code, NOP, PREM, UTSAAV, ULIP, CAT1, CAT2");
      }
    };
    reader.readAsBinaryString(file);
    e.currentTarget.value = "";
  };

  const initials = (name: string) =>
    name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();

  const AVATAR_COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#14b8a6", "#f43f5e"];
  const avatarColor = (id: number) => AVATAR_COLORS[id % AVATAR_COLORS.length];

  const formatPhone = (p: string) =>
    p.replace(/(\+\d{2})(\d{5})(\d{5})/, "$1 $2 $3") || p;

  return (
    <div>
      {/* Data Requirements Card */}
      <ExcelInfo />

      {/* Toolbar */}
      <div className="flex gap-3 mb-6 flex-wrap items-center">
        <div className="relative flex-1 min-w-56">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, company, phone…"
            className="w-full pl-10 pr-4 py-2.5 border-1.5 border-slate-200 rounded-lg font-base bg-white outline-none"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base text-slate-400">🔍</span>
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {statusOptions.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                statusFilter === s
                  ? "bg-slate-900 text-white"
                  : "border-1.5 border-slate-200 bg-white text-slate-600"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <button
          onClick={() => {
            if (!showFilters) setDraftFilters(filters);
            setShowFilters(!showFilters);
          }}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold cursor-pointer transition-all border-1.5 ${showFilters || filters.length > 0 ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200"}`}
        >
          {filters.length > 0 ? `🎯 ${filters.length} Filters` : "🎯 Filter"}
        </button>

        <button
          onClick={() => fileRef.current?.click()}
          className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1.5 whitespace-nowrap transition-colors"
        >
          📤 Upload Excel
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={handleFileUpload}
          aria-label="Upload Excel file"
        />
      </div>

      {showFilters && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-slate-900">Advanced Filters</h3>
            <div className="space-x-2">
              <button onClick={clearFilters} className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors cursor-pointer">Clear All</button>
              <button onClick={applyFilters} className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer">Apply Filters</button>
            </div>
          </div>
          
          {draftFilters.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-xs border border-dashed border-slate-200 rounded-lg mb-4">No filters added. Click below to add one.</div>
          ) : (
            <div className="space-y-2 mb-4">
              {draftFilters.map(f => (
                <div key={f.id} className="flex gap-2 items-center">
                  <select 
                    value={f.column} 
                    onChange={e => updateFilter(f.id, 'column', e.target.value as keyof Lead)}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 outline-none bg-slate-50 flex-1 cursor-pointer"
                  >
                    <option value="name">Name</option>
                    <option value="phone">Phone</option>
                    <option value="email">Email</option>
                    <option value="leader_code">Leader Code</option>
                    <option value="nop">NOP</option>
                    <option value="prem">PREM</option>
                    <option value="utsaav">UTSAAV</option>
                    <option value="ulip">ULIP</option>
                    <option value="cat1">CAT1</option>
                    <option value="cat2">CAT2</option>
                    <option value="status">Status</option>
                    <option value="source">Source</option>
                  </select>
                  <select 
                    value={f.operator} 
                    onChange={e => updateFilter(f.id, 'operator', e.target.value)}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 outline-none bg-slate-50 cursor-pointer"
                  >
                    <option value="contains">Contains</option>
                    <option value="equals">Equals</option>
                    <option value="greater_than">Greater Than (&gt;)</option>
                    <option value="less_than">Less Than (&lt;)</option>
                  </select>
                  <input 
                    type="text" 
                    value={f.value} 
                    onChange={e => updateFilter(f.id, 'value', e.target.value)}
                    placeholder="Value"
                    className="border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none flex-1 font-medium"
                  />
                  <button onClick={() => removeFilter(f.id)} className="p-2 text-slate-400 hover:text-red-500 transition-colors cursor-pointer" title="Remove filter">
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          
          <button onClick={addFilter} className="text-xs font-bold text-slate-900 border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer">
            + Add Condition
          </button>
        </div>
      )}

      {/* Results count */}
      <div className="text-xs text-slate-600 mb-3">
        Showing <strong>{visible.length}</strong> of <strong>{leads.length}</strong> leads
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {["Lead", "Phone", "L.Code", "NOP", "PREM", "UTSAAV", "ULIP", "CAT1", "CAT2", "Status", "Source", "Action"].map(h => (
                <th
                  key={h}
                  className="px-2 py-3 text-left font-bold text-slate-600 text-2xs uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((lead, i) => {
              const colors = STATUS_COLORS[lead.status] || STATUS_COLORS["New"];
              return (
                <tr
                  key={lead.id}
                  className={`${i < visible.length - 1 ? "border-b border-slate-100" : ""} hover:bg-slate-50 transition-colors`}
                >
                  <td className="px-2 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-8 h-8 rounded-full text-white flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ backgroundColor: avatarColor(lead.id) } as React.CSSProperties}
                      >
                        {initials(lead.name)}
                      </div>
                      <div className="min-w-0 max-w-32">
                        <div className="font-bold text-slate-900 truncate">{lead.name}</div>
                        <div className="text-2xs text-slate-400 truncate">{lead.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-3.5">
                    <span className="font-mono text-2xs text-slate-900 whitespace-nowrap">{formatPhone(lead.phone)}</span>
                  </td>
                  <td className="px-2 py-3.5 text-slate-600 font-medium">{lead.leader_code || "-"}</td>
                  <td className="px-2 py-3.5 text-slate-600 font-medium">{lead.nop || "-"}</td>
                  <td className="px-2 py-3.5 text-slate-600 font-medium">{lead.prem || "-"}</td>
                  <td className="px-2 py-3.5 text-slate-600 font-medium">{lead.utsaav || "-"}</td>
                  <td className="px-2 py-3.5 text-slate-600 font-medium">{lead.ulip || "-"}</td>
                  <td className="px-2 py-3.5 text-slate-600 font-medium">{lead.cat1 || "-"}</td>
                  <td className="px-2 py-3.5 text-slate-600 font-medium">{lead.cat2 || "-"}</td>
                  <td className="px-2 py-3.5">
                    <span className={`inline-block px-2.5 py-1 text-2xs font-bold rounded-full border whitespace-nowrap ${colors.bg} ${colors.text} ${colors.border}`}>
                      {lead.status}
                    </span>
                  </td>
                  <td className="px-2 py-3.5">
                    <span className="text-2xs text-slate-400 font-medium whitespace-nowrap">
                      {lead.source === "Excel" ? "📊 Excel" : "✍️ Manual"}
                    </span>
                  </td>
                  <td className="px-2 py-3.5">
                    <button
                      onClick={() => onCall(lead)}
                      className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1.5 transition-colors whitespace-nowrap"
                    >
                      📞 Call
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {visible.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <div className="text-4xl mb-2">🔍</div>
            No leads match your search
          </div>
        )}
      </div>
    </div>
  );
}

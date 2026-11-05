"use client";

import { useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import ExcelInfo from "./ExcelInfo";
import SafeDate from "./SafeDate";
import { LEAD_STATUSES, normalizeLeadStatus } from "@/lib/leadStatus";
import * as XLSX from "xlsx";

interface Lead {
  id: number;
  agent_code: string;
  name: string;
  mobile: string;
  submanager_name?: string;
  submanager_id?: string | null;
  company?: string;
  leader_code?: string;
  data1?: string;
  data2?: string;
  data3?: string;
  data4?: string;
  cat1?: string;
  cat2?: number;
  status: string;
  source: string;
}

interface CallLog {
  id: number;
  lead_id: number;
  disposition: string;
  notes?: string;
  called_at: string;
}

interface MasterFile {
  id: string;
  manager_id: string;
  file_name: string;
  row_count: number;
  uploaded_at: string;
}

type FilterCondition = {
  id: string;
  column: keyof Lead;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than';
  value: string;
};

interface LeadsTableProps {
  leads: Lead[];
  logs: CallLog[];
  onRefresh: () => void;
  onCall: (lead: Lead) => void;
  canManage?: boolean;
  submanagers?: { id: string; name: string }[];
  fileId: string | null;
  onFileUploaded: (file: MasterFile) => void;
}

export default function LeadsTable({ leads, logs, onRefresh, onCall, canManage = true, submanagers = [], fileId, onFileUploaded }: LeadsTableProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [draftFilters, setDraftFilters] = useState<FilterCondition[]>([]);
  const [showManualForm, setShowManualForm] = useState(false);
  const [savingLead, setSavingLead] = useState(false);
  const [manualError, setManualError] = useState("");
  const [manualSuccess, setManualSuccess] = useState("");
  const [manualLead, setManualLead] = useState({
    agent_code: "", name: "", mobile: "", leader_code: "", data1: "", data2: "", data3: "", data4: "",
    cat1: "", cat2: "", status: "Not Picked",
  });
  const fileRef = useRef<HTMLInputElement>(null);

  const statusOptions = ["All", ...LEAD_STATUSES];

  const addFilter = () => setDraftFilters([...draftFilters, { id: Math.random().toString(), column: 'name', operator: 'contains', value: '' }]);
  const removeFilter = (id: string) => setDraftFilters(draftFilters.filter(f => f.id !== id));
  const updateFilter = (id: string, field: keyof FilterCondition, val: string) => setDraftFilters(draftFilters.map(f => f.id === id ? { ...f, [field]: val } : f));
  const applyFilters = () => { setFilters(draftFilters); setShowFilters(false); };
  const clearFilters = () => { setDraftFilters([]); setFilters([]); setShowFilters(false); };

  const updateManualLead = (field: keyof typeof manualLead, value: string) => {
    setManualLead(current => ({ ...current, [field]: value }));
    setManualError("");
    setManualSuccess("");
  };

  const saveManualLead = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingLead(true);
    setManualError("");
    setManualSuccess("");

    try {
      const { data: userData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!userData.user) throw new Error("Please sign in again before adding a lead.");

      const { error } = await supabase.from("leads").insert({
        user_id: userData.user.id,
        manager_id: userData.user.id,
        file_id: fileId,
        name: manualLead.name.trim(),
        agent_code: manualLead.agent_code.trim() || null,
        mobile: manualLead.mobile.trim() || null,
        leader_code: manualLead.leader_code.trim() || null,
        data1: manualLead.data1.trim() || null,
        data2: manualLead.data2.trim() || null,
        data3: manualLead.data3.trim() || null,
        data4: manualLead.data4.trim() || null,
        cat1: manualLead.cat1.trim() || null,
        cat2: manualLead.cat2 ? Number(manualLead.cat2) : null,
        status: manualLead.status,
        source: "Manual",
      } as never);

      if (error) throw error;
      setManualLead({ agent_code: "", name: "", mobile: "", leader_code: "", data1: "", data2: "", data3: "", data4: "", cat1: "", cat2: "", status: "Not Picked" });
      setShowManualForm(false);
      setSearch("");
      setStatusFilter("All");
      setFilters([]);
      setDraftFilters([]);
      setShowFilters(false);
      setManualSuccess("Lead added successfully.");
      onRefresh();
    } catch (error) {
      console.error("Error adding lead:", error);
      setManualError(error instanceof Error ? error.message : "Could not add this lead. Please try again.");
    } finally {
      setSavingLead(false);
    }
  };

  const visible = leads
    .filter(l => {
      const matchSearch = !search ||
        l.name.toLowerCase().includes(search.toLowerCase()) ||
        (l.agent_code && l.agent_code.toLowerCase().includes(search.toLowerCase())) ||
        (l.leader_code && l.leader_code.toLowerCase().includes(search.toLowerCase())) ||
        l.mobile.includes(search);
      const matchStatus = statusFilter === "All" || normalizeLeadStatus(l.status) === statusFilter;
      
      const matchFilters = filters.every(f => {
        if (!f.value) return true;
        const val = f.column === "status" ? normalizeLeadStatus(l.status) : l[f.column];
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
    });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: "binary" });
        const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        if (!data.length) throw new Error("The selected Excel sheet has no lead rows.");

        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          alert("Not authenticated");
          return;
        }

        const rows = data as Record<string, unknown>[];
        const normalizeHeader = (header: string) => header.toLowerCase().replace(/[^a-z0-9]/g, "");
        const rowValue = (row: Record<string, unknown>, header: string) => {
          const actualHeader = Object.keys(row).find(key => normalizeHeader(key) === normalizeHeader(header));
          const value = actualHeader ? row[actualHeader] : "";
          return value === null || value === undefined ? "" : String(value).trim();
        };
        const requiredHeaders = ["agentCode", "name", "mobile", "submanagerName", "leaderCode", "data1", "data2", "data3", "data4"];
        const missingHeaders = requiredHeaders.filter(header => !Object.keys(rows[0] || {}).some(key => normalizeHeader(key) === normalizeHeader(header)));
        if (missingHeaders.length) throw new Error(`Missing required columns: ${missingHeaders.join(", ")}.`);
        const assignmentFor = (row: Record<string, unknown>) => rowValue(row, "submanagerName");
        const leads = rows.map(row => ({
          agent_code: rowValue(row, "agentCode"),
          name: rowValue(row, "name"),
          mobile: rowValue(row, "mobile"),
          submanager_name: assignmentFor(row),
          leader_code: rowValue(row, "leaderCode"),
          data1: rowValue(row, "data1"),
          data2: rowValue(row, "data2"),
          data3: rowValue(row, "data3"),
          data4: rowValue(row, "data4"),
          status: "Not Picked",
          source: "Excel",
          user_id: userData.user.id,
          manager_id: userData.user.id,
          submanager_id: submanagers.find(person => person.name.trim().toLowerCase() === assignmentFor(row).toLowerCase())?.id || null,
        }));

        const { data: masterFileData, error: fileError } = await supabase.from("master_files").insert({
          manager_id: userData.user.id,
          file_name: file.name,
          row_count: leads.length,
        } as never).select().single();
        if (fileError) throw fileError;
        if (!masterFileData) throw new Error("Could not create a file history record.");
        const masterFile = masterFileData as unknown as MasterFile;
        const leadsForFile = leads.map(lead => ({ ...lead, file_id: masterFile.id }));

        const { error } = await supabase
          .from("leads")
          .insert(leadsForFile as never);

        if (error) {
          await supabase.from("master_files").delete().eq("id", masterFile.id);
          throw error;
        }
        const unmatched = rows.filter(row => {
          const value = assignmentFor(row);
          return value && !submanagers.some(person => person.name.trim().toLowerCase() === String(value).trim().toLowerCase());
        });
        if (unmatched.length) alert(`${unmatched.length} row(s) were uploaded without an assignment because subManagerName did not match a People and Access name.`);
        onFileUploaded(masterFile);
      } catch (error) {
        console.error(error);
        alert(error instanceof Error ? `Master file upload failed: ${error.message}` : "Master file upload failed. Check that the workbook has valid lead columns and the database schema is up to date.");
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

  const latestCallsByLead = new Map<number, CallLog[]>();
  logs.forEach(log => {
    if (log.disposition === "Pending") return;
    const entries = latestCallsByLead.get(log.lead_id) || [];
    if (entries.length < 2) {
      entries.push(log);
      latestCallsByLead.set(log.lead_id, entries);
    }
  });

  const renderCallEntry = (entry?: CallLog) => entry ? (
    <div className="lead-call-entry">
      <SafeDate date={entry.called_at} />
      <span>{entry.notes?.trim() || "No notes"}</span>
    </div>
  ) : <span className="lead-call-empty">No calls yet</span>;

  return (
    <div>
      {/* Data Requirements Card */}
      {canManage && <ExcelInfo />}

      {manualSuccess && (
        <div className="manual-success" role="status">
          <span>✓</span>{manualSuccess}
          <button type="button" onClick={() => setManualSuccess("")} aria-label="Dismiss confirmation">×</button>
        </div>
      )}

      {canManage && showManualForm && (
        <div className="manual-modal-backdrop">
          <section className="manual-modal" role="dialog" aria-modal="true" aria-labelledby="manual-lead-title">
            <div className="manual-modal-header">
              <div>
                <span className="manual-modal-kicker">LEAD DETAILS</span>
                <h2 id="manual-lead-title">Add a lead</h2>
                <p>Enter the contact and tracking information below.</p>
              </div>
              <button
                type="button"
                className="manual-modal-close"
                onClick={() => { setShowManualForm(false); setManualError(""); }}
                aria-label="Close add lead form"
              >×</button>
            </div>

            <form onSubmit={saveManualLead}>
              <div className="manual-form-grid">
                <label className="manual-field manual-field-wide">
                  <span>Full name <b>*</b></span>
                  <input autoFocus required maxLength={120} value={manualLead.name} onChange={e => updateManualLead("name", e.target.value)} placeholder="e.g. Ananya Sharma" />
                </label>
                <label className="manual-field">
                  <span>Phone number</span>
                  <input type="tel" maxLength={30} value={manualLead.mobile} onChange={e => updateManualLead("mobile", e.target.value)} placeholder="+91 98765 43210" />
                </label>
                <label className="manual-field">
                  <span>Agent code</span>
                  <input maxLength={80} value={manualLead.agent_code} onChange={e => updateManualLead("agent_code", e.target.value)} placeholder="Alphanumeric" />
                </label>
                <label className="manual-field">
                  <span>Leader code</span>
                  <input maxLength={80} value={manualLead.leader_code} onChange={e => updateManualLead("leader_code", e.target.value)} placeholder="Optional" />
                </label>
                <label className="manual-field">
                  <span>Status</span>
                  <select value={manualLead.status} onChange={e => updateManualLead("status", e.target.value)}>
                    {statusOptions.filter(status => status !== "All").map(status => <option key={status}>{status}</option>)}
                  </select>
                </label>
                <div className="manual-field-divider">Tracking data <span>Optional</span></div>
                {([
                  ["data1", "Data 1"], ["data2", "Data 2"], ["data3", "Data 3"], ["data4", "Data 4"], ["cat2", "CAT2"],
                ] as const).map(([field, label]) => (
                  <label className="manual-field" key={field}>
                    <span>{label}</span>
                    <input maxLength={120} value={manualLead[field]} onChange={e => updateManualLead(field, e.target.value)} placeholder="—" />
                  </label>
                ))}
                <label className="manual-field">
                  <span>CAT1</span>
                  <input maxLength={80} value={manualLead.cat1} onChange={e => updateManualLead("cat1", e.target.value)} placeholder="Optional" />
                </label>
              </div>
              {manualError && <div className="manual-error" role="alert">{manualError}</div>}
              <div className="manual-modal-actions">
                <button type="button" className="manual-cancel" onClick={() => { setShowManualForm(false); setManualError(""); }}>Cancel</button>
                <button type="submit" className="manual-submit" disabled={savingLead}>{savingLead ? "Saving lead…" : "Add lead"}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Toolbar */}
      <div className="leads-toolbar flex gap-3 mb-6 flex-wrap items-center">
        <div className="relative flex-1 min-w-56">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, agent code, mobile…"
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
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "border-1.5 border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-700"
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
          className={`px-4 py-2.5 rounded-lg text-xs font-bold cursor-pointer transition-all border-1.5 ${showFilters || filters.length > 0 ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:border-indigo-200 hover:text-indigo-700"}`}
        >
          {filters.length > 0 ? `🎯 ${filters.length} Filters` : "🎯 Filter"}
        </button>

        {canManage && <button
          onClick={() => fileRef.current?.click()}
          className="leads-upload-button px-5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1.5 whitespace-nowrap transition-colors"
        >
          📤 Upload Excel
        </button>}
        {canManage && <button
          type="button"
          onClick={() => { setShowManualForm(true); setManualError(""); setManualSuccess(""); }}
          className="manual-add-button"
        >
          <span aria-hidden="true">＋</span> Add lead
        </button>}
        {canManage && <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={handleFileUpload}
          aria-label="Upload Excel file"
        />}
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
                    <option value="agent_code">Agent code</option>
                    <option value="mobile">Mobile</option>
                    <option value="leader_code">Leader Code</option>
                    <option value="data1">Data 1</option>
                    <option value="data2">Data 2</option>
                    <option value="data3">Data 3</option>
                    <option value="data4">Data 4</option>
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
      <div className="table-scroll leads-table-scroll bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {["Agent code", "Lead", "Submanager", "Mobile", "Leader code", "Data 1", "Data 2", "Data 3", "Data 4", "CAT1", "CAT2", "Status", "Latest call", "Previous call", "Action"].map(h => (
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
              return (
                <tr
                  key={lead.id}
                  className={`${i < visible.length - 1 ? "border-b border-slate-100" : ""} hover:bg-slate-50 transition-colors`}
                >
                  <td data-label="Agent code" className="px-2 py-3.5 text-slate-600 font-medium">{lead.agent_code || "—"}</td>
                  <td data-label="Lead" className="px-2 py-3.5 lead-card-title">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-8 h-8 rounded-full text-white flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ backgroundColor: avatarColor(lead.id) } as React.CSSProperties}
                      >
                        {initials(lead.name)}
                      </div>
                      <div className="min-w-0 max-w-32">
                        <div className="font-bold text-slate-900 truncate">{lead.name}</div>
                      </div>
                    </div>
                  </td>
                  <td data-label="Submanager" className="px-2 py-3.5 text-slate-600 font-medium">{lead.submanager_name || "—"}</td>
                  <td data-label="Mobile" className="px-2 py-3.5">
                    <span className="font-mono text-2xs text-slate-900 whitespace-nowrap">{formatPhone(lead.mobile)}</span>
                  </td>
                  <td data-label="Leader code" className="px-2 py-3.5 text-slate-600 font-medium">{lead.leader_code || "—"}</td>
                  <td data-label="Data 1" className="px-2 py-3.5 text-slate-600 font-medium">{lead.data1 || "—"}</td>
                  <td data-label="Data 2" className="px-2 py-3.5 text-slate-600 font-medium">{lead.data2 || "—"}</td>
                  <td data-label="Data 3" className="px-2 py-3.5 text-slate-600 font-medium">{lead.data3 || "—"}</td>
                  <td data-label="Data 4" className="px-2 py-3.5 text-slate-600 font-medium">{lead.data4 || "—"}</td>
                  <td data-label="CAT1" className="px-2 py-3.5 text-slate-600 font-medium">{lead.cat1 || "—"}</td>
                  <td data-label="CAT2" className="px-2 py-3.5 text-slate-600 font-medium">{lead.cat2 ?? "—"}</td>
                  <td data-label="Status" className="px-2 py-3.5 text-slate-600 font-medium">{normalizeLeadStatus(lead.status)}</td>
                  <td data-label="Latest call" className="px-2 py-3.5">{renderCallEntry(latestCallsByLead.get(lead.id)?.[0])}</td>
                  <td data-label="Previous call" className="px-2 py-3.5">{renderCallEntry(latestCallsByLead.get(lead.id)?.[1])}</td>
                  <td data-label="Action" className="px-2 py-3.5 lead-card-action">
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

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { ChartNoAxesCombined, House, LogOut, PhoneCall, Users, UserRoundCog } from "lucide-react";
import { normalizeLeadStatus } from "@/lib/leadStatus";
import AuthGuard from "@/components/AuthGuard";
import LeadsTable from "@/components/LeadsTable";
import CallModal from "@/components/CallModal";
import Analytics from "@/components/Analytics";

interface Lead {
  id: number;
  agent_code: string;
  name: string;
  mobile: string;
  submanager_name?: string;
  submanager_id?: string | null;
  manager_id?: string;
  file_id?: string | null;
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
  lead_name: string;
  company: string;
  phone: string;
  disposition: string;
  notes?: string;
  called_at: string;
  manager_id?: string;
  user_id?: string;
  file_id?: string | null;
}

interface MasterFile {
  id: string;
  manager_id: string;
  file_name: string;
  row_count: number;
  uploaded_at: string;
}

const PAGE_SIZE = 1000;

async function fetchAllLeads(userId: string, role = "manager", ownerManagerId = userId, fileId: string | null = null): Promise<Lead[]> {
  const allLeads: Lead[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const leadsQuery = supabase
      .from("leads")
      .select("*")
      // RLS returns only the signed-in submanager's assigned rows. Filtering by
      // manager keeps the query scoped while allowing name-based legacy matches.
      .eq("manager_id", role === "manager" ? userId : ownerManagerId);
    const { data, error } = await (fileId ? leadsQuery.eq("file_id", fileId) : leadsQuery)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data as Lead[] | null) || [];
    allLeads.push(...page);
    if (page.length < PAGE_SIZE) return allLeads;
  }
}

async function fetchAllCallLogs(userId: string, role = "manager", fileId: string | null = null): Promise<CallLog[]> {
  const allLogs: CallLog[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const logsQuery = supabase
      .from("call_logs")
      .select("*")
      .eq(role === "manager" ? "manager_id" : "user_id", userId);
    const { data, error } = await (fileId ? logsQuery.eq("file_id", fileId) : logsQuery)
      .order("called_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data as CallLog[] | null) || [];
    allLogs.push(...page);
    if (page.length < PAGE_SIZE) return allLogs;
  }
}

export default function Dashboard() {
  const [tab, setTab] = useState("leads");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [logs, setLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [currentLogId, setCurrentLogId] = useState<number | null>(null);
  const [returnedFromDialer, setReturnedFromDialer] = useState(false);
  const [role, setRole] = useState("manager");
  const [managerId, setManagerId] = useState("");
  const [submanagers, setSubmanagers] = useState<{id:string; name:string; email:string}[]>([]);
  const [masterFiles, setMasterFiles] = useState<MasterFile[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [callPeriod, setCallPeriod] = useState<"all" | "day" | "week">("all");
  const [peopleMessage, setPeopleMessage] = useState("");
  const [peopleBusy, setPeopleBusy] = useState(false);
  const [dashboardError, setDashboardError] = useState("");
  const dialerOpenedRef = useRef(false);
  const dialerOpenedAtRef = useRef(0);
  const router = useRouter();
  const selectedMasterFile = masterFiles.find(file => file.id === selectedFileId) || null;
  const visibleCallLogs = logs.filter(log => {
    if (log.disposition === "Pending") return false;
    if (callPeriod === "all") return true;
    const calledAt = new Date(log.called_at);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (callPeriod === "day") return calledAt >= today;
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    return calledAt >= weekStart;
  });

  useEffect(() => {
    const handleReturnToPage = () => {
      if (dialerOpenedRef.current && Date.now() - dialerOpenedAtRef.current > 1000 && document.visibilityState === "visible") {
        dialerOpenedRef.current = false;
        setReturnedFromDialer(true);
      }
    };

    document.addEventListener("visibilitychange", handleReturnToPage);
    window.addEventListener("focus", handleReturnToPage);
    return () => {
      document.removeEventListener("visibilitychange", handleReturnToPage);
      window.removeEventListener("focus", handleReturnToPage);
    };
  }, []);

  useEffect(() => {
    if (!managerId) return;
    const refresh = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const [allLeads, allLogs] = await Promise.all([
        fetchAllLeads(role === "manager" ? managerId : userData.user.id, role, managerId, selectedFileId),
        fetchAllCallLogs(role === "manager" ? managerId : userData.user.id, role, selectedFileId),
      ]);
      const { data: updatedFiles } = await supabase.from("master_files").select("*").order("uploaded_at", { ascending: false });
      setMasterFiles((updatedFiles || []) as unknown as MasterFile[]);
      setLeads(allLeads);
      setLogs(allLogs);
    };
    const channel = supabase.channel(`workspace-${managerId}-${role}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "call_logs" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "master_files" }, refresh)
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [managerId, role, selectedFileId]);

  // Fetch leads and logs
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          router.push("/login");
          return;
        }

        const { data: profileData, error: profileError } = await supabase.from("profiles").select("role, manager_id").eq("id", userData.user.id).single();
        if (profileError) throw profileError;
        const profile = profileData as unknown as { role: string; manager_id: string | null };
        const userRole = profile.role as string;
        const ownerId = userRole === "manager" ? userData.user.id : profile.manager_id as string;
        setRole(userRole); setManagerId(ownerId);
        const { data: people } = await supabase.from("profiles").select("id, name, email").eq("manager_id", ownerId).eq("role", "submanager");
        setSubmanagers((people || []) as {id:string; name:string; email:string}[]);
        const { data: filesData, error: filesError } = await supabase.from("master_files").select("*").order("uploaded_at", { ascending: false });
        if (filesError) throw filesError;
        const availableFiles = (filesData || []) as unknown as MasterFile[];
        setMasterFiles(availableFiles);
        const activeFileId = availableFiles[0]?.id || null;
        setSelectedFileId(activeFileId);
        const [allLeads, allLogs] = await Promise.all([
          fetchAllLeads(userRole === "manager" ? ownerId : userData.user.id, userRole, ownerId, activeFileId),
          fetchAllCallLogs(userRole === "manager" ? ownerId : userData.user.id, userRole, activeFileId),
        ]);
        setLeads(allLeads);
        setLogs(allLogs);

        const pendingLog = allLogs.find(log => log.disposition === "Pending" && log.user_id === userData.user.id);
        const pendingLead = pendingLog && allLeads.find(lead => lead.id === pendingLog.lead_id);
        if (pendingLog && pendingLead) {
          setSelectedLead(pendingLead);
          setCurrentLogId(pendingLog.id);
          setModalOpen(true);
          setReturnedFromDialer(true);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String((error as { message?: string })?.message || "Unknown database error");
        setDashboardError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  const handleCall = async (lead: Lead) => {
    if (!lead.mobile?.trim()) {
      alert("This lead does not have a phone number yet.");
      return;
    }
    dialerOpenedRef.current = false;
    setReturnedFromDialer(false);
    setCurrentLogId(null);

    try {
      const { data: userData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!userData.user) throw new Error("Please sign in again before placing a call.");

      const { data, error: insertError } = await supabase
        .from("call_logs")
        .insert({
          lead_id: lead.id,
          lead_name: lead.name,
          company: lead.company || "",
          phone: lead.mobile,
          disposition: "Pending",
          notes: "",
          user_id: userData.user.id,
          manager_id: managerId,
          file_id: lead.file_id || null,
        } as never)
        .select()
        .single();

      if (insertError) throw insertError;
      if (!data) throw new Error("The call could not be added to your call history.");

      const pendingCall = data as CallLog;
      setCurrentLogId(pendingCall.id);
      setLogs(current => [pendingCall, ...current]);
      setSelectedLead(lead);
      setModalOpen(true);

      // Open the native dialer only after the pending call record exists.
      dialerOpenedRef.current = true;
      dialerOpenedAtRef.current = Date.now();
      const dialNumber = lead.mobile.replace(/[^\d+*#,;]/g, "");
      window.location.href = `tel:${dialNumber}`;
    } catch (error) {
      console.error("Error starting call:", error);
      alert(error instanceof Error ? error.message : "Could not start this call.");
    }
  };

  const handleSaveLog = async (disposition: string, notes: string) => {
    if (!selectedLead || !currentLogId) return;

    try {
      // Update the call log
      const { error } = await supabase
        .from("call_logs")
        .update({ disposition, notes } as never)
        .eq("id", currentLogId);

      if (error) throw error;

      // Update the lead status
      const { error: leadUpdateError } = await supabase
        .from("leads")
        .update({
          status: disposition,
        } as never)
        .eq("id", selectedLead.id);
      if (leadUpdateError) throw leadUpdateError;

      // Refresh data
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        const [allLeads, allLogs] = await Promise.all([
          fetchAllLeads(role === "manager" ? managerId : userData.user.id, role, managerId, selectedFileId),
          fetchAllCallLogs(role === "manager" ? managerId : userData.user.id, role, selectedFileId),
        ]);
        setLeads(allLeads);
        setLogs(allLogs);
      }

      setModalOpen(false);
      setSelectedLead(null);
      setCurrentLogId(null);
      setReturnedFromDialer(false);
      dialerOpenedRef.current = false;
    } catch (error) {
      console.error("Error saving log:", error);
      alert("Failed to save call log");
    }
  };

  const selectMasterFile = async (fileId: string) => {
    setSelectedFileId(fileId || null);
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const [allLeads, allLogs] = await Promise.all([
        fetchAllLeads(role === "manager" ? managerId : userData.user.id, role, managerId, fileId || null),
        fetchAllCallLogs(role === "manager" ? managerId : userData.user.id, role, fileId || null),
      ]);
      setLeads(allLeads);
      setLogs(allLogs);
      setCallPeriod("all");
    } catch (error) {
      setDashboardError(error instanceof Error ? error.message : "Could not load this file.");
    } finally {
      setLoading(false);
    }
  };

  const handleMasterFileUploaded = async (file: MasterFile) => {
    setMasterFiles(current => [file, ...current.filter(existing => existing.id !== file.id)]);
    setSelectedFileId(file.id);
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const [allLeads, allLogs] = await Promise.all([
        fetchAllLeads(managerId, "manager", managerId, file.id),
        fetchAllCallLogs(managerId, "manager", file.id),
      ]);
      setLeads(allLeads);
      setLogs(allLogs);
      setCallPeriod("all");
    } catch (error) {
      setDashboardError(error instanceof Error ? error.message : "Could not load the uploaded file.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (currentLogId) {
      try {
        await supabase.from("call_logs").delete().eq("id", currentLogId);
      } catch (error) {
        console.error("Error deleting log:", error);
      }
    }
    setModalOpen(false);
    setSelectedLead(null);
    setCurrentLogId(null);
    setReturnedFromDialer(false);
    dialerOpenedRef.current = false;
    setLogs(current => current.filter(log => log.id !== currentLogId));
  };

  const exportCSV = () => {
    const active = visibleCallLogs;
    const submanagerHeader = role === "manager";
    const csv = [
      ["#", "Lead Name", ...(submanagerHeader ? ["Submanager"] : []), "Company", "Phone", "Disposition", "Notes", "Date & Time"].join(","),
      ...active.map(l =>
        [l.id, `"${l.lead_name}"`, ...(submanagerHeader ? [`"${leads.find(lead => lead.id === l.lead_id)?.submanager_name || ""}"`] : []), `"${l.company}"`, l.phone, normalizeLeadStatus(l.disposition), `"${(l.notes || "").replace(/"/g, "`")}"`, new Date(l.called_at).toLocaleString("en-IN")].join(",")
      )
    ].join("\n");

    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const fileLabel = (selectedMasterFile?.file_name || "all_files").replace(/[^a-z0-9-_]+/gi, "_");
    a.download = `call_report_${fileLabel}_${callPeriod}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const TABS = [
    { id: "leads", label: "Leads", badge: leads.length, icon: Users },
    { id: "logs", label: "Call Logs", badge: logs.filter(l => l.disposition !== "Pending").length, icon: PhoneCall },
    { id: "analytics", label: "Analytics", badge: null, icon: ChartNoAxesCombined },
    ...(role === "manager" ? [{ id: "people", label: "People and Access", badge: null, icon: UserRoundCog }] : []),
  ];
  const selectedFileIndex = masterFiles.findIndex(file => file.id === selectedFileId);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <AuthGuard>
      <div className="dashboard-shell min-h-screen bg-slate-50">
        {/* Modal */}
        <CallModal
          lead={selectedLead}
          isOpen={modalOpen}
          callReturnedFromDialer={returnedFromDialer}
          onClose={handleCancel}
          onSave={handleSaveLog}
        />

        {/* Header */}
        <div className="dashboard-header bg-slate-900 px-7">
          <div className="dashboard-header-inner max-w-6xl mx-auto flex items-center justify-between gap-6 py-4">
            <Link href="/" className="dashboard-brand" aria-label="LeadTrack home">
              <span className="dashboard-brand-mark">⚡</span>
              <span><strong>LeadTrack</strong><small>Lead management workspace</small></span>
            </Link>

            <nav className="dashboard-nav flex gap-1" aria-label="Workspace navigation">
              <Link href="/" className="dashboard-home-link">
                <House size={16} strokeWidth={2} aria-hidden="true" />
                <span>Home</span>
              </Link>
              {TABS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  aria-current={tab === t.id ? "page" : undefined}
                  className={`dashboard-nav-link ${tab === t.id ? "is-active" : ""}`}
                >
                  <t.icon size={16} strokeWidth={2} aria-hidden="true" />
                  <span>{t.label}</span>
                  {t.badge !== null && (
                    <span className="dashboard-nav-badge">
                      {t.badge}
                    </span>
                  )}
                </button>
              ))}
            </nav>

            <div className="dashboard-account">
              <div className="dashboard-account-date">
                <span>
                  {new Date().toLocaleDateString("en-IN", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
                <span className="dashboard-live"><i /> Active workspace</span>
              </div>
              <button
                onClick={handleLogout}
                className="dashboard-logout"
                aria-label="Log out"
              >
                <LogOut size={15} aria-hidden="true" />
                <span>Log out</span>
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="dashboard-content max-w-6xl mx-auto px-7 py-7">
          {dashboardError && <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Could not load your workspace: {dashboardError}. Check that the latest `supabase-schema.sql` has been applied.</div>}
          {tab !== "people" && (
            <section className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
              <label htmlFor="master-file-select" className="text-sm font-bold text-slate-700">Master file</label>
              {masterFiles.length > 0 ? <>
                <button type="button" disabled={selectedFileIndex < 0 || selectedFileIndex >= masterFiles.length - 1} onClick={() => selectMasterFile(masterFiles[selectedFileIndex + 1]?.id)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:opacity-40">← Previous file</button>
                <select id="master-file-select" value={selectedFileId || ""} onChange={event => selectMasterFile(event.target.value)} className="min-w-64 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium">
                  {masterFiles.map(file => <option key={file.id} value={file.id}>{file.file_name} · {new Date(file.uploaded_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}</option>)}
                </select>
                <button type="button" disabled={selectedFileIndex <= 0} onClick={() => selectMasterFile(masterFiles[selectedFileIndex - 1]?.id)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:opacity-40">Next file →</button>
                {role === "manager" && selectedMasterFile && <span className="text-xs text-slate-500">{selectedMasterFile.row_count.toLocaleString("en-IN")} rows in file</span>}
              </> : <span className="text-sm text-slate-500">{role === "manager" ? "Upload a master Excel file to create a file history." : "No master files have leads assigned to you yet."}</span>}
            </section>
          )}
          {tab === "leads" && (
            <>
              <div className="dashboard-page-intro">
                <div>
                  <div className="dashboard-breadcrumb"><Link href="/">Home</Link><span>/</span><strong>Leads</strong></div>
                  <h1>Leads</h1>
                  <p>Keep your contacts organized and move every conversation forward.</p>
                </div>
                <div className="dashboard-intro-count"><Users size={16} aria-hidden="true" /><span><strong>{leads.length.toLocaleString("en-IN")}</strong> total leads</span></div>
              </div>
              <LeadsTable
                leads={leads}
                logs={logs}
                onRefresh={() => {
                  supabase.auth.getUser().then(({ data }) => {
                    if (data.user) fetchAllLeads(role === "manager" ? managerId : data.user.id, role, managerId, selectedFileId).then(setLeads).catch(error => console.error("Error refreshing leads:", error));
                  });
                }}
                onCall={handleCall}
                canManage={role === "manager"}
                submanagers={submanagers}
                fileId={selectedFileId}
                onFileUploaded={handleMasterFileUploaded}
              />
            </>
          )}

          {tab === "logs" && (
            <div>
              <div className="dashboard-section-heading">
                <div>
                  <div className="dashboard-breadcrumb"><Link href="/">Home</Link><span>/</span><strong>Call logs</strong></div>
                  <h1>Call logs</h1>
                  <p>Review outcomes and follow-ups from your recent conversations.</p>
                </div>
                <button
                  onClick={exportCSV}
                  className="dashboard-export-button"
                >
                  ↓ Export CSV
                </button>
              </div>

              <div className="mb-4 flex flex-wrap items-center gap-2" aria-label="Call history date range">
                {[{ id: "day", label: "Today" }, { id: "week", label: "This week" }, { id: "all", label: "All dates" }].map(period => (
                  <button key={period.id} type="button" onClick={() => setCallPeriod(period.id as "day" | "week" | "all")} aria-pressed={callPeriod === period.id} className={`rounded-lg border px-3 py-2 text-xs font-bold ${callPeriod === period.id ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-600"}`}>
                    {period.label}
                  </button>
                ))}
                <span className="ml-auto text-xs text-slate-500">{selectedMasterFile?.file_name || "All files"} · {visibleCallLogs.length} calls</span>
              </div>

              <div className="table-scroll bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      {(role === "manager" ? ["Lead", "Submanager", "Company", "Phone", "Disposition", "Notes", "Date & Time"] : ["Lead", "Company", "Phone", "Disposition", "Notes", "Date & Time"]).map(h => (
                        <th
                          key={h}
                          className="px-4 py-3 text-left font-bold text-slate-600 text-2xs uppercase tracking-wider"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleCallLogs.length === 0 ? (
                      <tr>
                        <td colSpan={role === "manager" ? 7 : 6} className="text-center py-12 text-slate-400">
                          <div className="text-4xl mb-2">📋</div>
                          No call logs yet
                        </td>
                      </tr>
                    ) : (
                      visibleCallLogs
                        .map((log, i) => (
                          <tr
                            key={log.id}
                            className={`${i < visibleCallLogs.length - 1 ? "border-b border-slate-100" : ""}`}
                          >
                            <td className="px-4 py-3.5 font-bold text-slate-900">{log.lead_name}</td>
                            {role === "manager" && <td className="px-4 py-3.5 text-slate-600">{leads.find(lead => lead.id === log.lead_id)?.submanager_name || "—"}</td>}
                            <td className="px-4 py-3.5 text-slate-600">{log.company}</td>
                            <td className="px-4 py-3.5">
                              <span className="font-mono text-2xs text-slate-900">
                                {log.phone.replace(/(\+\d{2})(\d{5})(\d{5})/, "$1 $2 $3")}
                              </span>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="inline-block px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-2xs font-bold rounded-full">
                                {normalizeLeadStatus(log.disposition)}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-slate-600 max-w-48">
                              <span className="block overflow-hidden text-ellipsis whitespace-nowrap">
                                {log.notes || <em className="text-slate-300">—</em>}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-slate-400 text-2xs whitespace-nowrap">
                              {new Date(log.called_at).toLocaleString("en-IN")}
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "analytics" && (
            <>
              <div className="dashboard-page-intro">
                <div>
                  <div className="dashboard-breadcrumb"><Link href="/">Home</Link><span>/</span><strong>Analytics</strong></div>
                  <h1>Analytics</h1>
                  <p>See the activity and outcomes behind your lead pipeline.</p>
                </div>
              </div>
              <Analytics logs={logs} leads={leads} onExport={exportCSV} showSubmanager={role === "manager"} />
            </>
          )}

          {tab === "people" && role === "manager" && (
            <section className="bg-white border border-slate-200 rounded-2xl p-6">
              <h1 className="text-2xl font-bold text-slate-900">People and Access</h1>
              <p className="text-sm text-slate-500 mt-2">Upload an Excel file with submanagerName, email, and password columns to create submanager accounts.</p>
              <input className="mt-5 block" type="file" accept=".xlsx,.xls,.csv" onChange={async event => {
                const input = event.currentTarget;
                const file = input.files?.[0]; if (!file) return;
                setPeopleBusy(true); setPeopleMessage("");
                try {
                  const XLSX = await import("xlsx");
                  const bytes = await file.arrayBuffer();
                  const workbook = XLSX.read(bytes, { type: "array" });
                  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
                  const findColumn = (row: Record<string, unknown>, expected: string[]) => {
                    const aliases = new Set(expected.map(value => value.toLowerCase().replace(/[\s_-]/g, "")));
                    return Object.keys(row).find(column => aliases.has(column.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[\s_-]/g, "")));
                  };
                  const accounts = rows.map(row => {
                    const nameKey = findColumn(row, ["submanagerName", "name"]);
                    const emailKey = findColumn(row, ["email"]);
                    const passwordKey = findColumn(row, ["password"]);
                    return {
                      name: nameKey ? String(row[nameKey] ?? "").trim() : "",
                      email: emailKey ? String(row[emailKey] ?? "").trim() : "",
                      password: passwordKey ? String(row[passwordKey] ?? "") : "",
                    };
                  });
                  const invalidRows = accounts.filter(row => !row.name || !row.email || !row.password);
                  const validAccounts = accounts.filter(row => row.name && row.email && row.password);
                  if (!validAccounts.length) throw new Error(`No valid rows found. Use columns submanagerName, email, password. Found: ${rows[0] ? Object.keys(rows[0]).join(", ") : "an empty sheet"}.`);
                  const { data: session } = await supabase.auth.getSession();
                  const response = await fetch("/api/submanagers", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.session?.access_token || ""}` }, body: JSON.stringify({ accounts: validAccounts }) });
                  const result = await response.json(); if (!response.ok) throw new Error(result.error || "Account creation failed.");
                  setSubmanagers(current => [...current.filter(person => !result.people.some((created: { email: string }) => created.email.toLowerCase() === person.email.toLowerCase())), ...result.people]);
                  const skipped = invalidRows.length ? ` Skipped ${invalidRows.length} incomplete row(s).` : "";
                  setPeopleMessage(`Created ${result.created} account(s).${skipped}${result.errors?.length ? ` ${result.errors.length} row(s) failed: ${result.errors.join("; ")}` : ""}`);
                } catch (error) { setPeopleMessage(error instanceof Error ? error.message : "Could not process this file."); }
                finally { setPeopleBusy(false); input.value = ""; }
              }} />
              {peopleBusy && <p className="mt-3 text-sm">Creating accounts…</p>}
              {peopleMessage && <p className="mt-3 text-sm text-indigo-700">{peopleMessage}</p>}
              <div className="mt-6 divide-y divide-slate-100">{submanagers.map(person => <div key={person.id} className="py-3 flex justify-between"><strong>{person.name}</strong><span>{person.email}</span></div>)}</div>
            </section>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}

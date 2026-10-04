"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { ChartNoAxesCombined, House, LogOut, PhoneCall, Users } from "lucide-react";
import { normalizeLeadStatus } from "@/lib/leadStatus";
import AuthGuard from "@/components/AuthGuard";
import LeadsTable from "@/components/LeadsTable";
import CallModal from "@/components/CallModal";
import Analytics from "@/components/Analytics";

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

interface CallLog {
  id: number;
  lead_id: number;
  lead_name: string;
  company: string;
  phone: string;
  disposition: string;
  notes?: string;
  called_at: string;
}

const PAGE_SIZE = 1000;

async function fetchAllLeads(userId: string): Promise<Lead[]> {
  const allLeads: Lead[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data as Lead[] | null) || [];
    allLeads.push(...page);
    if (page.length < PAGE_SIZE) return allLeads;
  }
}

async function fetchAllCallLogs(userId: string): Promise<CallLog[]> {
  const allLogs: CallLog[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("call_logs")
      .select("*")
      .eq("user_id", userId)
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
  const dialerOpenedRef = useRef(false);
  const dialerOpenedAtRef = useRef(0);
  const router = useRouter();

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

  // Fetch leads and logs
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          router.push("/login");
          return;
        }

        const [allLeads, allLogs] = await Promise.all([
          fetchAllLeads(userData.user.id),
          fetchAllCallLogs(userData.user.id),
        ]);
        setLeads(allLeads);
        setLogs(allLogs);

        const pendingLog = allLogs.find(log => log.disposition === "Pending");
        const pendingLead = pendingLog && allLeads.find(lead => lead.id === pendingLog.lead_id);
        if (pendingLog && pendingLead) {
          setSelectedLead(pendingLead);
          setCurrentLogId(pendingLog.id);
          setModalOpen(true);
          setReturnedFromDialer(true);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  const handleCall = async (lead: Lead) => {
    if (!lead.phone?.trim()) {
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
          phone: lead.phone,
          disposition: "Pending",
          notes: "",
          user_id: userData.user.id,
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
      const dialNumber = lead.phone.replace(/[^\d+*#,;]/g, "");
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
      await supabase
        .from("leads")
        .update({
          status: disposition,
        } as never)
        .eq("id", selectedLead.id);

      // Refresh data
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        const [allLeads, allLogs] = await Promise.all([
          fetchAllLeads(userData.user.id),
          fetchAllCallLogs(userData.user.id),
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
    const active = logs.filter(l => l.disposition !== "Pending");
    const csv = [
      ["#", "Lead Name", "Company", "Phone", "Disposition", "Notes", "Date & Time"].join(","),
      ...active.map(l =>
        [l.id, `"${l.lead_name}"`, `"${l.company}"`, l.phone, normalizeLeadStatus(l.disposition), `"${(l.notes || "").replace(/"/g, "`")}"`, new Date(l.called_at).toLocaleString("en-IN")].join(",")
      )
    ].join("\n");

    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `call_report_${new Date().toISOString().slice(0, 10)}.csv`;
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
  ];

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
                    if (data.user) fetchAllLeads(data.user.id).then(setLeads).catch(error => console.error("Error refreshing leads:", error));
                  });
                }}
                onCall={handleCall}
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

              <div className="table-scroll bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      {["Lead", "Company", "Phone", "Disposition", "Notes", "Date & Time"].map(h => (
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
                    {logs.filter(l => l.disposition !== "Pending").length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-slate-400">
                          <div className="text-4xl mb-2">📋</div>
                          No call logs yet
                        </td>
                      </tr>
                    ) : (
                      logs
                        .filter(l => l.disposition !== "Pending")
                        .map((log, i) => (
                          <tr
                            key={log.id}
                            className={`${i < logs.filter(l => l.disposition !== "Pending").length - 1 ? "border-b border-slate-100" : ""}`}
                          >
                            <td className="px-4 py-3.5 font-bold text-slate-900">{log.lead_name}</td>
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
              <Analytics logs={logs} leads={leads} onExport={exportCSV} />
            </>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}

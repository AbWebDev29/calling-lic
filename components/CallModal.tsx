"use client";

import { useEffect, useState } from "react";
import { LEAD_STATUSES } from "@/lib/leadStatus";

interface Lead {
  id: number;
  name: string;
  phone: string;
  company?: string;
}

interface CallModalProps {
  lead: Lead | null;
  isOpen: boolean;
  callReturnedFromDialer: boolean;
  onClose: () => void;
  onSave: (disposition: string, notes: string) => Promise<void>;
}

const DISPOSITIONS = LEAD_STATUSES;

export default function CallModal({ lead, isOpen, callReturnedFromDialer, onClose, onSave }: CallModalProps) {
  const [disposition, setDisposition] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDisposition("");
      setNotes("");
      setIsSaving(false);
    }
  }, [isOpen, lead?.id]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(disposition, notes);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !lead) return null;

  const AVATAR_COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#14b8a6", "#f43f5e"];
  const avatarColor = (id: number) => AVATAR_COLORS[id % AVATAR_COLORS.length];
  
  const initials = (name: string) =>
    name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();

  const formatPhone = (p: string) =>
    p.replace(/(\+\d{2})(\d{5})(\d{5})/, "$1 $2 $3") || p;

  return (
    <div className="fixed inset-0 z-50 min-h-screen bg-slate-900/65 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl p-7.5 w-full max-w-md shadow-3xl">
        {/* Header */}
        <div className="flex items-center gap-3.5 mb-5.5">
          <div
            className="w-11.5 h-11.5 rounded-full text-white flex items-center justify-center text-lg font-black flex-shrink-0"
            style={{ backgroundColor: avatarColor(lead.id) } as React.CSSProperties}
          >
            {initials(lead.name)}
          </div>
          <div>
            <div className="font-black text-lg text-slate-900">{lead.name}</div>
            <div className="text-xs text-slate-600">{lead.company}</div>
          </div>
        </div>

        {/* Call initiated message */}
        <div className={`rounded-xl p-3 mb-5.5 text-xs ${callReturnedFromDialer ? "bg-indigo-50 border border-indigo-200 text-indigo-800" : "bg-slate-50 border border-slate-200 text-slate-700"}`}>
          <strong>{callReturnedFromDialer ? "Welcome back" : "Your phone dialer is opening"}</strong>
          <div className="mt-1">Call to <strong className="font-mono">{formatPhone(lead.phone)}</strong></div>
          <div className="text-2xs mt-1 opacity-80">Choose the outcome below to save this call and update the lead.</div>
        </div>

        {/* Disposition select */}
        <label className="block mb-2">
          <span className="text-2xs font-bold text-slate-600 uppercase tracking-widest">Call Outcome</span>
          <select
            value={disposition}
            onChange={e => setDisposition(e.target.value)}
            required
            className="block w-full mt-1.5 px-3.5 py-2.5 border-1.5 border-slate-200 rounded-lg text-sm bg-white outline-none cursor-pointer text-slate-900 font-bold"
          >
            <option value="" disabled>Choose an outcome</option>
            {DISPOSITIONS.map(d => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>

        {/* Notes textarea */}
        <label className="block mt-4 mb-5.5">
          <span className="text-2xs font-bold text-slate-600 uppercase tracking-widest">Notes</span>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Very interested, call back Thursday…"
            rows={3}
            className="block w-full mt-1.5 px-3.5 py-2.5 border-1.5 border-slate-200 rounded-lg text-xs bg-white outline-none resize-vertical font-inherit"
            aria-label="Call notes"
          />
        </label>

        {/* Actions */}
        <div className="flex gap-2.5">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="flex-1 px-0 py-2.75 bg-slate-100 text-slate-600 border-1.5 border-slate-200 rounded-lg text-sm font-bold cursor-pointer hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !disposition}
            className="flex-auto px-0 py-2.75 bg-slate-900 text-white border-none rounded-lg text-sm font-bold cursor-pointer hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "✅ Save Log"}
          </button>
        </div>
      </div>
    </div>
  );
}

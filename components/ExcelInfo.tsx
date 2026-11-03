"use client";

import * as XLSX from "xlsx";

export default function ExcelInfo() {
  const downloadTemplate = () => {
    const data = [
      ["name", "phone", "email", "submanager_name", "leader_code", "nop", "prem", "utsaav", "ulip"],
      ["John Doe", "+1234567890", "john@example.com", "Anvi", "LDR123", 5, 10000, 2000, 5000],
      ["Jane Smith", "+0987654321", "jane@smith.com", "Anvi", "LDR456", 2, 5000, 1000, 2000]
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Leads Template");
    XLSX.writeFile(wb, "lead_template.xlsx");
  };

  return (
    <div className="excel-info-card bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-6">
      <div className="flex items-start gap-4">
        <div className="text-2xl text-indigo-600">📊</div>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-indigo-900 uppercase tracking-wider mb-1">
            Data Requirements
          </h3>
          <p className="text-sm text-indigo-800 mb-3 leading-relaxed">
            Include <code className="bg-indigo-100 px-1 rounded font-bold">name</code>,{" "}
            <code className="bg-indigo-100 px-1 rounded font-bold">phone</code>,{" "}
            <code className="bg-indigo-100 px-1 rounded font-bold">email</code>, and{" "}
            <code className="bg-indigo-100 px-1 rounded font-bold">submanager_name</code> to assign a caller. Optional columns: leader_code, nop, prem, utsaav, ulip.
          </p>
          <button
            onClick={downloadTemplate}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors"
          >
            📥 Download Sample Template
          </button>
        </div>
      </div>
    </div>
  );
}

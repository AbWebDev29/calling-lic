"use client";

import * as XLSX from "xlsx";

export default function ExcelInfo() {
  const downloadTemplate = () => {
    const data = [
      ["NAME", "PHONE", "Email", "leader code", "NOP", "PREM", "UTSAAV", "ULIP", "CAT1", "CAT2"],
      ["John Doe", "+1234567890", "john@example.com", "LDR123", 5, 10000, 2000, 5000, "A1", 1],
      ["Jane Smith", "+0987654321", "jane@smith.com", "LDR456", 2, 5000, 1000, 2000, "B2", 2]
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Leads Template");
    XLSX.writeFile(wb, "lead_template.xlsx");
  };

  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6">
      <div className="flex items-start gap-4">
        <div className="text-2xl text-emerald-600">📊</div>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-emerald-900 uppercase tracking-wider mb-1">
            Data Requirements
          </h3>
          <p className="text-sm text-emerald-700 mb-3 leading-relaxed">
            Your Excel file must include these exact headers:{" "}
            <code className="bg-emerald-100 px-1 rounded font-bold">NAME</code>,{" "}
            <code className="bg-emerald-100 px-1 rounded font-bold">PHONE</code>,{" "}
            <code className="bg-emerald-100 px-1 rounded font-bold">Email</code>,{" "}
            <code className="bg-emerald-100 px-1 rounded font-bold">leader code</code>,{" "}
            <code className="bg-emerald-100 px-1 rounded font-bold">NOP</code>,{" "}
            <code className="bg-emerald-100 px-1 rounded font-bold">PREM</code>,{" "}
            <code className="bg-emerald-100 px-1 rounded font-bold">UTSAAV</code>,{" "}
            <code className="bg-emerald-100 px-1 rounded font-bold">ULIP</code>,{" "}
            <code className="bg-emerald-100 px-1 rounded font-bold">CAT1</code>,{" "}
            <code className="bg-emerald-100 px-1 rounded font-bold">CAT2</code>.
          </p>
          <button
            onClick={downloadTemplate}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors"
          >
            📥 Download Sample Template
          </button>
        </div>
      </div>
    </div>
  );
}

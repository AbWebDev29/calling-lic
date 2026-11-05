"use client";

import * as XLSX from "xlsx";

export default function ExcelInfo() {
  const downloadTemplate = () => {
    const data = [
      ["agentCode", "name", "mobile", "submanagerName", "leaderCode", "data1", "data2", "data3", "data4"],
      ["AGT001", "John Doe", "1234567890", "Anvi", "LDR123", "A", "B", "C", "D"],
      ["AGT002", "Jane Smith", "0987654321", "Anvi", "LDR456", "E", "F", "G", "H"]
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
            Use exactly these columns in order: <code className="bg-indigo-100 px-1 rounded font-bold">agentCode</code>, <code className="bg-indigo-100 px-1 rounded font-bold">name</code>, <code className="bg-indigo-100 px-1 rounded font-bold">mobile</code>, <code className="bg-indigo-100 px-1 rounded font-bold">submanagerName</code>, <code className="bg-indigo-100 px-1 rounded font-bold">leaderCode</code>, <code className="bg-indigo-100 px-1 rounded font-bold">data1</code>, <code className="bg-indigo-100 px-1 rounded font-bold">data2</code>, <code className="bg-indigo-100 px-1 rounded font-bold">data3</code>, and <code className="bg-indigo-100 px-1 rounded font-bold">data4</code>.
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

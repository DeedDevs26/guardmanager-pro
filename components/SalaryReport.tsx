import React, { useState } from 'react';
import jsPDF from 'jspdf';
import { db } from '../services/db';
import { SalarySlip } from '../types';

const fmt = (n: number) => `Rs.${n.toLocaleString('en-IN')}`;

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const getRangeLabel = (from: string, to: string) => `${fmtDate(from)}  –  ${fmtDate(to)}`;

// default: first day of current month → today
const today = new Date().toISOString().split('T')[0];
const firstOfMonth = today.slice(0, 7) + '-01';

export const SalaryReport: React.FC = () => {
  const [fromDate, setFromDate] = useState(firstOfMonth);
  const [toDate, setToDate] = useState(today);
  const [slips, setSlips] = useState<SalarySlip[]>([]);
  const [rangeLabel, setRangeLabel] = useState(''); // label at time of last calculation

  // Clear results whenever date range changes so stale data is never shown
  const handleFromChange = (v: string) => { setFromDate(v); setSlips([]); };
  const handleToChange = (v: string) => { setToDate(v); setSlips([]); };

  // ── Calculate ──
  const calculateSalary = () => {
    if (!fromDate || !toDate || fromDate > toDate) {
      alert('Please set a valid date range (From ≤ To).');
      return;
    }
    const guards = db.guards.getAll();
    const allAttendance = db.attendance.getAll();
    const allExpenses = db.expenses.getAll();

    const report: SalarySlip[] = guards.map(guard => {
      // Filter by date range
      const guardAttendance = allAttendance.filter(a =>
        a.guardId === guard.id && a.date >= fromDate && a.date <= toDate
      );

      let presentShifts = 0;
      let foodCount = 0;

      guardAttendance.forEach(record => {
        ['morning', 'evening', 'night'].forEach(key => {
          const shift = (record as any)[key];
          if (shift.status === 'Present') {
            presentShifts++;
            if (shift.foodTaken) foodCount++;
          }
        });
      });

      const guardExpenses = allExpenses.filter(e =>
        e.guardId === guard.id && e.date >= fromDate && e.date <= toDate
      );

      // Advance only
      const totalAdvance = guardExpenses
        .filter(e => e.type === 'Advance')
        .reduce((sum, e) => sum + e.amount, 0);

      // Others (everything that isn't Advance or Uniform)
      const totalOthers = guardExpenses
        .filter(e => e.type === 'Other')
        .reduce((sum, e) => sum + e.amount, 0);

      // Uniform — dated expense entries only
      const uniformDeduction = guardExpenses
        .filter(e => e.type === 'Uniform')
        .reduce((sum, e) => sum + e.amount, 0);

      const grossSalary = presentShifts * guard.salaryPerShift;
      const totalFoodCost = foodCount * guard.foodCostPerShift;
      const netSalary = grossSalary - totalAdvance - totalOthers - totalFoodCost - uniformDeduction;

      return {
        guardId: guard.id,
        guardName: guard.name,
        month: `${fromDate} to ${toDate}`,
        totalShifts: presentShifts,
        grossSalary,
        totalAdvance,
        totalOthers,
        totalFoodCost,
        uniformDeduction,
        netSalary,
      };
    });

    setRangeLabel(getRangeLabel(fromDate, toDate));
    setSlips(report);
  };

  // ── Print (popup window) ──
  const handlePrint = () => {
    if (slips.length === 0) { alert('Please calculate the report first.'); return; }
    const totalGross = slips.reduce((a, b) => a + b.grossSalary, 0);
    const totalAdv = slips.reduce((a, b) => a + b.totalAdvance, 0);
    const totalOth = slips.reduce((a, b) => a + b.totalOthers, 0);
    const totalFood = slips.reduce((a, b) => a + b.totalFoodCost, 0);
    const totalUni = slips.reduce((a, b) => a + b.uniformDeduction, 0);
    const totalNet = slips.reduce((a, b) => a + b.netSalary, 0);
    const totalShifts = slips.reduce((a, b) => a + b.totalShifts, 0);

    const rows = slips.map((s, i) => `
      <tr style="background:${i % 2 === 0 ? '#f8faff' : '#fff'}">
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-weight:600">${s.guardName}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center">${s.totalShifts}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right">${fmt(s.grossSalary)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;color:#dc2626">- ${fmt(s.totalAdvance)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;color:#dc2626">- ${fmt(s.totalFoodCost)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;color:#dc2626">- ${fmt(s.uniformDeduction)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;color:#dc2626">- ${fmt(s.totalOthers)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;color:#1152d4">${fmt(s.netSalary)}</td>
      </tr>`).join('');

    const html = `
      <html><head><title>Salary Report – ${rangeLabel}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a1a; padding: 30px; }
        @media print { body { padding: 10px; } }
        h1 { font-size: 22px; color: #1152d4; letter-spacing: 1px; }
        .sub { color: #555; font-size: 11px; margin-top: 2px; }
        .badge { background:#e8f0ff;color:#1152d4;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;border:1px solid #c7d7f5; }
        .divider { border: none; border-top: 2px solid #1152d4; margin: 14px 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        thead tr { background: #1152d4; color: #fff; }
        th { padding: 9px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; }
        tfoot tr { background: #1a1a2e; color: #fff; }
        tfoot td { padding: 9px 12px; font-weight: 700; }
        .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #e2e8f0; padding-top: 10px; }
      </style></head>
      <body>
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <h1>GuardManager Pro</h1>
            <div class="sub">Salary Report  —  ${rangeLabel}</div>
            <div class="sub">Generated on: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
          </div>
          <div class="badge">OFFICIAL SALARY STATEMENT</div>
        </div>
        <hr class="divider"/>
        <table>
          <thead>
            <tr>
              <th style="text-align:left">Guard Name</th>
              <th style="text-align:center">Shifts</th>
              <th style="text-align:right">Gross Salary</th>
              <th style="text-align:right">Advance</th>
              <th style="text-align:right">Food Ded.</th>
              <th style="text-align:right">Uniform</th>
              <th style="text-align:right">Others</th>
              <th style="text-align:right">Net Salary</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr>
              <td>TOTALS</td>
              <td style="text-align:center">${totalShifts}</td>
              <td style="text-align:right">${fmt(totalGross)}</td>
              <td style="text-align:right">${fmt(totalAdv)}</td>
              <td style="text-align:right">${fmt(totalFood)}</td>
              <td style="text-align:right">${fmt(totalUni)}</td>
              <td style="text-align:right">${fmt(totalOth)}</td>
              <td style="text-align:right">${fmt(totalNet)}</td>
            </tr>
          </tfoot>
        </table>
        <div class="footer">GuardManager Pro &nbsp;|&nbsp; Offline Desktop System &nbsp;|&nbsp; ${new Date().toLocaleDateString()}</div>
      </body></html>`;

    const win = window.open('', '_blank', 'width=960,height=720');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 350);
  };

  // ── Per-guard Slip PDF ──
  const downloadGuardSlip = (slip: SalarySlip) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 18;
    const contentW = pageW - margin * 2;
    const blue: [number, number, number] = [17, 82, 212];
    const dark: [number, number, number] = [26, 26, 26];
    const gray: [number, number, number] = [100, 100, 100];
    const white: [number, number, number] = [255, 255, 255];
    const lightBlue: [number, number, number] = [232, 240, 255];
    const red: [number, number, number] = [220, 38, 38];
    const slipRange = getRangeLabel(fromDate, toDate);
    let y = margin;

    // Header
    doc.setFillColor(...blue);
    doc.rect(margin, y, contentW, 26, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...white);
    doc.text('SALARY SLIP', margin + 5, y + 10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(210, 225, 255);
    doc.text('GuardManager Pro  |  Offline Desktop System', margin + 5, y + 17);
    doc.text(`Period: ${slipRange}`, margin + 5, y + 23);
    doc.setFontSize(8);
    doc.setTextColor(...white);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, pageW - margin - 4, y + 10, { align: 'right' });
    y += 32;

    // Guard name banner
    doc.setFillColor(...lightBlue);
    doc.roundedRect(margin, y, contentW, 12, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...blue);
    doc.text(slip.guardName, margin + 5, y + 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...gray);
    doc.text('Employee', pageW - margin - 4, y + 8, { align: 'right' });
    y += 18;

    // Breakdown rows
    const rowH = 10;
    const rows: { label: string; value: string; color: [number, number, number] }[] = [
      { label: 'Shifts Present', value: String(slip.totalShifts), color: dark },
      { label: 'Gross Salary  (shifts × rate)', value: `Rs.${slip.grossSalary.toLocaleString('en-IN')}`, color: dark },
      { label: '(-) Food Deduction', value: `- Rs.${slip.totalFoodCost.toLocaleString('en-IN')}`, color: red },
      { label: '(-) Uniform Deduction', value: `- Rs.${slip.uniformDeduction.toLocaleString('en-IN')}`, color: red },
      { label: '(-) Others', value: `- Rs.${slip.totalOthers.toLocaleString('en-IN')}`, color: red },
    ];

    rows.forEach((row, i) => {
      const bg: [number, number, number] = i % 2 === 0 ? [248, 250, 255] : white;
      doc.setFillColor(...bg);
      doc.rect(margin, y, contentW, rowH, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.line(margin, y + rowH, margin + contentW, y + rowH);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...dark);
      doc.text(row.label, margin + 4, y + 6.5);
      doc.setTextColor(...row.color);
      doc.text(row.value, pageW - margin - 4, y + 6.5, { align: 'right' });
      y += rowH;
    });

    // Net salary box
    y += 4;
    doc.setFillColor(...blue);
    doc.roundedRect(margin, y, contentW, 13, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...white);
    doc.text('NET SALARY PAYABLE', margin + 5, y + 8.5);
    doc.setFontSize(13);
    doc.text(`Rs.${slip.netSalary.toLocaleString('en-IN')}`, pageW - margin - 4, y + 8.5, { align: 'right' });
    y += 22;

    // Signature lines
    doc.setDrawColor(...gray);
    doc.setLineWidth(0.3);
    doc.line(margin, y + 12, margin + 55, y + 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...gray);
    doc.text('Employee Signature', margin + 27, y + 16, { align: 'center' });
    doc.line(pageW - margin - 55, y + 12, pageW - margin, y + 12);
    doc.text('Authorized Signatory', pageW - margin - 27, y + 16, { align: 'center' });
    y += 24;

    // Footer
    doc.setDrawColor(...blue);
    doc.setLineWidth(0.4);
    doc.line(margin, y, pageW - margin, y);
    y += 5;
    doc.setFontSize(7.5);
    doc.setTextColor(...gray);
    doc.text('This is a computer-generated salary slip. No signature required if digitally authorized.', pageW / 2, y, { align: 'center' });

    doc.save(`Slip-${slip.guardName.replace(/\s+/g, '_')}-${fromDate}-to-${toDate}.pdf`);
  };

  // ── All-guards PDF Download ──
  const handleDownloadPDF = () => {
    if (slips.length === 0) { alert('Please calculate the report first.'); return; }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 14;
    const contentW = pageW - margin * 2;
    const blue: [number, number, number] = [17, 82, 212];
    const dark: [number, number, number] = [26, 26, 26];
    const gray: [number, number, number] = [85, 85, 85];
    const white: [number, number, number] = [255, 255, 255];
    const lightBlue: [number, number, number] = [232, 240, 255];

    let y = margin;

    // Header bar
    const headerH = 22;
    doc.setFillColor(...blue);
    doc.rect(margin, y, contentW, headerH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...white);
    doc.text('GuardManager Pro', margin + 5, y + 9);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(210, 225, 255);
    doc.text(`Salary Report  –  ${rangeLabel}`, margin + 5, y + 17);
    doc.setFontSize(8.5);
    doc.setTextColor(...white);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, pageW - margin - 4, y + 9, { align: 'right' });
    y += headerH + 6;

    // Columns
    const cols = [
      { label: 'Guard Name', w: 46, align: 'left' },
      { label: 'Shifts', w: 16, align: 'center' },
      { label: 'Gross Salary', w: 30, align: 'right' },
      { label: 'Advance', w: 26, align: 'right' },
      { label: 'Food Ded.', w: 24, align: 'right' },
      { label: 'Uniform', w: 24, align: 'right' },
      { label: 'Others', w: 24, align: 'right' },
      { label: 'Net Salary', w: 30, align: 'right' },
    ];

    const colX: number[] = [margin];
    cols.slice(0, -1).forEach((c, i) => colX.push(colX[i] + c.w));
    const rowH = 8;

    // Table header
    doc.setFillColor(...blue);
    doc.rect(margin, y, contentW, rowH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...white);
    cols.forEach((col, i) => {
      const x = col.align === 'right'
        ? colX[i] + col.w - 2
        : col.align === 'center'
          ? colX[i] + col.w / 2
          : colX[i] + 2;
      doc.text(col.label, x, y + 5.5, { align: col.align as any });
    });
    y += rowH;

    // Rows
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    slips.forEach((slip, idx) => {
      const bg: [number, number, number] = idx % 2 === 0 ? [248, 250, 255] : white;
      doc.setFillColor(...bg);
      doc.rect(margin, y, contentW, rowH, 'F');

      const cells = [
        slip.guardName,
        String(slip.totalShifts),
        fmt(slip.grossSalary),
        `- ${fmt(slip.totalAdvance)}`,
        `- ${fmt(slip.totalFoodCost)}`,
        `- ${fmt(slip.uniformDeduction)}`,
        `- ${fmt(slip.totalOthers)}`,
        fmt(slip.netSalary),
      ];

      cells.forEach((cell, i) => {
        const col = cols[i];
        if (i === 7) doc.setTextColor(...blue);
        else if (i >= 3 && i <= 6) doc.setTextColor(220, 38, 38);
        else doc.setTextColor(...dark);

        const x = col.align === 'right'
          ? colX[i] + col.w - 2
          : col.align === 'center'
            ? colX[i] + col.w / 2
            : colX[i] + 2;
        doc.text(cell, x, y + 5.5, { align: col.align as any });
      });

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.line(margin, y + rowH, margin + contentW, y + rowH);
      y += rowH;
    });

    // Totals row
    y += 1;
    doc.setFillColor(26, 26, 46);
    doc.rect(margin, y, contentW, rowH + 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...white);
    const totals = [
      'TOTALS',
      String(slips.reduce((a, b) => a + b.totalShifts, 0)),
      fmt(slips.reduce((a, b) => a + b.grossSalary, 0)),
      fmt(slips.reduce((a, b) => a + b.totalAdvance, 0)),
      fmt(slips.reduce((a, b) => a + b.totalFoodCost, 0)),
      fmt(slips.reduce((a, b) => a + b.uniformDeduction, 0)),
      fmt(slips.reduce((a, b) => a + b.totalOthers, 0)),
      fmt(slips.reduce((a, b) => a + b.netSalary, 0)),
    ];
    totals.forEach((t, i) => {
      const col = cols[i];
      const x = col.align === 'right'
        ? colX[i] + col.w - 2
        : col.align === 'center'
          ? colX[i] + col.w / 2
          : colX[i] + 2;
      doc.text(t, x, y + 6, { align: col.align as any });
    });
    y += rowH + 6;

    // Summary box
    const totalNet = slips.reduce((a, b) => a + b.netSalary, 0);
    doc.setFillColor(...lightBlue);
    doc.roundedRect(margin, y, contentW, 10, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...blue);
    doc.text(`Total Payable (${rangeLabel}):`, margin + 4, y + 6.5);
    doc.setFontSize(11);
    doc.text(fmt(totalNet), pageW - margin - 4, y + 6.5, { align: 'right' });
    y += 16;

    // Footer
    doc.setDrawColor(...blue);
    doc.setLineWidth(0.4);
    doc.line(margin, y, pageW - margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...gray);
    doc.text('GuardManager Pro  |  Offline Desktop System  |  Confidential', pageW / 2, y, { align: 'center' });

    doc.save(`Salary-Report-${fromDate}-to-${toDate}.pdf`);
  };

  return (
    <div className="p-8 h-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-start mb-6 flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Salary Report</h2>
          <p className="text-slate-500 text-sm">Automatic calculation based on attendance and advances</p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Date range */}
          <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-lg px-3 py-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">From</span>
            <input
              type="date"
              className="bg-transparent text-sm text-slate-700 outline-none cursor-pointer"
              value={fromDate}
              max={toDate}
              onChange={e => handleFromChange(e.target.value)}
            />
            <span className="text-slate-400 mx-1">→</span>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">To</span>
            <input
              type="date"
              className="bg-transparent text-sm text-slate-700 outline-none cursor-pointer"
              value={toDate}
              min={fromDate}
              onChange={e => handleToChange(e.target.value)}
            />
          </div>

          <button
            onClick={calculateSalary}
            className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            Calculate Report
          </button>
          <button
            onClick={handlePrint}
            disabled={slips.length === 0}
            className="bg-slate-700 text-white px-4 py-2 rounded-lg hover:bg-slate-800 flex items-center gap-2 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="material-icons text-sm">print</span> Print
          </button>
          <button
            onClick={handleDownloadPDF}
            disabled={slips.length === 0}
            className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 flex items-center gap-2 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="material-icons text-sm">picture_as_pdf</span> Download PDF
          </button>
        </div>
      </div>

      {/* Active range badge shown when results are loaded */}
      {slips.length > 0 && (
        <div className="mb-3 flex items-center gap-2 text-xs text-primary font-semibold bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 w-fit">
          <span className="material-icons text-sm">date_range</span>
          Results for: {rangeLabel}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
        {slips.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2">
            <span className="material-icons text-4xl">summarize</span>
            <p className="text-sm">Set a date range and click <strong>Calculate Report</strong> to generate salary slips.</p>
          </div>
        ) : (
          <div className="overflow-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-4 text-xs font-bold text-slate-500 uppercase">Guard Name</th>
                  <th className="px-5 py-4 text-xs font-bold text-slate-500 uppercase text-center">Total Shifts</th>
                  <th className="px-5 py-4 text-xs font-bold text-slate-500 uppercase text-right">Gross Salary</th>
                  <th className="px-5 py-4 text-xs font-bold text-slate-500 uppercase text-right text-red-500">Advance</th>
                  <th className="px-5 py-4 text-xs font-bold text-slate-500 uppercase text-right text-red-500">Food Ded.</th>
                  <th className="px-5 py-4 text-xs font-bold text-slate-500 uppercase text-right text-red-500">Uniform</th>
                  <th className="px-5 py-4 text-xs font-bold text-slate-500 uppercase text-right text-red-500">Others</th>
                  <th className="px-5 py-4 text-xs font-bold text-slate-700 uppercase text-right bg-slate-100">Net Salary</th>
                  <th className="px-5 py-4 text-xs font-bold text-slate-500 uppercase text-center">Slip</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {slips.map((slip) => (
                  <tr key={slip.guardId} className="hover:bg-slate-50">
                    <td className="px-5 py-4 font-bold text-slate-700">{slip.guardName}</td>
                    <td className="px-5 py-4 text-center">{slip.totalShifts}</td>
                    <td className="px-5 py-4 text-right">₹{slip.grossSalary.toLocaleString()}</td>
                    <td className="px-5 py-4 text-right text-red-500">- ₹{slip.totalAdvance.toLocaleString()}</td>
                    <td className="px-5 py-4 text-right text-red-500">- ₹{slip.totalFoodCost.toLocaleString()}</td>
                    <td className="px-5 py-4 text-right text-red-500">- ₹{slip.uniformDeduction.toLocaleString()}</td>
                    <td className="px-5 py-4 text-right text-red-500">- ₹{slip.totalOthers.toLocaleString()}</td>
                    <td className="px-5 py-4 text-right font-bold text-primary bg-slate-50 border-l border-slate-100">
                      ₹{slip.netSalary.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => downloadGuardSlip(slip)}
                        title={`Download salary slip for ${slip.guardName}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 hover:border-emerald-400 transition text-xs font-semibold"
                      >
                        <span className="material-icons text-sm">picture_as_pdf</span>
                        Slip
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-300 font-bold">
                <tr>
                  <td className="px-5 py-4">TOTALS</td>
                  <td className="px-5 py-4 text-center">{slips.reduce((a, b) => a + b.totalShifts, 0)}</td>
                  <td className="px-5 py-4 text-right">₹{slips.reduce((a, b) => a + b.grossSalary, 0).toLocaleString()}</td>
                  <td className="px-5 py-4 text-right">₹{slips.reduce((a, b) => a + b.totalAdvance, 0).toLocaleString()}</td>
                  <td className="px-5 py-4 text-right">₹{slips.reduce((a, b) => a + b.totalFoodCost, 0).toLocaleString()}</td>
                  <td className="px-5 py-4 text-right">₹{slips.reduce((a, b) => a + b.uniformDeduction, 0).toLocaleString()}</td>
                  <td className="px-5 py-4 text-right">₹{slips.reduce((a, b) => a + b.totalOthers, 0).toLocaleString()}</td>
                  <td className="px-5 py-4 text-right text-primary">₹{slips.reduce((a, b) => a + b.netSalary, 0).toLocaleString()}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
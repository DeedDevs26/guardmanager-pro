import React, { useState, useEffect, useCallback } from 'react';
import { jsPDF } from 'jspdf';
import { db } from '../services/db';
import { postJson } from '../services/api';
import { AccountRecord, AccountCategory } from '../types';

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (amount: number) =>
  `Rs.${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDisplay = (amount: number) =>
  `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

// Default range: 1st of current month → today
const today = () => new Date().toISOString().split('T')[0];
const firstOfMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

// ── PDF Export ───────────────────────────────────────────────────────────────
function exportPDF(
  filtered: AccountRecord[],
  startDate: string,
  endDate: string,
  totalIncome: number,
  totalExpense: number,
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = 0;

  // ── Header banner ──
  doc.setFillColor(17, 82, 212);
  doc.rect(0, 0, pageW, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('GuardManager Pro', margin, 11);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Account Statement', margin, 18);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, pageW - margin, 18, { align: 'right' });

  y = 34;

  // ── Period ──
  doc.setTextColor(60, 60, 60);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`Period: ${fmtDate(startDate)} to ${fmtDate(endDate)}`, margin, y);
  y += 10;

  // ── Summary boxes ──
  const boxH = 16;
  const boxW = (pageW - margin * 2 - 8) / 3;

  const drawBox = (x: number, label: string, value: string, r: number, g: number, b: number) => {
    doc.setFillColor(r, g, b);
    doc.roundedRect(x, y, boxW, boxH, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.text(label, x + boxW / 2, y + 5, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(value, x + boxW / 2, y + 12, { align: 'center' });
  };

  const balance = totalIncome - totalExpense;
  drawBox(margin, 'INCOME', fmt(totalIncome), 16, 185, 129);
  drawBox(margin + boxW + 4, 'EXPENSE', fmt(totalExpense), 239, 68, 68);
  const bColor = balance >= 0 ? [17, 82, 212] as const : [245, 158, 11] as const;
  drawBox(margin + (boxW + 4) * 2, 'NET BALANCE', (balance >= 0 ? '+' : '') + fmt(balance), bColor[0], bColor[1], bColor[2]);

  y += boxH + 10;

  // ── Table header ──
  const colX = [margin, margin + 20, margin + 46, margin + 105, margin + 140, margin + 165];
  const headers = ['#', 'Date', 'Description', 'Category', 'Type', 'Amount'];

  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, pageW - margin * 2, 8, 'F');
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  headers.forEach((h, i) => {
    const align = i === 5 ? 'right' : 'left';
    const x = i === 5 ? colX[i] + 25 : colX[i];
    doc.text(h, x, y + 5.5, { align });
  });
  y += 8;

  // ── Table rows ──
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  filtered.forEach((r, idx) => {
    if (y > 270) {
      doc.addPage();
      y = 14;
    }
    const rowBg = idx % 2 === 0;
    if (rowBg) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, pageW - margin * 2, 7.5, 'F');
    }

    doc.setTextColor(80, 80, 80);
    doc.text(String(idx + 1), colX[0], y + 5);
    doc.text(fmtDate(r.date), colX[1], y + 5);

    // Truncate long description
    const desc = r.description.length > 36 ? r.description.slice(0, 34) + '…' : r.description;
    doc.text(desc, colX[2], y + 5);

    const cat = r.category.length > 16 ? r.category.slice(0, 14) + '…' : r.category;
    doc.text(cat, colX[3], y + 5);

    // Type badge colour
    if (r.type === 'expense') {
      doc.setTextColor(239, 68, 68);
    } else {
      doc.setTextColor(16, 185, 129);
    }
    doc.text(r.type.charAt(0).toUpperCase() + r.type.slice(1), colX[4], y + 5);

    // Amount right-aligned
    const sign = r.type === 'expense' ? '-' : '+';
    doc.setFont('helvetica', 'bold');
    const amtTxt = sign + fmt(r.amount);
    doc.text(amtTxt, colX[5] + 25, y + 5, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);

    y += 7.5;
  });

  // ── Footer line ──
  y += 4;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, pageW - margin, y);
  y += 5;
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(`Total ${filtered.length} record(s)  |  GuardManager Pro — Confidential`, margin, y);

  const filename = `account-statement-${startDate}-to-${endDate}.pdf`;
  const base64 = doc.output('datauristring');

  postJson('/api/export/pdf', { filename, base64 })
    .then(() => alert(`Statement saved to configured exports folder as ${filename}`))
    .catch(err => alert('Failed to save PDF: ' + (err instanceof Error ? err.message : String(err))));
}

// ── Main Component ────────────────────────────────────────────────────────────
export const Accounts: React.FC = () => {
  const [records, setRecords] = useState<AccountRecord[]>([]);

  // Date range filter — default: 1st of month → today
  const [startDate, setStartDate] = useState(firstOfMonth());
  const [endDate, setEndDate] = useState(today());

  const [filterCategory, setFilterCategory] = useState('');
  const [filterType, setFilterType] = useState<'' | 'expense' | 'income'>('');

  const [form, setForm] = useState<Partial<AccountRecord>>({
    date: today(),
    type: 'expense',
    category: '',
    description: '',
    amount: undefined,
  });
  const [formError, setFormError] = useState('');

  const [savedCategories, setSavedCategories] = useState<AccountCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [customCategoryName, setCustomCategoryName] = useState<string>('');

  const refresh = useCallback(() => {
    setRecords(db.accounts.getAll());
    setSavedCategories(db.categories.getAll());
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // ── Filtered records (date range + category + type) ──
  const filtered = records.filter(r => {
    if (startDate && r.date < startDate) return false;
    if (endDate && r.date > endDate) return false;
    if (filterCategory && r.category !== filterCategory) return false;
    if (filterType && r.type !== filterType) return false;
    return true;
  });

  // ── Summary stats for selected range ──
  const rangeIncome = filtered.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0);
  const rangeExpense = filtered.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
  const rangeBalance = rangeIncome - rangeExpense;

  // ── All categories for dropdown ──
  const allCategories = [...new Set(records.map(r => r.category))].sort();

  // ── Form submit ──
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!form.date) { setFormError('Date is required.'); return; }
    if (!form.description?.trim()) { setFormError('Description is required.'); return; }
    if (!form.category) { setFormError('Category is required.'); return; }
    if (!form.amount || form.amount <= 0) { setFormError('Enter a valid amount.'); return; }

    db.accounts.add({
      id: `acc_${Date.now()}`,
      date: form.date,
      description: form.description.trim(),
      category: form.category,
      amount: Number(form.amount),
      type: form.type as 'expense' | 'income',
      createdAt: new Date().toISOString(),
    });

    setForm({ date: today(), type: 'expense', category: '', description: '', amount: undefined });
    setSelectedCategoryId('');
    setCustomCategoryName('');
    refresh();
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this record?')) { db.accounts.delete(id); refresh(); }
  };

  const handleExportPDF = () => {
    if (filtered.length === 0) { alert('No records to export for the selected range.'); return; }
    exportPDF(filtered, startDate, endDate, rangeIncome, rangeExpense);
  };

  const clearFilters = () => {
    setStartDate(firstOfMonth()); setEndDate(today());
    setFilterCategory(''); setFilterType('');
  };

  const hasActiveFilters = filterCategory || filterType ||
    startDate !== firstOfMonth() || endDate !== today();

  const monthLabel = startDate === endDate
    ? fmtDate(startDate)
    : `${fmtDate(startDate)} - ${fmtDate(endDate)}`;

  return (
    <div className="p-6 h-full flex flex-col gap-5 overflow-auto">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Accounts</h2>
          <p className="text-slate-500 text-sm mt-0.5">Track income &amp; expenses</p>
        </div>
        <button
          onClick={handleExportPDF}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition shadow-sm active:scale-95"
        >
          <span className="material-icons text-base">picture_as_pdf</span>
          Export PDF
        </button>
      </div>

      {/* ── Summary Cards (driven by date range) ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard icon="trending_down" label="Period Expense" value={fmtDisplay(rangeExpense)} color="bg-red-500" sub={monthLabel} />
        <SummaryCard icon="trending_up"   label="Period Income"  value={fmtDisplay(rangeIncome)}  color="bg-emerald-500" sub={monthLabel} />
        <SummaryCard
          icon={rangeBalance >= 0 ? 'account_balance' : 'warning'}
          label="Period Balance"
          value={(rangeBalance >= 0 ? '+' : '') + fmtDisplay(rangeBalance)}
          color={rangeBalance >= 0 ? 'bg-primary' : 'bg-amber-500'}
          sub={rangeBalance >= 0 ? 'Profit' : 'Loss'}
        />
      </div>

      {/* ── Main Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 flex-1 min-h-0">

        {/* Left: Add Entry Form */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <h3 className="font-bold text-base mb-4 text-slate-700 flex items-center gap-2">
              <span className="material-icons text-primary text-lg">add_circle_outline</span>
              New Entry
            </h3>

            {formError && (
              <div className="mb-3 bg-red-50 text-red-600 text-xs p-2 rounded-lg border border-red-200 flex items-center gap-2">
                <span className="material-icons text-sm">error_outline</span>
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Expense / Income toggle */}
              <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                <button type="button"
                  onClick={() => {
                    setForm({ ...form, type: 'expense', category: '' });
                    setSelectedCategoryId('');
                    setCustomCategoryName('');
                  }}
                  className={`flex-1 py-2 text-sm font-bold transition ${form.type === 'expense' ? 'bg-red-500 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
                  Expense
                </button>
                <button type="button"
                  onClick={() => {
                    setForm({ ...form, type: 'income', category: '' });
                    setSelectedCategoryId('');
                    setCustomCategoryName('');
                  }}
                  className={`flex-1 py-2 text-sm font-bold transition ${form.type === 'income' ? 'bg-emerald-500 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
                  Income
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Date</label>
                <input type="date" required
                  className="w-full border border-slate-200 rounded-lg p-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={form.date}
                  onChange={e => setForm({ ...form, date: e.target.value })} />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Category</label>
                <div className="flex gap-2 items-center">
                  <select required
                    className="w-full border border-slate-200 rounded-lg p-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
                    value={selectedCategoryId}
                    onChange={e => {
                      const val = e.target.value;
                      setSelectedCategoryId(val);
                      if (val === 'custom') {
                        setForm({ ...form, category: '' });
                      } else if (val === '') {
                        setForm({ ...form, category: '' });
                      } else {
                        const cat = savedCategories.find(c => c.id === val);
                        if (cat) setForm({ ...form, category: cat.name });
                      }
                    }}>
                    <option value="">Select category…</option>
                    {savedCategories
                      .filter(c => c.type === form.type)
                      .map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    <option value="custom" className="font-bold text-primary">+ Custom / New Category</option>
                  </select>

                  {selectedCategoryId && selectedCategoryId !== 'custom' && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('Delete this category option?')) {
                          db.categories.delete(selectedCategoryId).then(() => {
                            refresh();
                            setSelectedCategoryId('');
                            setForm({ ...form, category: '' });
                          });
                        }
                      }}
                      className="text-slate-350 hover:text-red-500 transition-colors p-1 flex-shrink-0"
                      title="Delete this category option"
                    >
                      <span className="material-icons text-base">delete</span>
                    </button>
                  )}
                </div>
              </div>

              {selectedCategoryId === 'custom' && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-500 mb-1">Custom Category Name</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="w-full border border-slate-200 rounded-lg p-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder="Enter new category..."
                      value={customCategoryName}
                      onChange={e => setCustomCategoryName(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        if (!customCategoryName.trim()) return;
                        const newCat = {
                          id: `cat_${Date.now()}`,
                          name: customCategoryName.trim(),
                          type: form.type as 'expense' | 'income'
                        };
                        await db.categories.add(newCat);
                        refresh();
                        setSelectedCategoryId(newCat.id);
                        setForm({ ...form, category: newCat.name });
                        setCustomCategoryName('');
                      }}
                      className="bg-primary text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-blue-700 transition"
                    >
                      Save
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Description</label>
                <input type="text" required placeholder="Brief description…"
                  className="w-full border border-slate-200 rounded-lg p-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={form.description || ''}
                  onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Amount (₹)</label>
                <input type="number" required min="0.01" step="0.01" placeholder="0.00"
                  className="w-full border border-slate-200 rounded-lg p-2 text-sm bg-slate-50 font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={form.amount ?? ''}
                  onChange={e => setForm({ ...form, amount: parseFloat(e.target.value) })} />
              </div>

              <button type="submit"
                className="w-full py-2.5 rounded-lg font-bold text-white text-sm transition shadow-sm hover:opacity-90 active:scale-95"
                style={{ background: form.type === 'expense' ? '#ef4444' : '#10b981' }}>
                <span className="material-icons text-sm align-middle mr-1">add</span>
                Add {form.type === 'expense' ? 'Expense' : 'Income'}
              </button>
            </form>
          </div>
        </div>

        {/* Right: Date range filter + Table */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">

          {/* ── Date Range + Filters bar ── */}
          <div className="p-3 border-b border-slate-100 bg-slate-50 space-y-2">
            {/* Date range row */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="material-icons text-slate-400 text-base">date_range</span>
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-bold text-slate-500">From</label>
                <input type="date"
                  className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)} />
              </div>
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-bold text-slate-500">To</label>
                <input type="date"
                  className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)} />
              </div>

              {/* Quick presets */}
              <div className="flex gap-1 ml-1">
                {[
                  { label: 'This Month', fn: () => { setStartDate(firstOfMonth()); setEndDate(today()); } },
                  {
                    label: 'Last Month', fn: () => {
                      const d = new Date();
                      const y = d.getMonth() === 0 ? d.getFullYear() - 1 : d.getFullYear();
                      const m = d.getMonth() === 0 ? 12 : d.getMonth();
                      const last = new Date(y, m, 0).getDate();
                      setStartDate(`${y}-${String(m).padStart(2, '0')}-01`);
                      setEndDate(`${y}-${String(m).padStart(2, '0')}-${last}`);
                    }
                  },
                  { label: 'This Year', fn: () => { setStartDate(`${new Date().getFullYear()}-01-01`); setEndDate(today()); } },
                ].map(p => (
                  <button key={p.label} onClick={p.fn}
                    className="text-xs px-2 py-1 rounded bg-white border border-slate-200 text-slate-600 hover:bg-primary hover:text-white hover:border-primary transition font-medium">
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Category + Type filters */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="material-icons text-slate-400 text-base">filter_list</span>
              <select
                className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                <option value="">All Categories</option>
                {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select
                className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={filterType} onChange={e => setFilterType(e.target.value as '' | 'expense' | 'income')}>
                <option value="">All Types</option>
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
              {hasActiveFilters && (
                <button onClick={clearFilters}
                  className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                  <span className="material-icons text-sm">close</span>Reset
                </button>
              )}
              <span className="ml-auto text-xs text-slate-400 font-medium">
                {filtered.length} record{filtered.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* ── Table ── */}
          <div className="overflow-auto flex-1">
            <table className="w-full text-left text-sm">
              <thead className="bg-white sticky top-0 z-10">
                <tr className="border-b border-slate-100">
                  <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wide w-10">S.No</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wide">Date</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wide">Description</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wide">Category</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wide text-right">Amount</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wide text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-16 text-slate-400 text-sm">
                      <span className="material-icons block text-4xl mb-2 text-slate-200">receipt_long</span>
                      No records found for this period.
                    </td>
                  </tr>
                ) : (
                  filtered.map((r, idx) => (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-slate-400 text-xs font-mono">{idx + 1}</td>
                      <td className="px-4 py-3 text-slate-600 font-medium whitespace-nowrap">{fmtDate(r.date)}</td>
                      <td className="px-4 py-3 text-slate-700 max-w-xs">
                        <span className="line-clamp-1">{r.description}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                          {r.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold whitespace-nowrap">
                        <span className={r.type === 'expense' ? 'text-red-500' : 'text-emerald-600'}>
                          {r.type === 'expense' ? '−' : '+'}
                          {fmtDisplay(r.amount)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => handleDelete(r.id)}
                          className="text-slate-300 hover:text-red-500 transition-colors rounded p-0.5 hover:bg-red-50"
                          title="Delete record">
                          <span className="material-icons text-base">delete_outline</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* ── Footer totals ── */}
          {filtered.length > 0 && (
            <div className="p-3 border-t border-slate-100 bg-slate-50 flex flex-wrap justify-between items-center gap-3 text-sm">
              <div className="flex gap-5">
                <span className="text-slate-500">
                  Expense: <strong className="text-red-500">{fmtDisplay(rangeExpense)}</strong>
                </span>
                <span className="text-slate-500">
                  Income: <strong className="text-emerald-500">{fmtDisplay(rangeIncome)}</strong>
                </span>
                <span className="text-slate-500">
                  Balance:{' '}
                  <strong className={rangeBalance >= 0 ? 'text-primary' : 'text-amber-500'}>
                    {(rangeBalance >= 0 ? '+' : '') + fmtDisplay(rangeBalance)}
                  </strong>
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Summary Card ─────────────────────────────────────────────────────────────
const SummaryCard = ({ icon, label, value, color, sub }: {
  icon: string; label: string; value: string; color: string; sub: string;
}) => (
  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-4">
    <div className={`${color} p-2.5 rounded-xl text-white flex-shrink-0`}>
      <span className="material-icons text-xl">{icon}</span>
    </div>
    <div className="min-w-0">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wide truncate">{label}</p>
      <p className="text-xl font-bold text-slate-800 mt-0.5">{value}</p>
      <p className="text-xs text-slate-400 truncate">{sub}</p>
    </div>
  </div>
);

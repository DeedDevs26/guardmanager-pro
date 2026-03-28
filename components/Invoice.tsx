import React, { useState, useRef } from 'react';
import jsPDF from 'jspdf';
import { db } from '../services/db';
import { Invoice as InvoiceType, InvoiceLineItem, InvoiceCompany, InvoiceBankDetails } from '../types';

// ─── Helpers ────────────────────────────────────────────────────────────────

const getTodayDate = () => new Date().toISOString().split('T')[0];

const getFinancialYear = (): string => {
    const now = new Date();
    const month = now.getMonth() + 1; // 1-12
    const year = now.getFullYear();
    if (month >= 4) return `${year}-${String(year + 1).slice(2)}`;
    return `${year - 1}-${String(year).slice(2)}`;
};

const generateInvoiceNumber = (): string => {
    const fy = getFinancialYear();
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `INV/${fy}/${rand}`;
};

const numberToWordsIndian = (num: number): string => {
    if (num === 0) return 'Zero Rupees Only';
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
        'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen',
        'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const twoDigits = (n: number): string => {
        if (n < 20) return ones[n];
        return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    };

    const threeDigits = (n: number): string => {
        if (n >= 100) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + twoDigits(n % 100) : '');
        return twoDigits(n);
    };

    const intPart = Math.floor(num);
    let result = '';
    if (intPart >= 10000000) {
        result += threeDigits(Math.floor(intPart / 10000000)) + ' Crore ';
    }
    if (intPart % 10000000 >= 100000) {
        result += threeDigits(Math.floor((intPart % 10000000) / 100000)) + ' Lakh ';
    }
    if (intPart % 100000 >= 1000) {
        result += threeDigits(Math.floor((intPart % 100000) / 1000)) + ' Thousand ';
    }
    if (intPart % 1000 > 0) {
        result += threeDigits(intPart % 1000);
    }
    return result.trim() + ' Rupees Only';
};

const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const newLineItem = (): InvoiceLineItem => ({
    id: Date.now().toString() + Math.random(),
    description: 'Security Guard',
    guards: 1,
    days: 26,
    rate: 0,
    value: 0,
});

const defaultCompany: InvoiceCompany = {
    name: '',
    address: '',
    phone: '',
    email: '',
    pan: '',
};

const defaultBank: InvoiceBankDetails = {
    bankName: '',
    accountName: '',
    accountNumber: '',
    ifsc: '',
};

// ─── Preview Component (also used for PDF) ──────────────────────────────────

interface PreviewProps {
    invoiceNumber: string;
    invoiceDate: string;
    company: InvoiceCompany;
    clientName: string;
    clientAddress: string;
    lineItems: InvoiceLineItem[];
    totalAmount: number;
    bankDetails: InvoiceBankDetails;
    previewRef?: React.RefObject<HTMLDivElement>;
}

const InvoicePreview: React.FC<PreviewProps> = ({
    invoiceNumber, invoiceDate, company, clientName, clientAddress,
    lineItems, totalAmount, bankDetails, previewRef
}) => (
    <div
        ref={previewRef}
        id="invoice-preview-content"
        style={{
            fontFamily: 'Arial, sans-serif',
            fontSize: '12px',
            color: '#1a1a1a',
            background: '#fff',
            padding: '32px',
            minWidth: '600px',
        }}
    >
        {/* Header */}
        <div style={{ borderBottom: '3px solid #1152d4', paddingBottom: '16px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#1152d4', letterSpacing: '1px' }}>
                        {company.name || 'Your Company Name'}
                    </div>
                    <div style={{ marginTop: '4px', color: '#444', lineHeight: '1.6' }}>
                        {company.address && <div>{company.address}</div>}
                        {company.phone && <div>Phone: {company.phone}</div>}
                        {company.email && <div>Email: {company.email}</div>}
                        {company.pan && <div>PAN: {company.pan}</div>}
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '26px', fontWeight: 'bold', color: '#1152d4', letterSpacing: '2px' }}>
                        INVOICE
                    </div>
                    <div style={{ marginTop: '8px', color: '#444', lineHeight: '1.8' }}>
                        <div><strong>Invoice No:</strong> {invoiceNumber}</div>
                        <div><strong>Date:</strong> {invoiceDate}</div>
                    </div>
                </div>
            </div>
        </div>

        {/* Bill To */}
        <div style={{ marginBottom: '20px', display: 'flex', gap: '40px' }}>
            <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'bold', color: '#1152d4', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '1px' }}>
                    Bill To
                </div>
                <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{clientName || 'Client Name'}</div>
                <div style={{ color: '#555', marginTop: '2px', whiteSpace: 'pre-line' }}>{clientAddress || 'Client Address'}</div>
            </div>
        </div>

        {/* Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
            <thead>
                <tr style={{ background: '#1152d4', color: '#fff' }}>
                    <th style={{ padding: '8px 10px', textAlign: 'center', width: '40px' }}>S.No</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>Description</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>No. of Guards</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>No. of Days</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Rate (₹)</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Value (₹)</th>
                </tr>
            </thead>
            <tbody>
                {lineItems.map((item, idx) => (
                    <tr key={item.id} style={{ background: idx % 2 === 0 ? '#f8faff' : '#fff' }}>
                        <td style={{ padding: '7px 10px', textAlign: 'center', borderBottom: '1px solid #e2e8f0' }}>{idx + 1}</td>
                        <td style={{ padding: '7px 10px', borderBottom: '1px solid #e2e8f0' }}>{item.description}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'center', borderBottom: '1px solid #e2e8f0' }}>{item.guards}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'center', borderBottom: '1px solid #e2e8f0' }}>{item.days}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', borderBottom: '1px solid #e2e8f0' }}>{formatCurrency(item.rate)}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 'bold', borderBottom: '1px solid #e2e8f0' }}>{formatCurrency(item.value)}</td>
                    </tr>
                ))}
            </tbody>
        </table>

        {/* Totals */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <div style={{ minWidth: '240px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: '#1152d4', color: '#fff', fontWeight: 'bold', fontSize: '14px', borderRadius: '4px' }}>
                    <span>Total Amount</span>
                    <span>₹ {formatCurrency(totalAmount)}</span>
                </div>
            </div>
        </div>

        {/* Amount in Words */}
        <div style={{ background: '#f0f4ff', border: '1px solid #c7d7f5', borderRadius: '4px', padding: '10px 14px', marginBottom: '16px' }}>
            <span style={{ fontWeight: 'bold', color: '#1152d4' }}>Amount in Words: </span>
            <span style={{ fontStyle: 'italic' }}>{numberToWordsIndian(totalAmount)}</span>
        </div>

        {/* Note */}
        <div style={{ marginBottom: '20px', color: '#555', fontSize: '11px', borderLeft: '3px solid #f59e0b', paddingLeft: '10px' }}>
            <strong>Note:</strong> Kindly make the payment on or before the 3rd of every month.
        </div>

        {/* Bank Details */}
        <div style={{ marginBottom: '24px', background: '#f8faff', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '12px 16px' }}>
            <div style={{ fontWeight: 'bold', color: '#1152d4', marginBottom: '8px', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '1px' }}>
                Bank Details
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 20px', color: '#444' }}>
                <div><strong>Bank Name:</strong> {bankDetails.bankName || '—'}</div>
                <div><strong>Account Name:</strong> {bankDetails.accountName || '—'}</div>
                <div><strong>Account Number:</strong> {bankDetails.accountNumber || '—'}</div>
                <div><strong>IFSC Code:</strong> {bankDetails.ifsc || '—'}</div>
            </div>
        </div>

        {/* Footer */}
        <div style={{ borderTop: '2px solid #1152d4', paddingTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ textAlign: 'center', minWidth: '180px' }}>
                <div style={{ marginBottom: '40px', color: '#555', fontSize: '11px' }}>
                    For <strong>{company.name || 'Company Name'}</strong>
                </div>
                <div style={{ borderTop: '1px solid #1a1a1a', paddingTop: '4px', fontWeight: 'bold', fontSize: '11px' }}>
                    Authorized Signatory
                </div>
            </div>
        </div>
    </div>
);

// ─── Saved Invoices List ─────────────────────────────────────────────────────

interface SavedInvoicesProps {
    invoices: InvoiceType[];
    onDelete: (id: string) => void;
    onLoad: (inv: InvoiceType) => void;
}

const SavedInvoicesList: React.FC<SavedInvoicesProps> = ({ invoices, onDelete, onLoad }) => {
    if (invoices.length === 0) {
        return (
            <div className="text-center text-slate-400 py-8 text-sm">
                No saved invoices yet.
            </div>
        );
    }
    return (
        <div className="divide-y divide-slate-100">
            {invoices.slice().reverse().map(inv => (
                <div key={inv.id} className="flex items-center justify-between py-3 px-2 hover:bg-slate-50 rounded">
                    <div>
                        <div className="font-semibold text-slate-800 text-sm">{inv.invoiceNumber}</div>
                        <div className="text-xs text-slate-500">{inv.clientName} · {inv.invoiceDate}</div>
                        <div className="text-xs font-bold text-primary">₹{formatCurrency(inv.totalAmount)}</div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => onLoad(inv)}
                            className="text-xs px-2 py-1 bg-blue-50 text-primary rounded hover:bg-blue-100 font-medium"
                        >
                            Load
                        </button>
                        <button
                            onClick={() => onDelete(inv.id)}
                            className="text-slate-400 hover:text-red-500"
                        >
                            <span className="material-icons text-sm">delete</span>
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};

// ─── Main Invoice Component ──────────────────────────────────────────────────

export const Invoice: React.FC = () => {
    const previewRef = useRef<HTMLDivElement>(null!);

    const [invoiceNumber, setInvoiceNumber] = useState(generateInvoiceNumber());
    const [invoiceDate, setInvoiceDate] = useState(getTodayDate());
    const [company, setCompany] = useState<InvoiceCompany>(defaultCompany);
    const [clientName, setClientName] = useState('');
    const [clientAddress, setClientAddress] = useState('');
    const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([newLineItem()]);
    const [bankDetails, setBankDetails] = useState<InvoiceBankDetails>(defaultBank);
    const [savedInvoices, setSavedInvoices] = useState<InvoiceType[]>(() => db.invoices.getAll());
    const [activeTab, setActiveTab] = useState<'form' | 'saved'>('form');
    const [saveMsg, setSaveMsg] = useState('');

    const totalAmount = lineItems.reduce((sum, item) => sum + item.value, 0);

    // ── Line Item Handlers ──
    const updateLineItem = (id: string, field: keyof InvoiceLineItem, rawValue: string | number) => {
        setLineItems(prev => prev.map(item => {
            if (item.id !== id) return item;
            const updated = { ...item, [field]: rawValue };
            updated.value = updated.guards * updated.days * updated.rate;
            return updated;
        }));
    };

    const addRow = () => setLineItems(prev => [...prev, newLineItem()]);

    const removeRow = (id: string) => {
        if (lineItems.length === 1) return;
        setLineItems(prev => prev.filter(item => item.id !== id));
    };

    // ── Save ──
    const handleSave = () => {
        const invoice: InvoiceType = {
            id: Date.now().toString(),
            invoiceNumber,
            invoiceDate,
            company,
            clientName,
            clientAddress,
            lineItems,
            totalAmount,
            bankDetails,
            createdAt: new Date().toISOString(),
        };
        db.invoices.add(invoice);
        setSavedInvoices(db.invoices.getAll());
        setSaveMsg('Invoice saved!');
        setTimeout(() => setSaveMsg(''), 2500);
    };

    // ── Load saved invoice into form ──
    const handleLoad = (inv: InvoiceType) => {
        setInvoiceNumber(inv.invoiceNumber);
        setInvoiceDate(inv.invoiceDate);
        setCompany(inv.company);
        setClientName(inv.clientName);
        setClientAddress(inv.clientAddress);
        setLineItems(inv.lineItems);
        setBankDetails(inv.bankDetails);
        setActiveTab('form');
    };

    // ── Delete saved ──
    const handleDelete = (id: string) => {
        if (confirm('Delete this invoice?')) {
            db.invoices.delete(id);
            setSavedInvoices(db.invoices.getAll());
        }
    };

    // ── New Invoice ──
    const handleNew = () => {
        setInvoiceNumber(generateInvoiceNumber());
        setInvoiceDate(getTodayDate());
        setCompany(defaultCompany);
        setClientName('');
        setClientAddress('');
        setLineItems([newLineItem()]);
        setBankDetails(defaultBank);
    };

    // ── Print ──
    const handlePrint = () => {
        const printContent = document.getElementById('invoice-preview-content');
        if (!printContent) return;
        const win = window.open('', '_blank', 'width=900,height=700');
        if (!win) return;
        win.document.write(`
      <html>
        <head>
          <title>${invoiceNumber}</title>
          <style>
            body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>${printContent.outerHTML}</body>
      </html>
    `);
        win.document.close();
        win.focus();
        setTimeout(() => { win.print(); win.close(); }, 300);
    };

    // ── Download PDF ──
    const handleDownloadPDF = async () => {
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pageW = doc.internal.pageSize.getWidth();
        const margin = 15;
        const contentW = pageW - margin * 2;
        let y = margin;

        const blue = [17, 82, 212] as [number, number, number];
        const lightBlue = [240, 244, 255] as [number, number, number];
        const lightGray = [248, 250, 255] as [number, number, number];
        const dark = [26, 26, 26] as [number, number, number];
        const gray = [85, 85, 85] as [number, number, number];

        // Header bar
        doc.setFillColor(...blue);
        doc.rect(margin, y, contentW, 1, 'F');
        y += 3;

        // Company name
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.setTextColor(...blue);
        doc.text(company.name || 'Your Company Name', margin, y + 7);

        // INVOICE label (right)
        doc.setFontSize(22);
        doc.text('INVOICE', pageW - margin, y + 7, { align: 'right' });
        y += 12;

        // Company details (left) | Invoice details (right)
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(...gray);
        const compLines = [
            company.address,
            company.phone ? `Phone: ${company.phone}` : '',
            company.email ? `Email: ${company.email}` : '',
            company.pan ? `PAN: ${company.pan}` : '',
        ].filter(Boolean);
        compLines.forEach(line => { doc.text(line, margin, y); y += 4.5; });

        // Invoice meta (right side, aligned with company details)
        const metaY = y - compLines.length * 4.5;
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...dark);
        doc.text(`Invoice No: ${invoiceNumber}`, pageW - margin, metaY, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...gray);
        doc.text(`Date: ${invoiceDate}`, pageW - margin, metaY + 5, { align: 'right' });

        y += 6;

        // Divider
        doc.setDrawColor(...blue);
        doc.setLineWidth(0.5);
        doc.line(margin, y, pageW - margin, y);
        y += 6;

        // Bill To
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(...blue);
        doc.text('BILL TO', margin, y);
        y += 4;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(...dark);
        doc.text(clientName || 'Client Name', margin, y);
        y += 5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(...gray);
        if (clientAddress) {
            const addrLines = doc.splitTextToSize(clientAddress, contentW / 2);
            addrLines.forEach((line: string) => { doc.text(line, margin, y); y += 4; });
        }
        y += 4;

        // Table header
        const colWidths = [12, 62, 22, 22, 22, 28];
        const colX = [margin];
        colWidths.slice(0, -1).forEach((w, i) => colX.push(colX[i] + w));
        const headers = ['S.No', 'Description', 'Guards', 'Days', 'Rate (₹)', 'Value (₹)'];
        const rowH = 7;

        doc.setFillColor(...blue);
        doc.rect(margin, y, contentW, rowH, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(255, 255, 255);
        headers.forEach((h, i) => {
            const align = i === 0 ? 'center' : i >= 4 ? 'right' : 'left';
            const x = align === 'right' ? colX[i] + colWidths[i] - 2 : align === 'center' ? colX[i] + colWidths[i] / 2 : colX[i] + 2;
            doc.text(h, x, y + 4.8, { align });
        });
        y += rowH;

        // Table rows
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        lineItems.forEach((item, idx) => {
            const bg: [number, number, number] = idx % 2 === 0 ? lightGray : [255, 255, 255];
            doc.setFillColor(...bg);
            doc.rect(margin, y, contentW, rowH, 'F');
            doc.setTextColor(...dark);
            const cells = [
                String(idx + 1),
                item.description,
                String(item.guards),
                String(item.days),
                formatCurrency(item.rate),
                formatCurrency(item.value),
            ];
            cells.forEach((cell, i) => {
                const align = i === 0 ? 'center' : i >= 4 ? 'right' : 'left';
                const x = align === 'right' ? colX[i] + colWidths[i] - 2 : align === 'center' ? colX[i] + colWidths[i] / 2 : colX[i] + 2;
                const truncated = doc.splitTextToSize(cell, colWidths[i] - 4)[0];
                doc.text(truncated, x, y + 4.8, { align });
            });
            y += rowH;
        });

        // Bottom border of table
        doc.setDrawColor(226, 232, 240);
        doc.line(margin, y, pageW - margin, y);
        y += 6;

        // Total
        const totalBoxW = 70;
        const totalBoxX = pageW - margin - totalBoxW;
        doc.setFillColor(...blue);
        doc.roundedRect(totalBoxX, y, totalBoxW, 9, 2, 2, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(255, 255, 255);
        doc.text('Total Amount', totalBoxX + 4, y + 6);
        doc.text(`\u20B9 ${formatCurrency(totalAmount)}`, totalBoxX + totalBoxW - 3, y + 6, { align: 'right' });
        y += 14;

        // Amount in words
        doc.setFillColor(...lightBlue);
        doc.roundedRect(margin, y, contentW, 9, 2, 2, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(...blue);
        doc.text('Amount in Words:', margin + 3, y + 5.5);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(...dark);
        doc.text(numberToWordsIndian(totalAmount), margin + 35, y + 5.5);
        y += 14;

        // Note
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...gray);
        doc.setDrawColor(245, 158, 11);
        doc.setLineWidth(1);
        doc.line(margin, y, margin, y + 6);
        doc.setLineWidth(0.3);
        doc.text('Note: Kindly make the payment on or before the 3rd of every month.', margin + 4, y + 4);
        y += 12;

        // Bank Details
        doc.setFillColor(248, 250, 255);
        doc.roundedRect(margin, y, contentW, 22, 2, 2, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(margin, y, contentW, 22, 2, 2, 'S');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(...blue);
        doc.text('BANK DETAILS', margin + 4, y + 5);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(...dark);
        const bankLeft = [
            `Bank Name: ${bankDetails.bankName || '—'}`,
            `Account Number: ${bankDetails.accountNumber || '—'}`,
        ];
        const bankRight = [
            `Account Name: ${bankDetails.accountName || '—'}`,
            `IFSC Code: ${bankDetails.ifsc || '—'}`,
        ];
        bankLeft.forEach((line, i) => doc.text(line, margin + 4, y + 10 + i * 5));
        bankRight.forEach((line, i) => doc.text(line, margin + contentW / 2, y + 10 + i * 5));
        y += 28;

        // Footer
        doc.setDrawColor(...blue);
        doc.setLineWidth(0.5);
        doc.line(margin, y, pageW - margin, y);
        y += 6;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(...gray);
        doc.text(`For ${company.name || 'Company Name'}`, pageW - margin, y, { align: 'right' });
        y += 16;
        doc.setDrawColor(...dark);
        doc.setLineWidth(0.3);
        doc.line(pageW - margin - 50, y, pageW - margin, y);
        y += 4;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(...dark);
        doc.text('Authorized Signatory', pageW - margin - 25, y, { align: 'center' });

        doc.save(`${invoiceNumber.replace(/\//g, '-')}.pdf`);
    };

    // ─── Render ──────────────────────────────────────────────────────────────

    return (
        <div className="p-6 h-full flex flex-col gap-4 overflow-hidden">
            {/* Page Header */}
            <div className="flex items-center justify-between flex-shrink-0">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Invoice</h2>
                    <p className="text-sm text-slate-500">Create and manage security service invoices</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleNew}
                        className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-100 transition text-sm font-medium"
                    >
                        <span className="material-icons text-sm">add</span>
                        New Invoice
                    </button>
                    <button
                        onClick={handleSave}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium"
                    >
                        <span className="material-icons text-sm">save</span>
                        Save Invoice
                    </button>
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition text-sm font-medium"
                    >
                        <span className="material-icons text-sm">print</span>
                        Print
                    </button>
                    <button
                        onClick={handleDownloadPDF}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
                    >
                        <span className="material-icons text-sm">picture_as_pdf</span>
                        Download PDF
                    </button>
                </div>
            </div>

            {saveMsg && (
                <div className="flex-shrink-0 bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-2 rounded-lg flex items-center gap-2">
                    <span className="material-icons text-sm">check_circle</span>
                    {saveMsg}
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 flex-shrink-0 border-b border-slate-200">
                <button
                    onClick={() => setActiveTab('form')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition ${activeTab === 'form' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    Create Invoice
                </button>
                <button
                    onClick={() => setActiveTab('saved')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition ${activeTab === 'saved' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    Saved Invoices ({savedInvoices.length})
                </button>
            </div>

            {activeTab === 'saved' ? (
                <div className="flex-1 overflow-auto bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                    <SavedInvoicesList invoices={savedInvoices} onDelete={handleDelete} onLoad={handleLoad} />
                </div>
            ) : (
                <div className="flex-1 overflow-hidden grid grid-cols-2 gap-4">
                    {/* ── Left: Form ── */}
                    <div className="overflow-auto bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col gap-5">

                        {/* Invoice Meta */}
                        <div>
                            <h3 className="font-bold text-slate-700 mb-3 text-sm uppercase tracking-wide">Invoice Details</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Invoice Number</label>
                                    <input
                                        type="text"
                                        className="w-full border rounded p-2 bg-slate-50 text-sm font-mono"
                                        value={invoiceNumber}
                                        onChange={e => setInvoiceNumber(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Invoice Date</label>
                                    <input
                                        type="date"
                                        className="w-full border rounded p-2 bg-slate-50 text-sm"
                                        value={invoiceDate}
                                        onChange={e => setInvoiceDate(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Company Details */}
                        <div>
                            <h3 className="font-bold text-slate-700 mb-3 text-sm uppercase tracking-wide">Company Details</h3>
                            <div className="space-y-2">
                                {([
                                    ['name', 'Company Name'],
                                    ['address', 'Address'],
                                    ['phone', 'Phone'],
                                    ['email', 'Email'],
                                    ['pan', 'PAN Number'],
                                ] as [keyof InvoiceCompany, string][]).map(([field, label]) => (
                                    <div key={field}>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">{label}</label>
                                        <input
                                            type="text"
                                            className="w-full border rounded p-2 bg-slate-50 text-sm"
                                            value={company[field]}
                                            onChange={e => setCompany({ ...company, [field]: e.target.value })}
                                            placeholder={label}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Bill To */}
                        <div>
                            <h3 className="font-bold text-slate-700 mb-3 text-sm uppercase tracking-wide">Bill To</h3>
                            <div className="space-y-2">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Client Name</label>
                                    <input
                                        type="text"
                                        className="w-full border rounded p-2 bg-slate-50 text-sm"
                                        value={clientName}
                                        onChange={e => setClientName(e.target.value)}
                                        placeholder="Client / Company Name"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Client Address</label>
                                    <textarea
                                        className="w-full border rounded p-2 bg-slate-50 text-sm h-16 resize-none"
                                        value={clientAddress}
                                        onChange={e => setClientAddress(e.target.value)}
                                        placeholder="Client Address"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Line Items */}
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide">Service Items</h3>
                                <button
                                    onClick={addRow}
                                    className="flex items-center gap-1 text-xs px-3 py-1.5 bg-primary text-white rounded-lg hover:bg-blue-700 transition font-medium"
                                >
                                    <span className="material-icons text-xs">add</span>
                                    Add Row
                                </button>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="bg-slate-100 text-slate-600">
                                            <th className="px-2 py-2 text-left font-bold">Description</th>
                                            <th className="px-2 py-2 text-center font-bold w-16">Guards</th>
                                            <th className="px-2 py-2 text-center font-bold w-16">Days</th>
                                            <th className="px-2 py-2 text-center font-bold w-20">Rate (₹)</th>
                                            <th className="px-2 py-2 text-right font-bold w-24">Value (₹)</th>
                                            <th className="w-8"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {lineItems.map(item => (
                                            <tr key={item.id}>
                                                <td className="px-1 py-1">
                                                    <input
                                                        type="text"
                                                        className="w-full border rounded px-2 py-1 bg-slate-50"
                                                        value={item.description}
                                                        onChange={e => updateLineItem(item.id, 'description', e.target.value)}
                                                    />
                                                </td>
                                                <td className="px-1 py-1">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        className="w-full border rounded px-2 py-1 bg-slate-50 text-center"
                                                        value={item.guards}
                                                        onChange={e => updateLineItem(item.id, 'guards', Number(e.target.value))}
                                                    />
                                                </td>
                                                <td className="px-1 py-1">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        className="w-full border rounded px-2 py-1 bg-slate-50 text-center"
                                                        value={item.days}
                                                        onChange={e => updateLineItem(item.id, 'days', Number(e.target.value))}
                                                    />
                                                </td>
                                                <td className="px-1 py-1">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        className="w-full border rounded px-2 py-1 bg-slate-50 text-center"
                                                        value={item.rate}
                                                        onChange={e => updateLineItem(item.id, 'rate', Number(e.target.value))}
                                                    />
                                                </td>
                                                <td className="px-2 py-1 text-right font-bold text-primary">
                                                    ₹{formatCurrency(item.value)}
                                                </td>
                                                <td className="px-1 py-1 text-center">
                                                    <button
                                                        onClick={() => removeRow(item.id)}
                                                        disabled={lineItems.length === 1}
                                                        className="text-slate-300 hover:text-red-500 disabled:opacity-30"
                                                    >
                                                        <span className="material-icons text-sm">remove_circle</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {/* Total */}
                            <div className="flex justify-end mt-3">
                                <div className="bg-primary text-white px-4 py-2 rounded-lg font-bold text-sm">
                                    Total: ₹{formatCurrency(totalAmount)}
                                </div>
                            </div>
                        </div>

                        {/* Bank Details */}
                        <div>
                            <h3 className="font-bold text-slate-700 mb-3 text-sm uppercase tracking-wide">Bank Details</h3>
                            <div className="grid grid-cols-2 gap-2">
                                {([
                                    ['bankName', 'Bank Name'],
                                    ['accountName', 'Account Name'],
                                    ['accountNumber', 'Account Number'],
                                    ['ifsc', 'IFSC Code'],
                                ] as [keyof InvoiceBankDetails, string][]).map(([field, label]) => (
                                    <div key={field}>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">{label}</label>
                                        <input
                                            type="text"
                                            className="w-full border rounded p-2 bg-slate-50 text-sm"
                                            value={bankDetails[field]}
                                            onChange={e => setBankDetails({ ...bankDetails, [field]: e.target.value })}
                                            placeholder={label}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* ── Right: Preview ── */}
                    <div className="overflow-auto bg-white rounded-xl shadow-sm border border-slate-200">
                        <div className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center gap-2">
                            <span className="material-icons text-sm text-slate-500">preview</span>
                            <span className="text-sm font-semibold text-slate-600">Live Preview</span>
                        </div>
                        <div className="p-2 overflow-auto">
                            <div style={{ transform: 'scale(0.78)', transformOrigin: 'top left', width: '128%' }}>
                                <InvoicePreview
                                    invoiceNumber={invoiceNumber}
                                    invoiceDate={invoiceDate}
                                    company={company}
                                    clientName={clientName}
                                    clientAddress={clientAddress}
                                    lineItems={lineItems}
                                    totalAmount={totalAmount}
                                    bankDetails={bankDetails}
                                    previewRef={previewRef}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

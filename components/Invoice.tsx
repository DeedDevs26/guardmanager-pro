import React, { useState, useRef } from 'react';
import jsPDF from 'jspdf';
import { db } from '../services/db';
import { Invoice as InvoiceType, InvoiceLineItem, InvoiceCompany, InvoiceBankDetails, BankOption } from '../types';
import { logoBase64 } from './logoBase64';
import { qrWithGst, qrWithoutGst } from './qrCodesBase64';

// ─── Helpers ────────────────────────────────────────────────────────────────

const getTodayDate = () => new Date().toISOString().split('T')[0];

const getFinancialYear = (): string => {
    const now = new Date();
    const month = now.getMonth() + 1;
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
    if (intPart >= 10000000) result += threeDigits(Math.floor(intPart / 10000000)) + ' Crore ';
    if (intPart % 10000000 >= 100000) result += threeDigits(Math.floor((intPart % 10000000) / 100000)) + ' Lakh ';
    if (intPart % 100000 >= 1000) result += threeDigits(Math.floor((intPart % 100000) / 1000)) + ' Thousand ';
    if (intPart % 1000 > 0) result += threeDigits(intPart % 1000);
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

const COMPANY_NAME_WITH_GST = 'BLACK CAT COMMANDO SECURITY FORCE';
const COMPANY_NAME_WITHOUT_GST = 'BCCSF(Security Services)';

// ─── Default Company (BLACK CAT COMMANDO SECURITY FORCE) ────────────────────

const defaultCompany: InvoiceCompany = {
    name: COMPANY_NAME_WITH_GST,
    address: 'No 5 18/414 PN Road, Puspa Bus Stop, Opp.\nSecond Floor, Tirupur – 641 602',
    phone: '9500427215',
    email: 'bccsec.force@gmail.com',
    pan: 'ABFFB6765P',
    gstNumber: '33ABFFB6765P1ZW',
    sacCode: '998525',
};

const defaultBank: InvoiceBankDetails = {
    bankName: '',
    accountName: '',
    accountNumber: '',
    ifsc: '',
};

// ─── Preview Component ───────────────────────────────────────────────────────

interface PreviewProps {
    invoiceNumber: string;
    invoiceDate: string;
    invoiceType: 'with_gst' | 'without_gst';
    company: InvoiceCompany;
    clientName: string;
    clientAddress: string;
    clientGstNumber: string;
    lineItems: InvoiceLineItem[];
    subTotal: number;
    cgstPercent: number;
    sgstPercent: number;
    cgstAmount: number;
    sgstAmount: number;
    totalAmount: number;
    bankDetails: InvoiceBankDetails;
    previewRef?: React.RefObject<HTMLDivElement>;
}

const InvoicePreview: React.FC<PreviewProps> = ({
    invoiceNumber, invoiceDate, invoiceType, company, clientName, clientAddress,
    clientGstNumber, lineItems, subTotal, cgstPercent, sgstPercent,
    cgstAmount, sgstAmount, totalAmount, bankDetails, previewRef
}) => (
    <div
        ref={previewRef}
        id="invoice-preview-content"
        style={{
            fontFamily: 'Arial, sans-serif',
            fontSize: '12px',
            color: '#000',
            background: '#fff',
            padding: '24px',
            minWidth: '600px',
            border: '2px solid #1f4e78',
            position: 'relative'
        }}
    >
        {/* Top Header */}
        <div style={{ background: '#1f4e78', color: '#fff', fontSize: '20px', fontWeight: 'bold', padding: '6px 30px', textAlign: 'right', letterSpacing: '1px', marginBottom: '16px' }}>
            {invoiceType === 'with_gst' ? 'INVOICE' : 'INVOICE'}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', padding: '0 8px' }}>
            <div style={{ flex: 1 }}>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#000', textTransform: 'uppercase' }}>
                    {company.name || 'Your Company Name'}
                </div>
                <div style={{ marginTop: '4px', color: '#000', lineHeight: '1.4', fontSize: '11px' }}>
                    {company.address && company.address.split('\n').map((line, i) => <div key={i}>{line}</div>)}
                    {company.phone && <span>Phone: {company.phone} | </span>}
                    {company.email && <span>Email: {company.email}</span>}
                    <div style={{ display: 'flex', gap: '40px', marginTop: '2px' }}>
                        {invoiceType === 'with_gst' && company.gstNumber && <div>GSTNO: {company.gstNumber}</div>}
                        {company.pan && <div>PAN No: {company.pan}</div>}
                    </div>
                    {invoiceType === 'with_gst' && company.sacCode && <div style={{ marginTop: '2px' }}>SAC CODE: {company.sacCode}</div>}
                </div>
            </div>

            <div style={{ width: '120px', display: 'flex', justifyContent: 'flex-end' }}>
                {logoBase64 && (
                    <img src={logoBase64} alt="Company Logo" style={{ width: '100px', height: 'auto', objectFit: 'contain' }} />
                )}
            </div>
        </div>

        {/* Bill To Section */}
        <div style={{ background: '#1f4e78', color: '#fff', padding: '4px 8px', fontWeight: 'bold', fontSize: '13px', marginBottom: '8px' }}>
            Bill To:
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', padding: '0 8px' }}>
            <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'bold', fontSize: '14px', textTransform: 'uppercase' }}>{clientName || 'Client Name'}</div>
                <div style={{ color: '#000', marginTop: '2px', whiteSpace: 'pre-line', fontSize: '12px', paddingLeft: '8px' }}>{clientAddress || 'Client Address'}</div>
                {invoiceType === 'with_gst' && clientGstNumber && (
                    <div style={{ marginTop: '12px', fontSize: '12px' }}>GSTNO: {clientGstNumber}</div>
                )}
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'flex-start' }}>
                <div style={{ color: '#000', fontSize: '12px', fontWeight: 'bold' }}>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                        <div style={{ width: '80px', textAlign: 'left' }}>Invoice No</div>
                        <div>: {invoiceNumber}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <div style={{ width: '80px', textAlign: 'left' }}>Invoice Date</div>
                        <div>: {invoiceDate}</div>
                    </div>
                </div>
            </div>
        </div>

        {/* Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '0' }}>
            <thead>
                <tr style={{ background: '#1f4e78', color: '#fff', fontSize: '12px' }}>
                    <th style={{ padding: '6px 8px', textAlign: 'center', width: '40px', border: '1px solid #1f4e78' }}>S.No</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left', border: '1px solid #1f4e78' }}>Description</th>
                    <th style={{ padding: '6px 8px', textAlign: 'center', border: '1px solid #1f4e78' }}>No. of Guards</th>
                    <th style={{ padding: '6px 8px', textAlign: 'center', border: '1px solid #1f4e78' }}>No. of Days</th>
                    <th style={{ padding: '6px 8px', textAlign: 'center', border: '1px solid #1f4e78' }}>Rate (₹)</th>
                    <th style={{ padding: '6px 8px', textAlign: 'center', border: '1px solid #1f4e78' }}>Value (₹)</th>
                </tr>
            </thead>
            <tbody>
                {lineItems.map((item, idx) => (
                    <tr key={item.id} style={{ background: '#fff', color: '#000' }}>
                        <td style={{ padding: '6px 8px', textAlign: 'center', borderLeft: '1px solid #1f4e78', borderRight: '1px solid #1f4e78' }}>{idx + 1}</td>
                        <td style={{ padding: '6px 8px', borderRight: '1px solid #1f4e78' }}>{item.description}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'center', borderRight: '1px solid #1f4e78' }}>{item.guards}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'center', borderRight: '1px solid #1f4e78' }}>{item.days}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'center', borderRight: '1px solid #1f4e78' }}>{item.rate}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'center', borderRight: '1px solid #1f4e78' }}>{item.value}</td>
                    </tr>
                ))}
            </tbody>
        </table>

        {/* Table Totals Header */}
        <div style={{ display: 'flex', background: '#1f4e78', color: '#fff', fontWeight: 'bold', padding: '6px 8px', fontSize: '12px' }}>
            <div style={{ flex: '1', textAlign: 'right', paddingRight: '20px' }}>Total</div>
            <div style={{ width: '80px', textAlign: 'center' }}>{lineItems.reduce((s, i) => s + i.guards, 0)}</div>
            <div style={{ width: '80px', textAlign: 'center' }}>{lineItems.reduce((s, i) => s + i.days, 0)}</div>
            <div style={{ width: '80px', textAlign: 'center' }}></div>
            <div style={{ width: '80px', textAlign: 'center' }}>{subTotal}</div>
        </div>

        {/* GST block aligned to right exactly under value */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px', marginBottom: '16px', fontSize: '12px', fontWeight: 'bold' }}>
            {invoiceType === 'with_gst' ? (
                <div style={{ width: '280px' }}>
                    <div style={{ display: 'flex', padding: '2px 8px' }}>
                        <div style={{ flex: 1, textAlign: 'right', paddingRight: '16px' }}>Subtotal:</div>
                        <div style={{ width: '80px', textAlign: 'center' }}>{subTotal}</div>
                    </div>
                    <div style={{ display: 'flex', padding: '2px 8px' }}>
                        <div style={{ flex: 1, textAlign: 'right', paddingRight: '16px' }}>SGST ({sgstPercent}%):</div>
                        <div style={{ width: '80px', textAlign: 'center' }}>{sgstAmount.toFixed(2)}</div>
                    </div>
                    <div style={{ display: 'flex', padding: '2px 8px' }}>
                        <div style={{ flex: 1, textAlign: 'right', paddingRight: '16px' }}>CGST ({cgstPercent}%):</div>
                        <div style={{ width: '80px', textAlign: 'center' }}>{cgstAmount.toFixed(2)}</div>
                    </div>
                    <div style={{ display: 'flex', background: '#1f4e78', color: '#fff', padding: '4px 8px', marginTop: '4px' }}>
                        <div style={{ flex: 1, textAlign: 'right', paddingRight: '16px' }}>Grand Total:</div>
                        <div style={{ width: '80px', textAlign: 'center' }}>{totalAmount.toFixed(2)}</div>
                    </div>
                </div>
            ) : (
                <div style={{ width: '280px' }}>
                    <div style={{ display: 'flex', background: '#1f4e78', color: '#fff', padding: '4px 8px', marginTop: '4px' }}>
                        <div style={{ flex: 1, textAlign: 'right', paddingRight: '16px' }}>Grand Total:</div>
                        <div style={{ width: '80px', textAlign: 'center' }}>{totalAmount.toFixed(2)}</div>
                    </div>
                </div>
            )}
        </div>

        {/* Bank & QR */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', padding: '0 8px' }}>
            <div style={{ fontSize: '12px' }}>
                <div style={{ fontWeight: 'bold', textDecoration: 'underline', marginBottom: '4px' }}>Bank Details:</div>
                <table style={{ fontWeight: 'bold', borderCollapse: 'collapse', borderSpacing: 0 }}>
                    <tbody>
                        <tr><td style={{ padding: '2px 0', paddingRight: '12px', verticalAlign: 'top' }}>Bank Name</td><td style={{ padding: '2px 0' }}>: {bankDetails.bankName || '—'}</td></tr>
                        <tr><td style={{ padding: '2px 0', paddingRight: '12px', verticalAlign: 'top' }}>Account Name</td><td style={{ padding: '2px 0' }}>: {bankDetails.accountName || '—'}</td></tr>
                        <tr><td style={{ padding: '2px 0', paddingRight: '12px', verticalAlign: 'top' }}>Account Number</td><td style={{ padding: '2px 0' }}>: {bankDetails.accountNumber || '—'}</td></tr>
                        <tr><td style={{ padding: '2px 0', paddingRight: '12px', verticalAlign: 'top' }}>IFSC Code</td><td style={{ padding: '2px 0' }}>: {bankDetails.ifsc || '—'}</td></tr>
                        {(bankDetails as any).upiId && (
                            <tr><td style={{ padding: '2px 0', paddingRight: '12px', verticalAlign: 'top' }}>UPI ID</td><td style={{ padding: '2px 0' }}>: {(bankDetails as any).upiId}</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Dynamic QR Code */}
            <div style={{ width: '100px', height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img 
                    src={invoiceType === 'with_gst' ? qrWithGst : qrWithoutGst} 
                    alt="QR Code" 
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                />
            </div>
        </div>

        {/* Amount in words */}
        <div style={{ background: '#1f4e78', color: '#fff', padding: '4px 8px', fontWeight: 'bold', fontSize: '12px', marginBottom: '16px' }}>
            Amount : Rupees {numberToWordsIndian(totalAmount)} Only
        </div>

        {/* Note */}
        <div style={{ fontWeight: 'bold', fontSize: '11px', marginBottom: '48px', padding: '0 8px' }}>
            Note: Kindly make the payment on or before the 3rd of every month.
        </div>

        {/* Signatures */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', padding: '0 8px', fontSize: '12px', fontWeight: 'bold' }}>
            <div style={{ marginBottom: '60px' }}>
                for {company.name || 'Company Name'}
            </div>
            <div>
                Authorized signatory
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
                        <div className="flex items-center gap-2">
                            <div className="font-semibold text-slate-800 text-sm">{inv.invoiceNumber}</div>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${inv.invoiceType === 'with_gst' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                {inv.invoiceType === 'with_gst' ? 'With GST' : 'Without GST'}
                            </span>
                        </div>
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
    const [invoiceType, setInvoiceType] = useState<'with_gst' | 'without_gst'>('without_gst');
    const [company, setCompany] = useState<InvoiceCompany>({ ...defaultCompany, name: COMPANY_NAME_WITHOUT_GST });
    const [clientName, setClientName] = useState('');
    const [clientAddress, setClientAddress] = useState('');
    const [clientGstNumber, setClientGstNumber] = useState('');
    const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([newLineItem()]);
    const [cgstPercent, setCgstPercent] = useState(9);
    const [sgstPercent, setSgstPercent] = useState(9);
    const [savedBanks, setSavedBanks] = useState<BankOption[]>([]);
    const [selectedBankId, setSelectedBankId] = useState<string>('custom');
    const [bankDetails, setBankDetails] = useState<InvoiceBankDetails | BankOption>(defaultBank);
    const [savedInvoices, setSavedInvoices] = useState<InvoiceType[]>(() => db.invoices.getAll());
    const [availableSites, setAvailableSites] = useState<any[]>([]);
    const [selectedSiteId, setSelectedSiteId] = useState<string>('custom');
    const [activeTab, setActiveTab] = useState<'form' | 'saved'>('form');
    const [saveMsg, setSaveMsg] = useState('');

    React.useEffect(() => {
        const banks = db.banks.getAll();
        setSavedBanks(banks);
        if (banks.length > 0) {
            setSelectedBankId(banks[0].id);
            setBankDetails(banks[0]);
        }
        
        const sites = db.sites.getAll();
        setAvailableSites(sites);
    }, []);

    const subTotal = lineItems.reduce((sum, item) => sum + item.value, 0);
    const cgstAmount = invoiceType === 'with_gst' ? (subTotal * cgstPercent) / 100 : 0;
    const sgstAmount = invoiceType === 'with_gst' ? (subTotal * sgstPercent) / 100 : 0;
    const totalAmount = subTotal + cgstAmount + sgstAmount;

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
            invoiceType,
            company,
            clientName,
            clientAddress,
            clientGstNumber,
            lineItems,
            subTotal,
            cgstPercent,
            sgstPercent,
            cgstAmount,
            sgstAmount,
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
        setInvoiceType(inv.invoiceType ?? 'without_gst');
        setCompany(inv.company);
        setClientName(inv.clientName);
        setClientAddress(inv.clientAddress);
        setClientGstNumber(inv.clientGstNumber ?? '');
        setLineItems(inv.lineItems);
        setCgstPercent(inv.cgstPercent ?? 9);
        setSgstPercent(inv.sgstPercent ?? 9);
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
        setInvoiceType('without_gst');
        setCompany({ ...defaultCompany, name: COMPANY_NAME_WITHOUT_GST });
        setClientName('');
        setClientAddress('');
        setClientGstNumber('');
        setLineItems([newLineItem()]);
        setCgstPercent(9);
        setSgstPercent(9);
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
        const pageH = doc.internal.pageSize.getHeight();
        const margin = 15;
        const contentW = pageW - margin * 2;

        const darkBlue = [31, 78, 120] as [number, number, number];
        const dark = [0, 0, 0] as [number, number, number];

        // Page Border
        doc.setDrawColor(...darkBlue);
        doc.setLineWidth(0.8);
        doc.rect(margin / 2, margin / 2, pageW - margin, pageH - margin, 'S');

        let y = margin;        // Top Header
        // Full width dark blue bar with "INVOICE"
        doc.setFillColor(...darkBlue);
        doc.rect(margin, y, contentW, 10, 'F');
        doc.setFont('times', 'bold');
        doc.setFontSize(18);
        doc.setTextColor(255, 255, 255);
        doc.text(invoiceType === 'with_gst' ? 'INVOICE' : 'INVOICE', pageW - margin - 5, y + 7, { align: 'right' });

        y += 14;

        // Left side company meta
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(...dark);
        doc.text((company.name || 'Your Company Name').toUpperCase(), margin, y + 4);
        y += 10;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        const addrLines = company.address.split('\n');
        addrLines.forEach((line) => { doc.text(line, margin, y); y += 4; });

        let metaLine = '';
        if (company.phone) metaLine += `Phone: ${company.phone}`;
        if (company.email) metaLine += ` | Email: ${company.email}`;
        if (metaLine) { doc.text(metaLine, margin, y); y += 4; }

        doc.setFont('helvetica', 'bold');
        let taxLine = '';
        if (invoiceType === 'with_gst' && company.gstNumber) taxLine += `GSTNO: ${company.gstNumber}        `;
        if (company.pan) taxLine += `PAN No: ${company.pan}`;
        if (taxLine) { doc.text(taxLine, margin, y); y += 4; }
        
        if (invoiceType === 'with_gst' && company.sacCode) {
            doc.text(`SAC CODE: ${company.sacCode}`, margin, y);
            y += 4;
        }
        doc.setFont('helvetica', 'normal');

        const companyDetailsMaxY = y;

        // Logo on right
        if (logoBase64) {
            doc.addImage(logoBase64, 'JPEG', pageW - margin - 40, margin + 14, 35, 35);
        }

        y = Math.max(companyDetailsMaxY, margin + 48);
        y += 2;

        // Bill To Header
        doc.setFillColor(...darkBlue);
        doc.rect(margin, y, contentW, 6, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(255, 255, 255);
        doc.text('Bill To:', margin + 2, y + 4.5);
        y += 10;

        // Bill To Details
        doc.setFontSize(10);
        doc.setTextColor(...dark);
        const billToTopY = y;
        doc.text((clientName || 'Client Name').toUpperCase(), margin + 2, y);
        y += 4;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        if (clientAddress) {
            const clientSplit = doc.splitTextToSize(clientAddress, (contentW / 2) - 10);
            clientSplit.forEach((line: string) => { doc.text(line, margin + 6, y); y += 4; });
        }
        if (invoiceType === 'with_gst' && clientGstNumber) {
            y += 2;
            doc.text(`GSTNO: ${clientGstNumber}`, margin + 2, y);
            y += 4;
        }
        const billToMaxY = y;

        // Invoice Meta Details (aligned right, parallel to Bill To top)
        y = billToTopY;
        doc.setFont('helvetica', 'bold');
        doc.text('Invoice No', pageW / 2 + 10, y);
        doc.text(`: ${invoiceNumber}`, pageW / 2 + 35, y);
        doc.text('Invoice Date', pageW / 2 + 10, y + 5);
        doc.text(`: ${invoiceDate}`, pageW / 2 + 35, y + 5);

        y = Math.max(billToMaxY, billToTopY + 10) + 6;

        // Table Header
        const cW = [12, 70, 22, 22, 26, 28];
        const colX = [margin];
        cW.slice(0, -1).forEach((w, i) => colX.push(colX[i] + w));
        const headers = ['S.NO', 'Description', 'No. of Guards', 'No. of Days', 'Rate (Rs.)', 'Value (Rs.)'];
        const rowH = 6;

        doc.setFillColor(...darkBlue);
        doc.rect(margin, y, contentW, rowH, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);

        headers.forEach((h, i) => {
            const align = i === 1 ? 'left' : 'center';
            const x = align === 'center' ? colX[i] + cW[i] / 2 : colX[i] + 3;
            doc.text(h, x, y + 4.2, { align });
        });

        doc.setDrawColor(...darkBlue);
        doc.setLineWidth(0.3);
        doc.rect(margin, y, contentW, rowH, 'S');
        y += rowH;

        // Table Rows
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...dark);
        lineItems.forEach((item, idx) => {
            doc.rect(margin, y, contentW, rowH, 'S');
            // internal vertical borders
            for (let i = 1; i < cW.length; i++) {
                doc.line(colX[i], y, colX[i], y + rowH);
            }

            const cells = [
                String(idx + 1),
                item.description,
                String(item.guards),
                String(item.days),
                item.rate.toString(),
                item.value.toString()
            ];

            cells.forEach((cell, i) => {
                const align = i === 1 ? 'left' : 'center';
                const x = align === 'center' ? colX[i] + cW[i] / 2 : colX[i] + 3;
                const truncated = doc.splitTextToSize(cell, cW[i] - 2)[0];
                doc.text(truncated, x, y + 4.2, { align });
            });
            y += rowH;
        });

        // Table Totals Banner
        doc.setFillColor(...darkBlue);
        doc.rect(margin, y, contentW, rowH, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text('Total', colX[2] - 10, y + 4.2, { align: 'right' });
        doc.text(String(lineItems.reduce((s, i) => s + i.guards, 0)), colX[2] + cW[2] / 2, y + 4.2, { align: 'center' });
        doc.text(String(lineItems.reduce((s, i) => s + i.days, 0)), colX[3] + cW[3] / 2, y + 4.2, { align: 'center' });
        doc.text(String(subTotal), colX[5] + cW[5] / 2, y + 4.2, { align: 'center' });
        y += rowH;

        // GST & Grand Total
        doc.setTextColor(...dark);
        const rightAlignX = colX[5] - 4;
        const valAlignX = colX[5] + cW[5] / 2;

        y += 4;
        if (invoiceType === 'with_gst') {
            doc.text('Subtotal:', rightAlignX, y, { align: 'right' });
            doc.text(String(subTotal), valAlignX, y, { align: 'center' });
            y += 4;
            doc.text(`SGST (${sgstPercent}%):`, rightAlignX, y, { align: 'right' });
            doc.text(sgstAmount.toFixed(2), valAlignX, y, { align: 'center' });
            y += 4;
            doc.text(`CGST (${cgstPercent}%):`, rightAlignX, y, { align: 'right' });
            doc.text(cgstAmount.toFixed(2), valAlignX, y, { align: 'center' });
            y += 2;
        }

        // Grand total Box
        doc.setFillColor(...darkBlue);
        doc.rect(colX[4], y, cW[4] + cW[5], rowH, 'F');
        doc.setTextColor(255, 255, 255);
        doc.text('Grand Total:', rightAlignX, y + 4.2, { align: 'right' });
        doc.text(totalAmount.toFixed(2), valAlignX, y + 4.2, { align: 'center' });
        y += rowH + 6;

        // Bank Details & QR
        doc.setTextColor(...dark);
        doc.setFontSize(8.5);
        doc.text('Bank Details:', margin, y);
        doc.setLineWidth(0.3);
        doc.line(margin, y + 1, margin + 18, y + 1); // underline
        y += 4;

        const bankLabels = ['Bank Name', 'Account Name', 'Account Number', 'IFSC Code'];
        const bankVals = [
            bankDetails.bankName || '—',
            bankDetails.accountName || '—',
            bankDetails.accountNumber || '—',
            bankDetails.ifsc || '—'
        ];
        if ((bankDetails as any).upiId) {
            bankLabels.push('UPI ID');
            bankVals.push((bankDetails as any).upiId);
        }

        bankLabels.forEach((lbl, i) => {
            doc.setFont('helvetica', 'bold');
            doc.text(lbl, margin + 4, y);
            doc.text(`:   ${bankVals[i]}`, margin + 30, y);
            y += 4;
        });

        // Dynamic QR Code
        const qrSize = 25;
        const qrY = y - (bankLabels.length * 4) - 2;
        const qrX = pageW - margin - qrSize - 5;
        const activeQr = invoiceType === 'with_gst' ? qrWithGst : qrWithoutGst;
        doc.addImage(activeQr, 'PNG', qrX, qrY, qrSize, qrSize);

        y += 6;

        // Amount in words
        doc.setFillColor(...darkBlue);
        doc.rect(margin, y, contentW, 6, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(255, 255, 255);
        doc.text(`Amount : Rupees ${numberToWordsIndian(totalAmount)} Only`, margin + 2, y + 4.2);

        y += 10;

        // Note & Footer
        doc.setTextColor(...dark);
        doc.setFontSize(8.5);
        doc.text('Note: Kindly make the payment on or before the 3rd of every month.', margin, y);

        y += 18;

        doc.setFontSize(9);
        doc.text(`for ${company.name || 'Company Name'}`, pageW - margin, y, { align: 'right' });

        y += 20;
        doc.text('Authorized signatory', pageW - margin, y, { align: 'right' });

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

                        {/* Invoice Type Toggle */}
                        <div>
                            <h3 className="font-bold text-slate-700 mb-3 text-sm uppercase tracking-wide">Invoice Type</h3>
                            <div className="flex gap-0 rounded-lg border border-slate-200 overflow-hidden w-fit">
                                <button
                                    onClick={() => {
                                        setInvoiceType('without_gst');
                                        if (company.name === COMPANY_NAME_WITH_GST) {
                                            setCompany({ ...company, name: COMPANY_NAME_WITHOUT_GST });
                                        }
                                    }}
                                    className={`px-5 py-2 text-sm font-semibold transition ${invoiceType === 'without_gst' ? 'bg-slate-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                                >
                                    Without GST
                                </button>
                                <button
                                    onClick={() => {
                                        setInvoiceType('with_gst');
                                        if (company.name === COMPANY_NAME_WITHOUT_GST) {
                                            setCompany({ ...company, name: COMPANY_NAME_WITH_GST });
                                        }
                                    }}
                                    className={`px-5 py-2 text-sm font-semibold transition ${invoiceType === 'with_gst' ? 'bg-primary text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                                >
                                    With GST
                                </button>
                            </div>
                        </div>

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
                                        {field === 'address' ? (
                                            <textarea
                                                className="w-full border rounded p-2 bg-slate-50 text-sm h-16 resize-none"
                                                value={company[field]}
                                                onChange={e => setCompany({ ...company, [field]: e.target.value })}
                                                placeholder={label}
                                            />
                                        ) : (
                                            <input
                                                type="text"
                                                className="w-full border rounded p-2 bg-slate-50 text-sm"
                                                value={company[field]}
                                                onChange={e => setCompany({ ...company, [field]: e.target.value })}
                                                placeholder={label}
                                            />
                                        )}
                                    </div>
                                ))}
                                {invoiceType === 'with_gst' && (
                                    <div className="space-y-2">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1">
                                                Your GST Number <span className="text-primary">(Admin)</span>
                                            </label>
                                            <input
                                                type="text"
                                                className="w-full border border-primary/30 bg-blue-50 rounded p-2 text-sm font-mono"
                                                value={company.gstNumber}
                                                onChange={e => setCompany({ ...company, gstNumber: e.target.value })}
                                                placeholder="e.g. 33ABFFB6765P1ZW"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1">
                                                SAC CODE <span className="text-primary">(Admin)</span>
                                            </label>
                                            <input
                                                type="text"
                                                className="w-full border border-primary/30 bg-blue-50 rounded p-2 text-sm font-mono"
                                                value={company.sacCode || ''}
                                                onChange={e => setCompany({ ...company, sacCode: e.target.value })}
                                                placeholder="e.g. 998525"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Bill To */}
                        <div>
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide">Bill To</h3>
                                <select
                                    className="border border-slate-300 rounded text-xs px-2 py-1 bg-white text-slate-700 font-medium cursor-pointer"
                                    value={selectedSiteId}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setSelectedSiteId(val);
                                        if (val === 'custom') {
                                            setClientName('');
                                            setClientAddress('');
                                            setClientGstNumber('');
                                        } else {
                                            const site = availableSites.find(s => s.id === val);
                                            if (site) {
                                                setClientName(site.clientName || site.name);
                                                setClientAddress(`${site.name}\n${site.location}`);
                                                setClientGstNumber(site.gstNo || '');
                                            }
                                        }
                                    }}
                                >
                                    <option value="custom" className="font-bold text-primary">Custom / Manual Entry</option>
                                    {availableSites.map(s => (
                                        <option key={s.id} value={s.id}>{s.name} ({s.clientName})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Client Name</label>
                                    <input
                                        type="text"
                                        className="w-full border rounded p-2 bg-slate-50 text-sm"
                                        value={clientName}
                                        onChange={e => {
                                            setSelectedSiteId('custom');
                                            setClientName(e.target.value);
                                        }}
                                        placeholder="Client / Company Name"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Client Address</label>
                                    <textarea
                                        className="w-full border rounded p-2 bg-slate-50 text-sm h-16 resize-none"
                                        value={clientAddress}
                                        onChange={e => {
                                            setSelectedSiteId('custom');
                                            setClientAddress(e.target.value);
                                        }}
                                        placeholder="Client Address"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">
                                        Client GST Number
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full border border-green-300 bg-green-50 rounded p-2 text-sm font-mono uppercase"
                                        value={clientGstNumber}
                                        onChange={e => {
                                            setSelectedSiteId('custom');
                                            setClientGstNumber(e.target.value);
                                        }}
                                        placeholder="Client GST Number"
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

                            {/* GST Rates (only when With GST) */}
                            {invoiceType === 'with_gst' && (
                                <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                                    <div className="text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">GST Rates</div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1">CGST %</label>
                                            <input
                                                type="number"
                                                min="0"
                                                max="28"
                                                step="0.5"
                                                className="w-full border rounded px-2 py-1.5 text-sm bg-white text-center"
                                                value={cgstPercent}
                                                onChange={e => setCgstPercent(Number(e.target.value))}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1">SGST %</label>
                                            <input
                                                type="number"
                                                min="0"
                                                max="28"
                                                step="0.5"
                                                className="w-full border rounded px-2 py-1.5 text-sm bg-white text-center"
                                                value={sgstPercent}
                                                onChange={e => setSgstPercent(Number(e.target.value))}
                                            />
                                        </div>
                                    </div>
                                    <div className="mt-2 space-y-1 text-xs text-slate-600">
                                        <div className="flex justify-between">
                                            <span>Sub Total:</span>
                                            <span className="font-semibold">₹{formatCurrency(subTotal)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>CGST ({cgstPercent}%):</span>
                                            <span className="font-semibold">₹{formatCurrency(cgstAmount)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>SGST ({sgstPercent}%):</span>
                                            <span className="font-semibold">₹{formatCurrency(sgstAmount)}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Total */}
                            <div className="flex justify-end mt-3">
                                <div className="bg-primary text-white px-4 py-2 rounded-lg font-bold text-sm">
                                    Total: ₹{formatCurrency(totalAmount)}
                                </div>
                            </div>
                        </div>

                        {/* Bank Details */}
                        <div>
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide">Bank Details</h3>
                                <select
                                    className="border border-slate-300 rounded text-xs px-2 py-1 bg-white text-slate-700 font-medium cursor-pointer"
                                    value={selectedBankId}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setSelectedBankId(val);
                                        if (val === 'custom') {
                                            setBankDetails({ bankName: '', accountName: '', accountNumber: '', ifsc: '', upiId: '' } as any);
                                        } else {
                                            const bank = savedBanks.find(b => b.id === val);
                                            if (bank) setBankDetails(bank);
                                        }
                                    }}
                                >
                                    {savedBanks.map(b => (
                                        <option key={b.id} value={b.id}>{b.bankName} - {b.accountName}</option>
                                    ))}
                                    <option value="custom" className="font-bold text-primary">+ Custom / New Bank</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                {([
                                    ['bankName', 'Bank Name'],
                                    ['accountName', 'Account Name'],
                                    ['accountNumber', 'Account Number'],
                                    ['ifsc', 'IFSC Code'],
                                    ['upiId', 'UPI ID (Optional)']
                                ] as [keyof (InvoiceBankDetails & { upiId?: string }), string][]).map(([field, label]) => (
                                    <div key={field}>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">{label}</label>
                                        <input
                                            type="text"
                                            className="w-full border rounded p-2 bg-slate-50 text-sm"
                                            value={(bankDetails as any)[field] || ''}
                                            onChange={e => {
                                                if (selectedBankId !== 'custom') setSelectedBankId('custom');
                                                setBankDetails({ ...bankDetails, [field]: e.target.value })
                                            }}
                                            placeholder={label}
                                        />
                                    </div>
                                ))}
                            </div>
                            {selectedBankId === 'custom' && (
                                <div className="mt-3 flex justify-end">
                                    <button
                                        onClick={() => {
                                            const newBank: BankOption = {
                                                id: Date.now().toString(),
                                                bankName: bankDetails.bankName,
                                                accountName: bankDetails.accountName,
                                                accountNumber: bankDetails.accountNumber,
                                                ifsc: bankDetails.ifsc,
                                                upiId: (bankDetails as any).upiId || ''
                                            };
                                            db.banks.add(newBank);
                                            setSavedBanks(db.banks.getAll());
                                            setSelectedBankId(newBank.id);
                                        }}
                                        className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded font-bold transition flex items-center gap-1"
                                    >
                                        <span className="material-icons text-[14px]">save</span> Save as New Bank Option
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Right: Preview ── */}
                    <div className="overflow-auto bg-white rounded-xl shadow-sm border border-slate-200">
                        <div className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="material-icons text-sm text-slate-500">preview</span>
                                <span className="text-sm font-semibold text-slate-600">Live Preview</span>
                            </div>
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${invoiceType === 'with_gst' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                                {invoiceType === 'with_gst' ? '🧾 Invoice (With GST)' : '📄 Invoice (Without GST)'}
                            </span>
                        </div>
                        <div className="p-2 overflow-auto">
                            <div style={{ transform: 'scale(0.78)', transformOrigin: 'top left', width: '128%' }}>
                                <InvoicePreview
                                    invoiceNumber={invoiceNumber}
                                    invoiceDate={invoiceDate}
                                    invoiceType={invoiceType}
                                    company={company}
                                    clientName={clientName}
                                    clientAddress={clientAddress}
                                    clientGstNumber={clientGstNumber}
                                    lineItems={lineItems}
                                    subTotal={subTotal}
                                    cgstPercent={cgstPercent}
                                    sgstPercent={sgstPercent}
                                    cgstAmount={cgstAmount}
                                    sgstAmount={sgstAmount}
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

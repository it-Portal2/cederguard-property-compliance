import React, { useState, useEffect } from 'react';
import { 
  FileText, Download, History as HistoryIcon, Search, Filter, 
  ExternalLink, Loader2, AlertCircle, CheckCircle, Clock,
  DollarSign, Building2, Calendar, Trash2
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { api } from '../lib/api';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/* ─── Helpers ─── */
const fmtGBP = (n: any) => {
  const val = Number(n);
  if (isNaN(val)) return '£0.00';
  return `£${val.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export function Invoices() {
  const { user } = useStore();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);

  const isAdmin = (user?.role || user?.profile?.role) === 'admin';

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const res = isAdmin ? await api.adminGetInvoices() : await api.clientGetInvoices();
      if (res.success) {
        setInvoices(res.invoices || []);
      } else {
        setError(res.error || 'Failed to fetch invoices');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (invoice: any) => {
    setDownloading(invoice.id);
    try {
      // Create a temporary hidden element for the PDF
      const element = document.createElement('div');
      element.style.position = 'absolute';
      element.style.left = '-9999px';
      element.style.top = '0';
      element.style.width = '800px';
      element.style.backgroundColor = 'white';
      element.style.padding = '40px';
      element.innerHTML = `
        <div style="font-family: Arial, sans-serif; color: #1e293b;">
          <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <img src="/logo.png" style="height: 45px; width: auto; object-fit: contain;" />
              <div>
                <h1 style="font-size: 20px; font-weight: 900; margin: 0; color: #1e293b; letter-spacing: -0.5px;">CEDAR GUARD</h1>
                <p style="font-size: 10px; color: #64748b; margin: 2px 0 0; font-weight: 600; text-transform: uppercase; tracking: 0.5px;">Risk Intelligence & Compliance</p>
              </div>
            </div>
            <div style="text-align: right;">
              <h2 style="font-size: 18px; font-weight: bold; margin: 0;">INVOICE</h2>
              <p style="font-size: 12px; color: #64748b; margin: 4px 0 0;">#${invoice.invoiceNumber || invoice.id.slice(0, 8).toUpperCase()}</p>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px;">
            <div>
              <p style="font-size: 10px; font-weight: bold; color: #94a3b8; text-transform: uppercase; margin-bottom: 8px;">Billed To</p>
              <p style="font-size: 14px; font-weight: bold; margin: 0;">${invoice.clientName}</p>
              <p style="font-size: 12px; color: #64748b; margin: 4px 0 0;">${invoice.clientEmail}</p>
              ${invoice.clientAddress ? `<p style="font-size: 12px; color: #64748b; margin: 4px 0 0;">${invoice.clientAddress}</p>` : ''}
            </div>
            <div style="text-align: right;">
              <p style="font-size: 10px; font-weight: bold; color: #94a3b8; text-transform: uppercase; margin-bottom: 8px;">Invoice Details</p>
              <p style="font-size: 12px; margin: 0;"><strong>Date:</strong> ${format(new Date(invoice.createdAt), 'dd MMM yyyy')}</p>
              <p style="font-size: 12px; margin: 4px 0 0;"><strong>Due Date:</strong> ${invoice.dueDate ? format(new Date(invoice.dueDate), 'dd MMM yyyy') : 'On Receipt'}</p>
              <p style="font-size: 12px; margin: 4px 0 0;"><strong>Status:</strong> ${invoice.status || 'Paid'}</p>
            </div>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 40px;">
            <thead>
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <th style="text-align: left; padding: 12px 0; font-size: 12px; color: #64748b; font-weight: bold;">Description</th>
                <th style="text-align: right; padding: 12px 0; font-size: 12px; color: #64748b; font-weight: bold;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${(invoice.items || []).map((item: any) => {
                const name = item.name || item.label || 'Service Item';
                const description = item.description || item.sub || '';
                const price = item.price || item.amount || 0;
                return `
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 12px 0;">
                      <p style="font-size: 13px; font-weight: bold; margin: 0;">${name}</p>
                      ${description ? `<p style="font-size: 11px; color: #64748b; margin: 2px 0 0;">${description}</p>` : ''}
                    </td>
                    <td style="text-align: right; font-size: 13px;">${fmtGBP(price)}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <div style="display: flex; justify-content: flex-end;">
            <div style="width: 250px;">
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-top: 2px solid #e2e8f0;">
                <p style="font-size: 14px; font-weight: bold; margin: 0;">Total Amount</p>
                <p style="font-size: 16px; font-weight: bold; color: #4f46e5; margin: 0;">${fmtGBP(invoice.totalAmount || invoice.total)}</p>
              </div>
            </div>
          </div>

          <div style="margin-top: 60px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center;">
            <p style="font-size: 11px; color: #94a3b8; margin: 0;">Thank you for your business. For any queries, contact support@cedarguard.co.uk</p>
          </div>
        </div>
      `;
      document.body.appendChild(element);

      const canvas = await html2canvas(element, { 
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Invoice_${invoice.invoiceNumber || invoice.id.slice(0, 8)}.pdf`);
      
      document.body.removeChild(element);
    } catch (err) {
      console.error('PDF Generation failed', err);
      setError('Failed to generate PDF. Please try again.');
    } finally {
      setDownloading(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this invoice? This action cannot be undone.')) return;
    
    try {
      const res = await api.adminDeleteInvoice(id);
      if (res.success) {
        setInvoices(prev => prev.filter(inv => inv.id !== id));
      } else {
        alert(res.error || 'Failed to delete invoice');
      }
    } catch (err: any) {
      alert(err.message || 'An error occurred while deleting');
    }
  };

  const filteredInvoices = invoices.filter(inv => 
    inv.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
              <HistoryIcon className="w-7 h-7" />
            </div>
            Billing & Invoices
          </h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            {isAdmin ? "Manage and track all platform invoices." : "View and download your service invoices."}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-lg flex flex-col items-center gap-4 text-center">
          <AlertCircle className="w-12 h-12" />
          <div>
            <h3 className="font-bold text-lg">Failed to Load Invoices</h3>
            <p className="text-sm opacity-90">{error}</p>
          </div>
          <button 
            onClick={fetchInvoices}
            className="px-6 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm font-bold transition-colors"
          >
            Try Again
          </button>
        </div>
      ) : invoices.length === 0 ? (
        <div className="bg-white border border-slate-200 p-12 rounded-lg flex flex-col items-center gap-6 text-center">
          <div className="p-4 bg-slate-50 rounded-full text-slate-300">
            <FileText className="w-16 h-16" />
          </div>
          <div>
            <h3 className="font-bold text-xl text-slate-800">No Invoices Yet</h3>
            <p className="text-slate-500 max-w-sm mt-2">When invoices are generated for your account, they will appear here for review and download.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text"
              placeholder="Search by invoice # or client..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
            />
          </div>

          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Invoice / Date</th>
                  {isAdmin && <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Client</th>}
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-800">#{inv.invoiceNumber || inv.id.slice(0, 8).toUpperCase()}</span>
                        <span className="text-xs text-slate-400 font-medium">{format(new Date(inv.createdAt), 'dd MMM yyyy')}</span>
                      </div>
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-slate-400" />
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-slate-700">{inv.clientName}</span>
                            <span className="text-[10px] text-slate-400">{inv.clientEmail}</span>
                          </div>
                        </div>
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-black text-indigo-600 font-mono">{fmtGBP(inv.totalAmount)}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={clsx(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                        inv.status === 'Paid' ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : 
                        "bg-amber-50 text-amber-700 border border-amber-100"
                      )}>
                        {inv.status === 'Paid' ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        {inv.status || 'Paid'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleDownload(inv)}
                          disabled={downloading === inv.id}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                        >
                          {downloading === inv.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                          PDF
                        </button>
                        {isAdmin && (
                          <button 
                            onClick={() => handleDelete(inv.id)}
                            className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                            title="Delete Invoice"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

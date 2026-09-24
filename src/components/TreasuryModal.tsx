/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useWorld } from '../context/WorldContext';
import { SimulatedActionBadge } from './DemoModeBadge';
import {
  CreditCard,
  DollarSign,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Building,
  FileText,
  Lock,
  ArrowRight,
  AlertCircle,
  X,
} from 'lucide-react';

export const TreasuryModal: React.FC = () => {
  const {
    showTreasuryModal,
    setShowTreasuryModal,
    invoices,
    treasuryBalance,
    approvePayment,
    identity,
  } = useWorld();

  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('inv-511');
  const [authStep, setAuthStep] = useState<'IDLE' | 'AUTHORIZING' | 'SUCCESS'>('IDLE');

  if (!showTreasuryModal) return null;

  const invoice = invoices.find((i) => i.id === selectedInvoiceId) || invoices[0];

  const handleAuthorize = (invoiceId: string) => {
    setAuthStep('AUTHORIZING');
    setTimeout(() => {
      const res = approvePayment(invoiceId);
      if (res.success || res.reason === 'ALREADY_PAID') {
        setAuthStep('SUCCESS');
      } else {
        setAuthStep('IDLE');
      }
    }, 900);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={() => setShowTreasuryModal(false)}
    >
      <div
        className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-950/80 text-amber-400 rounded-lg border border-amber-800/50">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">Treasury & Payment Vault</span>
                <SimulatedActionBadge type="PAYMENT" />
              </div>
              <div className="text-xs text-slate-400">
                Simulated corporate payables vault (Demo Mode)
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowTreasuryModal(false)}
            className="p-1.5 text-slate-400 hover:text-white rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Treasury Balance Banner */}
        <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-slate-400">Corporate Treasury Reserve (Simulation)</div>
            <div className="text-2xl font-bold font-mono text-white">
              ${treasuryBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-mono text-sky-400">Demo Treasury Vault · Account #8842</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Auto-Approval Cap: $100.00</div>
          </div>
        </div>

        {/* Invoice Body */}
        {invoice && (
          <div className="p-5 overflow-y-auto max-h-[60vh] space-y-4 text-xs">
            {/* Invoice Top Status */}
            <div className="flex items-center justify-between p-3.5 bg-slate-950/80 rounded-lg border border-slate-800">
              <div>
                <div className="text-[10px] font-mono text-slate-500 uppercase">Vendor Invoice</div>
                <div className="text-sm font-bold text-white flex items-center gap-2 mt-0.5">
                  <span>{invoice.vendorName}</span>
                  <span className="text-xs font-mono text-slate-400">({invoice.invoiceNumber})</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Due: {invoice.dueDate} · Communication: Email Rail (EDI Demo)
                </div>
              </div>

              <div className="text-right">
                <div className="text-lg font-bold font-mono text-white">
                  ${invoice.amount.toFixed(2)}
                </div>
                <span
                  className={`inline-block text-[9px] font-mono font-semibold px-2 py-0.5 rounded mt-1 ${
                    invoice.status === 'PAID'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                      : 'bg-amber-950 text-amber-300 border border-amber-800/60'
                  }`}
                >
                  {invoice.status}
                </span>
              </div>
            </div>

            {/* Line Items */}
            <div className="border border-slate-800 rounded-lg overflow-hidden">
              <div className="bg-slate-950 px-3 py-2 border-b border-slate-800 text-[11px] font-semibold text-slate-400 flex items-center justify-between">
                <span>ITEMIZED BREAKDOWN</span>
                <span>SUBTOTAL</span>
              </div>
              <div className="divide-y divide-slate-800/60 bg-slate-900/50">
                {invoice.items.map((item, idx) => (
                  <div key={idx} className="p-3 flex items-center justify-between">
                    <div>
                      <div className="text-slate-200 font-medium">{item.description}</div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        Qty: {item.quantity} × ${Math.abs(item.unitPrice).toFixed(2)}
                      </div>
                    </div>
                    <div
                      className={`font-mono font-semibold ${
                        item.unitPrice < 0 ? 'text-emerald-400' : 'text-slate-200'
                      }`}
                    >
                      {item.unitPrice < 0 ? '-' : ''}${Math.abs(item.quantity * item.unitPrice).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Compliance & Policy Checklist */}
            <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 space-y-2">
              <div className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                <span>Simulated Treasury Authorization Rules</span>
              </div>
              <ul className="text-[11px] text-slate-400 space-y-1 list-disc list-inside">
                <li>Under $100: Maya (AI Procurement) auto-approves via native demo webhook.</li>
                <li>$100 to $5,000: Founder approval credential required (Active: {identity.personalName}).</li>
                <li>Over $5,000: Dual-signature required with Finance Board.</li>
              </ul>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>Demo credential #8842 ready</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTreasuryModal(false)}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition-colors"
            >
              Cancel
            </button>

            {invoice && invoice.status !== 'PAID' ? (
              <button
                disabled={authStep === 'AUTHORIZING'}
                onClick={() => handleAuthorize(invoice.id)}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm"
              >
                {authStep === 'AUTHORIZING' ? (
                  <span>Authorizing simulated payment...</span>
                ) : (
                  <>
                    <span>Authorize ${invoice.amount.toFixed(2)}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            ) : (
              <div className="px-4 py-1.5 bg-emerald-950 text-emerald-300 rounded text-xs font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Simulated payment approved ({invoice ? `$${invoice.amount.toFixed(2)}` : 'PAID'})</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

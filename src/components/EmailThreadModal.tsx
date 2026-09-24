/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useWorld } from '../context/WorldContext';
import { Mail, ArrowDown, Send, CheckCircle2, AlertTriangle, ShieldCheck, X } from 'lucide-react';

export const EmailThreadModal: React.FC = () => {
  const {
    showEmailThreadModal,
    setShowEmailThreadModal,
    handleDialogueOption,
    setShowTreasuryModal,
  } = useWorld();

  if (!showEmailThreadModal) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={() => setShowEmailThreadModal(false)}
    >
      <div
        className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-950/80 text-orange-400 rounded-lg border border-orange-800/50">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">
                  Email Rail: Acme Manufacturing
                </span>
                <span className="text-[10px] font-mono text-amber-400 bg-amber-950 px-2 py-0.5 rounded border border-amber-800/60">
                  UNCLAIMED / ASYNC RAIL
                </span>
              </div>
              <div className="text-xs text-slate-400">
                Subject: Re: Inquiry: Chassis Shipment #511 Customs Hold & PO Delivery
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowEmailThreadModal(false)}
            className="p-1.5 text-slate-400 hover:text-white rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message Thread */}
        <div className="p-5 overflow-y-auto max-h-[60vh] space-y-4 text-xs">
          {/* Message 1: Maya to Acme */}
          <div className="p-4 bg-slate-950/80 rounded-lg border border-slate-800 space-y-2">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-emerald-400">Maya (AI Procurement Lead)</span>
                <span className="text-[10px] text-slate-500 font-mono">&lt;maya@mycompany.dev&gt;</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">Today, 09:48 AM</span>
            </div>
            <div className="text-slate-300 leading-relaxed font-sans">
              To: vendor-support@acme-mfg.internal
              <br /><br />
              Hello Kurt and the Acme Logistics team,
              <br /><br />
              Our automated supply pipeline flagged that Purchase Order #511 (Precision CNC Aluminum Chassis Units, Batch 1) has been held at the border port of entry past the scheduled delivery window.
              <br /><br />
              Could you please confirm the current customs clearance timeline and provide an updated delivery ETA?
              <br /><br />
              Regards,
              <br />
              Maya · Autonomous Procurement Lead, My Company
            </div>
          </div>

          {/* Message 2: Acme reply to Maya */}
          <div className="p-4 bg-amber-950/20 rounded-lg border border-amber-800/50 space-y-2">
            <div className="flex items-center justify-between border-b border-amber-800/30 pb-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-amber-300">Kurt Vance (Acme Fabrication Desk)</span>
                <span className="text-[10px] text-slate-500 font-mono">&lt;kvance@acme-mfg.internal&gt;</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">Today, 09:51 AM</span>
            </div>
            <div className="text-slate-200 leading-relaxed font-sans">
              Hi Maya,
              <br /><br />
              Thank you for reaching out. We apologize for the delay. The carrier experienced an unexpected tariff re-classification hold at regional customs.
              <br /><br />
              The paperwork has now cleared and the container is released to freight transit.
              <br /><br />
              <strong className="text-amber-200">
                • New Arrival ETA: Friday by 2:00 PM EST
                <br />
                • As a courtesy for the friction, we have applied a $400.00 service credit directly to Invoice #511, bringing your revised total from $818.00 down to $418.00.
              </strong>
              <br /><br />
              Please let us know if this works for your production schedule.
              <br /><br />
              Best regards,
              <br />
              Kurt Vance · Acme Manufacturing
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <div className="text-[11px] text-slate-400 font-mono">
            Async SMTP verified via RFC-822 signature
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setShowEmailThreadModal(false);
                handleDialogueOption('MAYA_ACCEPT_CREDIT');
              }}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold transition-colors"
            >
              Accept $400 Credit
            </button>

            <button
              onClick={() => {
                setShowEmailThreadModal(false);
                setShowTreasuryModal(true);
              }}
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-semibold transition-colors"
            >
              Review Invoice #511
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

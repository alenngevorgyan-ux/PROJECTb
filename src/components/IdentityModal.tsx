/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useWorld } from '../context/WorldContext';
import { SimulatedActionBadge } from './DemoModeBadge';
import {
  Wallet,
  ShieldCheck,
  Key,
  CreditCard,
  UserCheck,
  Building,
  Bot,
  Lock,
  CheckCircle2,
  X,
} from 'lucide-react';

export const IdentityModal: React.FC = () => {
  const { showIdentityModal, setShowIdentityModal, identity, treasuryBalance } = useWorld();

  if (!showIdentityModal) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={() => setShowIdentityModal(false)}
    >
      <div
        className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sky-950/80 text-sky-400 rounded-lg border border-sky-800/50">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">Identity & Governance Wallet</span>
                <SimulatedActionBadge type="CUSTOMER_SYSTEM" />
              </div>
              <div className="text-xs text-slate-400">
                Personal credentials, enterprise roles, and delegated agent permissions (Demo Mode)
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowIdentityModal(false)}
            className="p-1.5 text-slate-400 hover:text-white rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto max-h-[65vh] space-y-4 text-xs">
          {/* Identity Card */}
          <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                Personal Identity
              </div>
              <div className="text-sm font-bold text-white mt-0.5">{identity.personalName}</div>
              <div className="text-xs text-slate-400 font-mono mt-0.5">{identity.personalEmail}</div>
              <div className="mt-2 text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Demo Role Keyring #8842 (Simulation)</span>
              </div>
            </div>

            <div>
              <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                Corporate Role
              </div>
              <div className="text-sm font-bold text-white mt-0.5">{identity.workTitle}</div>
              <div className="text-xs text-slate-400 mt-0.5">{identity.workCompany}</div>
              <div className="mt-2 text-[10px] text-sky-400 font-mono">
                CloudWorks Entitlement: {identity.cloudWorksAccount}
              </div>
            </div>
          </div>

          {/* Payment Methods & Linked Rails */}
          <div className="space-y-2">
            <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
              Connected Settlement Accounts
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-slate-200 font-medium">
                  <span>Corporate Treasury Vault</span>
                  <span className="font-mono text-xs text-emerald-400">
                    ${treasuryBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  Account •••• 8842 · Instant Wire Native Rail
                </div>
              </div>

              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-slate-200 font-medium">
                  <span>Business Credit Line</span>
                  <span className="font-mono text-xs text-slate-300">$50,000.00</span>
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  Card •••• 1094 · Exp 08/29
                </div>
              </div>
            </div>
          </div>

          {/* Delegated AI Agent Permissions Matrix */}
          <div className="space-y-2">
            <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
              Delegated AI Agent Permissions & Spending Caps
            </div>
            <div className="border border-slate-800 rounded-lg overflow-hidden">
              <div className="bg-slate-950 px-3 py-2 border-b border-slate-800 text-[10px] font-semibold text-slate-400 grid grid-cols-3">
                <span>AGENT & ROLE</span>
                <span>AUTO-APPROVE CAP</span>
                <span>FOUNDER THRESHOLD</span>
              </div>
              <div className="divide-y divide-slate-800/60 bg-slate-900/50">
                {identity.agentPermissions.map((perm, idx) => (
                  <div key={idx} className="p-3 grid grid-cols-3 items-center">
                    <div>
                      <div className="font-semibold text-white flex items-center gap-1.5">
                        <Bot className="w-3.5 h-3.5 text-sky-400" />
                        <span>{perm.agentName}</span>
                      </div>
                      <div className="text-[10px] text-slate-400">{perm.role}</div>
                    </div>

                    <div className="font-mono text-emerald-400">
                      {perm.canPreparePayments ? `$${perm.autoApproveLimit}.00` : 'None'}
                    </div>

                    <div className="font-mono text-slate-300 text-[11px]">
                      {perm.founderApprovalRange}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-sky-400" />
            <span>Simulated Identity Session (Demo Mode)</span>
          </div>

          <button
            onClick={() => setShowIdentityModal(false)}
            className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs font-semibold transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

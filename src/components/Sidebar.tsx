/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useWorld } from '../context/WorldContext';
import {
  Globe,
  Building,
  Users,
  Bot,
  Layers,
  Network,
  CheckSquare,
  Inbox,
  CreditCard,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
  DollarSign,
  ArrowUpRight,
  X,
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType =
  | 'WORLD'
  | 'MY COMPANY'
  | 'PEOPLE'
  | 'AGENTS'
  | 'PROJECTS'
  | 'RELATIONSHIPS'
  | 'TASKS'
  | 'INBOX'
  | 'TREASURY';

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<TabType>('MY COMPANY');
  const {
    currentLocation,
    organizations,
    characters,
    currentRooms,
    tasks,
    invoices,
    pullRequests,
    treasuryBalance,
    teleportToOrganization,
    teleportToRoom,
    callVitek,
    interactWithCharacter,
    setShowPRModal,
    setShowTreasuryModal,
    setShowEmailThreadModal,
    setShowDesignReviewModal,
  } = useWorld();

  const tabs: { id: TabType; label: string; icon: any }[] = [
    { id: 'WORLD', label: 'WORLD', icon: Globe },
    { id: 'MY COMPANY', label: 'MY COMPANY', icon: Building },
    { id: 'PEOPLE', label: 'PEOPLE', icon: Users },
    { id: 'AGENTS', label: 'AGENTS', icon: Bot },
    { id: 'PROJECTS', label: 'PROJECTS', icon: Layers },
    { id: 'RELATIONSHIPS', label: 'RELATIONSHIPS', icon: Network },
    { id: 'TASKS', label: 'TASKS', icon: CheckSquare },
    { id: 'INBOX', label: 'INBOX', icon: Inbox },
    { id: 'TREASURY', label: 'TREASURY', icon: CreditCard },
  ];

  if (!isOpen) return null;

  return (
    <aside className="w-80 sm:w-96 bg-slate-900/98 backdrop-blur-md border-r border-slate-800 flex flex-col h-full z-30 shrink-0 select-none shadow-2xl">
      {/* Sidebar Header */}
      <div className="px-4 py-3.5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building className="w-4 h-4 text-sky-400" />
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            Operational Directory
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
          title="Close sidebar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs Navigation (Scrollable horizontal or grid) */}
      <div className="px-2 py-2 border-b border-slate-800/80 overflow-x-auto flex items-center gap-1 scrollbar-none bg-slate-950/40">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* ------------------ TAB: WORLD ------------------ */}
        {activeTab === 'WORLD' && (
          <div className="space-y-3">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Connected Companies ({organizations.length})
            </div>
            {organizations.map((org) => (
              <div
                key={org.id}
                className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg hover:border-slate-700 transition-all space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white">{org.name}</span>
                    {org.isVerified ? (
                      <span className="text-[9px] font-mono font-semibold px-1.5 py-0.2 bg-sky-950 text-sky-300 border border-sky-800/60 rounded">
                        ✓ VERIFIED
                      </span>
                    ) : (
                      <span className="text-[9px] font-mono font-semibold px-1.5 py-0.2 bg-amber-950 text-amber-300 border border-amber-800/60 rounded">
                        EXTERNAL
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => teleportToOrganization(org.id)}
                    className="text-[10px] text-sky-400 hover:text-sky-300 flex items-center gap-0.5 font-medium"
                  >
                    <span>ENTER</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">{org.tagline}</p>
                <div className="flex items-center gap-3 text-[10px] text-slate-500 pt-1 border-t border-slate-900">
                  <span>Rail: {org.communicationRail}</span>
                  <span>·</span>
                  <span>Agents: {org.aiAgentsCount}</span>
                  <span>·</span>
                  <span>Staff: {org.employeesCount}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ------------------ TAB: MY COMPANY ------------------ */}
        {activeTab === 'MY COMPANY' && (
          <div className="space-y-3">
            <div className="p-3 bg-sky-950/40 border border-sky-900/60 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">Campus Status: Operational</span>
                <span className="text-[10px] text-emerald-400 font-mono">100% ONLINE</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                7 active rooms · 4 autonomous agents on site · 1 external EDI rail linked.
              </p>
            </div>

            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Departments & Rooms
            </div>
            <div className="space-y-1.5">
              {[
                { name: 'Founder Office', role: 'Executive Strategy & Keyring #8842', id: 'founder-office' },
                { name: 'Engineering', role: 'Vitek (AI Staff Engineer) · PR #184', id: 'engineering' },
                { name: 'Design', role: 'Alex (Human Lead Designer) · Apollo sprint', id: 'design' },
                { name: 'Procurement', role: 'Maya (AI Procurement) · Customs hold', id: 'procurement' },
                { name: 'Finance', role: 'Treasury vault ($128.4K) & Invoice #511', id: 'finance' },
                { name: 'Meeting Room', role: 'Shared conference hub & board table', id: 'meeting-room' },
                { name: 'Server Room', role: 'Primary ledger node & container runtime', id: 'server-room' },
              ].map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    teleportToOrganization('my-company');
                    teleportToRoom(r.id);
                  }}
                  className="w-full text-left p-2.5 bg-slate-950/50 hover:bg-slate-800/60 border border-slate-800/80 rounded-lg flex items-center justify-between group transition-colors"
                >
                  <div>
                    <div className="text-xs font-semibold text-white group-hover:text-sky-300">
                      {r.name}
                    </div>
                    <div className="text-[10px] text-slate-400">{r.role}</div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-sky-400" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ------------------ TAB: PEOPLE ------------------ */}
        {activeTab === 'PEOPLE' && (
          <div className="space-y-3">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Human Colleagues & Contacts
            </div>
            {[
              {
                name: 'Alex Founder',
                role: 'CEO & Founder · My Company',
                status: 'AVAILABLE',
                location: 'Founder Office',
              },
              {
                name: 'Alex',
                role: 'Lead Human Designer · My Company',
                status: 'COLLABORATING',
                location: 'Design / Project Apollo',
              },
              {
                name: 'Kurt Vance',
                role: 'Lead Fabrication Rep · Acme Mfg',
                status: 'EXTERNAL',
                location: 'Acme Gatehouse (Email Rail)',
              },
            ].map((p, idx) => (
              <div
                key={idx}
                className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">{p.name}</span>
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded">
                    {p.status}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">{p.role}</div>
                <div className="text-[10px] text-sky-400 font-mono">Room: {p.location}</div>
              </div>
            ))}
          </div>
        )}

        {/* ------------------ TAB: AGENTS ------------------ */}
        {activeTab === 'AGENTS' && (
          <div className="space-y-3">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Autonomous AI Workforce
            </div>
            {characters
              .filter((c) => c.type === 'AI')
              .map((agent) => (
                <div
                  key={agent.id}
                  className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg space-y-2 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white">{agent.name}</span>
                      <span className="text-[9px] font-mono text-sky-400 bg-sky-950 px-1.5 py-0.2 rounded border border-sky-800/40">
                        AI
                      </span>
                    </div>
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-semibold ${
                        agent.status === 'WORKING'
                          ? 'bg-blue-950 text-blue-300'
                          : agent.status === 'TALKING'
                          ? 'bg-emerald-950 text-emerald-300'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {agent.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">{agent.role}</div>
                  {agent.statusText && (
                    <div className="text-[10px] text-sky-300 font-mono bg-sky-950/40 p-1 rounded">
                      {agent.statusText}
                    </div>
                  )}
                  <div className="pt-1 flex items-center justify-end">
                    <button
                      onClick={() => {
                        if (agent.id === 'vitek') callVitek();
                        else interactWithCharacter(agent.id);
                      }}
                      className="px-2.5 py-1 text-[11px] font-medium bg-sky-600/80 hover:bg-sky-500 text-white rounded transition-colors"
                    >
                      {agent.id === 'vitek' ? 'Call Vitek' : 'Interact'}
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* ------------------ TAB: PROJECTS ------------------ */}
        {activeTab === 'PROJECTS' && (
          <div className="space-y-3">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Active Cross-Org Projects
            </div>
            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">Project Apollo</span>
                <span className="text-[10px] font-mono text-indigo-400 bg-indigo-950 px-1.5 py-0.5 rounded">
                  JOINT SPRINT
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Shared mobile onboarding rework between My Company & Northstar Design.
              </p>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-emerald-400">Design V2 Ready for review</span>
                <button
                  onClick={() => setShowDesignReviewModal(true)}
                  className="px-2 py-0.5 text-[10px] font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded"
                >
                  REVIEW V2
                </button>
              </div>
            </div>

            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">Onboarding Bug Remediation</span>
                <span className="text-[10px] font-mono text-sky-400 bg-sky-950 px-1.5 py-0.5 rounded">
                  PULL REQUEST
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Signup state drop resolution assigned to Vitek. 42/42 simulated tests passing.
              </p>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-sky-400 font-mono">PR #184</span>
                <button
                  onClick={() => setShowPRModal(true)}
                  className="px-2 py-0.5 text-[10px] font-semibold bg-sky-600 hover:bg-sky-500 text-white rounded"
                >
                  VIEW PR
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ------------------ TAB: RELATIONSHIPS ------------------ */}
        {activeTab === 'RELATIONSHIPS' && (
          <div className="space-y-3">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Institutional Graph
            </div>
            {[
              {
                name: 'Northstar Design',
                rel: 'VERIFIED PARTNER',
                desc: 'Native token syncing, mutual shared rooms, real-time avatar collaboration.',
                rail: 'NATIVE API',
              },
              {
                name: 'Acme Manufacturing',
                rel: 'EXTERNAL SUPPLIER',
                desc: 'Unclaimed business entity. Handled via automated Email Rail & EDI.',
                rail: 'EMAIL RAIL (SIMULATED)',
              },
              {
                name: 'CloudWorks',
                rel: 'ENTERPRISE CLOUD VENDOR',
                desc: 'Verified identity-authenticated cluster hosting & entitlement checks.',
                rail: 'NATIVE API',
              },
            ].map((r, idx) => (
              <div
                key={idx}
                className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">{r.name}</span>
                  <span className="text-[9px] font-mono text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded">
                    {r.rel}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">{r.desc}</p>
                <div className="text-[10px] text-sky-400 font-mono pt-1">Rail: {r.rail}</div>
              </div>
            ))}
          </div>
        )}

        {/* ------------------ TAB: TASKS ------------------ */}
        {activeTab === 'TASKS' && (
          <div className="space-y-3">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Simulated Work Queue ({tasks.length})
            </div>
            {tasks.map((task) => (
              <div
                key={task.id}
                className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">{task.title}</span>
                  <span className="text-[9px] font-mono text-sky-400 bg-sky-950 px-1.5 py-0.5 rounded">
                    {task.status}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Assignee: {task.assignedTo}</span>
                  <span>{task.updatedAt}</span>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1">
                  <div
                    className="bg-sky-500 h-full rounded-full transition-all"
                    style={{ width: `${task.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ------------------ TAB: INBOX ------------------ */}
        {activeTab === 'INBOX' && (
          <div className="space-y-3">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Asynchronous Rail Messages
            </div>
            <div
              onClick={() => setShowEmailThreadModal(true)}
              className="p-3 bg-slate-950/60 hover:bg-slate-800/60 border border-slate-800 rounded-lg cursor-pointer transition-colors space-y-1"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">Acme Manufacturing</span>
                <span className="text-[10px] font-mono text-amber-400">EMAIL RAIL</span>
              </div>
              <div className="text-xs text-sky-300 font-medium">
                Re: Inquiry: Chassis Shipment #511 Customs Hold
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                “Shipment delayed at customs. New ETA: Friday. We can offer a $400 credit.”
              </p>
              <div className="text-[10px] text-slate-500 pt-1">Click to view full thread</div>
            </div>

            <div
              onClick={() => setShowPRModal(true)}
              className="p-3 bg-slate-950/60 hover:bg-slate-800/60 border border-slate-800 rounded-lg cursor-pointer transition-colors space-y-1"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">GitHub Simulation</span>
                <span className="text-[10px] font-mono text-emerald-400">PULL REQUEST</span>
              </div>
              <div className="text-xs text-sky-300 font-medium">
                PR #184: fix(auth): prevent signup state reset
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                Vitek opened branch fix/onboarding-state. All 42 unit & integration tests pass.
              </p>
            </div>
          </div>
        )}

        {/* ------------------ TAB: TREASURY ------------------ */}
        {activeTab === 'TREASURY' && (
          <div className="space-y-3">
            <div className="p-3 bg-amber-950/30 border border-amber-900/60 rounded-lg space-y-1">
              <div className="text-xs text-amber-300 font-medium">Corporate Treasury Vault</div>
              <div className="text-2xl font-bold font-mono text-white">
                ${treasuryBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-slate-400">
                Demo Keyring: #8842 · Simulation active
              </div>
            </div>

            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Pending Invoices
            </div>
            {invoices.map((inv) => (
              <div
                key={inv.id}
                className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">
                    {inv.vendorName} {inv.invoiceNumber}
                  </span>
                  <span
                    className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-semibold ${
                      inv.status === 'PAID'
                        ? 'bg-emerald-950 text-emerald-300'
                        : 'bg-amber-950 text-amber-300'
                    }`}
                  >
                    {inv.status}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Amount Due:</span>
                  <span className="font-bold font-mono text-white">${inv.amount.toFixed(2)}</span>
                </div>
                <div className="pt-1">
                  <button
                    onClick={() => setShowTreasuryModal(true)}
                    className="w-full py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded transition-colors"
                  >
                    {inv.status === 'PAID' ? 'VIEW RECEIPT' : `AUTHORIZE $${inv.amount.toFixed(2)}`}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
};

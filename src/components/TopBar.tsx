/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useWorld } from '../context/WorldContext';
import { DemoModeBadge } from './DemoModeBadge';
import {
  Search,
  Wallet,
  Volume2,
  VolumeX,
  Compass,
  Building,
  UserCheck,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';

interface TopBarProps {
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
  onToggleRealityFeed: () => void;
  isRealityFeedOpen: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  onToggleSidebar,
  isSidebarOpen,
  onToggleRealityFeed,
  isRealityFeedOpen,
}) => {
  const {
    currentLocation,
    setCurrentLocation,
    customerMode,
    setCustomerMode,
    isSoundEnabled,
    setIsSoundEnabled,
    setShowIdentityModal,
    setShowCommandPalette,
    callVitek,
    teleportToOrganization,
    identity,
  } = useWorld();

  return (
    <header className="h-14 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 flex items-center justify-between shrink-0 select-none z-30">
      {/* Zone 1: Wordmark & Core Spatial Brand */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          title="Toggle Sidebar"
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
        >
          <Building className="w-5 h-5 text-sky-400" />
        </button>

        <span className="font-bold text-base tracking-tight text-white flex items-center gap-2">
          Business World
          <DemoModeBadge />
        </span>
      </div>

      {/* Zone 2: Navigation Links & Fast Spatial Shortcuts */}
      <div className="hidden md:flex items-center gap-1.5 bg-slate-950/60 p-1 rounded-lg border border-slate-800/80">
        <button
          onClick={() => setCurrentLocation('MY_COMPANY')}
          className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
            currentLocation === 'MY_COMPANY'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          My Company HQ
        </button>

        <button
          onClick={() => setCurrentLocation('CITY')}
          className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
            currentLocation === 'CITY'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          City Map
        </button>

        <button
          onClick={() => teleportToOrganization('northstar-design')}
          className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
            currentLocation === 'NORTHSTAR'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          Northstar Design
        </button>

        <button
          onClick={() => teleportToOrganization('acme-manufacturing')}
          className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
            currentLocation === 'ACME'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          Acme Mfg
        </button>

        <button
          onClick={() => teleportToOrganization('cloudworks')}
          className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
            currentLocation === 'CLOUDWORKS'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          CloudWorks
        </button>
      </div>

      {/* Zone 3: Actions, Search, Customer Mode & Identity */}
      <div className="flex items-center gap-2.5">
        {/* Customer Mode Toggle (Specifically requested in prompt!) */}
        <button
          onClick={() => {
            const nextMode = !customerMode;
            setCustomerMode(nextMode);
            if (nextMode) {
              teleportToOrganization('cloudworks');
            }
          }}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md border transition-all ${
            customerMode
              ? 'bg-emerald-600/90 text-white border-emerald-400/60 shadow-md animate-pulse'
              : 'bg-slate-800/80 text-slate-300 border-slate-700/60 hover:text-white hover:bg-slate-700'
          }`}
          title="Toggle Consumer Support Demo Mode"
        >
          <UserCheck className="w-3.5 h-3.5" />
          <span className="whitespace-nowrap">
            {customerMode ? 'CUSTOMER MODE ON' : 'ENTER AS CUSTOMER'}
          </span>
        </button>

        {/* Global Command Search (⌘K) */}
        <button
          onClick={() => setShowCommandPalette(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700/60 rounded-md text-xs font-medium transition-all shadow-sm"
          title="Global Search & Teleport"
        >
          <Search className="w-3.5 h-3.5 text-slate-400" />
          <span className="hidden sm:inline">Search world...</span>
          <kbd className="hidden sm:inline-block font-mono text-[10px] bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700 text-slate-400">
            ⌘K
          </kbd>
        </button>

        {/* Identity Wallet */}
        <button
          onClick={() => setShowIdentityModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 hover:text-white border border-slate-700/60 rounded-md text-xs font-medium transition-all"
          title="Open Identity Wallet"
        >
          <Wallet className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden md:inline">{identity.personalName}</span>
          <span className="text-[10px] text-sky-400 font-mono hidden lg:inline">✓ CEO</span>
        </button>

        {/* Reality Feed Drawer Toggle */}
        <button
          onClick={onToggleRealityFeed}
          className={`p-1.5 rounded transition-colors ${
            isRealityFeedOpen
              ? 'bg-sky-600 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
          title="Toggle Reality Feed"
        >
          <Sparkles className="w-4 h-4" />
        </button>

        {/* Sound Toggle */}
        <button
          onClick={() => setIsSoundEnabled(!isSoundEnabled)}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
          title={isSoundEnabled ? 'Mute Sound FX' : 'Enable Sound FX'}
        >
          {isSoundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
        </button>
      </div>
    </header>
  );
};

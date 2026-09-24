/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { WorldProvider } from './context/WorldContext';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { WorldCanvas } from './components/WorldCanvas';
import { RealityFeed } from './components/RealityFeed';
import { AgentDialogueModal } from './components/AgentDialogueModal';
import { PullRequestModal } from './components/PullRequestModal';
import { TreasuryModal } from './components/TreasuryModal';
import { EmailThreadModal } from './components/EmailThreadModal';
import { DesignReviewModal } from './components/DesignReviewModal';
import { IdentityModal } from './components/IdentityModal';
import { CommandPalette } from './components/CommandPalette';
import { FirstRunBanner } from './components/FirstRunBanner';

function WorldContent() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isRealityFeedOpen, setIsRealityFeedOpen] = useState(true);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 select-none">
      {/* Top Navigation Bar */}
      <TopBar
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        isSidebarOpen={isSidebarOpen}
        onToggleRealityFeed={() => setIsRealityFeedOpen((prev) => !prev)}
        isRealityFeedOpen={isRealityFeedOpen}
      />

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Operational Sidebar */}
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        {/* Center Interactive World Canvas */}
        <main className="flex-1 relative h-full overflow-hidden">
          <WorldCanvas />
          <FirstRunBanner />
        </main>

        {/* Right Reality Feed Drawer */}
        <RealityFeed
          isOpen={isRealityFeedOpen}
          onClose={() => setIsRealityFeedOpen(false)}
        />
      </div>

      {/* Interactive Modals & Overlays */}
      <AgentDialogueModal />
      <PullRequestModal />
      <TreasuryModal />
      <EmailThreadModal />
      <DesignReviewModal />
      <IdentityModal />
      <CommandPalette />
    </div>
  );
}

export default function App() {
  return (
    <WorldProvider>
      <WorldContent />
    </WorldProvider>
  );
}

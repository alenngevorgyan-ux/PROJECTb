/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  Character,
  Organization,
  Room,
  RealityEvent,
  PullRequest,
  Invoice,
  TaskItem,
  IdentityProfile,
  ViewLocation,
  AgentWorkflow,
} from '../types/world';
import {
  INITIAL_CHARACTERS,
  INITIAL_ORGANIZATIONS,
  MY_COMPANY_ROOMS,
  NORTHSTAR_ROOMS,
  ACME_ROOMS,
  CLOUDWORKS_ROOMS,
  INITIAL_IDENTITY,
  INITIAL_INVOICES,
  INITIAL_PULL_REQUESTS,
  INITIAL_TASKS,
  INITIAL_REALITY_EVENTS,
} from '../data/initialData';
import { soundFX } from '../audio/soundFx';

interface ActiveDialogue {
  characterId: string;
  stage: string;
  message: string;
  speaker: string;
  speakerRole: string;
  avatarColor: string;
  options?: { label: string; actionId: string; primary?: boolean; variant?: 'default' | 'danger' | 'success' }[];
  isThinking?: boolean;
}

interface WorldContextType {
  currentLocation: ViewLocation;
  setCurrentLocation: (loc: ViewLocation) => void;
  organizations: Organization[];
  characters: Character[];
  rooms: Room[];
  currentRooms: Room[];
  selectedOrganization: Organization | null;
  setSelectedOrganization: (org: Organization | null) => void;
  realityEvents: RealityEvent[];
  pullRequests: PullRequest[];
  invoices: Invoice[];
  tasks: TaskItem[];
  identity: IdentityProfile;
  treasuryBalance: number;
  customerMode: boolean;
  setCustomerMode: (val: boolean) => void;
  isSoundEnabled: boolean;
  setIsSoundEnabled: (val: boolean) => void;
  cameraTarget: { x: number; y: number } | null;
  setCameraTarget: (coords: { x: number; y: number } | null) => void;
  activeDialogue: ActiveDialogue | null;
  setActiveDialogue: (dialogue: ActiveDialogue | null) => void;
  
  // Active modals
  showPRModal: boolean;
  setShowPRModal: (show: boolean) => void;
  showEmailThreadModal: boolean;
  setShowEmailThreadModal: (show: boolean) => void;
  showDesignReviewModal: boolean;
  setShowDesignReviewModal: (show: boolean) => void;
  showTreasuryModal: boolean;
  setShowTreasuryModal: (show: boolean) => void;
  showIdentityModal: boolean;
  setShowIdentityModal: (show: boolean) => void;
  showCommandPalette: boolean;
  setShowCommandPalette: (show: boolean) => void;
  showFirstRunBanner: boolean;
  setShowFirstRunBanner: (show: boolean) => void;

  // Actions
  callVitek: () => void;
  interactWithCharacter: (charId: string) => void;
  handleDialogueOption: (actionId: string) => void;
  teleportToOrganization: (orgId: string) => void;
  teleportToRoom: (roomId: string) => void;
  movePlayerTo: (x: number, y: number) => void;
  approvePayment: (invoiceId: string) => void;
  mergePullRequest: (prId: string) => void;
  addRealityEvent: (event: Omit<RealityEvent, 'id' | 'timestamp'>) => void;
}

const WorldContext = createContext<WorldContextType | null>(null);

export const WorldProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentLocation, setCurrentLocation] = useState<ViewLocation>('MY_COMPANY');
  const [organizations] = useState<Organization[]>(INITIAL_ORGANIZATIONS);
  const [characters, setCharacters] = useState<Character[]>(INITIAL_CHARACTERS);
  const [selectedOrganization, setSelectedOrganization] = useState<Organization | null>(null);
  const [realityEvents, setRealityEvents] = useState<RealityEvent[]>(INITIAL_REALITY_EVENTS);
  const [pullRequests, setPullRequests] = useState<PullRequest[]>(INITIAL_PULL_REQUESTS);
  const [invoices, setInvoices] = useState<Invoice[]>(INITIAL_INVOICES);
  const [tasks, setTasks] = useState<TaskItem[]>(INITIAL_TASKS);
  const [identity, setIdentity] = useState<IdentityProfile>(INITIAL_IDENTITY);
  const [treasuryBalance, setTreasuryBalance] = useState<number>(128450);
  const [customerMode, setCustomerMode] = useState<boolean>(false);
  const [isSoundEnabled, setIsSoundEnabled] = useState<boolean>(true);
  const [cameraTarget, setCameraTarget] = useState<{ x: number; y: number } | null>(null);

  // Active dialogue and modals
  const [activeDialogue, setActiveDialogue] = useState<ActiveDialogue | null>(null);
  const [showPRModal, setShowPRModal] = useState<boolean>(false);
  const [showEmailThreadModal, setShowEmailThreadModal] = useState<boolean>(false);
  const [showDesignReviewModal, setShowDesignReviewModal] = useState<boolean>(false);
  const [showTreasuryModal, setShowTreasuryModal] = useState<boolean>(false);
  const [showIdentityModal, setShowIdentityModal] = useState<boolean>(false);
  const [showCommandPalette, setShowCommandPalette] = useState<boolean>(false);
  const [showFirstRunBanner, setShowFirstRunBanner] = useState<boolean>(true);

  // Sound sync
  useEffect(() => {
    soundFX.enabled = isSoundEnabled;
  }, [isSoundEnabled]);

  // Keyboard shortcut for ⌘K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowCommandPalette((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Helper to add events
  const addRealityEvent = useCallback((event: Omit<RealityEvent, 'id' | 'timestamp'>) => {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const newEvt: RealityEvent = {
      ...event,
      id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: timeStr,
    };
    setRealityEvents((prev) => [newEvt, ...prev.slice(0, 40)]);
  }, []);

  // Rooms for current view
  const currentRooms = React.useMemo(() => {
    switch (currentLocation) {
      case 'MY_COMPANY':
        return MY_COMPANY_ROOMS;
      case 'NORTHSTAR':
        return NORTHSTAR_ROOMS;
      case 'ACME':
        return ACME_ROOMS;
      case 'CLOUDWORKS':
        return CLOUDWORKS_ROOMS;
      default:
        return [];
    }
  }, [currentLocation]);

  const handleSetCurrentLocation = useCallback((loc: ViewLocation) => {
    soundFX.playChime();
    setCurrentLocation(loc);
    if (loc === 'CITY') {
      setCharacters((prev) =>
        prev.map((c) =>
          c.id === 'founder'
            ? { ...c, x: 7, y: 11, currentRoomId: 'CITY', facing: 'down' }
            : c
        )
      );
    } else if (loc === 'MY_COMPANY') {
      setCharacters((prev) =>
        prev.map((c) =>
          c.id === 'founder'
            ? { ...c, x: 3, y: 3, currentRoomId: 'founder-office', facing: 'down' }
            : c
        )
      );
    } else if (loc === 'NORTHSTAR') {
      setCharacters((prev) =>
        prev.map((c) =>
          c.id === 'founder'
            ? { ...c, x: 3, y: 5, currentRoomId: 'northstar-reception', facing: 'down' }
            : c
        )
      );
    } else if (loc === 'ACME') {
      setCharacters((prev) =>
        prev.map((c) =>
          c.id === 'founder'
            ? { ...c, x: 3, y: 5, currentRoomId: 'acme-gatehouse', facing: 'down' }
            : c
        )
      );
    } else if (loc === 'CLOUDWORKS') {
      setCharacters((prev) =>
        prev.map((c) =>
          c.id === 'founder'
            ? { ...c, x: 3, y: 5, currentRoomId: 'cloudworks-support', facing: 'down' }
            : c
        )
      );
    }
  }, []);

  // Teleportation
  const teleportToOrganization = useCallback((orgId: string) => {
    soundFX.playChime();
    const org = organizations.find((o) => o.id === orgId);
    if (org) {
      setSelectedOrganization(org);
    }
    if (orgId === 'my-company') {
      setCurrentLocation('MY_COMPANY');
      setCharacters((prev) =>
        prev.map((c) => (c.id === 'founder' ? { ...c, x: 3, y: 3, currentRoomId: 'founder-office' } : c))
      );
    } else if (orgId === 'northstar-design') {
      setCurrentLocation('NORTHSTAR');
      setCharacters((prev) =>
        prev.map((c) => (c.id === 'founder' ? { ...c, x: 3, y: 5, currentRoomId: 'northstar-reception' } : c))
      );
    } else if (orgId === 'acme-manufacturing') {
      setCurrentLocation('ACME');
      setCharacters((prev) =>
        prev.map((c) => (c.id === 'founder' ? { ...c, x: 3, y: 5, currentRoomId: 'acme-gatehouse' } : c))
      );
    } else if (orgId === 'cloudworks') {
      setCurrentLocation('CLOUDWORKS');
      setCharacters((prev) =>
        prev.map((c) => (c.id === 'founder' ? { ...c, x: 3, y: 5, currentRoomId: 'cloudworks-support' } : c))
      );
    } else {
      // Return to City and position outside building
      setCurrentLocation('CITY');
      if (org) {
        setCharacters((prev) =>
          prev.map((c) =>
            c.id === 'founder'
              ? {
                  ...c,
                  x: org.buildingCoords.x + Math.floor(org.buildingCoords.width / 2),
                  y: org.buildingCoords.y + org.buildingCoords.height + 1,
                  currentRoomId: 'CITY',
                }
              : c
          )
        );
      }
    }
  }, [organizations]);

  const teleportToRoom = useCallback((roomId: string) => {
    soundFX.playFootstep();
    const targetRoom = currentRooms.find((r) => r.id === roomId);
    if (targetRoom && targetRoom.defaultSeat) {
      setCharacters((prev) =>
        prev.map((c) =>
          c.id === 'founder'
            ? {
                ...c,
                x: targetRoom.defaultSeat!.x,
                y: targetRoom.defaultSeat!.y,
                currentRoomId: targetRoom.id,
              }
            : c
        )
      );
    }
  }, [currentRooms]);

  // Smooth player movement
  const movePlayerTo = useCallback((x: number, y: number) => {
    soundFX.playFootstep();
    setCharacters((prev) =>
      prev.map((c) => {
        if (c.id !== 'founder') return c;
        const dx = x - c.x;
        const dy = y - c.y;
        let facing: 'up' | 'down' | 'left' | 'right' = c.facing;
        if (Math.abs(dx) > Math.abs(dy)) {
          facing = dx > 0 ? 'right' : 'left';
        } else if (Math.abs(dy) > 0) {
          facing = dy > 0 ? 'down' : 'up';
        }
        return {
          ...c,
          x,
          y,
          facing,
          isMoving: true,
        };
      })
    );
  }, []);

  // Character Agent Walk loop helper
  const animateAgentWalk = useCallback(
    (charId: string, waypoints: { x: number; y: number }[], onComplete?: () => void) => {
      let stepIndex = 0;
      const interval = setInterval(() => {
        if (stepIndex >= waypoints.length) {
          clearInterval(interval);
          setCharacters((prev) =>
            prev.map((c) => (c.id === charId ? { ...c, isMoving: false } : c))
          );
          if (onComplete) onComplete();
          return;
        }
        const nextCoord = waypoints[stepIndex];
        setCharacters((prev) =>
          prev.map((c) => {
            if (c.id !== charId) return c;
            const dx = nextCoord.x - c.x;
            const dy = nextCoord.y - c.y;
            let facing = c.facing;
            if (Math.abs(dx) > Math.abs(dy)) {
              facing = dx > 0 ? 'right' : 'left';
            } else if (Math.abs(dy) > 0) {
              facing = dy > 0 ? 'down' : 'up';
            }
            return {
              ...c,
              x: nextCoord.x,
              y: nextCoord.y,
              facing,
              isMoving: true,
            };
          })
        );
        stepIndex++;
      }, 160);
    },
    []
  );

  // -------------------------------------------------------------
  // DEMO 1: VITEK CALL FLOW
  // -------------------------------------------------------------
  const callVitek = useCallback(() => {
    soundFX.playChime();
    addRealityEvent({
      agentId: 'founder',
      agentName: 'Alex Founder',
      worldAction: 'Founder called Vitek to executive desk',
      businessEvent: 'Dispatched autonomous engineering directive: Onboarding Audit',
      category: 'DEV',
    });

    setCharacters((prev) =>
      prev.map((c) =>
        c.id === 'vitek'
          ? {
              ...c,
              status: 'WALKING',
              statusText: 'Walking to Founder Office...',
            }
          : c
      )
    );

    // Waypoints from Engineering (9,3) to Founder Office (4,3)
    const waypoints = [
      { x: 8, y: 3 },
      { x: 7, y: 3 },
      { x: 6, y: 3 },
      { x: 5, y: 3 },
      { x: 4, y: 3 },
    ];

    animateAgentWalk('vitek', waypoints, () => {
      // Arrived at Founder
      soundFX.playTerminalBeep();
      setCharacters((prev) =>
        prev.map((c) =>
          c.id === 'vitek'
            ? {
                ...c,
                status: 'TALKING',
                statusText: 'Talking with Founder',
                facing: 'left',
              }
            : c
        )
      );

      setActiveDialogue({
        characterId: 'vitek',
        stage: 'VITEK_INITIAL',
        speaker: 'Vitek',
        speakerRole: 'AI Staff Engineer',
        avatarColor: '#3b82f6',
        message: 'Yep. What do you need?',
        options: [
          {
            label: 'Check why onboarding is failing and prepare a fix. Don’t deploy anything.',
            actionId: 'VITEK_REQ_ONBOARDING',
            primary: true,
          },
          {
            label: 'Give me a quick status update on our CI pipeline.',
            actionId: 'VITEK_STATUS_UPDATE',
          },
          {
            label: 'Nevermind, return to your desk.',
            actionId: 'VITEK_DISMISS',
          },
        ],
      });
    });
  }, [addRealityEvent, animateAgentWalk]);

  // Vitek work pipeline execution
  const runVitekEngineeringPipeline = useCallback(() => {
    setActiveDialogue(null);
    soundFX.playFootstep();

    // Vitek walks back to desk
    const waypoints = [
      { x: 5, y: 3 },
      { x: 6, y: 3 },
      { x: 7, y: 3 },
      { x: 8, y: 3 },
      { x: 9, y: 3 },
    ];

    animateAgentWalk('vitek', waypoints, () => {
      // Start pipeline at desk
      const stages = [
        { label: 'ANALYZING REPOSITORY', duration: 1800, reality: 'Ran AST lint & repo traversal on auth slice' },
        { label: 'CREATING BRANCH', duration: 1600, reality: 'Created git branch `fix/onboarding-state`' },
        { label: 'EDITING', duration: 2000, reality: 'Patched useSessionState.ts & VerifyEmail.tsx' },
        { label: 'RUNNING TESTS', duration: 2200, reality: 'Executed test runner: 42/42 unit & e2e suites passing' },
        { label: 'OPENING PR', duration: 1600, reality: 'Opened Pull Request #184 with verified diff' },
      ];

      let currentStageIdx = 0;

      const advanceStage = () => {
        if (currentStageIdx >= stages.length) {
          // Pipeline complete! Vitek stands up and walks back to Founder!
          soundFX.playActionComplete();
          setCharacters((prev) =>
            prev.map((c) =>
              c.id === 'vitek'
                ? {
                    ...c,
                    status: 'WALKING',
                    statusText: 'Walking back to Founder with PR #184...',
                  }
                : c
            )
          );

          // Walk back to founder
          animateAgentWalk('vitek', [{ x: 8, y: 3 }, { x: 7, y: 3 }, { x: 6, y: 3 }, { x: 5, y: 3 }, { x: 4, y: 3 }], () => {
            setCharacters((prev) =>
              prev.map((c) =>
                c.id === 'vitek'
                  ? {
                      ...c,
                      status: 'TALKING',
                      statusText: 'Presenting PR #184 to Founder',
                      facing: 'left',
                    }
                  : c
              )
            );

            setActiveDialogue({
              characterId: 'vitek',
              stage: 'VITEK_RESULT',
              speaker: 'Vitek',
              speakerRole: 'AI Staff Engineer',
              avatarColor: '#3b82f6',
              message:
                'Found it. The signup state was being reset after email verification.\n\nPR #184 created.\n42/42 tests passing.\n\nWant me to call QA?',
              options: [
                { label: 'VIEW PR #184', actionId: 'VIEW_PR_184', primary: true },
                { label: 'CALL QA', actionId: 'VITEK_CALL_QA' },
                { label: 'APPROVE', actionId: 'VITEK_APPROVE', variant: 'success' },
                { label: 'NOT NOW', actionId: 'VITEK_DISMISS' },
              ],
            });
          });
          return;
        }

        const stage = stages[currentStageIdx];
        soundFX.playTerminalBeep();
        setCharacters((prev) =>
          prev.map((c) =>
            c.id === 'vitek'
              ? {
                  ...c,
                  status: 'WORKING',
                  statusText: stage.label,
                }
              : c
          )
        );

        addRealityEvent({
          agentId: 'vitek',
          agentName: 'Vitek',
          worldAction: `Vitek terminal: ${stage.label}`,
          businessEvent: stage.reality,
          category: 'DEV',
        });

        currentStageIdx++;
        setTimeout(advanceStage, stage.duration);
      };

      advanceStage();
    });
  }, [animateAgentWalk, addRealityEvent]);

  // -------------------------------------------------------------
  // DEMO 2: MAYA EXTERNAL ACME SHIPMENT DEMO
  // -------------------------------------------------------------
  const startMayaAcmeWorkflow = useCallback(() => {
    setActiveDialogue(null);
    soundFX.playChime();

    addRealityEvent({
      agentId: 'maya',
      agentName: 'Maya',
      worldAction: 'Maya initiated external supplier query to Acme Manufacturing',
      businessEvent: 'Transmitting RFC-822 authenticated dispatch on Email Rail',
      category: 'SUPPLY',
    });

    setCharacters((prev) =>
      prev.map((c) =>
        c.id === 'maya'
          ? {
              ...c,
              status: 'EN ROUTE',
              statusText: 'Exiting My Company to dispatch Acme Email Rail...',
            }
          : c
      )
    );

    // Maya walks out of Procurement
    const waypoints = [
      { x: 3, y: 7 },
      { x: 3, y: 6 },
      { x: 3, y: 5 },
      { x: 4, y: 5 },
      { x: 5, y: 5 },
    ];

    animateAgentWalk('maya', waypoints, () => {
      // Simulated Email Rail transmission
      setTimeout(() => {
        soundFX.playTerminalBeep();
        addRealityEvent({
          agentId: 'maya',
          agentName: 'Maya',
          worldAction: 'EMAIL RAIL: Outgoing email sent to vendor-support@acme-mfg.internal',
          businessEvent: 'PO #511 Customs Hold Inquiry dispatched',
          category: 'SUPPLY',
        });

        setCharacters((prev) =>
          prev.map((c) =>
            c.id === 'maya'
              ? {
                  ...c,
                  status: 'WAITING FOR APPROVAL',
                  statusText: 'Waiting for Acme Email response...',
                }
              : c
          )
        );

        // Simulated asynchronous supplier response
        setTimeout(() => {
          soundFX.playActionComplete();
          addRealityEvent({
            agentId: 'acme',
            agentName: 'Acme Manufacturing (External)',
            worldAction: 'ACME RESPONSE RECEIVED via Email Rail',
            businessEvent: '“Shipment delayed at customs. New ETA: Friday. We can offer a $400 credit.”',
            category: 'SUPPLY',
          });

          // Maya walks back to Founder office to report!
          setCharacters((prev) =>
            prev.map((c) =>
              c.id === 'maya'
                ? {
                    ...c,
                    status: 'WALKING',
                    statusText: 'Returning to Founder Office with Acme response...',
                  }
                : c
            )
          );

          animateAgentWalk('maya', [{ x: 4, y: 4 }, { x: 4, y: 3 }], () => {
            setCharacters((prev) =>
              prev.map((c) =>
                c.id === 'maya'
                  ? {
                      ...c,
                      status: 'TALKING',
                      statusText: 'Briefing Founder on Acme negotiation',
                      facing: 'left',
                    }
                  : c
              )
            );

            setActiveDialogue({
              characterId: 'maya',
              stage: 'MAYA_ACME_REPORT',
              speaker: 'Maya',
              speakerRole: 'AI Procurement Lead',
              avatarColor: '#10b981',
              message:
                'Acme confirmed a customs delay. New ETA is Friday and they’re offering a $400 credit on Invoice #511.\n\nAccept credit?',
              options: [
                { label: 'ACCEPT CREDIT', actionId: 'MAYA_ACCEPT_CREDIT', primary: true, variant: 'success' },
                { label: 'NEGOTIATE ($600 credit)', actionId: 'MAYA_NEGOTIATE' },
                { label: 'ESCALATE TO CARRIER', actionId: 'MAYA_ESCALATE', variant: 'danger' },
                { label: 'VIEW EMAIL THREAD', actionId: 'VIEW_EMAIL_THREAD' },
              ],
            });
          });
        }, 3200);
      }, 1500);
    });
  }, [animateAgentWalk, addRealityEvent]);

  // -------------------------------------------------------------
  // DEMO 3: NORTHSTAR CROSS-COMPANY COLLAB (ALEX + NOVA)
  // -------------------------------------------------------------
  const startNorthstarDesignCollab = useCallback(() => {
    setActiveDialogue(null);
    soundFX.playChime();

    addRealityEvent({
      agentId: 'founder',
      agentName: 'Alex Founder',
      worldAction: 'Launched joint design sprint in Project Apollo room',
      businessEvent: 'Synchronized cross-org design tokens between My Company & Northstar',
      category: 'DESIGN',
    });

    setCharacters((prev) =>
      prev.map((c) => {
        if (c.id === 'nova' || c.id === 'alex-designer') {
          return {
            ...c,
            status: 'WALKING',
            statusText: 'Moving to Project Apollo collaboration table...',
          };
        }
        return c;
      })
    );

    // Both walk to collaboration table (coords: 14, 5 and 16, 5)
    setTimeout(() => {
      soundFX.playFootstep();
      setCharacters((prev) =>
        prev.map((c) => {
          if (c.id === 'nova') {
            return {
              ...c,
              x: 14,
              y: 5,
              facing: 'right',
              status: 'WORKING',
              statusText: 'Drafting mobile onboarding tokens...',
            };
          }
          if (c.id === 'alex-designer') {
            return {
              ...c,
              x: 16,
              y: 5,
              facing: 'left',
              status: 'WORKING',
              statusText: 'Validating accessibility contrast...',
            };
          }
          return c;
        })
      );

      // Conversational work bubbles
      setTimeout(() => {
        soundFX.playTerminalBeep();
        addRealityEvent({
          agentId: 'nova',
          agentName: 'Nova (Northstar AI)',
          worldAction: 'Nova highlighted layout bug: “The current component breaks Northstar’s mobile grid.”',
          businessEvent: 'Auto-refactoring 8pt fluid padding container',
          category: 'DESIGN',
        });

        setTimeout(() => {
          soundFX.playTerminalBeep();
          addRealityEvent({
            agentId: 'alex-designer',
            agentName: 'Alex (Human Designer)',
            worldAction: 'Alex noted: “We need to preserve accessibility and our existing signup logic.”',
            businessEvent: 'Applied WCAG 2.2 AA contrast standards to auth buttons',
            category: 'DESIGN',
          });

          setTimeout(() => {
            soundFX.playActionComplete();
            addRealityEvent({
              agentId: 'nova',
              agentName: 'Nova (Northstar AI)',
              worldAction: 'DESIGN V2 READY · Human approval required',
              businessEvent: 'Generated responsive design tokens & prototype bundle',
              category: 'DESIGN',
            });

            setCharacters((prev) =>
              prev.map((c) => {
                if (c.id === 'nova') {
                  return {
                    ...c,
                    status: 'WAITING FOR APPROVAL',
                    statusText: 'Design V2 Ready for review',
                  };
                }
                return c;
              })
            );

            setActiveDialogue({
              characterId: 'nova',
              stage: 'NOVA_DESIGN_READY',
              speaker: 'Nova',
              speakerRole: 'AI Principal Designer · Northstar Design',
              avatarColor: '#6366f1',
              message:
                'Alex and I completed the mobile onboarding rework!\n\nAll components now adhere to Northstar’s fluid grid while preserving existing signup validation hooks.\n\nDESIGN V2 READY — Human approval required.',
              options: [
                { label: 'REVIEW DESIGN V2', actionId: 'REVIEW_DESIGN_V2', primary: true },
                { label: 'APPROVE DIRECTLY', actionId: 'APPROVE_DESIGN_DIRECT', variant: 'success' },
                { label: 'CLOSE', actionId: 'DISMISS_DIALOGUE' },
              ],
            });
          }, 2400);
        }, 2200);
      }, 1600);
    }, 600);
  }, [addRealityEvent]);

  // -------------------------------------------------------------
  // DEMO 4: CLOUDWORKS CUSTOMER SUPPORT DEMO
  // -------------------------------------------------------------
  const startCloudWorksSupportFlow = useCallback(() => {
    soundFX.playChime();
    setActiveDialogue({
      characterId: 'cloudworks-agent',
      stage: 'CW_WELCOME',
      speaker: 'Dex',
      speakerRole: 'AI Support Specialist · CloudWorks',
      avatarColor: '#10b981',
      message: 'Hey — what can I help you with today?',
      options: [
        {
          label: 'My subscription renewed yesterday but the product says I don’t have Pro.',
          actionId: 'CW_ISSUE_PRO_ACCESS',
          primary: true,
        },
        {
          label: 'Just reviewing our cluster metrics and uptime SLA.',
          actionId: 'CW_CHECK_SLA',
        },
      ],
    });
  }, []);

  // -------------------------------------------------------------
  // INTERACT WITH CHARACTERS (CLICK / APPROACH)
  // -------------------------------------------------------------
  const interactWithCharacter = useCallback(
    (charId: string) => {
      soundFX.playFootstep();
      const char = characters.find((c) => c.id === charId);
      if (!char) return;

      if (charId === 'vitek') {
        setActiveDialogue({
          characterId: 'vitek',
          stage: 'VITEK_INITIAL',
          speaker: 'Vitek',
          speakerRole: 'AI Staff Engineer',
          avatarColor: '#3b82f6',
          message: 'Yep. What do you need?',
          options: [
            {
              label: 'Check why onboarding is failing and prepare a fix. Don’t deploy anything.',
              actionId: 'VITEK_REQ_ONBOARDING',
              primary: true,
            },
            {
              label: 'Show me Pull Request #184 status.',
              actionId: 'VIEW_PR_184',
            },
            {
              label: 'Status report on unit test suites.',
              actionId: 'VITEK_STATUS_UPDATE',
            },
          ],
        });
      } else if (charId === 'maya') {
        setActiveDialogue({
          characterId: 'maya',
          stage: 'MAYA_INITIAL',
          speaker: 'Maya',
          speakerRole: 'AI Procurement Lead',
          avatarColor: '#10b981',
          message: 'Hi Alex. Tracking vendor pipelines and customs shipments. What can I do for you?',
          options: [
            {
              label: 'Maya, go ask Acme why shipment #511 is late.',
              actionId: 'MAYA_ASK_ACME_SHIPMENT',
              primary: true,
            },
            {
              label: 'Review pending invoices and treasury spending limits.',
              actionId: 'MAYA_REVIEW_INVOICES',
            },
            {
              label: 'Check inventory reserves for aluminum chassis.',
              actionId: 'MAYA_INVENTORY_CHECK',
            },
          ],
        });
      } else if (charId === 'alex-designer') {
        setActiveDialogue({
          characterId: 'alex-designer',
          stage: 'ALEX_DESIGNER',
          speaker: 'Alex',
          speakerRole: 'Lead Human Designer',
          avatarColor: '#a855f7',
          message:
            'Hey! I’ve been coordinating with Nova over at Northstar Design. Want to run a joint sprint on Project Apollo?',
          options: [
            {
              label: 'Let’s visit Northstar Design and collaborate with Nova.',
              actionId: 'GO_TO_NORTHSTAR',
              primary: true,
            },
            {
              label: 'Review our current design system tokens.',
              actionId: 'REVIEW_DESIGN_V2',
            },
          ],
        });
      } else if (charId === 'northstar-receptionist') {
        setActiveDialogue({
          characterId: 'northstar-receptionist',
          stage: 'NORTHSTAR_RECEPTION',
          speaker: 'Lyra',
          speakerRole: 'AI Concierge · Northstar Design',
          avatarColor: '#818cf8',
          message: 'Hey! Welcome to Northstar. What can I help with?',
          options: [
            { label: 'Existing project', actionId: 'NS_EXISTING_PROJECT', primary: true },
            { label: 'New project inquiry', actionId: 'NS_NEW_PROJECT' },
            { label: 'Billing & Invoicing', actionId: 'NS_BILLING' },
            { label: 'Partnership overview', actionId: 'NS_PARTNERSHIP' },
            { label: 'Talk to someone', actionId: 'NS_TALK_SOMEONE' },
          ],
        });
      } else if (charId === 'nova') {
        setActiveDialogue({
          characterId: 'nova',
          stage: 'NOVA_ROOM',
          speaker: 'Nova',
          speakerRole: 'AI Principal Designer · Northstar Design',
          avatarColor: '#6366f1',
          message: 'Welcome to the Project Apollo suite! What should we build next with your design team?',
          options: [
            {
              label: 'Nova, work with Alex on the mobile onboarding.',
              actionId: 'NOVA_WORK_WITH_ALEX',
              primary: true,
            },
            {
              label: 'Inspect Project Apollo component specifications.',
              actionId: 'REVIEW_DESIGN_V2',
            },
          ],
        });
      } else if (charId === 'cloudworks-agent') {
        startCloudWorksSupportFlow();
      }
    },
    [characters, startCloudWorksSupportFlow]
  );

  // -------------------------------------------------------------
  // DIALOGUE OPTION HANDLERS
  // -------------------------------------------------------------
  const handleDialogueOption = useCallback(
    (actionId: string) => {
      soundFX.playFootstep();

      // VITEK ACTIONS
      if (actionId === 'VITEK_REQ_ONBOARDING') {
        setActiveDialogue({
          characterId: 'vitek',
          stage: 'VITEK_CLARIFY',
          speaker: 'Vitek',
          speakerRole: 'AI Staff Engineer',
          avatarColor: '#3b82f6',
          message: 'Should I only prepare a PR, or can I merge after tests pass?',
          options: [
            { label: 'PR only.', actionId: 'VITEK_PR_ONLY', primary: true },
            { label: 'Merge after tests pass.', actionId: 'VITEK_MERGE_DIRECT' },
          ],
        });
      } else if (actionId === 'VITEK_PR_ONLY') {
        setActiveDialogue({
          characterId: 'vitek',
          stage: 'VITEK_START_WORK',
          speaker: 'Vitek',
          speakerRole: 'AI Staff Engineer',
          avatarColor: '#3b82f6',
          message: 'Got it. I’ll come back when it’s ready.',
          options: [],
        });
        setTimeout(() => {
          runVitekEngineeringPipeline();
        }, 900);
      } else if (actionId === 'VIEW_PR_184') {
        setActiveDialogue(null);
        setShowPRModal(true);
      } else if (actionId === 'VITEK_CALL_QA') {
        soundFX.playActionComplete();
        addRealityEvent({
          agentId: 'vitek',
          agentName: 'Vitek',
          worldAction: 'Vitek triggered automated QA suite dispatch',
          businessEvent: 'Cypress & Playwright synthetic worker pool allocated for PR #184',
          category: 'DEV',
        });
        setActiveDialogue({
          characterId: 'vitek',
          stage: 'VITEK_QA_CALLED',
          speaker: 'Vitek',
          speakerRole: 'AI Staff Engineer',
          avatarColor: '#3b82f6',
          message: 'Automated QA suite notified. Synthetic test runs initiated on staging cluster.',
          options: [
            { label: 'VIEW PR #184', actionId: 'VIEW_PR_184', primary: true },
            { label: 'DISMISS', actionId: 'VITEK_DISMISS' },
          ],
        });
      } else if (actionId === 'VITEK_APPROVE') {
        soundFX.playActionComplete();
        setPullRequests((prev) =>
          prev.map((pr) => (pr.id === 'pr-184' ? { ...pr, status: 'MERGED' } : pr))
        );
        addRealityEvent({
          agentId: 'founder',
          agentName: 'Alex Founder',
          worldAction: 'Founder merged Pull Request #184 into `main`',
          businessEvent: 'CI/CD pipeline deployed commit #a7f920b to production',
          category: 'DEV',
        });
        setActiveDialogue({
          characterId: 'vitek',
          stage: 'VITEK_APPROVED',
          speaker: 'Vitek',
          speakerRole: 'AI Staff Engineer',
          avatarColor: '#3b82f6',
          message: 'PR #184 merged. Production deploy verified green. Returning to Engineering.',
          options: [{ label: 'DISMISS', actionId: 'VITEK_DISMISS' }],
        });
      } else if (actionId === 'VITEK_DISMISS') {
        setActiveDialogue(null);
        setCharacters((prev) =>
          prev.map((c) =>
            c.id === 'vitek'
              ? {
                  ...c,
                  status: 'AVAILABLE',
                  statusText: 'Ready at Engineering desk',
                }
              : c
          )
        );
      }

      // MAYA ACTIONS
      else if (actionId === 'MAYA_ASK_ACME_SHIPMENT') {
        setActiveDialogue({
          characterId: 'maya',
          stage: 'MAYA_CLARIFY',
          speaker: 'Maya',
          speakerRole: 'AI Procurement Lead',
          avatarColor: '#10b981',
          message: 'Should I contact our normal supplier contact at Acme Manufacturing?',
          options: [
            { label: 'Yes.', actionId: 'MAYA_CONFIRM_SUPPLIER_CONTACT', primary: true },
            { label: 'Check logistics records first.', actionId: 'MAYA_CHECK_RECORDS' },
          ],
        });
      } else if (actionId === 'MAYA_CONFIRM_SUPPLIER_CONTACT') {
        startMayaAcmeWorkflow();
      } else if (actionId === 'VIEW_EMAIL_THREAD') {
        setActiveDialogue(null);
        setShowEmailThreadModal(true);
      } else if (actionId === 'MAYA_ACCEPT_CREDIT') {
        soundFX.playActionComplete();
        // Update Invoice #511
        setInvoices((prev) =>
          prev.map((inv) =>
            inv.id === 'inv-511'
              ? {
                  ...inv,
                  amount: 418.0,
                  items: [
                    { description: 'Precision CNC Aluminum Chassis Units (Batch 1)', quantity: 2, unitPrice: 409.0 },
                    { description: 'Customs Delay Service Credit (Agreed via Email Rail)', quantity: 1, unitPrice: -400.0 },
                  ],
                }
              : inv
          )
        );
        addRealityEvent({
          agentId: 'maya',
          agentName: 'Maya',
          worldAction: 'Maya accepted $400 vendor credit for customs delay',
          businessEvent: 'Revised Acme Invoice #511 down to $418.00; pending founder signature',
          category: 'FINANCE',
        });
        setActiveDialogue({
          characterId: 'maya',
          stage: 'MAYA_CREDIT_ACCEPTED',
          speaker: 'Maya',
          speakerRole: 'AI Procurement Lead',
          avatarColor: '#10b981',
          message:
            'Credit accepted and applied to Invoice #511. Revised total: $418.00.\n\nReady for Treasury authorization in Finance.',
          options: [
            { label: 'OPEN TREASURY & PAY $418', actionId: 'OPEN_TREASURY_MODAL', primary: true },
            { label: 'DISMISS', actionId: 'DISMISS_DIALOGUE' },
          ],
        });
      }

      // NORTHSTAR ACTIONS
      else if (actionId === 'GO_TO_NORTHSTAR') {
        teleportToOrganization('northstar-design');
        setActiveDialogue(null);
      } else if (actionId === 'NS_EXISTING_PROJECT') {
        setActiveDialogue({
          characterId: 'northstar-receptionist',
          stage: 'NS_WHICH_PROJECT',
          speaker: 'Lyra',
          speakerRole: 'AI Concierge · Northstar Design',
          avatarColor: '#818cf8',
          message: 'Which project would you like to enter?',
          options: [
            { label: 'Project Apollo', actionId: 'ENTER_PROJECT_APOLLO', primary: true },
            { label: 'Brand Guidelines 2026', actionId: 'NS_BRAND_GUIDE' },
          ],
        });
      } else if (actionId === 'ENTER_PROJECT_APOLLO') {
        soundFX.playChime();
        teleportToRoom('project-apollo-room');
        setActiveDialogue({
          characterId: 'nova',
          stage: 'NOVA_ROOM',
          speaker: 'Nova',
          speakerRole: 'AI Principal Designer · Northstar Design',
          avatarColor: '#6366f1',
          message:
            'Welcome to the shared Project Apollo room! Alex and I are ready to collaborate on our next milestone.',
          options: [
            {
              label: 'Nova, work with Alex on the mobile onboarding.',
              actionId: 'NOVA_WORK_WITH_ALEX',
              primary: true,
            },
          ],
        });
      } else if (actionId === 'NOVA_WORK_WITH_ALEX') {
        startNorthstarDesignCollab();
      } else if (actionId === 'REVIEW_DESIGN_V2') {
        setActiveDialogue(null);
        setShowDesignReviewModal(true);
      }

      // CLOUDWORKS ACTIONS
      else if (actionId === 'CW_ISSUE_PRO_ACCESS') {
        setActiveDialogue({
          characterId: 'cloudworks-agent',
          stage: 'CW_ALLOW_PERMISSION',
          speaker: 'Dex',
          speakerRole: 'AI Support Specialist · CloudWorks',
          avatarColor: '#10b981',
          message:
            'I can check that. Can I access your CloudWorks subscription account and billing telemetry?',
          options: [
            { label: 'ALLOW ONCE', actionId: 'CW_ALLOW_ONCE', primary: true, variant: 'success' },
            { label: 'CANCEL', actionId: 'DISMISS_DIALOGUE' },
          ],
        });
      } else if (actionId === 'CW_ALLOW_ONCE') {
        soundFX.playTerminalBeep();
        addRealityEvent({
          agentId: 'cloudworks-agent',
          agentName: 'Dex (CloudWorks AI)',
          worldAction: 'Identity grant verified: Temporary read access to Customer #84922',
          businessEvent: 'Queried entitlement ledger for transaction #tx_984210',
          category: 'SUPPORT',
        });
        setActiveDialogue({
          characterId: 'cloudworks-agent',
          stage: 'CW_FOUND_STATE',
          speaker: 'Dex',
          speakerRole: 'AI Support Specialist · CloudWorks',
          avatarColor: '#10b981',
          message:
            'Found it.\n\nPayment succeeded yesterday, but the entitlement update failed in webhook dispatch.\n\nI can restore Pro immediately and open a billing incident for the duplicate state.',
          options: [{ label: 'FIX IT', actionId: 'CW_FIX_IT', primary: true, variant: 'success' }],
        });
      } else if (actionId === 'CW_FIX_IT') {
        soundFX.playActionComplete();
        // Update identity profile
        setIdentity((prev) => ({
          ...prev,
          cloudWorksAccount: 'Customer #84922 (Pro Tier · Active)',
        }));
        addRealityEvent({
          agentId: 'cloudworks-agent',
          agentName: 'Dex (CloudWorks AI)',
          worldAction: 'PRO ACCESS RESTORED · Case CW-18421 closed',
          businessEvent: 'Provisioned unlimited cluster instances & edge caching',
          category: 'SUPPORT',
        });
        setActiveDialogue({
          characterId: 'cloudworks-agent',
          stage: 'CW_RESTORED',
          speaker: 'Dex',
          speakerRole: 'AI Support Specialist · CloudWorks',
          avatarColor: '#10b981',
          message:
            'PRO ACCESS RESTORED\n\nCase: CW-18421\n\nNo forms. No phone calls. Your cluster credentials have been re-synced.',
          options: [{ label: 'DONE', actionId: 'DISMISS_DIALOGUE' }],
        });
      }

      // TREASURY / INVOICE ACTIONS
      else if (actionId === 'OPEN_TREASURY_MODAL' || actionId === 'MAYA_REVIEW_INVOICES') {
        setActiveDialogue(null);
        setShowTreasuryModal(true);
      }

      // GENERAL DISMISS
      else if (actionId === 'DISMISS_DIALOGUE') {
        setActiveDialogue(null);
      }
    },
    [
      runVitekEngineeringPipeline,
      startMayaAcmeWorkflow,
      teleportToOrganization,
      teleportToRoom,
      startNorthstarDesignCollab,
      addRealityEvent,
    ]
  );

  // Payment approval simulation
  const approvePayment = useCallback(
    (invoiceId: string) => {
      soundFX.playPaymentTransfer();
      const invoice = invoices.find((i) => i.id === invoiceId);
      if (!invoice) return;

      setTreasuryBalance((prev) => prev - invoice.amount);
      setInvoices((prev) =>
        prev.map((i) => (i.id === invoiceId ? { ...i, status: 'PAID' } : i))
      );

      addRealityEvent({
        agentId: 'founder',
        agentName: 'Alex Founder',
        worldAction: `Founder approved payment for Acme Invoice ${invoice.invoiceNumber} ($${invoice.amount})`,
        businessEvent: `Biometric key #8842 authorized instant wire from Treasury balance`,
        category: 'FINANCE',
      });
    },
    [invoices, addRealityEvent]
  );

  // Merge PR simulation
  const mergePullRequest = useCallback(
    (prId: string) => {
      soundFX.playActionComplete();
      setPullRequests((prev) =>
        prev.map((pr) => (pr.id === prId ? { ...pr, status: 'MERGED' } : pr))
      );
      addRealityEvent({
        agentId: 'founder',
        agentName: 'Alex Founder',
        worldAction: `Founder merged PR #184 into main branch`,
        businessEvent: 'Automated CI/CD build triggered; container image pushed to CloudWorks cluster',
        category: 'DEV',
      });
    },
    [addRealityEvent]
  );

  return (
    <WorldContext.Provider
      value={{
        currentLocation,
        setCurrentLocation: handleSetCurrentLocation,
        organizations,
        characters,
        rooms: [
          ...MY_COMPANY_ROOMS,
          ...NORTHSTAR_ROOMS,
          ...ACME_ROOMS,
          ...CLOUDWORKS_ROOMS,
        ],
        currentRooms,
        selectedOrganization,
        setSelectedOrganization,
        realityEvents,
        pullRequests,
        invoices,
        tasks,
        identity,
        treasuryBalance,
        customerMode,
        setCustomerMode,
        isSoundEnabled,
        setIsSoundEnabled,
        cameraTarget,
        setCameraTarget,
        activeDialogue,
        setActiveDialogue,
        showPRModal,
        setShowPRModal,
        showEmailThreadModal,
        setShowEmailThreadModal,
        showDesignReviewModal,
        setShowDesignReviewModal,
        showTreasuryModal,
        setShowTreasuryModal,
        showIdentityModal,
        setShowIdentityModal,
        showCommandPalette,
        setShowCommandPalette,
        showFirstRunBanner,
        setShowFirstRunBanner,
        callVitek,
        interactWithCharacter,
        handleDialogueOption,
        teleportToOrganization,
        teleportToRoom,
        movePlayerTo,
        approvePayment,
        mergePullRequest,
        addRealityEvent,
      }}
    >
      {children}
    </WorldContext.Provider>
  );
};

export const useWorld = () => {
  const context = useContext(WorldContext);
  if (!context) {
    throw new Error('useWorld must be used within a WorldProvider');
  }
  return context;
};

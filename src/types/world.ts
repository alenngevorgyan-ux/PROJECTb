/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type AgentStatus =
  | 'AVAILABLE'
  | 'WORKING'
  | 'WAITING FOR APPROVAL'
  | 'IN MEETING'
  | 'OUTSIDE COMPANY'
  | 'WALKING'
  | 'TALKING'
  | 'EN ROUTE';

export type AgentRoleType = 'AI' | 'HUMAN';

export interface Character {
  id: string;
  name: string;
  role: string;
  type: AgentRoleType;
  companyId: string;
  currentRoomId: string; // or 'CITY'
  status: AgentStatus;
  avatarColor: string;
  hairColor: string;
  shirtColor: string;
  pantsColor: string;
  x: number; // grid coordinates
  y: number;
  targetX?: number;
  targetY?: number;
  facing: 'up' | 'down' | 'left' | 'right';
  isMoving?: boolean;
  statusText?: string;
  currentWorkflow?: AgentWorkflow;
}

export interface AgentWorkflow {
  id: string;
  type: 'VITEK_ONBOARDING_FIX' | 'MAYA_ACME_SHIPMENT' | 'NOVA_DESIGN_COLLAB' | 'CLOUDWORKS_SUPPORT';
  step: number;
  totalSteps: number;
  stepLabel: string;
  progressPercent: number;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'WAITING_INPUT';
  resultData?: any;
}

export interface Organization {
  id: string;
  name: string;
  badge: 'VERIFIED' | 'EXTERNAL / UNCLAIMED';
  isVerified: boolean;
  tagline: string;
  description: string;
  accentColor: string;
  buildingCoords: { x: number; y: number; width: number; height: number };
  communicationRail: 'NATIVE' | 'EMAIL' | 'API' | 'EDI';
  relationship: 'OWNED' | 'PARTNER' | 'SUPPLIER' | 'VENDOR' | 'PROSPECT';
  employeesCount: number;
  aiAgentsCount: number;
  services: string[];
  publicDepartments: string[];
  activeProjects: string[];
}

export interface Room {
  id: string;
  companyId: string;
  name: string;
  description: string;
  bounds: { x: number; y: number; width: number; height: number };
  color: string;
  iconName: string;
  defaultSeat?: { x: number; y: number };
}

export interface RealityEvent {
  id: string;
  timestamp: string;
  agentId: string;
  agentName: string;
  worldAction: string;
  businessEvent: string;
  category: 'DEV' | 'SUPPLY' | 'DESIGN' | 'FINANCE' | 'SUPPORT' | 'GENERAL';
  relatedEntityId?: string;
}

export interface PullRequest {
  id: string;
  number: number;
  title: string;
  branch: string;
  author: string;
  status: 'OPEN' | 'MERGED' | 'CHECKS_PASSING';
  testsCount: number;
  testsPassed: number;
  summary: string;
  diffSummary: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  vendorName: string;
  vendorId: string;
  amount: number;
  date: string;
  dueDate: string;
  status: 'PENDING_APPROVAL' | 'PAID' | 'SCHEDULED';
  items: { description: string; quantity: number; unitPrice: number }[];
  requiresFounderApproval: boolean;
  currency: string;
}

export interface TaskItem {
  id: string;
  title: string;
  assignedTo: string;
  organizationId: string;
  status: 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  progress: number;
  updatedAt: string;
}

export interface IdentityProfile {
  personalName: string;
  personalEmail: string;
  workTitle: string;
  workCompany: string;
  workVerified: boolean;
  cloudWorksAccount: string;
  acmeBuyerContact: string;
  paymentMethods: { type: string; last4: string; balance: number }[];
  agentPermissions: {
    agentName: string;
    role: string;
    canPreparePayments: boolean;
    autoApproveLimit: number;
    founderApprovalRange: string;
    financeApprovalThreshold: string;
  }[];
}

export type ViewLocation = 'CITY' | 'MY_COMPANY' | 'NORTHSTAR' | 'ACME' | 'CLOUDWORKS';

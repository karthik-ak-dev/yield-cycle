// Referral tree model interface for simple MLM tracking
export interface ReferralTree {
  userId: string;           // Primary Key (same as User.userId)
  parentId?: string;        // Direct referrer's userId
  level1Count: number;      // Count of direct referrals (level 1)
  level2Count: number;      // Count of level 2 team members
  level3Count: number;      // Count of level 3 team members
  level4Count: number;      // Count of level 4 team members
  level5Count: number;      // Count of level 5 team members
  totalTeamSize: number;    // Total team members across all levels
  totalTeamVolume: number;  // Total deposit volume from team
  directReferralCodes: string[]; // Referral codes of direct referrals
  updatedAt: string;        // ISO timestamp when record was last updated
  createdAt: string;        // ISO timestamp when record was created
}

// Referral tree creation input
export interface CreateReferralTreeInput {
  userId: string;
  parentId?: string;
}

// Referral tree update input
export interface UpdateReferralTreeInput {
  level1Count?: number;
  level2Count?: number;
  level3Count?: number;
  level4Count?: number;
  level5Count?: number;
  totalTeamSize?: number;
  totalTeamVolume?: number;
  directReferralCodes?: string[];
}

// Referral tree response
export interface ReferralTreeResponse {
  userId: string;
  parentId?: string;
  level1Count: number;
  level2Count: number;
  level3Count: number;
  level4Count: number;
  level5Count: number;
  totalTeamSize: number;
  totalTeamVolume: number;
  updatedAt: string;
}

// Simple team stats for dashboard
export interface TeamStats {
  directReferrals: number;  // Level 1 count
  totalTeamSize: number;    // All levels combined
  totalTeamVolume: number;  // Total deposit volume from team
} 
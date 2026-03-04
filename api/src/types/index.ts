// Auth
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: UserProfile;
}

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isAdmin: boolean;
  emailVerified: boolean;
  skipMatchesInfoCard: boolean;
  unreadReplyCount: number;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  passwordConfirm: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
  passwordConfirm: string;
}

// Search
export interface SearchQueryCreate {
  nameLast: string;
  nameFirst: string | null;
  nameNickname: string | null;
  nameMiddle: string | null;
  ageApx: number | null;
  city: string | null;
  state: string | null;
  keyWords: string | null;
}

export interface SearchQuery extends SearchQueryCreate {
  id: string;
  loginId: string;
  disabled: boolean;
  confirmed: boolean;
  confirmedAt: string | null;
  keySearch: string | null;
  matchCntNew: number;
  matchCntTotal: number;
  matchCntDismissed: number;
  createdAt: string;
  updatedAt: string;
}

// Match — sanitized response (no snippet-derived data exposed to client)
export interface MatchResult {
  id: string;
  userQueryId: string;
  sourceDomain: string;
  fingerprint: string | null;
  scoreFinal: number;
  scoreMax: number;
  rank: number;
  isRead: boolean;
  status: 'pending' | 'confirmed' | 'rejected';
}

export interface MatchSummary {
  userQueryId: string;
  nameLast: string;
  nameFirst: string | null;
  matchCntTotal: number;
  matchCntNew: number;
  matchCntDismissed: number;
  confirmed: boolean;
}

export interface NotificationBadge {
  matchCntNew: number;
  searchesCntWithNew: number;
}

// Express augmentation
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

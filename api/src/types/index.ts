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
  createdAt: string;
  updatedAt: string;
}

// Match
export interface MatchResult {
  id: string;
  userQueryId: string;
  ranDt: string;
  nameFull: string | null;
  nameFirst: string | null;
  nameLast: string | null;
  ageYears: number | null;
  dod: string | null;
  dateVisitation: string | null;
  dateFuneral: string | null;
  city: string | null;
  state: string | null;
  source: string | null;
  url: string;
  snippet: string | null;
  fingerprint: string | null;
  typeProvider: string | null;
  urlImage: string | null;
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

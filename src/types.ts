export type PlatformType = 'instagram' | 'facebook' | 'tiktok' | 'youtube' | 'web';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  role?: 'admin' | 'user' | 'editor';
  password?: string;
  createdAt?: string;
}

export interface TopicDuplicateCheck {
  isDuplicateTopic: boolean;
  duplicateReason?: string;
  similarExistingTitle?: string;
  similarExistingId?: string;
  similarityScore?: number; // 0 to 100
}

export interface CategoryItem {
  id: string;
  userId: string;
  name: string;
  color: string; // e.g. '#6366f1'
  description?: string; // Guía descriptiva para que la IA entienda y categorice enlaces
  createdAt?: string;
}

export interface SavedLinkItem {
  id: string;
  userId?: string;
  url: string;
  originalUrl: string;
  platform: PlatformType;
  title: string;
  summary: string;
  keyTakeaways: string[];
  category: string;
  tags: string[];
  estimatedTime?: string;
  authorOrChannel?: string;
  userNote?: string;
  createdAt: string; // ISO date string
  updatedAt?: string;
  thumbnailUrl?: string;
  duplicateCheck?: TopicDuplicateCheck;
  isExactDuplicateOf?: string; // ID of existing link if exact URL was detected
  savedWithAi?: boolean; // Whether the item was analyzed/saved using AI
}

export interface AnalyzeLinkRequest {
  url: string;
  userNote?: string;
  existingItems?: Array<{
    id: string;
    url: string;
    title: string;
    summary: string;
    category: string;
    tags: string[];
  }>;
}

export interface AnalyzeLinkResponse {
  success: boolean;
  geminiKeyMissing?: boolean;
  aiProcessed?: boolean;
  data?: {
    platform: PlatformType;
    title: string;
    summary: string;
    keyTakeaways: string[];
    category: string;
    tags: string[];
    estimatedTime: string;
    authorOrChannel: string;
    thumbnailUrl?: string;
    duplicateCheck: TopicDuplicateCheck;
    exactDuplicateFound?: {
      id: string;
      title: string;
      url: string;
    };
    geminiKeyMissing?: boolean;
    aiProcessed?: boolean;
  };
  error?: string;
}

export interface AiStatusResponse {
  success: boolean;
  configured: boolean;
  hasKey: boolean;
  missingKey: boolean;
  source?: string;
  provider: string;
  environment?: string;
  message: string;
  setupGuide?: {
    variableName: string;
    dashboardUrl?: string;
    steps: string[];
  };
}

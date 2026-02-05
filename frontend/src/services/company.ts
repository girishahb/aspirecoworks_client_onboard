import { apiGet } from './api';

export interface CompanyProfile {
  id: string;
  companyName: string;
  contactEmail: string;
  onboardingStage?: string;
  renewalStatus?: string | null;
  renewalDate?: string | null;
  [key: string]: unknown;
}

/**
 * Fetch the current user's company profile.
 * Backend: GET /companies/me (requires CLIENT with companyId).
 */
export async function getMyCompany(): Promise<CompanyProfile> {
  try {
    return await apiGet<CompanyProfile>('/companies/me');
  } catch (error) {
    console.error('[getMyCompany] Error:', error);
    // Re-throw with more context
    if (error instanceof Error) {
      throw new Error(`Failed to load company: ${error.message}`);
    }
    throw error;
  }
}

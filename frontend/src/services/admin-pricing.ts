/**
 * Admin Pricing API
 */

import { apiGet, apiPost, apiPut } from './api';

export interface Pricing {
  id: string;
  resourceId: string;
  hourlyPrice: number | null;
  dayPrice: number | null;
}

export interface ResourceWithPricing {
  id: string;
  locationId: string;
  type: string;
  capacity: number;
  isActive: boolean;
  pricing: Pricing | null;
  location?: { id: string; name: string; address: string };
}

export interface LocationWithResources {
  id: string;
  name: string;
  address: string;
  resources: ResourceWithPricing[];
}

export interface CampaignPricingParams {
  conferenceHourly?: number;
  discussionHourly?: number;
  dayPassPrice?: number;
}

export interface ApplyCampaignResult {
  updated: number;
}

export async function getLocationsWithResources(): Promise<LocationWithResources[]> {
  return apiGet<LocationWithResources[]>('/admin/locations');
}

export async function updateResourcePricing(
  resourceId: string,
  data: { hourlyPrice?: number | null; dayPrice?: number | null },
): Promise<Pricing> {
  return apiPut<Pricing>(`/admin/pricing/resource/${resourceId}`, data);
}

export async function applyCampaignPricing(params: CampaignPricingParams): Promise<ApplyCampaignResult> {
  return apiPost<ApplyCampaignResult>('/admin/pricing/campaign', params);
}

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OnboardingStage } from '../common/enums/onboarding-stage.enum';
import { assertValidTransition } from '../client-profiles/onboarding-stage.helper';
import type { OnboardingStage as PrismaOnboardingStage } from '@prisma/client';

/**
 * Centralizes onboarding stage transitions driven by system events.
 * Company id is ClientProfile id (schema uses ClientProfile).
 * Does NOT allow skipping stages; validates transition before updating.
 */
@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Reusable stage guard: throws if company is not in one of the allowed stages.
   * Use for document flow enforcement (uploads, reviews, activation).
   * @param companyId ClientProfile id
   * @param allowedStages stages in which the action is allowed
   * @param message optional custom error message (UX)
   */
  async assertStage(
    companyId: string,
    allowedStages: OnboardingStage[],
    message?: string,
  ): Promise<void> {
    const company = await this.prisma.clientProfile.findUnique({
      where: { id: companyId },
      select: { onboardingStage: true },
    });
    if (!company) {
      throw new NotFoundException(message ?? `Company not found: ${companyId}`);
    }
    const current = company.onboardingStage as OnboardingStage;
    if (!allowedStages.includes(current)) {
      throw new BadRequestException(
        message ?? `Action not allowed at stage: ${current}`,
      );
    }
  }

  /**
   * Update company (ClientProfile) onboarding stage. Validates allowed transition.
   * @param companyId ClientProfile id
   */
  async updateStage(
    companyId: string,
    stage: OnboardingStage,
  ): Promise<{ id: string; onboardingStage: PrismaOnboardingStage }> {
    const existing = await this.prisma.clientProfile.findUnique({
      where: { id: companyId },
      select: { id: true, onboardingStage: true },
    });
    if (!existing) {
      throw new NotFoundException(`Company not found: ${companyId}`);
    }
    assertValidTransition(
      existing.onboardingStage as OnboardingStage,
      stage,
    );
    const updated = await this.prisma.clientProfile.update({
      where: { id: companyId },
      data: { onboardingStage: stage as PrismaOnboardingStage },
      select: { id: true, onboardingStage: true },
    });
    this.logger.log(
      `Stage transition ${companyId}: ${existing.onboardingStage} → ${stage}`,
    );
    return updated;
  }

  /**
   * Payment success: move to PAYMENT_CONFIRMED then KYC_IN_PROGRESS.
   * Allowed only from PAYMENT_PENDING (no stage skipping).
   */
  async onPaymentConfirmed(companyId: string): Promise<void> {
    await this.assertCurrentStage(companyId, [
      OnboardingStage.PAYMENT_PENDING,
    ]);
    await this.updateStage(companyId, OnboardingStage.PAYMENT_CONFIRMED);
    await this.updateStage(companyId, OnboardingStage.KYC_IN_PROGRESS);
  }

  /**
   * First (or any) KYC document uploaded: ensure stage is KYC_IN_PROGRESS.
   * Allowed from PAYMENT_CONFIRMED (or already KYC_IN_PROGRESS / KYC_REVIEW).
   */
  async onKycUploaded(companyId: string): Promise<void> {
    await this.updateStageIfAllowed(
      companyId,
      OnboardingStage.KYC_IN_PROGRESS,
      [
        OnboardingStage.PAYMENT_CONFIRMED,
        OnboardingStage.KYC_IN_PROGRESS,
        OnboardingStage.KYC_REVIEW,
      ],
    );
  }

  /**
   * After client uploads at least one KYC document: move to KYC_REVIEW so admin can review.
   * Allowed from KYC_IN_PROGRESS only (no stage skipping).
   */
  async moveToKycReviewAfterUpload(companyId: string): Promise<void> {
    await this.updateStageIfAllowed(
      companyId,
      OnboardingStage.KYC_REVIEW,
      [OnboardingStage.KYC_IN_PROGRESS, OnboardingStage.KYC_REVIEW],
    );
  }

  /**
   * All KYC approved: move to AGREEMENT_DRAFT_SHARED.
   * Allowed only from KYC_REVIEW.
   */
  async onKycApproved(companyId: string): Promise<void> {
    await this.assertCurrentStage(companyId, [OnboardingStage.KYC_REVIEW]);
    await this.updateStage(companyId, OnboardingStage.AGREEMENT_DRAFT_SHARED);
  }

  /**
   * Admin uploaded and shared agreement draft: move to AGREEMENT_DRAFT_SHARED.
   * Allowed from KYC_REVIEW (or already there).
   */
  async onAgreementDraftShared(companyId: string): Promise<void> {
    await this.updateStageIfAllowed(
      companyId,
      OnboardingStage.AGREEMENT_DRAFT_SHARED,
      [OnboardingStage.KYC_REVIEW, OnboardingStage.AGREEMENT_DRAFT_SHARED],
    );
  }

  /**
   * Client uploaded signed agreement: move to SIGNED_AGREEMENT_RECEIVED.
   * Allowed from AGREEMENT_DRAFT_SHARED (idempotent if already SIGNED_AGREEMENT_RECEIVED).
   */
  async onSignedAgreementReceived(companyId: string): Promise<void> {
    await this.updateStageIfAllowed(
      companyId,
      OnboardingStage.SIGNED_AGREEMENT_RECEIVED,
      [
        OnboardingStage.AGREEMENT_DRAFT_SHARED,
        OnboardingStage.SIGNED_AGREEMENT_RECEIVED,
      ],
    );
  }

  /**
   * Admin uploaded and shared final agreement: move to FINAL_AGREEMENT_SHARED.
   * Allowed only from SIGNED_AGREEMENT_RECEIVED.
   */
  async onFinalAgreementShared(companyId: string): Promise<void> {
    await this.assertCurrentStage(companyId, [
      OnboardingStage.SIGNED_AGREEMENT_RECEIVED,
    ]);
    await this.updateStage(companyId, OnboardingStage.FINAL_AGREEMENT_SHARED);
  }

  /**
   * Activation validation: all conditions must be met.
   * Returns true only if: (1) at least one payment PAID, (2) all latest KYC APPROVED/VERIFIED,
   * (3) at least one AGREEMENT_FINAL, (4) onboardingStage = FINAL_AGREEMENT_SHARED.
   * Company id = ClientProfile id.
   */
  async canActivateCompany(companyId: string): Promise<boolean> {
    const company = await this.prisma.clientProfile.findUnique({
      where: { id: companyId },
      include: {
        documents: true,
        payments: true,
      },
    });
    if (!company) {
      throw new NotFoundException('Company not found');
    }
    const stage = company.onboardingStage as OnboardingStage;
    if (stage !== OnboardingStage.FINAL_AGREEMENT_SHARED) {
      return false;
    }
    const hasPaidPayment = company.payments.some((p) => p.status === 'PAID');
    if (!hasPaidPayment) return false;
    const kycDocs = company.documents.filter(
      (d) => d.documentType === 'KYC' && d.documentOwner === 'CLIENT',
    );
    if (kycDocs.length > 0) {
      const latestVersion = Math.max(...kycDocs.map((d) => d.version));
      const latestKyc = kycDocs.find((d) => d.version === latestVersion);
      if (
        !latestKyc ||
        (latestKyc.status !== 'APPROVED' && latestKyc.status !== 'VERIFIED')
      ) {
        return false;
      }
    }
    const hasFinalAgreement = company.documents.some(
      (d) => d.documentType === 'AGREEMENT_FINAL',
    );
    if (!hasFinalAgreement) return false;
    return true;
  }

  /**
   * Throws if company is ACTIVE (onboarding locked). Call before any upload, review, or stage change.
   */
  async assertNotActive(companyId: string): Promise<void> {
    const company = await this.prisma.clientProfile.findUnique({
      where: { id: companyId },
      select: { onboardingStage: true },
    });
    if (company?.onboardingStage === OnboardingStage.ACTIVE) {
      throw new BadRequestException(
        'Company onboarding is locked after activation. No further uploads or stage changes are allowed.',
      );
    }
  }

  /**
   * Activate company: set ACTIVE and activationDate.
   * Allowed only from FINAL_AGREEMENT_SHARED.
   */
  async activateCompany(companyId: string): Promise<void> {
    await this.assertStage(
      companyId,
      [OnboardingStage.FINAL_AGREEMENT_SHARED],
      'Activation only allowed after final agreement has been shared.',
    );
    await this.prisma.clientProfile.update({
      where: { id: companyId },
      data: {
        onboardingStage: OnboardingStage.ACTIVE as PrismaOnboardingStage,
        activationDate: new Date(),
      },
    });
    this.logger.log(`Company activated: ${companyId}`);
  }

  private async assertCurrentStage(
    companyId: string,
    allowed: OnboardingStage[],
  ): Promise<void> {
    const profile = await this.prisma.clientProfile.findUnique({
      where: { id: companyId },
      select: { onboardingStage: true },
    });
    if (!profile) {
      throw new NotFoundException(`Company not found: ${companyId}`);
    }
    const current = profile.onboardingStage as OnboardingStage;
    if (!allowed.includes(current)) {
      throw new BadRequestException(
        `Invalid stage for this action. Current: ${current}. Allowed: ${allowed.join(', ')}.`,
      );
    }
  }

  private async updateStageIfAllowed(
    companyId: string,
    targetStage: OnboardingStage,
    allowedFrom: OnboardingStage[],
  ): Promise<void> {
    const profile = await this.prisma.clientProfile.findUnique({
      where: { id: companyId },
      select: { onboardingStage: true },
    });
    if (!profile) {
      throw new NotFoundException(`Company not found: ${companyId}`);
    }
    const current = profile.onboardingStage as OnboardingStage;
    if (!allowedFrom.includes(current)) {
      return; // idempotent: already in or past target
    }
    if (current === targetStage) {
      return;
    }
    await this.updateStage(companyId, targetStage);
  }
}

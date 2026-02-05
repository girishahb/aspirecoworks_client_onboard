import { BadRequestException } from '@nestjs/common';
import {
  OnboardingStage,
  canTransitionStage,
  ALLOWED_STAGE_TRANSITIONS,
} from '../common/enums/onboarding-stage.enum';
import type { OnboardingStage as PrismaOnboardingStage } from '@prisma/client';

/**
 * Safely transition a company's onboarding stage.
 * Throws BadRequestException if the transition is not allowed.
 */
export function assertValidTransition(
  currentStage: PrismaOnboardingStage | OnboardingStage,
  nextStage: OnboardingStage,
): void {
  const current = currentStage as OnboardingStage;
  if (!canTransitionStage(current, nextStage)) {
    const allowed = ALLOWED_STAGE_TRANSITIONS[current] ?? [];
    throw new BadRequestException(
      `Invalid onboarding stage transition: ${current} → ${nextStage}. Allowed next stages: ${allowed.length ? allowed.join(', ') : 'none'}.`,
    );
  }
}

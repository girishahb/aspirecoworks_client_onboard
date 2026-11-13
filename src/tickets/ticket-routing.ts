import { PrismaClient } from '@prisma/client';
import { GLOBAL_ROUTE_KEY } from './ticket.constants';

type RoutingDb = Pick<PrismaClient, 'issueGroupRoute'>;

const routeInclude = {
  recipients: true,
  department: true,
  defaultAssignee: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      isActive: true,
      role: true,
      homeLocationId: true,
    },
  },
} as const;

export async function findIssueRoute(
  db: RoutingDb,
  issueGroupId: string,
  locationId: string,
) {
  const specific = await db.issueGroupRoute.findUnique({
    where: { issueGroupId_locationKey: { issueGroupId, locationKey: locationId } },
    include: routeInclude,
  });
  if (specific?.isActive) return specific;
  const global = await db.issueGroupRoute.findUnique({
    where: { issueGroupId_locationKey: { issueGroupId, locationKey: GLOBAL_ROUTE_KEY } },
    include: routeInclude,
  });
  if (global?.isActive) return global;
  return null;
}

export function splitRecipients(recipients: { email: string; kind: 'TO' | 'CC' }[]): {
  to: string[];
  cc: string[];
} {
  const to: string[] = [];
  const cc: string[] = [];
  const seen = new Set<string>();
  for (const recipient of recipients) {
    const email = recipient.email.trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    if (recipient.kind === 'CC') cc.push(email);
    else to.push(email);
  }
  return {
    to,
    cc: cc.filter((email) => !to.includes(email)),
  };
}

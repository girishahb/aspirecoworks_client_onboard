import { UserRole } from '../enums/user-role.enum';

/** Full admin portal (web) + break-glass */
export const ADMIN_PORTAL_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.FINANCE,
];

/** Money screens / payment + invoice mutations */
export const MONEY_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.FINANCE,
];

/** Can create/update basic client details via mobile */
export const MOBILE_WRITE_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.FINANCE,
  UserRole.STAFF,
];

/** Can look up clients on mobile (reception + staff + finance + admins) */
export const MOBILE_LOOKUP_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.FINANCE,
  UserRole.STAFF,
  UserRole.RECEPTION,
  UserRole.MANAGER,
];

/** Reception mail photo → email notify (desk only) */
export const MOBILE_MAIL_NOTIFY_ROLES: UserRole[] = [
  UserRole.RECEPTION,
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
];

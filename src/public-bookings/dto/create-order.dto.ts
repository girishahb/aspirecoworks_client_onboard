import { IsEmail, IsInt, IsOptional, IsString, Matches, Min } from 'class-validator';

/** UUID-like format (8-4-4-4-12 hex) - accepts seed IDs like 00000000-0000-0000-0000-000000000001 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class CreateOrderDto {
  @Matches(UUID_PATTERN, { message: 'resourceId must be a UUID' })
  resourceId: string;

  @IsString()
  date: string; // YYYY-MM-DD

  @Matches(UUID_PATTERN, { message: 'timeSlotId must be a UUID' })
  @IsOptional()
  timeSlotId?: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  phone: string;
}

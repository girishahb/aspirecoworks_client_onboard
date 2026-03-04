import { IsOptional, IsIn } from 'class-validator';

export class QueryRevenueDto {
  @IsOptional()
  @IsIn(['7days', '30days'])
  range?: '7days' | '30days' = '7days';
}

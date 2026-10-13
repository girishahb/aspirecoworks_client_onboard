import { Controller, Get, Query, Res, StreamableFile, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import * as fs from 'fs';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { ImportQaService } from './import-qa.service';

@ApiTags('Import QA')
@ApiBearerAuth()
@Controller('admin/import-qa')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.FINANCE)
export class ImportQaController {
  constructor(private readonly importQaService: ImportQaService) {}

  @Get('runs')
  @ApiOperation({ summary: 'List Excel migration QA run folders' })
  listRuns() {
    return {
      latest: this.importQaService.getLatestRunId(),
      runs: this.importQaService.listRuns(),
    };
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get summary + distributions for a migration QA run' })
  getSummary(@Query('runId') runId?: string) {
    return this.importQaService.getSummary(runId);
  }

  @Get('date-qa')
  @ApiOperation({ summary: 'Browse date_qa.csv rows with filters' })
  async getDateQa(
    @Query('runId') runId?: string,
    @Query('locationCode') locationCode?: string,
    @Query('sheet') sheet?: string,
    @Query('flag') flag?: string,
    @Query('column') column?: string,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.importQaService.getDateQa({
      runId,
      locationCode,
      sheet,
      flag,
      column,
      q,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get('download')
  @ApiOperation({ summary: 'Download a QA artifact CSV/JSON' })
  download(
    @Query('file') file: string,
    @Query('runId') runId: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const filePath = this.importQaService.getCsvPath(file || 'date_qa.csv', runId);
    res.set({
      'Content-Type': file.endsWith('.json') ? 'application/json' : 'text/csv',
      'Content-Disposition': `attachment; filename="${file}"`,
    });
    return new StreamableFile(fs.createReadStream(filePath));
  }
}

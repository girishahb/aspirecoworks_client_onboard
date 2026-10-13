import { Module } from '@nestjs/common';
import { ImportQaController } from './import-qa.controller';
import { ImportQaService } from './import-qa.service';

@Module({
  controllers: [ImportQaController],
  providers: [ImportQaService],
})
export class ImportQaModule {}

import { Controller, Get } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import type { ClinicListItem } from '@application/queries/list-clinics/list-clinics.handler';
import { ListClinicsQuery } from '@application/queries/list-clinics/list-clinics.query';

@Controller('api/clinics')
export class ClinicsController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  async list(): Promise<readonly ClinicListItem[]> {
    return this.queryBus.execute(new ListClinicsQuery());
  }
}

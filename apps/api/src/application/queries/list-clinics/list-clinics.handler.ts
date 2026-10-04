import { Inject, Injectable } from '@nestjs/common';
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import type { Clinic } from '@domain/entities/clinic.entity';
import { CLINIC_REPOSITORY } from '@domain/repositories';
import type { ClinicRepository } from '@domain/repositories';
import { LOGGER, type Logger } from '@domain/services';
import { ListClinicsQuery } from './list-clinics.query';

export type ClinicListItem = Pick<Clinic, 'id' | 'name'>;

@QueryHandler(ListClinicsQuery)
@Injectable()
export class ListClinicsHandler
  implements IQueryHandler<ListClinicsQuery, readonly ClinicListItem[]>
{
  constructor(
    @Inject(CLINIC_REPOSITORY) private readonly clinicRepository: ClinicRepository,
    @Inject(LOGGER) private readonly logger: Logger,
  ) {}

  async execute(_query: ListClinicsQuery): Promise<readonly ClinicListItem[]> {
    this.logger.debug('Listing clinics', {
      context: 'ListClinicsQueryHandler',
    });

    const clinics = await this.clinicRepository.findAll();

    this.logger.info('Clinics listed', {
      context: 'ListClinicsQueryHandler',
      resultCount: clinics.length,
    });

    return clinics;
  }
}

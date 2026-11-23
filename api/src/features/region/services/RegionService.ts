import { AppDataSource } from "../../../core/bd/index.js";
import {
  Region,
  RegionStatus,
  RegionType,
} from "../../../core/bd/entities/Region.entity.js";
import { State } from "../../../core/bd/entities/State.entity.js";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "../../../core/errors/index.js";
import type { CreateRegionDto, UpdateRegionDto } from "../dto/index.js";
import {
  type PaginationQuery,
  toSkipTake,
} from "../../../core/http/pagination.js";
import {
  type RegionResponse,
  type StateResponse,
  toRegionResponse,
  toStateResponse,
} from "../responses/index.js";

export interface RegionFilters {
  stateId?: string | undefined;
  type?: RegionType | undefined;
  parentId?: string | undefined;
  status?: RegionStatus | undefined;
  search?: string | undefined;
}

function toSlug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export class RegionService {
  private readonly regionRepo = AppDataSource.getRepository(Region);
  private readonly stateRepo = AppDataSource.getRepository(State);

  public async listStates(onlyActive = true): Promise<StateResponse[]> {
    const states = await this.stateRepo.find({
      where: onlyActive ? { isActive: true } : {},
      order: { name: "ASC" },
    });

    return states.map(toStateResponse);
  }

  public async listRegions(
    filters: RegionFilters,
    pagination: PaginationQuery
  ): Promise<{ items: RegionResponse[]; total: number }> {
    const qb = this.regionRepo
      .createQueryBuilder("region")
      .leftJoinAndSelect("region.state", "state")
      .leftJoinAndSelect("region.parent", "parent")
      .orderBy("region.name", "ASC");

    if (filters.stateId) {
      qb.andWhere("region.stateId = :stateId", { stateId: filters.stateId });
    }

    if (filters.type) {
      qb.andWhere("region.type = :type", { type: filters.type });
    }

    if (filters.parentId) {
      qb.andWhere("region.parentId = :parentId", { parentId: filters.parentId });
    }

    if (filters.status) {
      qb.andWhere("region.status = :status", { status: filters.status });
    }

    if (filters.search) {
      const name = filters.search.toLowerCase();
      qb.andWhere(
        "(LOWER(region.name) LIKE :search OR LOWER(region.slug) LIKE :search " +
          "OR JSON_SEARCH(LOWER(CAST(region.aliases AS CHAR)), 'one', :search) IS NOT NULL)",
        { search: `%${name}%` }
      );
      qb.addSelect(
        "CASE WHEN LOWER(region.name) = :name OR LOWER(region.slug) = :name " +
          "OR JSON_SEARCH(LOWER(CAST(region.aliases AS CHAR)), 'one', :name) IS NOT NULL THEN 0 ELSE 1 END",
        "search_rank"
      ).setParameter("name", name).orderBy("search_rank", "ASC").addOrderBy("region.name", "ASC");
    }

    const { skip, take } = toSkipTake(pagination);
    const [regions, total] = await qb.skip(skip).take(take).getManyAndCount();

    return { items: regions.map(toRegionResponse), total };
  }

  public async getRegionById(id: string): Promise<RegionResponse> {
    const region = await this.regionRepo.findOne({
      where: { id },
      relations: { state: true, parent: true },
    });

    if (!region) {
      throw new NotFoundError("Región no encontrada");
    }

    return toRegionResponse(region);
  }

  public async createRegion(dto: CreateRegionDto): Promise<RegionResponse> {
    const state = await this.stateRepo.findOne({ where: { id: dto.stateId } });
    if (!state) {
      throw new NotFoundError("El estado especificado no existe");
    }

    if (dto.type === RegionType.ZONE && dto.parentId) {
      const parent = await this.regionRepo.findOne({
        where: { id: dto.parentId },
      });

      if (!parent) {
        throw new NotFoundError("El municipio padre especificado no existe");
      }

      if (parent.type !== RegionType.MUNICIPALITY) {
        throw new BadRequestError(
          "El parentId de una zona debe corresponder a un municipio"
        );
      }

      if (parent.stateId !== dto.stateId) {
        throw new BadRequestError(
          "La zona debe pertenecer al mismo estado que su municipio padre"
        );
      }
    }

    const slug = dto.slug ?? toSlug(dto.name);
    const existingSlug = await this.regionRepo.findOne({ where: { slug } });
    if (existingSlug) {
      throw new ConflictError(`Ya existe una región con el slug "${slug}"`);
    }

    const region = this.regionRepo.create({
      stateId: dto.stateId,
      parentId:
        dto.type === RegionType.MUNICIPALITY ? null : dto.parentId ?? null,
      type: dto.type,
      name: dto.name,
      slug,
      aliases: dto.aliases ?? [],
      lat: dto.lat ?? null,
      lng: dto.lng ?? null,
      status: dto.status ?? RegionStatus.ACTIVE,
    });

    const saved = await this.regionRepo.save(region);
    return this.getRegionById(saved.id);
  }

  public async updateRegion(
    id: string,
    dto: UpdateRegionDto
  ): Promise<RegionResponse> {
    const region = await this.regionRepo.findOne({
      where: { id },
      relations: { state: true, parent: true },
    });

    if (!region) {
      throw new NotFoundError("Región no encontrada");
    }

    if (dto.slug && dto.slug !== region.slug) {
      const existingSlug = await this.regionRepo.findOne({
        where: { slug: dto.slug },
      });
      if (existingSlug) {
        throw new ConflictError(
          `Ya existe una región con el slug "${dto.slug}"`
        );
      }
      region.slug = dto.slug;
    }

    if (dto.name !== undefined) region.name = dto.name;
    if (dto.aliases !== undefined) region.aliases = dto.aliases;
    if (dto.lat !== undefined) region.lat = dto.lat;
    if (dto.lng !== undefined) region.lng = dto.lng;
    if (dto.status !== undefined) region.status = dto.status;

    await this.regionRepo.save(region);
    return this.getRegionById(region.id);
  }

  public async toggleStatus(id: string): Promise<RegionResponse> {
    const region = await this.regionRepo.findOne({ where: { id } });

    if (!region) {
      throw new NotFoundError("Región no encontrada");
    }

    region.status =
      region.status === RegionStatus.ACTIVE
        ? RegionStatus.INACTIVE
        : RegionStatus.ACTIVE;

    await this.regionRepo.save(region);
    return this.getRegionById(region.id);
  }
}

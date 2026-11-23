import type { Region } from "../../../core/bd/entities/Region.entity.js";

export interface RegionResponse {
  id: string;
  stateId: string;
  stateName: string | null;
  parentId: string | null;
  parentName: string | null;
  type: string;
  name: string;
  slug: string;
  aliases: string[];
  lat: number | null;
  lng: number | null;
  status: string;
}

export function toRegionResponse(region: Region): RegionResponse {
  return {
    id: region.id,
    stateId: region.stateId,
    stateName: region.state?.name ?? null,
    parentId: region.parentId,
    parentName: region.parent?.name ?? null,
    type: region.type,
    name: region.name,
    slug: region.slug,
    aliases: region.aliases ?? [],
    lat: region.lat,
    lng: region.lng,
    status: region.status,
  };
}
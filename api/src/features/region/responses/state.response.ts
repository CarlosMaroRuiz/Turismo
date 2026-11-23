import type { State } from "../../../core/bd/entities/State.entity.js";

export interface StateResponse {
  id: string;
  code: string;
  name: string;
  slug: string;
  aliases: string[];
  isActive: boolean;
}

export function toStateResponse(state: State): StateResponse {
  return {
    id: state.id,
    code: state.code,
    name: state.name,
    slug: state.slug,
    aliases: state.aliases ?? [],
    isActive: state.isActive,
  };
}
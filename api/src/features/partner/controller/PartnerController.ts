import type { Request, Response } from "express";
import { ApiResponse } from "../../../core/http/ApiResponse.js";
import {
  paginationSchema,
  toPaginationMeta,
} from "../../../core/http/pagination.js";
import {
  BadRequestError,
  ForbiddenError,
  UnauthorizedError,
} from "../../../core/errors/index.js";
import { PartnerStatus } from "../../../core/bd/entities/Partner.js";
import { RoleCode } from "../../../core/bd/entities/Role.js";
import {
  addPartnerMemberSchema,
  createPartnerSchema,
  registerPartnerSchema,
  rejectPartnerSchema,
  suspendPartnerSchema,
  updatePartnerMemberSchema,
  updatePartnerSchema,
} from "../dto/index.js";
import { PartnerService } from "../services/PartnerService.js";

export class PartnerController {
  private readonly partnerService = new PartnerService();

  private getParamId(req: Request, paramName = "id"): string {
    const value = req.params[paramName];
    if (!value || typeof value !== "string") {
      throw new BadRequestError(`El parámetro '${paramName}' es requerido`);
    }
    return value;
  }

  private getAuthenticatedUser(req: Request): {
    userId: string;
    role: string;
    partnerId?: string;
  } {
    if (!req.user) {
      throw new UnauthorizedError("Usuario no autenticado");
    }

    return {
      userId: req.user.userId,
      role: req.user.role,
      ...(req.user.partnerId !== undefined && {
        partnerId: req.user.partnerId,
      }),
    };
  }

  private ensurePartnerAccess(req: Request, partnerId: string): void {
    const user = this.getAuthenticatedUser(req);
    if (user.role === RoleCode.SUPER_USER) return;

    if (user.partnerId !== partnerId) {
      throw new ForbiddenError(
        "No tienes acceso a la información de este socio"
      );
    }
  }

  public register = async (req: Request, res: Response): Promise<void> => {
    const dto = registerPartnerSchema.parse(req.body);
    const data = await this.partnerService.registerRequest(dto);

    ApiResponse.created(
      res,
      data,
      "Solicitud de registro enviada correctamente"
    );
  };

  /** Alta directa del administrador, con invitación opcional en el mismo paso. */
  public create = async (req: Request, res: Response): Promise<void> => {
    const dto = createPartnerSchema.parse(req.body);
    const data = await this.partnerService.createPartner(dto);

    ApiResponse.created(
      res,
      data,
      dto.invite
        ? "Socio creado y correo de activación enviado"
        : "Socio creado correctamente"
    );
  };

  public list = async (req: Request, res: Response): Promise<void> => {
    const rawStatus = req.query.status;
    let status: PartnerStatus | undefined;

    if (typeof rawStatus === "string" && rawStatus.length > 0) {
      const validStatuses = Object.values(PartnerStatus) as string[];
      if (!validStatuses.includes(rawStatus)) {
        throw new BadRequestError("Filtro de estado inválido", "INVALID_STATUS_FILTER");
      }
      status = rawStatus as PartnerStatus;
    }

    const pagination = paginationSchema.parse(req.query);
    const { items, total } = await this.partnerService.listPartners(
      status,
      pagination
    );

    ApiResponse.paginated(
      res,
      items,
      toPaginationMeta(total, pagination.page, pagination.limit),
      "Socios obtenidos correctamente"
    );
  };

  public getById = async (req: Request, res: Response): Promise<void> => {
    const id = this.getParamId(req, "id");
    this.ensurePartnerAccess(req, id);

    const data = await this.partnerService.getPartnerById(id);
    ApiResponse.ok(res, data, "Socio obtenido correctamente");
  };

  public update = async (req: Request, res: Response): Promise<void> => {
    const id = this.getParamId(req, "id");
    const actor = this.getAuthenticatedUser(req);

    await this.partnerService.assertCanManageMembers(
      id,
      actor.userId,
      actor.role
    );

    const dto = updatePartnerSchema.parse(req.body);

    const changesAdminFields =
      dto.categoryId !== undefined ||
      dto.regionId !== undefined ||
      dto.slug !== undefined;

    if (changesAdminFields && actor.role !== RoleCode.SUPER_USER) {
      throw new ForbiddenError(
        "Solo el administrador de la plataforma puede cambiar la categoría, la región o el slug",
        "ADMIN_ONLY_FIELDS"
      );
    }

    const data = await this.partnerService.updatePartner(id, dto);

    ApiResponse.ok(res, data, "Datos del socio actualizados correctamente");
  };

  public approve = async (req: Request, res: Response): Promise<void> => {
    const id = this.getParamId(req, "id");

    await this.partnerService.approvePartner(id);
    ApiResponse.ok(res, null, "Socio aprobado y correo de activación enviado");
  };

  public reject = async (req: Request, res: Response): Promise<void> => {
    const id = this.getParamId(req, "id");

    const dto = rejectPartnerSchema.parse(req.body);
    await this.partnerService.rejectPartner(id, dto);
    ApiResponse.ok(res, null, "Solicitud de socio rechazada");
  };

  public suspend = async (req: Request, res: Response): Promise<void> => {
    const id = this.getParamId(req, "id");

    const dto = suspendPartnerSchema.parse(req.body);
    await this.partnerService.suspendPartner(id, dto);
    ApiResponse.ok(res, null, "Socio suspendido correctamente");
  };

  public reactivate = async (req: Request, res: Response): Promise<void> => {
    const id = this.getParamId(req, "id");

    await this.partnerService.reactivatePartner(id);
    ApiResponse.ok(res, null, "Socio reactivado correctamente");
  };

  public resendInvite = async (req: Request, res: Response): Promise<void> => {
    const id = this.getParamId(req, "id");

    await this.partnerService.resendOwnerInvitation(id);
    ApiResponse.ok(res, null, "Invitación reenviada correctamente");
  };

  public resendMember = async (req: Request, res: Response): Promise<void> => {
    const id = this.getParamId(req, "id");
    const userId = String(req.params.userId);
    const actor = this.getAuthenticatedUser(req);

    await this.partnerService.assertCanManageMembers(id, actor.userId, actor.role);
    await this.partnerService.resendMemberInvitation(id, userId);
    ApiResponse.ok(res, null, "Invitación reenviada correctamente");
  };

  public listMembers = async (req: Request, res: Response): Promise<void> => {
    const id = this.getParamId(req, "id");
    this.ensurePartnerAccess(req, id);

    const data = await this.partnerService.listMembers(id);
    ApiResponse.ok(res, data, "Equipo del socio obtenido correctamente");
  };

  public addMember = async (req: Request, res: Response): Promise<void> => {
    const id = this.getParamId(req, "id");
    const actor = this.getAuthenticatedUser(req);

    await this.partnerService.assertCanManageMembers(
      id,
      actor.userId,
      actor.role
    );

    const dto = addPartnerMemberSchema.parse(req.body);
    const data = await this.partnerService.addMember(id, dto);

    ApiResponse.created(res, data, "Miembro agregado e invitación enviada");
  };

  public updateMember = async (req: Request, res: Response): Promise<void> => {
    const id = this.getParamId(req, "id");
    const memberId = this.getParamId(req, "memberId");
    const actor = this.getAuthenticatedUser(req);

    await this.partnerService.assertCanManageMembers(
      id,
      actor.userId,
      actor.role
    );

    const dto = updatePartnerMemberSchema.parse(req.body);
    const data = await this.partnerService.updateMember(id, memberId, dto);

    ApiResponse.ok(res, data, "Miembro actualizado correctamente");
  };
}
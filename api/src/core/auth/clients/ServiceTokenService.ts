import { AppDataSource } from "../../bd/index.js";
import { ApiClient } from "../../bd/entities/ApiClient.js";
import { PasswordService } from "../../security/PasswordService.js";
import {
  tokenService,
  type IssuedServiceToken,
} from "../tokens/TokenService.js";
import {
  ForbiddenError,
  UnauthorizedError,
} from "../../errors/index.js";

/**
 * Emisión de tokens para integraciones máquina a máquina (por ejemplo el
 * servicio de LLM). No hay refresh: el cliente vuelve a pedir token con sus
 * credenciales, que se verifican contra el hash guardado.
 */
export class ServiceTokenService {
  private get repo() {
    return AppDataSource.getRepository(ApiClient);
  }

  public async issue(
    clientId: string,
    secret: string
  ): Promise<IssuedServiceToken> {
    const client = await this.repo.findOne({ where: { clientId } });

    if (!client) {
      throw new UnauthorizedError(
        "Credenciales de servicio inválidas",
        "INVALID_SERVICE_CREDENTIALS"
      );
    }

    if (!client.isActive) {
      throw new ForbiddenError(
        "La credencial de servicio está desactivada",
        "SERVICE_CLIENT_INACTIVE"
      );
    }

    const secretMatches = await PasswordService.verify(
      secret,
      client.secretHash
    );

    if (!secretMatches) {
      throw new UnauthorizedError(
        "Credenciales de servicio inválidas",
        "INVALID_SERVICE_CREDENTIALS"
      );
    }

    client.lastUsedAt = new Date();
    await this.repo.save(client);

    return tokenService.issueServiceToken(client.clientId, client.scopes ?? []);
  }
}

export const serviceTokenService = new ServiceTokenService();

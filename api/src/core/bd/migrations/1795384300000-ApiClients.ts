import type { MigrationInterface, QueryRunner } from "typeorm";

/** Credenciales de servicio con permisos (scopes) para integraciones máquina a máquina. */
export class ApiClients1795384300000 implements MigrationInterface {
  name = "ApiClients1795384300000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`api_clients\` (\`id\` varchar(36) NOT NULL, \`client_id\` varchar(60) NOT NULL, \`name\` varchar(150) NOT NULL, \`secret_hash\` varchar(255) NOT NULL, \`scopes\` json NOT NULL, \`is_active\` tinyint NOT NULL DEFAULT 1, \`last_used_at\` timestamp(6) NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`uq_api_clients_client_id\` (\`client_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX \`uq_api_clients_client_id\` ON \`api_clients\``);
    await queryRunner.query(`DROP TABLE \`api_clients\``);
  }
}

import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Sesiones revocables: refresh tokens persistidos y versión de token por usuario.
 * `token_version` permite invalidar todos los access tokens emitidos al
 * suspender una cuenta, cambiar contraseña o revocar accesos.
 */
export class AuthSessions1795384200000 implements MigrationInterface {
  name = "AuthSessions1795384200000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`refresh_tokens\` (\`id\` varchar(36) NOT NULL, \`user_id\` varchar(36) NOT NULL, \`token_hash\` varchar(64) NOT NULL, \`expires_at\` timestamp(6) NOT NULL, \`revoked_at\` timestamp(6) NULL, \`user_agent\` varchar(255) NULL, \`ip\` varchar(64) NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`idx_refresh_tokens_user_id\` (\`user_id\`), UNIQUE INDEX \`uq_refresh_tokens_token_hash\` (\`token_hash\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
    );
    await queryRunner.query(
      `ALTER TABLE \`refresh_tokens\` ADD CONSTRAINT \`FK_refresh_tokens_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`token_version\` int NOT NULL DEFAULT '0'`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`users\` DROP COLUMN \`token_version\``
    );
    await queryRunner.query(
      `ALTER TABLE \`refresh_tokens\` DROP FOREIGN KEY \`FK_refresh_tokens_user\``
    );
    await queryRunner.query(`DROP TABLE \`refresh_tokens\``);
  }
}

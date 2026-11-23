import type { MigrationInterface, QueryRunner } from "typeorm";

/** Cotizaciones con vencimiento: base del flujo de reserva del agente. */
export class Quotes1795384600000 implements MigrationInterface {
  name = "Quotes1795384600000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`quotes\` (\`id\` varchar(36) NOT NULL, \`reference\` varchar(20) NOT NULL, \`currency\` varchar(3) NOT NULL DEFAULT 'MXN', \`subtotal\` decimal(12,2) NOT NULL, \`discount_total\` decimal(12,2) NOT NULL, \`taxes_total\` decimal(12,2) NOT NULL, \`total\` decimal(12,2) NOT NULL, \`items\` json NOT NULL, \`breakdown\` json NOT NULL, \`expires_at\` timestamp(6) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE INDEX \`uq_quotes_reference\` (\`reference\`), INDEX \`idx_quotes_expires_at\` (\`expires_at\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX \`uq_quotes_reference\` ON \`quotes\``
    );
    await queryRunner.query(
      `DROP INDEX \`idx_quotes_expires_at\` ON \`quotes\``
    );
    await queryRunner.query(`DROP TABLE \`quotes\``);
  }
}

import type { MigrationInterface, QueryRunner } from "typeorm";

export class SchemaUpdate1795379202643 implements MigrationInterface {
    name = 'SchemaUpdate1795379202643'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`partner_categories\` (\`id\` varchar(36) NOT NULL, \`code\` varchar(30) NOT NULL, \`name\` varchar(100) NOT NULL, \`is_active\` tinyint NOT NULL DEFAULT 1, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`uq_partner_categories_code\` (\`code\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`uq_partner_categories_code\` ON \`partner_categories\``);
        await queryRunner.query(`DROP TABLE \`partner_categories\``);
    }

}

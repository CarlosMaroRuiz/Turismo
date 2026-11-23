import type { MigrationInterface, QueryRunner } from "typeorm";

export class SchemaUpdate1795380299494 implements MigrationInterface {
    name = 'SchemaUpdate1795380299494'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`roles\` (\`id\` varchar(36) NOT NULL, \`code\` varchar(30) NOT NULL, \`name\` varchar(100) NOT NULL, \`is_active\` tinyint NOT NULL DEFAULT 1, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`uq_roles_code\` (\`code\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`uq_roles_code\` ON \`roles\``);
        await queryRunner.query(`DROP TABLE \`roles\``);
    }

}

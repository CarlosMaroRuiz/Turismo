import type { MigrationInterface, QueryRunner } from "typeorm";

export class SchemaUpdate1795378399819 implements MigrationInterface {
    name = 'SchemaUpdate1795378399819'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`states\` (\`id\` varchar(36) NOT NULL, \`code\` varchar(2) NOT NULL, \`name\` varchar(100) NOT NULL, \`slug\` varchar(120) NOT NULL, \`aliases\` json NOT NULL, \`is_active\` tinyint NOT NULL DEFAULT 0, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`uq_states_code\` (\`code\`), UNIQUE INDEX \`uq_states_slug\` (\`slug\`), INDEX \`idx_states_is_active\` (\`is_active\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`idx_states_is_active\` ON \`states\``);
        await queryRunner.query(`DROP INDEX \`uq_states_slug\` ON \`states\``);
        await queryRunner.query(`DROP INDEX \`uq_states_code\` ON \`states\``);
        await queryRunner.query(`DROP TABLE \`states\``);
    }

}

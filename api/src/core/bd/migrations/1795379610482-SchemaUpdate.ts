import type { MigrationInterface, QueryRunner } from "typeorm";

export class SchemaUpdate1795379610482 implements MigrationInterface {
    name = 'SchemaUpdate1795379610482'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`partners\` (\`id\` varchar(36) NOT NULL, \`category_id\` varchar(36) NOT NULL, \`region_id\` varchar(36) NOT NULL, \`commercial_name\` varchar(150) NOT NULL, \`legal_name\` varchar(200) NOT NULL, \`slug\` varchar(180) NOT NULL, \`description\` text NULL, \`address\` varchar(255) NOT NULL, \`lat\` decimal(10,7) NULL, \`lng\` decimal(10,7) NULL, \`contact_name\` varchar(150) NOT NULL, \`contact_email\` varchar(150) NOT NULL, \`contact_phone\` varchar(30) NOT NULL, \`status\` enum ('pending', 'active', 'suspended', 'rejected') NOT NULL DEFAULT 'pending', \`status_reason\` varchar(255) NULL, \`approved_at\` timestamp NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`uq_partners_slug\` (\`slug\`), INDEX \`idx_partners_category_status\` (\`category_id\`, \`status\`), INDEX \`idx_partners_region_status\` (\`region_id\`, \`status\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`partners\` ADD CONSTRAINT \`FK_006a6abd79a0b9ee3214329d56e\` FOREIGN KEY (\`category_id\`) REFERENCES \`partner_categories\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`partners\` ADD CONSTRAINT \`FK_e5e45d603b83cc0bd40af22760c\` FOREIGN KEY (\`region_id\`) REFERENCES \`regions\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`partners\` DROP FOREIGN KEY \`FK_e5e45d603b83cc0bd40af22760c\``);
        await queryRunner.query(`ALTER TABLE \`partners\` DROP FOREIGN KEY \`FK_006a6abd79a0b9ee3214329d56e\``);
        await queryRunner.query(`DROP INDEX \`idx_partners_region_status\` ON \`partners\``);
        await queryRunner.query(`DROP INDEX \`idx_partners_category_status\` ON \`partners\``);
        await queryRunner.query(`DROP INDEX \`uq_partners_slug\` ON \`partners\``);
        await queryRunner.query(`DROP TABLE \`partners\``);
    }

}

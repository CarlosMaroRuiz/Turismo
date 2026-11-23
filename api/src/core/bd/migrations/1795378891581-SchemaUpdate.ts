import type { MigrationInterface, QueryRunner } from "typeorm";

export class SchemaUpdate1795378891581 implements MigrationInterface {
    name = 'SchemaUpdate1795378891581'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`regions\` (\`id\` varchar(36) NOT NULL, \`state_id\` varchar(36) NOT NULL, \`parent_id\` varchar(36) NULL, \`type\` enum ('municipality', 'zone') NOT NULL, \`name\` varchar(150) NOT NULL, \`slug\` varchar(180) NOT NULL, \`aliases\` json NOT NULL, \`lat\` decimal(10,7) NULL, \`lng\` decimal(10,7) NULL, \`status\` enum ('active', 'inactive') NOT NULL DEFAULT 'active', \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`idx_regions_state_id\` (\`state_id\`), INDEX \`idx_regions_parent_id\` (\`parent_id\`), UNIQUE INDEX \`uq_regions_slug\` (\`slug\`), INDEX \`idx_regions_state_type_status\` (\`state_id\`, \`type\`, \`status\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`regions\` ADD CONSTRAINT \`FK_11777c536abe9e7ee61f2d29642\` FOREIGN KEY (\`state_id\`) REFERENCES \`states\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`regions\` ADD CONSTRAINT \`FK_b1dc15f575548116575b521d8de\` FOREIGN KEY (\`parent_id\`) REFERENCES \`regions\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`regions\` DROP FOREIGN KEY \`FK_b1dc15f575548116575b521d8de\``);
        await queryRunner.query(`ALTER TABLE \`regions\` DROP FOREIGN KEY \`FK_11777c536abe9e7ee61f2d29642\``);
        await queryRunner.query(`DROP INDEX \`idx_regions_state_type_status\` ON \`regions\``);
        await queryRunner.query(`DROP INDEX \`uq_regions_slug\` ON \`regions\``);
        await queryRunner.query(`DROP INDEX \`idx_regions_parent_id\` ON \`regions\``);
        await queryRunner.query(`DROP INDEX \`idx_regions_state_id\` ON \`regions\``);
        await queryRunner.query(`DROP TABLE \`regions\``);
    }

}

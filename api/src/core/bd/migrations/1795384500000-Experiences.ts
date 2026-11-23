import type { MigrationInterface, QueryRunner } from "typeorm";

/** Rama de atractivos: experiencias y turnos con aforo por fecha y hora. */
export class Experiences1795384500000 implements MigrationInterface {
  name = "Experiences1795384500000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`experiences\` (\`id\` varchar(36) NOT NULL, \`partner_id\` varchar(36) NOT NULL, \`region_id\` varchar(36) NOT NULL, \`name\` varchar(150) NOT NULL, \`slug\` varchar(180) NOT NULL, \`description\` text NOT NULL, \`duration_minutes\` int NOT NULL, \`min_age\` int NULL, \`price_adult\` decimal(10,2) NOT NULL, \`price_child\` decimal(10,2) NULL, \`requirements\` text NULL, \`is_active\` tinyint NOT NULL DEFAULT 1, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`uq_experiences_slug\` (\`slug\`), INDEX \`idx_experiences_partner_active\` (\`partner_id\`, \`is_active\`), INDEX \`idx_experiences_region_active\` (\`region_id\`, \`is_active\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
    );
    await queryRunner.query(
      `CREATE TABLE \`experience_slots\` (\`id\` varchar(36) NOT NULL, \`experience_id\` varchar(36) NOT NULL, \`date\` date NOT NULL, \`start_time\` varchar(5) NOT NULL, \`capacity\` int NOT NULL, \`booked\` int NOT NULL DEFAULT '0', \`status\` enum ('open', 'closed') NOT NULL DEFAULT 'open', \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`idx_experience_slots_date_status\` (\`date\`, \`status\`), UNIQUE INDEX \`uq_experience_slots_slot\` (\`experience_id\`, \`date\`, \`start_time\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
    );
    await queryRunner.query(
      `ALTER TABLE \`experiences\` ADD CONSTRAINT \`FK_experiences_partner\` FOREIGN KEY (\`partner_id\`) REFERENCES \`partners\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE \`experiences\` ADD CONSTRAINT \`FK_experiences_region\` FOREIGN KEY (\`region_id\`) REFERENCES \`regions\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE \`experience_slots\` ADD CONSTRAINT \`FK_experience_slots_experience\` FOREIGN KEY (\`experience_id\`) REFERENCES \`experiences\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`experience_slots\` DROP FOREIGN KEY \`FK_experience_slots_experience\``
    );
    await queryRunner.query(
      `ALTER TABLE \`experiences\` DROP FOREIGN KEY \`FK_experiences_region\``
    );
    await queryRunner.query(
      `ALTER TABLE \`experiences\` DROP FOREIGN KEY \`FK_experiences_partner\``
    );
    await queryRunner.query(
      `DROP INDEX \`uq_experience_slots_slot\` ON \`experience_slots\``
    );
    await queryRunner.query(
      `DROP INDEX \`idx_experience_slots_date_status\` ON \`experience_slots\``
    );
    await queryRunner.query(`DROP TABLE \`experience_slots\``);
    await queryRunner.query(
      `DROP INDEX \`uq_experiences_slug\` ON \`experiences\``
    );
    await queryRunner.query(
      `DROP INDEX \`idx_experiences_partner_active\` ON \`experiences\``
    );
    await queryRunner.query(
      `DROP INDEX \`idx_experiences_region_active\` ON \`experiences\``
    );
    await queryRunner.query(`DROP TABLE \`experiences\``);
  }
}

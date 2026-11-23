import type { MigrationInterface, QueryRunner } from "typeorm";

/** Rama de hoteles: tipos de habitación e inventario diario (tarifa + cierre). */
export class Accommodation1795384400000 implements MigrationInterface {
  name = "Accommodation1795384400000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`room_types\` (\`id\` varchar(36) NOT NULL, \`partner_id\` varchar(36) NOT NULL, \`name\` varchar(120) NOT NULL, \`description\` text NULL, \`max_adults\` int NOT NULL DEFAULT '2', \`max_children\` int NOT NULL DEFAULT '0', \`total_units\` int NOT NULL DEFAULT '1', \`base_price\` decimal(10,2) NOT NULL, \`amenities\` json NOT NULL, \`is_active\` tinyint NOT NULL DEFAULT 1, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`idx_room_types_partner_active\` (\`partner_id\`, \`is_active\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
    );
    await queryRunner.query(
      `CREATE TABLE \`room_inventory\` (\`id\` varchar(36) NOT NULL, \`room_type_id\` varchar(36) NOT NULL, \`date\` date NOT NULL, \`units\` int NOT NULL, \`price\` decimal(10,2) NOT NULL, \`is_closed\` tinyint NOT NULL DEFAULT 0, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`idx_room_inventory_date\` (\`date\`), UNIQUE INDEX \`uq_room_inventory_room_date\` (\`room_type_id\`, \`date\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
    );
    await queryRunner.query(
      `ALTER TABLE \`room_types\` ADD CONSTRAINT \`FK_room_types_partner\` FOREIGN KEY (\`partner_id\`) REFERENCES \`partners\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE \`room_inventory\` ADD CONSTRAINT \`FK_room_inventory_room_type\` FOREIGN KEY (\`room_type_id\`) REFERENCES \`room_types\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`room_inventory\` DROP FOREIGN KEY \`FK_room_inventory_room_type\``
    );
    await queryRunner.query(
      `ALTER TABLE \`room_types\` DROP FOREIGN KEY \`FK_room_types_partner\``
    );
    await queryRunner.query(
      `DROP INDEX \`uq_room_inventory_room_date\` ON \`room_inventory\``
    );
    await queryRunner.query(
      `DROP INDEX \`idx_room_inventory_date\` ON \`room_inventory\``
    );
    await queryRunner.query(`DROP TABLE \`room_inventory\``);
    await queryRunner.query(
      `DROP INDEX \`idx_room_types_partner_active\` ON \`room_types\``
    );
    await queryRunner.query(`DROP TABLE \`room_types\``);
  }
}

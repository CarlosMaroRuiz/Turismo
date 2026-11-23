import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Soporte multi-ítem en bookings para permitir reservas de:
 * - Salidas de paquetes (package_departure)
 * - Noches de hotel (room_stay)
 * - Turnos de experiencias (experience_slot)
 */
export class BookingMultiItem1795385000000 implements MigrationInterface {
  name = "BookingMultiItem1795385000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE `bookings` MODIFY `departure_id` varchar(36) NULL"
    );
    await queryRunner.query(
      "ALTER TABLE `bookings` ADD `item_type` varchar(30) NOT NULL DEFAULT 'package_departure'"
    );
    await queryRunner.query(
      "ALTER TABLE `bookings` ADD `item_id` varchar(36) NULL"
    );
    await queryRunner.query(
      "UPDATE `bookings` SET `item_id` = `departure_id` WHERE `item_id` IS NULL"
    );
    await queryRunner.query(
      "ALTER TABLE `bookings` MODIFY `item_id` varchar(36) NOT NULL"
    );
    await queryRunner.query(
      "ALTER TABLE `bookings` ADD `item_detail` json NULL"
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE `bookings` DROP COLUMN `item_detail`");
    await queryRunner.query("ALTER TABLE `bookings` DROP COLUMN `item_id`");
    await queryRunner.query("ALTER TABLE `bookings` DROP COLUMN `item_type`");
    await queryRunner.query(
      "ALTER TABLE `bookings` MODIFY `departure_id` varchar(36) NOT NULL"
    );
  }
}

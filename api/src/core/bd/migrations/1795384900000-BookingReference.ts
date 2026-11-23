import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Clave maestra de la reserva.
 *
 * Se genera al apartar (`pending_payment`) para que el viajero la tenga desde
 * el primer mensaje, y se convierte en el identificador que se comparte con el
 * proveedor y se codifica en el QR del comprobante.
 */
export class BookingReference1795384900000 implements MigrationInterface {
  name = "BookingReference1795384900000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE `bookings` ADD `reference` varchar(12) NULL"
    );

    // Reservas previas: se les asigna una clave derivada del uuid.
    await queryRunner.query(
      "UPDATE `bookings` SET `reference` = CONCAT('TRV-', UPPER(SUBSTRING(REPLACE(`id`, '-', ''), 1, 6))) WHERE `reference` IS NULL"
    );

    await queryRunner.query(
      "ALTER TABLE `bookings` MODIFY `reference` varchar(12) NOT NULL"
    );
    await queryRunner.query(
      "ALTER TABLE `bookings` ADD UNIQUE INDEX `uq_bookings_reference` (`reference`)"
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE `bookings` DROP INDEX `uq_bookings_reference`"
    );
    await queryRunner.query("ALTER TABLE `bookings` DROP COLUMN `reference`");
  }
}

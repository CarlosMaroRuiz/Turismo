import type { MigrationInterface, QueryRunner } from "typeorm";

export class Bookings1795384700000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE quotes ADD COLUMN client_id varchar(60) NULL");
    await queryRunner.query(`
      CREATE TABLE bookings (
        id varchar(36) NOT NULL PRIMARY KEY,
        quote_id varchar(36) NOT NULL,
        departure_id varchar(36) NOT NULL,
        client_id varchar(60) NOT NULL,
        traveler_ref varchar(80) NOT NULL,
        seats int NOT NULL,
        total decimal(12,2) NOT NULL,
        currency varchar(3) NOT NULL,
        status varchar(20) NOT NULL,
        expires_at timestamp(6) NOT NULL,
        paypal_order_id varchar(36) NULL,
        paypal_approval_url varchar(1024) NULL,
        paypal_capture_id varchar(36) NULL,
        created_at timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        UNIQUE KEY uq_bookings_quote (quote_id),
        UNIQUE KEY uq_bookings_paypal_order (paypal_order_id),
        KEY idx_bookings_inventory (departure_id, status, expires_at),
        CONSTRAINT fk_bookings_quote FOREIGN KEY (quote_id) REFERENCES quotes(id),
        CONSTRAINT fk_bookings_departure FOREIGN KEY (departure_id) REFERENCES package_departures(id)
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP TABLE bookings");
    await queryRunner.query("ALTER TABLE quotes DROP COLUMN client_id");
  }
}

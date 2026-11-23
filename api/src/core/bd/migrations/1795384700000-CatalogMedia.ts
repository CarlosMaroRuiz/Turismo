import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Medios del catálogo: galería de imágenes en paquetes, habitaciones y
 * experiencias, y logo del socio. Son URLs (el frontend usa su propio CDN);
 * la subida de archivos queda para una fase posterior.
 */
export class CatalogMedia1795384700000 implements MigrationInterface {
  name = "CatalogMedia1795384700000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`partners\` ADD \`logo_url\` varchar(500) NULL`
    );

    for (const table of ["packages", "room_types", "experiences"]) {
      await queryRunner.query(
        `ALTER TABLE \`${table}\` ADD \`images\` json NULL`
      );
      await queryRunner.query(
        `UPDATE \`${table}\` SET \`images\` = JSON_ARRAY() WHERE \`images\` IS NULL`
      );
      await queryRunner.query(
        `ALTER TABLE \`${table}\` MODIFY \`images\` json NOT NULL`
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ["packages", "room_types", "experiences"]) {
      await queryRunner.query(`ALTER TABLE \`${table}\` DROP COLUMN \`images\``);
    }
    await queryRunner.query(`ALTER TABLE \`partners\` DROP COLUMN \`logo_url\``);
  }
}

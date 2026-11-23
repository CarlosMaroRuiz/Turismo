import type { MigrationInterface, QueryRunner } from "typeorm";

export class SchemaUpdate1795382996491 implements MigrationInterface {
    name = 'SchemaUpdate1795382996491'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`package_departures\` (\`id\` varchar(36) NOT NULL, \`package_id\` varchar(36) NOT NULL, \`departure_date\` date NOT NULL, \`total_seats\` int NOT NULL, \`sold_seats\` int NOT NULL DEFAULT '0', \`adult_price\` decimal(10,2) NOT NULL, \`child_price\` decimal(10,2) NULL, \`status\` enum ('open', 'closed') NOT NULL DEFAULT 'open', \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`idx_package_departures_date_status\` (\`departure_date\`, \`status\`), UNIQUE INDEX \`uq_package_departure_date\` (\`package_id\`, \`departure_date\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`package_itinerary_days\` (\`id\` varchar(36) NOT NULL, \`package_id\` varchar(36) NOT NULL, \`day_number\` int NOT NULL, \`title\` varchar(150) NOT NULL, \`description\` text NOT NULL, UNIQUE INDEX \`uq_package_itinerary_day\` (\`package_id\`, \`day_number\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`packages\` (\`id\` varchar(36) NOT NULL, \`partner_id\` varchar(36) NOT NULL, \`destination_region_id\` varchar(36) NOT NULL, \`name\` varchar(150) NOT NULL, \`slug\` varchar(180) NOT NULL, \`summary\` varchar(300) NOT NULL, \`description\` text NOT NULL, \`nights\` int NOT NULL, \`min_travelers\` int NOT NULL DEFAULT '1', \`max_travelers\` int NULL, \`child_min_age\` int NULL, \`child_max_age\` int NULL, \`meeting_point\` varchar(255) NULL, \`requirements\` text NULL, \`cancellation_policy\` text NOT NULL, \`taxes_included\` tinyint NOT NULL DEFAULT 1, \`status\` enum ('draft', 'published', 'paused') NOT NULL DEFAULT 'draft', \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`uq_packages_slug\` (\`slug\`), INDEX \`idx_packages_destination_status\` (\`destination_region_id\`, \`status\`), INDEX \`idx_packages_partner_status\` (\`partner_id\`, \`status\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`package_promotions\` (\`id\` varchar(36) NOT NULL, \`package_id\` varchar(36) NOT NULL, \`name\` varchar(120) NOT NULL, \`discount_type\` enum ('percentage', 'fixed') NOT NULL, \`discount_value\` decimal(10,2) NOT NULL, \`valid_from\` date NOT NULL, \`valid_to\` date NOT NULL, \`min_travelers\` int NULL, \`days_of_week\` json NULL, \`status\` enum ('active', 'inactive') NOT NULL DEFAULT 'active', \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`idx_package_promotions_package_status\` (\`package_id\`, \`status\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`package_items\` (\`id\` varchar(36) NOT NULL, \`package_id\` varchar(36) NOT NULL, \`type\` enum ('lodging', 'transport', 'meals', 'activity', 'other') NOT NULL, \`description\` varchar(255) NOT NULL, \`is_included\` tinyint NOT NULL DEFAULT 1, \`sort_order\` int NOT NULL DEFAULT '0', INDEX \`idx_package_items_package_id\` (\`package_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`partner_users\` (\`id\` varchar(36) NOT NULL, \`partner_id\` varchar(36) NOT NULL, \`user_id\` varchar(36) NOT NULL, \`role\` enum ('owner', 'staff') NOT NULL DEFAULT 'staff', \`is_active\` tinyint NOT NULL DEFAULT 1, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`idx_partner_users_partner_id\` (\`partner_id\`), INDEX \`idx_partner_users_user_id\` (\`user_id\`), UNIQUE INDEX \`uq_partner_users_partner_user\` (\`partner_id\`, \`user_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`package_departures\` ADD CONSTRAINT \`FK_6972e37fa803546c188e672138a\` FOREIGN KEY (\`package_id\`) REFERENCES \`packages\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`package_itinerary_days\` ADD CONSTRAINT \`FK_b4f66688319cdb9a57eb767acf8\` FOREIGN KEY (\`package_id\`) REFERENCES \`packages\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`packages\` ADD CONSTRAINT \`FK_08c546f0f7802860d1552fcd56c\` FOREIGN KEY (\`partner_id\`) REFERENCES \`partners\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`packages\` ADD CONSTRAINT \`FK_43ec479c2799506d33d669a4724\` FOREIGN KEY (\`destination_region_id\`) REFERENCES \`regions\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`package_promotions\` ADD CONSTRAINT \`FK_25393d2631ee7f41f631f5a62ce\` FOREIGN KEY (\`package_id\`) REFERENCES \`packages\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`package_items\` ADD CONSTRAINT \`FK_4af1566b499be54342efb0b96c1\` FOREIGN KEY (\`package_id\`) REFERENCES \`packages\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`partner_users\` ADD CONSTRAINT \`FK_0274b889b21c97315f85009697c\` FOREIGN KEY (\`partner_id\`) REFERENCES \`partners\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`partner_users\` ADD CONSTRAINT \`FK_d79594e775c71c9cb02fb5c3f97\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`partner_users\` DROP FOREIGN KEY \`FK_d79594e775c71c9cb02fb5c3f97\``);
        await queryRunner.query(`ALTER TABLE \`partner_users\` DROP FOREIGN KEY \`FK_0274b889b21c97315f85009697c\``);
        await queryRunner.query(`ALTER TABLE \`package_items\` DROP FOREIGN KEY \`FK_4af1566b499be54342efb0b96c1\``);
        await queryRunner.query(`ALTER TABLE \`package_promotions\` DROP FOREIGN KEY \`FK_25393d2631ee7f41f631f5a62ce\``);
        await queryRunner.query(`ALTER TABLE \`packages\` DROP FOREIGN KEY \`FK_43ec479c2799506d33d669a4724\``);
        await queryRunner.query(`ALTER TABLE \`packages\` DROP FOREIGN KEY \`FK_08c546f0f7802860d1552fcd56c\``);
        await queryRunner.query(`ALTER TABLE \`package_itinerary_days\` DROP FOREIGN KEY \`FK_b4f66688319cdb9a57eb767acf8\``);
        await queryRunner.query(`ALTER TABLE \`package_departures\` DROP FOREIGN KEY \`FK_6972e37fa803546c188e672138a\``);
        await queryRunner.query(`DROP INDEX \`uq_partner_users_partner_user\` ON \`partner_users\``);
        await queryRunner.query(`DROP INDEX \`idx_partner_users_user_id\` ON \`partner_users\``);
        await queryRunner.query(`DROP INDEX \`idx_partner_users_partner_id\` ON \`partner_users\``);
        await queryRunner.query(`DROP TABLE \`partner_users\``);
        await queryRunner.query(`DROP INDEX \`idx_package_items_package_id\` ON \`package_items\``);
        await queryRunner.query(`DROP TABLE \`package_items\``);
        await queryRunner.query(`DROP INDEX \`idx_package_promotions_package_status\` ON \`package_promotions\``);
        await queryRunner.query(`DROP TABLE \`package_promotions\``);
        await queryRunner.query(`DROP INDEX \`idx_packages_partner_status\` ON \`packages\``);
        await queryRunner.query(`DROP INDEX \`idx_packages_destination_status\` ON \`packages\``);
        await queryRunner.query(`DROP INDEX \`uq_packages_slug\` ON \`packages\``);
        await queryRunner.query(`DROP TABLE \`packages\``);
        await queryRunner.query(`DROP INDEX \`uq_package_itinerary_day\` ON \`package_itinerary_days\``);
        await queryRunner.query(`DROP TABLE \`package_itinerary_days\``);
        await queryRunner.query(`DROP INDEX \`uq_package_departure_date\` ON \`package_departures\``);
        await queryRunner.query(`DROP INDEX \`idx_package_departures_date_status\` ON \`package_departures\``);
        await queryRunner.query(`DROP TABLE \`package_departures\``);
    }

}

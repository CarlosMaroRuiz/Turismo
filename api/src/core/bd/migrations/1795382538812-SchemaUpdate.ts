import type { MigrationInterface, QueryRunner } from "typeorm";

export class SchemaUpdate1795382538812 implements MigrationInterface {
    name = 'SchemaUpdate1795382538812'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`users\` (\`id\` varchar(36) NOT NULL, \`role_id\` varchar(36) NOT NULL, \`name\` varchar(150) NOT NULL, \`email\` varchar(150) NOT NULL, \`phone\` varchar(30) NULL, \`password_hash\` varchar(255) NULL, \`status\` enum ('invited', 'active', 'inactive') NOT NULL DEFAULT 'invited', \`must_change_password\` tinyint NOT NULL DEFAULT 0, \`last_login_at\` timestamp NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`idx_users_role_id\` (\`role_id\`), UNIQUE INDEX \`uq_users_email\` (\`email\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`user_tokens\` (\`id\` varchar(36) NOT NULL, \`user_id\` varchar(36) NOT NULL, \`type\` enum ('activation', 'password_reset') NOT NULL, \`token_hash\` varchar(64) NOT NULL, \`expires_at\` timestamp NOT NULL, \`used_at\` timestamp NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE INDEX \`uq_user_tokens_token_hash\` (\`token_hash\`), INDEX \`idx_user_tokens_user_type\` (\`user_id\`, \`type\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`users\` ADD CONSTRAINT \`FK_a2cecd1a3531c0b041e29ba46e1\` FOREIGN KEY (\`role_id\`) REFERENCES \`roles\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`user_tokens\` ADD CONSTRAINT \`FK_9e144a67be49e5bba91195ef5de\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`user_tokens\` DROP FOREIGN KEY \`FK_9e144a67be49e5bba91195ef5de\``);
        await queryRunner.query(`ALTER TABLE \`users\` DROP FOREIGN KEY \`FK_a2cecd1a3531c0b041e29ba46e1\``);
        await queryRunner.query(`DROP INDEX \`idx_user_tokens_user_type\` ON \`user_tokens\``);
        await queryRunner.query(`DROP INDEX \`uq_user_tokens_token_hash\` ON \`user_tokens\``);
        await queryRunner.query(`DROP TABLE \`user_tokens\``);
        await queryRunner.query(`DROP INDEX \`uq_users_email\` ON \`users\``);
        await queryRunner.query(`DROP INDEX \`idx_users_role_id\` ON \`users\``);
        await queryRunner.query(`DROP TABLE \`users\``);
    }

}

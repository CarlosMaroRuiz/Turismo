import bcrypt from "bcryptjs";
import { DataSource } from "typeorm";
import { Seed } from "../utils/seed.decorator.js";
import type { Seeder } from "../types/index.js";
import { METACONFIG } from "../../../metaconfig/index.js";
import { Role, RoleCode } from "../../entities/Role.js";
import { User, UserStatus } from "../../entities/User.js";

@Seed({ name: "users", order: 5 })
export class UserSeeder implements Seeder {
    async run(dataSource: DataSource): Promise<void> {
        const userRepo = dataSource.getRepository(User);
        const roleRepo = dataSource.getRepository(Role);

        const email = METACONFIG.superUser.email;
        const password = METACONFIG.superUser.password;
        const name = METACONFIG.superUser.name;

        // Sin upsert a propósito: si ya existe, no se toca (no pisa una
        // contraseña que el usuario ya cambió).
        const existing = await userRepo.findOne({ where: { email } });
        if (existing) return;

        const role = await roleRepo.findOneByOrFail({ code: RoleCode.SUPER_USER });

        const user = userRepo.create({
            roleId: role.id,
            name,
            email,
            phone: null,
            passwordHash: await bcrypt.hash(password, 12),
            status: UserStatus.ACTIVE,
            mustChangePassword: true,
        });

        await userRepo.save(user);
    }
}
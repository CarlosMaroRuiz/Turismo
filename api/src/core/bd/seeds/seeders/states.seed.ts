import { DataSource } from "typeorm";
import { Seed } from "../utils/seed.decorator.js";
import type { Seeder } from "../types/index.js";
import { State } from "../../entities/State.entity.js";

@Seed({ name: "states", order: 1 }) 
export class StateSeeder implements Seeder {
  async run(dataSource: DataSource): Promise<void> {
    const stateRepo = dataSource.getRepository(State);

    const statesData = [
      { code: "01", name: "Aguascalientes", slug: "aguascalientes", aliases: ["Ags.", "Ags"], isActive: true },
      { code: "02", name: "Baja California", slug: "baja-california", aliases: ["B.C.", "BC", "Baja California Norte"], isActive: true },
      { code: "03", name: "Baja California Sur", slug: "baja-california-sur", aliases: ["B.C.S.", "BCS"], isActive: true },
      { code: "04", name: "Campeche", slug: "campeche", aliases: ["Camp.", "Camp"], isActive: true },
      { code: "05", name: "Coahuila de Zaragoza", slug: "coahuila", aliases: ["Coah.", "Coah", "Coahuila"], isActive: true },
      { code: "06", name: "Colima", slug: "colima", aliases: ["Col.", "Col"], isActive: true },
      { code: "07", name: "Chiapas", slug: "chiapas", aliases: ["Chis.", "Chis"], isActive: true },
      { code: "08", name: "Chihuahua", slug: "chihuahua", aliases: ["Chih.", "Chih"], isActive: true },
      { code: "09", name: "Ciudad de México", slug: "ciudad-de-mexico", aliases: ["CDMX", "D.F.", "DF", "Distrito Federal"], isActive: true },
      { code: "10", name: "Durango", slug: "durango", aliases: ["Dgo.", "Dgo"], isActive: true },
      { code: "11", name: "Guanajuato", slug: "guanajuato", aliases: ["Gto.", "Gto"], isActive: true },
      { code: "12", name: "Guerrero", slug: "guerrero", aliases: ["Gro.", "Gro"], isActive: true },
      { code: "13", name: "Hidalgo", slug: "hidalgo", aliases: ["Hgo.", "Hgo"], isActive: true },
      { code: "14", name: "Jalisco", slug: "jalisco", aliases: ["Jal.", "Jal"], isActive: true },
      { code: "15", name: "México", slug: "estado-de-mexico", aliases: ["Edomex", "Edo. Méx.", "Mex.", "Estado de México"], isActive: true },
      { code: "16", name: "Michoacán de Ocampo", slug: "michoacan", aliases: ["Mich.", "Mich", "Michoacán"], isActive: true },
      { code: "17", name: "Morelos", slug: "morelos", aliases: ["Mor.", "Mor"], isActive: true },
      { code: "18", name: "Nayarit", slug: "nayarit", aliases: ["Nay.", "Nay"], isActive: true },
      { code: "19", name: "Nuevo León", slug: "nuevo-leon", aliases: ["N.L.", "NL"], isActive: true },
      { code: "20", name: "Oaxaca", slug: "oaxaca", aliases: ["Oax.", "Oax"], isActive: true },
      { code: "21", name: "Puebla", slug: "puebla", aliases: ["Pue.", "Pue"], isActive: true },
      { code: "22", name: "Querétaro", slug: "queretaro", aliases: ["Qro.", "Qro", "Querétaro de Arteaga"], isActive: true },
      { code: "23", name: "Quintana Roo", slug: "quintana-roo", aliases: ["Q. Roo", "QRoo", "Q.R."], isActive: true },
      { code: "24", name: "San Luis Potosí", slug: "san-luis-potosi", aliases: ["S.L.P.", "SLP"], isActive: true },
      { code: "25", name: "Sinaloa", slug: "sinaloa", aliases: ["Sin.", "Sin"], isActive: true },
      { code: "26", name: "Sonora", slug: "sonora", aliases: ["Son.", "Son"], isActive: true },
      { code: "27", name: "Tabasco", slug: "tabasco", aliases: ["Tab.", "Tab"], isActive: true },
      { code: "28", name: "Tamaulipas", slug: "tamaulipas", aliases: ["Tamps.", "Tamps"], isActive: true },
      { code: "29", name: "Tlaxcala", slug: "tlaxcala", aliases: ["Tlax.", "Tlax"], isActive: true },
      { code: "30", name: "Veracruz de Ignacio de la Llave", slug: "veracruz", aliases: ["Ver.", "Ver", "Veracruz"], isActive: true },
      { code: "31", name: "Yucatán", slug: "yucatan", aliases: ["Yuc.", "Yuc"], isActive: true },
      { code: "32", name: "Zacatecas", slug: "zacatecas", aliases: ["Zac.", "Zac"], isActive: true },
    ];

    await stateRepo.upsert(statesData, ["code"]);
  }
}
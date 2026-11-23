import { METACONFIG } from "../metaconfig/index.js";
import { AppDataSource } from "../bd/index.js";
import { App } from "./App.js";

export class Server {
  private readonly app: App;
  private readonly port: number;
  private readonly env: string;

  constructor() {
    this.app = new App();
    this.port = METACONFIG.server.port;
    this.env = METACONFIG.server.env;
  }

  public async start(): Promise<void> {
    try {
      if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
        console.log(`Base de datos (${METACONFIG.db.type}) conectada`);
      }

      this.app.instance.listen(this.port, () => {
        console.log(
          `Servidor corriendo en http://localhost:${this.port} [${this.env}]`
        );
      });
    } catch (error) {
      console.error("Error al iniciar el servidor:", error);
      process.exit(1);
    }
  }
}
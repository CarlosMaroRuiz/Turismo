import { Router } from "express";
import { AuthRoutes } from "../../features/auth/routes/AuthRoutes.js";
import { PartnerRoutes } from "../../features/partner/routes/PartnerRoutes.js";
import { RegionRoutes } from "../../features/region/routes/RegionRoutes.js";
import { PartnerCategoryRoutes } from "../../features/partner-category/routes/PartnerCategoryRoutes.js";
import { ServiceRoutes } from "../../features/service/routes/ServiceRoutes.js";
import { PackageRoutes } from "../../features/package/routes/PackageRoutes.js";
import { HotelRoutes } from "../../features/hotel/routes/HotelRoutes.js";
import { ExperienceRoutes } from "../../features/experience/routes/ExperienceRoutes.js";
import { QuoteRoutes } from "../../features/quote/routes/QuoteRoutes.js";
import { BookingRoutes } from "../../features/booking/routes/BookingRoutes.js";
import { buildOpenApiDocument } from "../http/openapi/index.js";

export class ApiRouter {
  public readonly router: Router;

  constructor() {
    this.router = Router();
    this.registerRoutes();
  }

  private registerRoutes(): void {
    // Contrato público: el frontend y el servicio de LLM integran contra esto.
    this.router.get("/openapi.json", (_req, res) => {
      res.json(buildOpenApiDocument());
    });

    this.router.use("/auth", new AuthRoutes().router);
    this.router.use("/partners", new PartnerRoutes().router);
    this.router.use("/regions", new RegionRoutes().router);
    this.router.use("/partner-categories", new PartnerCategoryRoutes().router);
    this.router.use("/service", new ServiceRoutes().router);
    this.router.use("/packages", new PackageRoutes().router);
    this.router.use("/hotels", new HotelRoutes().router);
    this.router.use("/experiences", new ExperienceRoutes().router);
    this.router.use("/quotes", new QuoteRoutes().router);
    this.router.use("/bookings", new BookingRoutes().router);
  }
}

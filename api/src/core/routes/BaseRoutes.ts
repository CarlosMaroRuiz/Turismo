import { Router } from "express";

export abstract class BaseRoutes<T> {
  public readonly router: Router;
  public readonly controller: T;

  constructor(controllerOrClass: T | (new () => T)) {
    this.router = Router();
    this.controller =
      typeof controllerOrClass === "function"
        ? new (controllerOrClass as new () => T)()
        : controllerOrClass;

    this.initRoutes();
  }

  protected abstract initRoutes(): void;
}
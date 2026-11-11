// Public entry of the add-crm-core package. A project's worker is just:
//   import { createCrm } from "add-crm-core";
//   import model from "../crm.model.mjs";
//   export default createCrm(model);
import app, { type Env } from "./api/index.js";
import { applyModel, type CrmModel } from "./api/objects.js";

/** Apply the project's model and return the Worker's handler. Throws if the model is invalid. */
export function createCrm(model: CrmModel = {}): ExportedHandler<Env> {
  applyModel(model);
  return { fetch: (request, env, ctx) => app.fetch(request, env, ctx) };
}

export { applyModel, defineModel, DEFAULT_NAV, OBJECTS, OPPORTUNITY_STAGES } from "./api/objects.js";
export type { CrmModel, FieldDef, FieldType, SObjectDef, Sharing, StageDef } from "./api/objects.js";
export type { Env };

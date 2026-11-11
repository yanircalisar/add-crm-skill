// The CRM itself comes from the add-crm-core package; this project only supplies its model.
import { createCrm } from "add-crm-core";
import model from "../crm.model.mjs";

export default createCrm(model);

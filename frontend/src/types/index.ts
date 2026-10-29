import type { components as Identity } from "./identity.generated";
import type { components as Content } from "./content.generated";
export type I = Identity["schemas"];
export type C = Content["schemas"];
export type Role = "USER" | "MODERATOR" | "ADMIN";
export type Range = "7d" | "30d" | "90d";

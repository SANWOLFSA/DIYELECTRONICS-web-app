import type { EscalationStage } from '../../lib/escalation';
// Normalised device catalog used by the routed Devices drill-down.
// Device type > Brand > Model > (Size) > Solutions

export type FamilyId =
  | 'display' | 'mobile' | 'computer' | 'audio' | 'media' | 'gaming'
  | 'refrigeration' | 'laundry' | 'dishwasher' | 'hvac' | 'water_heating'
  | 'cooking' | 'small_heating' | 'coffee' | 'motor_kitchen' | 'floorcare' | 'personal_care' | 'sewing'
  | 'networking' | 'printing' | 'printer_3d' | 'wearables' | 'imaging' | 'drone'
  | 'power_backup' | 'micromobility' | 'automotive' | 'workshop_power' | 'power_tools' | 'pumps' | 'test_equipment'
  | 'security' | 'gate_motor' | 'lighting' | 'smart_home'
  | 'medical_home';

export interface CatalogSize {
  slug: string;
  name: string;
}

export interface CatalogModel {
  slug: string;
  name: string;
  sizes: CatalogSize[]; // empty when the model has no size variants
  /** Optional curated product photo. When absent the UI asks /api/model-image, then falls back to a device-type illustration. */
  imageUrl?: string;
  /** Field notes carried over from the original hand-written catalog. */
  legacy?: { steps: string[]; tools: string[]; commonIssues: string[] };
}

export interface CatalogBrand {
  slug: string;
  name: string;
  /** Official website domain, used for the favicon logo fallback. */
  domain?: string;
  /** https://simpleicons.org slug for the official brand mark. */
  simpleIconSlug?: string;
  models: CatalogModel[];
}

export interface CatalogDeviceType {
  key: string; // stable internal key (matches MASTER_CATALOG key where one exists)
  slug: string; // URL slug
  name: string;
  group: string;
  family: FamilyId;
  sizeLabel?: string;
  image?: string;
  brands: CatalogBrand[];
}

export type Difficulty = 'Easy' | 'Moderate' | 'Advanced' | 'Expert';

/** A fault template in a per-family issue library. Text may use {device} {brand} {model} {size}. */
export interface IssueTemplate {
  id: string;
  title: string;
  symptom: string;
  causes: string[];
  tests: string[];
  fix: string[];
  parts: string[];
  tools: string[];
  difficulty: Difficulty;
  minutes: number;
  safety: string;
  /** Restrict to these device type keys. */
  only?: string[];
  /** Exclude these device type keys. */
  not?: string[];
}

export interface FamilyLibrary {
  issues: IssueTemplate[];
  /** brandSlug -> issueId -> brand specific note (error codes, known weak parts). '*' applies to every issue. */
  brandNotes?: Record<string, Record<string, string>>;
  /** Optional size-aware hint (e.g. capacitor rating by BTU, LED strip count by TV inches). */
  sizeNote?: (size: string, typeKey: string, issueId: string) => string | undefined;
}

export interface Solution {
  id: string;
  title: string;
  symptom: string;
  causes: string[];
  tests: string[];
  fix: string[];
  parts: string[];
  tools: string[];
  difficulty: Difficulty;
  minutes: number;
  safety: string;
  brandNote?: string;
  sizeNote?: string;
  source: 'library' | 'model-notes';
  /** The same fix laid out as Solution A -> B -> C (see lib/escalation.ts). */
  escalation?: EscalationStage[];
}

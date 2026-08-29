export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      parent_profiles: {
        Row: {
          id: string;
          guardian_confirmed_at: string;
          guardian_declaration_version: string;
          privacy_notice_version: string;
          pin_configured_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          guardian_confirmed_at: string;
          guardian_declaration_version: string;
          privacy_notice_version: string;
          pin_configured_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      child_profiles: {
        Row: {
          id: string;
          parent_id: string;
          nickname: string;
          birth_month: number;
          birth_year: number;
          content_locale: "tr-TR";
          favorite_animals: string[];
          favorite_toys: string[];
          interests: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          parent_id: string;
          nickname: string;
          birth_month: number;
          birth_year: number;
          content_locale?: "tr-TR";
          favorite_animals?: string[];
          favorite_toys?: string[];
          interests?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          nickname?: string;
          birth_month?: number;
          birth_year?: number;
          content_locale?: "tr-TR";
          favorite_animals?: string[];
          favorite_toys?: string[];
          interests?: string[];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "child_profiles_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "parent_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      child_consent_preferences: {
        Row: {
          child_id: string;
          parent_id: string;
          consent_type:
            | "personalization"
            | "learning_observations"
            | "anonymous_product_improvement";
          enabled: boolean;
          notice_version: string;
          granted_at: string | null;
          withdrawn_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "child_consent_preferences_child_id_parent_id_fkey";
            columns: ["child_id", "parent_id"];
            isOneToOne: false;
            referencedRelation: "child_profiles";
            referencedColumns: ["id", "parent_id"];
          },
        ];
      };
      published_game_versions: {
        Row: {
          game_id: string;
          game_version: number;
          age_band: "2-4" | "4-7";
          game: Json;
          published_by: string;
          published_at: string;
          archived_by: string | null;
          archived_at: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      game_catalog_tombstones: {
        Row: {
          game_id: string;
          deleted_from_status: "published" | "archived";
          deleted_by: string;
          deleted_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      set_parent_pin: {
        Args: { pin: string };
        Returns: undefined;
      };
      verify_parent_pin: {
        Args: { pin: string };
        Returns: boolean;
      };
      set_child_consent: {
        Args: {
          child_profile_id: string;
          consent_kind: "learning_observations" | "anonymous_product_improvement";
          is_enabled: boolean;
          consent_notice_version: string;
        };
        Returns: undefined;
      };
      set_child_personalization: {
        Args: {
          child_profile_id: string;
          is_enabled: boolean;
          consent_notice_version: string;
          favorite_animals?: string[];
          favorite_toys?: string[];
          interests?: string[];
        };
        Returns: undefined;
      };
      sync_interaction_events: {
        Args: { events: Json };
        Returns: Json;
      };
      select_next_activity: {
        Args: { child_profile_id: string; candidate_activity_ids: string[] };
        Returns: Json;
      };
      select_personalized_activity: {
        Args: { child_profile_id: string; candidate_activity_ids: string[] };
        Returns: Json;
      };
      get_parent_session_summary: {
        Args: { child_profile_id: string };
        Returns: Json;
      };
      get_parent_insight_evidence: {
        Args: { child_profile_id: string };
        Returns: Json;
      };
      get_parent_personalization_status: {
        Args: { child_profile_id: string };
        Returns: Json;
      };
      select_game_variant_preference: {
        Args: {
          child_profile_id: string;
          requested_age_band: "2-4" | "4-7";
          current_difficulty: "starter" | "growing" | "advanced";
        };
        Returns: Json;
      };
      select_bkt_routine_variant: {
        Args: {
          child_profile_id: string;
          requested_age_band: "2-4" | "4-7";
          current_difficulty: "starter" | "growing" | "advanced";
        };
        Returns: Json;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}

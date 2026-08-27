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
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}

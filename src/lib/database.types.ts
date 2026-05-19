export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      competitors: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          base_url: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          base_url: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          base_url?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "competitors_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      monitored_pages: {
        Row: {
          id: string;
          competitor_id: string;
          url: string;
          page_type: Database["public"]["Enums"]["page_type"];
          last_checked_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          competitor_id: string;
          url: string;
          page_type: Database["public"]["Enums"]["page_type"];
          last_checked_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          competitor_id?: string;
          url?: string;
          page_type?: Database["public"]["Enums"]["page_type"];
          last_checked_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "monitored_pages_competitor_id_fkey";
            columns: ["competitor_id"];
            isOneToOne: false;
            referencedRelation: "competitors";
            referencedColumns: ["id"];
          },
        ];
      };
      snapshots: {
        Row: {
          id: string;
          monitored_page_id: string;
          raw_text: string;
          hash: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          monitored_page_id: string;
          raw_text: string;
          hash: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          monitored_page_id?: string;
          raw_text?: string;
          hash?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "snapshots_monitored_page_id_fkey";
            columns: ["monitored_page_id"];
            isOneToOne: false;
            referencedRelation: "monitored_pages";
            referencedColumns: ["id"];
          },
        ];
      };
      detected_changes: {
        Row: {
          id: string;
          monitored_page_id: string;
          diff_summary: string;
          severity: Database["public"]["Enums"]["change_severity"];
          created_at: string;
        };
        Insert: {
          id?: string;
          monitored_page_id: string;
          diff_summary: string;
          severity?: Database["public"]["Enums"]["change_severity"];
          created_at?: string;
        };
        Update: {
          id?: string;
          monitored_page_id?: string;
          diff_summary?: string;
          severity?: Database["public"]["Enums"]["change_severity"];
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "detected_changes_monitored_page_id_fkey";
            columns: ["monitored_page_id"];
            isOneToOne: false;
            referencedRelation: "monitored_pages";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      page_type: "homepage" | "pricing" | "features" | "changelog";
      change_severity: "low" | "medium" | "high";
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Competitor =
  Database["public"]["Tables"]["competitors"]["Row"];
export type MonitoredPage =
  Database["public"]["Tables"]["monitored_pages"]["Row"];
export type DetectedChange =
  Database["public"]["Tables"]["detected_changes"]["Row"];
export type PageType = Database["public"]["Enums"]["page_type"];

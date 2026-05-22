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
          plan: "free" | "pro";
          competitor_limit: number;
          scan_interval_hours: number;
          subscription_status: string;
          current_period_end: string | null;
          billing_customer_id: string | null;
          billing_subscription_id: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          plan?: "free" | "pro";
          competitor_limit?: number;
          scan_interval_hours?: number;
          subscription_status?: string;
          current_period_end?: string | null;
          billing_customer_id?: string | null;
          billing_subscription_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          plan?: "free" | "pro";
          competitor_limit?: number;
          scan_interval_hours?: number;
          subscription_status?: string;
          current_period_end?: string | null;
          billing_customer_id?: string | null;
          billing_subscription_id?: string | null;
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
          scan_status: "pending" | "running" | "ready" | "failed";
          last_scan_at: string | null;
          last_scan_error: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          base_url: string;
          scan_status?: "pending" | "running" | "ready" | "failed";
          last_scan_at?: string | null;
          last_scan_error?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          base_url?: string;
          scan_status?: "pending" | "running" | "ready" | "failed";
          last_scan_at?: string | null;
          last_scan_error?: string | null;
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
          raw_content_hash: string | null;
          canonical_content_hash: string | null;
          structured_facts_hash: string | null;
          structured_facts_json: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          monitored_page_id: string;
          raw_text: string;
          hash: string;
          raw_content_hash?: string | null;
          canonical_content_hash?: string | null;
          structured_facts_hash?: string | null;
          structured_facts_json?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          monitored_page_id?: string;
          raw_text?: string;
          hash?: string;
          raw_content_hash?: string | null;
          canonical_content_hash?: string | null;
          structured_facts_hash?: string | null;
          structured_facts_json?: Json;
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
          change_type: string | null;
          confidence_score: number | null;
          evidence_json: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          monitored_page_id: string;
          diff_summary: string;
          severity?: Database["public"]["Enums"]["change_severity"];
          change_type?: string | null;
          confidence_score?: number | null;
          evidence_json?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          monitored_page_id?: string;
          diff_summary?: string;
          severity?: Database["public"]["Enums"]["change_severity"];
          change_type?: string | null;
          confidence_score?: number | null;
          evidence_json?: Json;
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
      competitor_intelligence_snapshots: {
        Row: {
          id: string;
          competitor_id: string;
          summary: Json;
          facts: Json;
          analyzed_pages: Json;
          warnings: string[];
          source: "openai" | "deterministic";
          created_at: string;
        };
        Insert: {
          id?: string;
          competitor_id: string;
          summary: Json;
          facts?: Json;
          analyzed_pages?: Json;
          warnings?: string[];
          source?: "openai" | "deterministic";
          created_at?: string;
        };
        Update: {
          id?: string;
          competitor_id?: string;
          summary?: Json;
          facts?: Json;
          analyzed_pages?: Json;
          warnings?: string[];
          source?: "openai" | "deterministic";
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "competitor_intelligence_snapshots_competitor_id_fkey";
            columns: ["competitor_id"];
            isOneToOne: false;
            referencedRelation: "competitors";
            referencedColumns: ["id"];
          },
        ];
      };
      scan_debug_logs: {
        Row: {
          id: string;
          competitor_id: string;
          run_type: "initial_setup" | "manual_analysis" | "manual_scan";
          status: "success" | "partial" | "failed";
          normalized_url: string | null;
          submitted_url: string | null;
          payload: Json;
          warnings: string[];
          errors: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          competitor_id: string;
          run_type: "initial_setup" | "manual_analysis" | "manual_scan";
          status: "success" | "partial" | "failed";
          normalized_url?: string | null;
          submitted_url?: string | null;
          payload?: Json;
          warnings?: string[];
          errors?: string[];
          created_at?: string;
        };
        Update: {
          id?: string;
          competitor_id?: string;
          run_type?: "initial_setup" | "manual_analysis" | "manual_scan";
          status?: "success" | "partial" | "failed";
          normalized_url?: string | null;
          submitted_url?: string | null;
          payload?: Json;
          warnings?: string[];
          errors?: string[];
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "scan_debug_logs_competitor_id_fkey";
            columns: ["competitor_id"];
            isOneToOne: false;
            referencedRelation: "competitors";
            referencedColumns: ["id"];
          },
        ];
      };
      user_products: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          base_url: string;
          scan_status: "pending" | "running" | "ready" | "failed" | "deferred";
          error_message: string | null;
          last_scanned_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          base_url: string;
          scan_status?: "pending" | "running" | "ready" | "failed" | "deferred";
          error_message?: string | null;
          last_scanned_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          base_url?: string;
          scan_status?: "pending" | "running" | "ready" | "failed" | "deferred";
          error_message?: string | null;
          last_scanned_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_products_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      product_snapshots: {
        Row: {
          id: string;
          user_product_id: string;
          user_id: string;
          summary_json: Json;
          structured_facts_json: Json;
          analyzed_pages: Json;
          warnings: string[];
          source: "openai" | "deterministic";
          created_at: string;
        };
        Insert: {
          id?: string;
          user_product_id: string;
          user_id: string;
          summary_json: Json;
          structured_facts_json?: Json;
          analyzed_pages?: Json;
          warnings?: string[];
          source?: "openai" | "deterministic";
          created_at?: string;
        };
        Update: {
          id?: string;
          user_product_id?: string;
          user_id?: string;
          summary_json?: Json;
          structured_facts_json?: Json;
          analyzed_pages?: Json;
          warnings?: string[];
          source?: "openai" | "deterministic";
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_snapshots_user_product_id_fkey";
            columns: ["user_product_id"];
            isOneToOne: false;
            referencedRelation: "user_products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_snapshots_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      product_recommendations: {
        Row: {
          id: string;
          user_product_id: string;
          user_id: string;
          recommendation_type: string;
          title: string;
          explanation: string;
          why_this_matters: string;
          evidence_json: Json;
          confidence: number;
          confidence_label: "very_low" | "low" | "medium" | "high" | "very_high";
          actionability: "low" | "medium" | "high";
          created_at: string;
        };
        Insert: {
          id?: string;
          user_product_id: string;
          user_id: string;
          recommendation_type: string;
          title: string;
          explanation: string;
          why_this_matters: string;
          evidence_json?: Json;
          confidence: number;
          confidence_label: "very_low" | "low" | "medium" | "high" | "very_high";
          actionability: "low" | "medium" | "high";
          created_at?: string;
        };
        Update: {
          id?: string;
          user_product_id?: string;
          user_id?: string;
          recommendation_type?: string;
          title?: string;
          explanation?: string;
          why_this_matters?: string;
          evidence_json?: Json;
          confidence?: number;
          confidence_label?: "very_low" | "low" | "medium" | "high" | "very_high";
          actionability?: "low" | "medium" | "high";
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_recommendations_user_product_id_fkey";
            columns: ["user_product_id"];
            isOneToOne: false;
            referencedRelation: "user_products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_recommendations_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      recommendation_feedback: {
        Row: {
          id: string;
          recommendation_id: string;
          user_id: string;
          feedback: "useful" | "not_useful" | "already_knew" | "implemented";
          created_at: string;
        };
        Insert: {
          id?: string;
          recommendation_id: string;
          user_id: string;
          feedback: "useful" | "not_useful" | "already_knew" | "implemented";
          created_at?: string;
        };
        Update: {
          id?: string;
          recommendation_id?: string;
          user_id?: string;
          feedback?: "useful" | "not_useful" | "already_knew" | "implemented";
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recommendation_feedback_recommendation_id_fkey";
            columns: ["recommendation_id"];
            isOneToOne: false;
            referencedRelation: "product_recommendations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recommendation_feedback_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      usage_events: {
        Row: {
          id: string;
          user_id: string;
          event_type: string;
          quantity: number;
          estimated_cost_eur: number;
          metadata_json: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          event_type: string;
          quantity?: number;
          estimated_cost_eur?: number;
          metadata_json?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          event_type?: string;
          quantity?: number;
          estimated_cost_eur?: number;
          metadata_json?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "usage_events_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_summary_cache: {
        Row: {
          id: string;
          user_id: string;
          cache_key: string;
          model: string;
          summary_json: Json;
          source: "openai" | "deterministic";
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          cache_key: string;
          model: string;
          summary_json: Json;
          source?: "openai" | "deterministic";
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          cache_key?: string;
          model?: string;
          summary_json?: Json;
          source?: "openai" | "deterministic";
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_summary_cache_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      page_type:
        | "homepage"
        | "pricing"
        | "features"
        | "product"
        | "changelog"
        | "docs";
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
export type CompetitorIntelligenceSnapshot =
  Database["public"]["Tables"]["competitor_intelligence_snapshots"]["Row"];
export type ScanDebugLog =
  Database["public"]["Tables"]["scan_debug_logs"]["Row"];
export type UserProduct =
  Database["public"]["Tables"]["user_products"]["Row"];
export type ProductSnapshot =
  Database["public"]["Tables"]["product_snapshots"]["Row"];
export type ProductRecommendation =
  Database["public"]["Tables"]["product_recommendations"]["Row"];
export type UsageEvent =
  Database["public"]["Tables"]["usage_events"]["Row"];
export type PageType = Database["public"]["Enums"]["page_type"];

// Mirrors supabase/migrations. Once the Supabase project exists, regenerate with:
//   npx supabase gen types typescript --project-id <id> > types/database.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Table<Row, Insert, Relationships = []> = {
  Row: Row;
  Insert: Insert;
  Update: Partial<Insert>;
  Relationships: Relationships;
};

export type ArPlacement = "floor" | "wall";
export type ProductStatus = "draft" | "published";
export type EventType = "product_view" | "ar_open" | "whatsapp_click";

export type Database = {
  public: {
    Tables: {
      admins: Table<{ user_id: string }, { user_id: string }>;
      categories: Table<
        {
          id: string;
          name: string;
          slug: string;
          sort_order: number;
          created_at: string | null;
        },
        {
          id?: string;
          name: string;
          slug: string;
          sort_order?: number;
          created_at?: string | null;
        }
      >;
      products: Table<
        {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          category_id: string | null;
          price_cents: number | null;
          height_mm: number | null;
          width_mm: number | null;
          depth_mm: number | null;
          model_path: string | null;
          model_source_path: string | null;
          poster_path: string | null;
          ar_placement: ArPlacement;
          status: ProductStatus;
          featured: boolean;
          featured_order: number | null;
          made_to_order: boolean;
          created_at: string | null;
          updated_at: string | null;
        },
        {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          category_id?: string | null;
          price_cents?: number | null;
          height_mm?: number | null;
          width_mm?: number | null;
          depth_mm?: number | null;
          model_path?: string | null;
          model_source_path?: string | null;
          poster_path?: string | null;
          ar_placement?: ArPlacement;
          status?: ProductStatus;
          featured?: boolean;
          featured_order?: number | null;
          made_to_order?: boolean;
          created_at?: string | null;
          updated_at?: string | null;
        },
        [
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ]
      >;
      product_images: Table<
        {
          id: string;
          product_id: string;
          path: string;
          alt: string | null;
          sort_order: number;
        },
        {
          id?: string;
          product_id: string;
          path: string;
          alt?: string | null;
          sort_order?: number;
        },
        [
          {
            foreignKeyName: "product_images_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ]
      >;
      banners: Table<
        {
          id: string;
          title: string | null;
          subtitle: string | null;
          image_desktop_path: string;
          image_mobile_path: string | null;
          link_url: string | null;
          starts_at: string | null;
          ends_at: string | null;
          active: boolean;
          sort_order: number;
        },
        {
          id?: string;
          title?: string | null;
          subtitle?: string | null;
          image_desktop_path: string;
          image_mobile_path?: string | null;
          link_url?: string | null;
          starts_at?: string | null;
          ends_at?: string | null;
          active?: boolean;
          sort_order?: number;
        }
      >;
      events: Table<
        {
          id: number;
          type: EventType;
          product_id: string | null;
          created_at: string | null;
        },
        // Anonymous inserts may only set these two columns (column-level grant).
        { type: EventType; product_id?: string | null },
        [
          {
            foreignKeyName: "events_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ]
      >;
      settings: Table<
        {
          id: number;
          store_name: string;
          whatsapp_number: string | null;
          instagram_url: string | null;
          about_text: string | null;
        },
        {
          id?: number;
          store_name?: string;
          whatsapp_number?: string | null;
          instagram_url?: string | null;
          about_text?: string | null;
        }
      >;
    };
    Views: { [_ in never]: never };
    Functions: {
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
    };
    Enums: {
      ar_placement: ArPlacement;
      product_status: ProductStatus;
    };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

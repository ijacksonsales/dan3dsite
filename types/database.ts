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
export type MaterialCategory = "extra" | "packaging";
export type OrderStatus =
  "quote" | "confirmed" | "in_production" | "ready" | "delivered" | "canceled";
export type PaymentMethod = "pix" | "cash" | "card" | "other";
export type ExpenseCategory =
  "filament" | "materials" | "packaging" | "energy" | "machine" | "other";
export type QuoteRequestStatus = "new" | "answered" | "archived";

/** One piece in `quote_requests.items` (normalized by submit_quote_request). */
export interface QuoteRequestItem {
  description: string;
  quantity: number;
  height_mm: number | null;
  width_mm: number | null;
}

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
          model_usdz_path: string | null;
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
          model_usdz_path?: string | null;
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
      cost_settings: Table<
        {
          id: number;
          filament_price_per_kg_cents: number;
          energy_price_per_kwh_cents: number;
          printer_power_w: number;
          machine_price_cents: number;
          machine_life_hours: number;
          maintenance_cents: number;
          failure_percent: number;
          labor_rate_per_hour_cents: number;
          margin_percent: number;
          updated_at: string | null;
        },
        {
          id?: number;
          filament_price_per_kg_cents?: number;
          energy_price_per_kwh_cents?: number;
          printer_power_w?: number;
          machine_price_cents?: number;
          machine_life_hours?: number;
          maintenance_cents?: number;
          failure_percent?: number;
          labor_rate_per_hour_cents?: number;
          margin_percent?: number;
          updated_at?: string | null;
        }
      >;
      materials: Table<
        {
          id: string;
          name: string;
          pack_units: number;
          pack_price_cents: number;
          category: MaterialCategory;
          default_quantity: number;
          used_by_default: boolean;
          sort_order: number;
          created_at: string | null;
        },
        {
          id?: string;
          name: string;
          pack_units: number;
          pack_price_cents: number;
          category: MaterialCategory;
          default_quantity?: number;
          used_by_default?: boolean;
          sort_order?: number;
          created_at?: string | null;
        }
      >;
      product_costs: Table<
        { product_id: string; inputs: Json; updated_at: string | null },
        { product_id: string; inputs: Json; updated_at?: string | null },
        [
          {
            foreignKeyName: "product_costs_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: true;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ]
      >;
      customers: Table<
        {
          id: string;
          name: string;
          phone: string | null;
          notes: string | null;
          created_at: string | null;
        },
        {
          id?: string;
          name: string;
          phone?: string | null;
          notes?: string | null;
          created_at?: string | null;
        }
      >;
      orders: Table<
        {
          id: string;
          number: number;
          customer_id: string;
          status: OrderStatus;
          due_date: string | null;
          discount_cents: number;
          shipping_cents: number;
          notes: string | null;
          delivered_at: string | null;
          created_at: string | null;
          updated_at: string | null;
        },
        {
          id?: string;
          customer_id: string;
          status?: OrderStatus;
          due_date?: string | null;
          discount_cents?: number;
          shipping_cents?: number;
          notes?: string | null;
          delivered_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        },
        [
          {
            foreignKeyName: "orders_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ]
      >;
      order_items: Table<
        {
          id: string;
          order_id: string;
          product_id: string | null;
          description: string;
          quantity: number;
          unit_price_cents: number;
          unit_cost_cents: number | null;
          unit_pass_through_cents: number;
          cost_inputs: Json | null;
          sort_order: number;
        },
        {
          id?: string;
          order_id: string;
          product_id?: string | null;
          description: string;
          quantity: number;
          unit_price_cents: number;
          unit_cost_cents?: number | null;
          unit_pass_through_cents?: number;
          cost_inputs?: Json | null;
          sort_order?: number;
        },
        [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ]
      >;
      order_payments: Table<
        {
          id: string;
          order_id: string;
          amount_cents: number;
          paid_on: string;
          method: PaymentMethod;
          note: string | null;
          created_at: string | null;
        },
        {
          id?: string;
          order_id: string;
          amount_cents: number;
          paid_on?: string;
          method?: PaymentMethod;
          note?: string | null;
          created_at?: string | null;
        },
        [
          {
            foreignKeyName: "order_payments_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ]
      >;
      expenses: Table<
        {
          id: string;
          description: string;
          category: ExpenseCategory;
          amount_cents: number;
          due_date: string;
          paid_on: string | null;
          repeat_monthly: boolean;
          notes: string | null;
          created_at: string | null;
        },
        {
          id?: string;
          description: string;
          category?: ExpenseCategory;
          amount_cents: number;
          due_date: string;
          paid_on?: string | null;
          repeat_monthly?: boolean;
          notes?: string | null;
          created_at?: string | null;
        }
      >;
      quote_requests: Table<
        {
          id: string;
          number: number;
          name: string;
          phone: string;
          city: string | null;
          items: Json;
          needed_by: string | null;
          notes: string | null;
          product_id: string | null;
          status: QuoteRequestStatus;
          order_id: string | null;
          archived_at: string | null;
          photos_removed: boolean;
          created_at: string;
          updated_at: string | null;
        },
        {
          id?: string;
          name: string;
          phone: string;
          city?: string | null;
          items: Json;
          needed_by?: string | null;
          notes?: string | null;
          product_id?: string | null;
          status?: QuoteRequestStatus;
          order_id?: string | null;
          archived_at?: string | null;
          photos_removed?: boolean;
          created_at?: string;
          updated_at?: string | null;
        },
        [
          {
            foreignKeyName: "quote_requests_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quote_requests_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ]
      >;
    };
    Views: { [_ in never]: never };
    Functions: {
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      event_summary: {
        Args: { since: string };
        Returns: {
          product_id: string | null;
          product_views: number;
          ar_opens: number;
          whatsapp_clicks: number;
        }[];
      };
      pay_expense: {
        Args: { p_expense_id: string; p_paid_on: string };
        Returns: undefined;
      };
      finance_months: {
        Args: { p_from: string; p_to: string };
        Returns: {
          month: string;
          received_cents: number;
          expenses_paid_cents: number;
          delivered_count: number;
          delivered_revenue_cents: number;
          delivered_cost_cents: number;
          items_without_cost: number;
        }[];
      };
      finance_open: {
        Args: { p_today: string };
        Returns: {
          receivable_cents: number;
          receivable_orders: number;
          payable_cents: number;
          payable_count: number;
          overdue_cents: number;
          overdue_count: number;
        }[];
      };
      finance_top_items: {
        Args: { p_from: string; p_to: string; p_limit?: number };
        Returns: {
          description: string;
          quantity: number;
          revenue_cents: number;
        }[];
      };
      save_order: {
        Args: {
          p_order_id: string | null;
          p_customer_id: string;
          p_due_date: string | null;
          p_discount_cents: number;
          p_shipping_cents: number;
          p_notes: string | null;
          p_items: Json;
        };
        Returns: string;
      };
      submit_quote_request: {
        Args: {
          p_name: string;
          p_phone: string;
          p_city: string | null;
          p_items: Json;
          p_needed_by: string | null;
          p_notes: string | null;
          p_product_id: string | null;
        };
        Returns: { id: string; number: number }[];
      };
    };
    Enums: {
      ar_placement: ArPlacement;
      product_status: ProductStatus;
      material_category: MaterialCategory;
      order_status: OrderStatus;
      payment_method: PaymentMethod;
      expense_category: ExpenseCategory;
      quote_request_status: QuoteRequestStatus;
    };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

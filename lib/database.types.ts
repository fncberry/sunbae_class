// ⚠️ Supabase가 생성한 타입입니다(Tables·Enums 헬퍼만 남김). 직접 고치지 말고 스키마를 바꾼 뒤 다시 생성하세요.
// (Supabase MCP generate_typescript_types 또는 `npx supabase gen types typescript --project-id fhhxgnatmrnglupjlkfm`)

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      chapter_media: {
        Row: {
          asset_id: string
          chapter_id: string
          created_at: string
          playback_id: string | null
          provider: string
        }
        Insert: {
          asset_id: string
          chapter_id: string
          created_at?: string
          playback_id?: string | null
          provider: string
        }
        Update: {
          asset_id?: string
          chapter_id?: string
          created_at?: string
          playback_id?: string | null
          provider?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapter_media_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: true
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      chapter_progress: {
        Row: {
          chapter_id: string
          completed: boolean
          updated_at: string
          user_id: string
          watched_seconds: number
        }
        Insert: {
          chapter_id: string
          completed?: boolean
          updated_at?: string
          user_id: string
          watched_seconds?: number
        }
        Update: {
          chapter_id?: string
          completed?: boolean
          updated_at?: string
          user_id?: string
          watched_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "chapter_progress_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chapter_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chapters: {
        Row: {
          id: string
          is_preview: boolean
          lecture_id: string
          minutes: number
          position: number
          title: string
        }
        Insert: {
          id?: string
          is_preview?: boolean
          lecture_id: string
          minutes: number
          position: number
          title: string
        }
        Update: {
          id?: string
          is_preview?: boolean
          lecture_id?: string
          minutes?: number
          position?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapters_lecture_id_fkey"
            columns: ["lecture_id"]
            isOneToOne: false
            referencedRelation: "lectures"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          code: string | null
          created_at: string
          department: string | null
          exam_date: string
          exam_label: string
          group_name: string
          id: string
          kind: Database["public"]["Enums"]["course_kind"]
          name: string
          professor: string | null
          semester: string | null
          students: number | null
          track: Database["public"]["Enums"]["course_track"] | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          department?: string | null
          exam_date: string
          exam_label: string
          group_name: string
          id: string
          kind: Database["public"]["Enums"]["course_kind"]
          name: string
          professor?: string | null
          semester?: string | null
          students?: number | null
          track?: Database["public"]["Enums"]["course_track"] | null
        }
        Update: {
          code?: string | null
          created_at?: string
          department?: string | null
          exam_date?: string
          exam_label?: string
          group_name?: string
          id?: string
          kind?: Database["public"]["Enums"]["course_kind"]
          name?: string
          professor?: string | null
          semester?: string | null
          students?: number | null
          track?: Database["public"]["Enums"]["course_track"] | null
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          created_at: string
          lecture_id: string
          option: Database["public"]["Enums"]["purchase_option"]
          order_id: string | null
          revoked_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          lecture_id: string
          option: Database["public"]["Enums"]["purchase_option"]
          order_id?: string | null
          revoked_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          lecture_id?: string
          option?: Database["public"]["Enums"]["purchase_option"]
          order_id?: string | null
          revoked_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_lecture_id_fkey"
            columns: ["lecture_id"]
            isOneToOne: false
            referencedRelation: "lectures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      grade_verifications: {
        Row: {
          course_id: string
          grade: string
          id: string
          instructor_id: string
          proof_text: string | null
          reject_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          semester_label: string
          status: Database["public"]["Enums"]["verification_status"]
          submitted_at: string
        }
        Insert: {
          course_id: string
          grade: string
          id?: string
          instructor_id: string
          proof_text?: string | null
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          semester_label: string
          status?: Database["public"]["Enums"]["verification_status"]
          submitted_at?: string
        }
        Update: {
          course_id?: string
          grade?: string
          id?: string
          instructor_id?: string
          proof_text?: string | null
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          semester_label?: string
          status?: Database["public"]["Enums"]["verification_status"]
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grade_verifications_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade_verifications_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade_verifications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      instructors: {
        Row: {
          admission_year: number | null
          bio: string
          created_at: string
          id: string
          major: string
          name: string
          user_id: string | null
        }
        Insert: {
          admission_year?: number | null
          bio?: string
          created_at?: string
          id?: string
          major: string
          name: string
          user_id?: string | null
        }
        Update: {
          admission_year?: number | null
          bio?: string
          created_at?: string
          id?: string
          major?: string
          name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instructors_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lectures: {
        Row: {
          course_id: string
          covers: string[]
          created_at: string
          id: string
          instructor_id: string
          price: number
          rating_sum: number
          review_count: number
          sales_count: number
          status: Database["public"]["Enums"]["lecture_status"]
          study_group_capacity: number | null
          study_group_price: number | null
          study_group_taken: number
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          course_id: string
          covers?: string[]
          created_at?: string
          id: string
          instructor_id: string
          price: number
          rating_sum?: number
          review_count?: number
          sales_count?: number
          status?: Database["public"]["Enums"]["lecture_status"]
          study_group_capacity?: number | null
          study_group_price?: number | null
          study_group_taken?: number
          summary?: string
          title: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          covers?: string[]
          created_at?: string
          id?: string
          instructor_id?: string
          price?: number
          rating_sum?: number
          review_count?: number
          sales_count?: number
          status?: Database["public"]["Enums"]["lecture_status"]
          study_group_capacity?: number | null
          study_group_price?: number | null
          study_group_taken?: number
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lectures_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lectures_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          amount: number
          created_at: string
          id: string
          lecture_id: string
          option: Database["public"]["Enums"]["purchase_option"]
          paid_at: string | null
          provider: string
          provider_order_id: string | null
          refunded_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          lecture_id: string
          option: Database["public"]["Enums"]["purchase_option"]
          paid_at?: string | null
          provider?: string
          provider_order_id?: string | null
          refunded_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          lecture_id?: string
          option?: Database["public"]["Enums"]["purchase_option"]
          paid_at?: string | null
          provider?: string
          provider_order_id?: string | null
          refunded_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_lecture_id_fkey"
            columns: ["lecture_id"]
            isOneToOne: false
            referencedRelation: "lectures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          major: string | null
          name: string | null
          nickname: string | null
          onboarded_at: string | null
          role: Database["public"]["Enums"]["user_role"]
          student_id: string | null
          terms_agreed_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          major?: string | null
          name?: string | null
          nickname?: string | null
          onboarded_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          student_id?: string | null
          terms_agreed_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          major?: string | null
          name?: string | null
          nickname?: string | null
          onboarded_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          student_id?: string | null
          terms_agreed_at?: string | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          author_label: string
          body: string
          created_at: string
          id: string
          lecture_id: string
          rating: number
          user_id: string | null
        }
        Insert: {
          author_label: string
          body: string
          created_at?: string
          id?: string
          lecture_id: string
          rating: number
          user_id?: string | null
        }
        Update: {
          author_label?: string
          body?: string
          created_at?: string
          id?: string
          lecture_id?: string
          rating?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_lecture_id_fkey"
            columns: ["lecture_id"]
            isOneToOne: false
            referencedRelation: "lectures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      course_kind: "major" | "cert"
      course_track: "major" | "liberal"
      lecture_status: "draft" | "reviewing" | "on_sale" | "hidden" | "rejected"
      order_status: "pending" | "paid" | "refunded" | "cancelled"
      purchase_option: "video" | "study"
      user_role: "student" | "instructor" | "admin"
      verification_status: "pending" | "approved" | "rejected"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

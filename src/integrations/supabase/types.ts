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
      ad_config: {
        Row: {
          ads_enabled: boolean
          feed_ad_frequency: number
          id: number
        }
        Insert: {
          ads_enabled?: boolean
          feed_ad_frequency?: number
          id?: number
        }
        Update: {
          ads_enabled?: boolean
          feed_ad_frequency?: number
          id?: number
        }
        Relationships: []
      }
      ads: {
        Row: {
          clicks: number
          created_at: string
          cta_link: string | null
          cta_text: string
          id: string
          image_url: string | null
          impressions: number
          is_active: boolean
          title: string
          video_bunny_id: string | null
        }
        Insert: {
          clicks?: number
          created_at?: string
          cta_link?: string | null
          cta_text?: string
          id?: string
          image_url?: string | null
          impressions?: number
          is_active?: boolean
          title: string
          video_bunny_id?: string | null
        }
        Update: {
          clicks?: number
          created_at?: string
          cta_link?: string | null
          cta_text?: string
          id?: string
          image_url?: string | null
          impressions?: number
          is_active?: boolean
          title?: string
          video_bunny_id?: string | null
        }
        Relationships: []
      }
      comments: {
        Row: {
          created_at: string
          id: string
          text: string
          user_id: string
          video_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          text: string
          user_id: string
          video_id: string
        }
        Update: {
          created_at?: string
          id?: string
          text?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          contact_user_id: string
          created_at: string
          id: string
          name: string
          owner_id: string
          phone: string
        }
        Insert: {
          contact_user_id: string
          created_at?: string
          id?: string
          name: string
          owner_id: string
          phone: string
        }
        Update: {
          contact_user_id?: string
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          phone?: string
        }
        Relationships: []
      }
      conversation_members: {
        Row: {
          conversation_id: string
          last_read_at: string
          typing_at: string | null
          unread: number
          user_id: string
        }
        Insert: {
          conversation_id: string
          last_read_at?: string
          typing_at?: string | null
          unread?: number
          user_id: string
        }
        Update: {
          conversation_id?: string
          last_read_at?: string
          typing_at?: string | null
          unread?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_members_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          last_at: string
          last_message: string
        }
        Insert: {
          created_at?: string
          id: string
          last_at?: string
          last_message?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_at?: string
          last_message?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
        }
        Relationships: []
      }
      likes: {
        Row: {
          created_at: string
          user_id: string
          video_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
          video_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          audio_url: string | null
          conversation_id: string
          created_at: string
          file_name: string | null
          file_url: string | null
          id: string
          image_url: string | null
          sender_id: string
          text: string
          video_row_id: string | null
          video_share_id: string | null
        }
        Insert: {
          audio_url?: string | null
          conversation_id: string
          created_at?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          image_url?: string | null
          sender_id: string
          text?: string
          video_row_id?: string | null
          video_share_id?: string | null
        }
        Update: {
          audio_url?: string | null
          conversation_id?: string
          created_at?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          image_url?: string | null
          sender_id?: string
          text?: string
          video_row_id?: string | null
          video_share_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          followers_count: number
          following_count: number
          id: string
          likes_count: number
          username: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          followers_count?: number
          following_count?: number
          id: string
          likes_count?: number
          username: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          followers_count?: number
          following_count?: number
          id?: string
          likes_count?: number
          username?: string
        }
        Relationships: []
      }
      trending_config: {
        Row: {
          boost_hashtags: string[]
          id: number
          trending_enabled: boolean
        }
        Insert: {
          boost_hashtags?: string[]
          id?: number
          trending_enabled?: boolean
        }
        Update: {
          boost_hashtags?: string[]
          id?: number
          trending_enabled?: boolean
        }
        Relationships: []
      }
      user_phones: {
        Row: {
          created_at: string
          phone: string
          user_id: string
        }
        Insert: {
          created_at?: string
          phone: string
          user_id: string
        }
        Update: {
          created_at?: string
          phone?: string
          user_id?: string
        }
        Relationships: []
      }
      video_views: {
        Row: {
          created_at: string
          id: string
          user_id: string | null
          video_id: string
          watch_duration: number
          watched_percent: number
        }
        Insert: {
          created_at?: string
          id?: string
          user_id?: string | null
          video_id: string
          watch_duration?: number
          watched_percent?: number
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string | null
          video_id?: string
          watch_duration?: number
          watched_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "video_views_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      videos: {
        Row: {
          allow_comments: boolean
          allow_duet: boolean
          avg_watch_percent: number
          boost_until: string | null
          bunny_cdn_url: string
          bunny_video_id: string
          caption: string
          comments_count: number
          completion_rate: number
          created_at: string
          hashtags: string[]
          id: string
          is_trending: boolean
          likes_count: number
          location: string | null
          saves_count: number
          shares_count: number
          thumbnail_url: string | null
          trending_score: number
          user_id: string
          views_count: number
          visibility: string
          watch_time_total: number
        }
        Insert: {
          allow_comments?: boolean
          allow_duet?: boolean
          avg_watch_percent?: number
          boost_until?: string | null
          bunny_cdn_url: string
          bunny_video_id: string
          caption?: string
          comments_count?: number
          completion_rate?: number
          created_at?: string
          hashtags?: string[]
          id?: string
          is_trending?: boolean
          likes_count?: number
          location?: string | null
          saves_count?: number
          shares_count?: number
          thumbnail_url?: string | null
          trending_score?: number
          user_id: string
          views_count?: number
          visibility?: string
          watch_time_total?: number
        }
        Update: {
          allow_comments?: boolean
          allow_duet?: boolean
          avg_watch_percent?: number
          boost_until?: string | null
          bunny_cdn_url?: string
          bunny_video_id?: string
          caption?: string
          comments_count?: number
          completion_rate?: number
          created_at?: string
          hashtags?: string[]
          id?: string
          is_trending?: boolean
          likes_count?: number
          location?: string | null
          saves_count?: number
          shares_count?: number
          thumbnail_url?: string | null
          trending_score?: number
          user_id?: string
          views_count?: number
          visibility?: string
          watch_time_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "videos_user_id_fkey"
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
      boost_video: { Args: { _video_id: string }; Returns: undefined }
      find_user_by_phone: { Args: { _phone: string }; Returns: string }
      is_member: { Args: { _cid: string }; Returns: boolean }
      mark_read: { Args: { _cid: string }; Returns: undefined }
      recalc_all_trending: { Args: never; Returns: undefined }
      recalc_trending: { Args: { _video_id: string }; Returns: undefined }
      record_share: { Args: { _video_id: string }; Returns: undefined }
      record_view: {
        Args: {
          _video_id: string
          _watch_duration: number
          _watched_percent: number
        }
        Returns: undefined
      }
      set_typing: { Args: { _cid: string; _on: boolean }; Returns: undefined }
      start_conversation: { Args: { _other: string }; Returns: string }
      track_ad: { Args: { _ad_id: string; _kind: string }; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
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

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
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

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

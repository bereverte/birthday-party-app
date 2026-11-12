
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "challenges": {
                  Row: {
                    "description": string | null,"emoji": string,"id": string,"name": string,"position": number,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "description"?: string | null,"emoji"?: string,"id"?: string,"name": string,"position": number,"status"?: string
                  }
                  Update: {
                    "description"?: string | null,"emoji"?: string,"id"?: string,"name"?: string,"position"?: number,"status"?: string
                  }
                  Relationships: [
                    
                  ]
                },"hosts": {
                  Row: {
                    "user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "user_id": string
                  }
                  Update: {
                    "user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"party_state": {
                  Row: {
                    "current_act_id": string | null,"current_challenge_id": string | null,"current_question_id": string | null,"id": number,"phase": string,"question_closes_at": string | null,"question_opened_at": string | null,"question_status": string,"quiz_podium": boolean,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "current_act_id"?: string | null,"current_challenge_id"?: string | null,"current_question_id"?: string | null,"id"?: number,"phase"?: string,"question_closes_at"?: string | null,"question_opened_at"?: string | null,"question_status"?: string,"quiz_podium"?: boolean,"updated_at"?: string
                  }
                  Update: {
                    "current_act_id"?: string | null,"current_challenge_id"?: string | null,"current_question_id"?: string | null,"id"?: number,"phase"?: string,"question_closes_at"?: string | null,"question_opened_at"?: string | null,"question_status"?: string,"quiz_podium"?: boolean,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "party_state_current_act_id_fkey"
      columns: ["current_act_id"]
isOneToOne: false
      referencedRelation: "show_acts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "party_state_current_challenge_id_fkey"
      columns: ["current_challenge_id"]
isOneToOne: false
      referencedRelation: "challenges"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "party_state_current_question_id_fkey"
      columns: ["current_question_id"]
isOneToOne: false
      referencedRelation: "quiz_questions"
      referencedColumns: ["id"]
    }
                  ]
                },"players": {
                  Row: {
                    "created_at": string,"emoji": string,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"emoji": string,"id": string,"name": string
                  }
                  Update: {
                    "created_at"?: string,"emoji"?: string,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"points_ledger": {
                  Row: {
                    "created_at": string,"id": string,"player_id": string,"points": number,"source_id": string,"source_type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"player_id": string,"points": number,"source_id": string,"source_type": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"player_id"?: string,"points"?: number,"source_id"?: string,"source_type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "points_ledger_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "leaderboard"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "points_ledger_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "points_ledger_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "quiz_leaderboard"
      referencedColumns: ["player_id"]
    }
                  ]
                },"quiz_answers": {
                  Row: {
                    "answered_at": string,"number_value": number | null,"option_id": string | null,"option_ids": (string)[] | null,"player_id": string,"question_id": string,"text_value": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "answered_at"?: string,"number_value"?: number | null,"option_id"?: string | null,"option_ids"?: (string)[] | null,"player_id": string,"question_id": string,"text_value"?: string | null
                  }
                  Update: {
                    "answered_at"?: string,"number_value"?: number | null,"option_id"?: string | null,"option_ids"?: (string)[] | null,"player_id"?: string,"question_id"?: string,"text_value"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "quiz_answers_option_id_question_id_fkey"
      columns: ["option_id","question_id"]
isOneToOne: false
      referencedRelation: "quiz_options"
      referencedColumns: ["id","question_id"]
    },{
      foreignKeyName: "quiz_answers_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "leaderboard"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "quiz_answers_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quiz_answers_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "quiz_leaderboard"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "quiz_answers_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "quiz_questions"
      referencedColumns: ["id"]
    }
                  ]
                },"quiz_keys": {
                  Row: {
                    "correct_option_id": string,"question_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "correct_option_id": string,"question_id": string
                  }
                  Update: {
                    "correct_option_id"?: string,"question_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "quiz_keys_correct_option_id_question_id_fkey"
      columns: ["correct_option_id","question_id"]
isOneToOne: false
      referencedRelation: "quiz_options"
      referencedColumns: ["id","question_id"]
    },{
      foreignKeyName: "quiz_keys_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "quiz_questions"
      referencedColumns: ["id"]
    }
                  ]
                },"quiz_number_keys": {
                  Row: {
                    "question_id": string,"value": number
                  }
                  ComputedFields: never
                  Insert: {
                    "question_id": string,"value": number
                  }
                  Update: {
                    "question_id"?: string,"value"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "quiz_number_keys_question_id_fkey"
      columns: ["question_id"]
isOneToOne: true
      referencedRelation: "quiz_questions"
      referencedColumns: ["id"]
    }
                  ]
                },"quiz_options": {
                  Row: {
                    "id": string,"position": number,"question_id": string,"text": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"position": number,"question_id": string,"text": string
                  }
                  Update: {
                    "id"?: string,"position"?: number,"question_id"?: string,"text"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "quiz_options_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "quiz_questions"
      referencedColumns: ["id"]
    }
                  ]
                },"quiz_questions": {
                  Row: {
                    "id": string,"image_url": string | null,"kind": string,"number_max": number | null,"number_tolerance": number,"position": number,"text": string,"time_limit_s": number
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"image_url"?: string | null,"kind"?: string,"number_max"?: number | null,"number_tolerance"?: number,"position": number,"text": string,"time_limit_s"?: number
                  }
                  Update: {
                    "id"?: string,"image_url"?: string | null,"kind"?: string,"number_max"?: number | null,"number_tolerance"?: number,"position"?: number,"text"?: string,"time_limit_s"?: number
                  }
                  Relationships: [
                    
                  ]
                },"quiz_reveal_images": {
                  Row: {
                    "image_url": string,"question_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "image_url": string,"question_id": string
                  }
                  Update: {
                    "image_url"?: string,"question_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "quiz_reveal_images_question_id_fkey"
      columns: ["question_id"]
isOneToOne: true
      referencedRelation: "quiz_questions"
      referencedColumns: ["id"]
    }
                  ]
                },"quiz_text_keys": {
                  Row: {
                    "answer": string,"credit": number,"position": number,"question_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "answer": string,"credit"?: number,"position": number,"question_id": string
                  }
                  Update: {
                    "answer"?: string,"credit"?: number,"position"?: number,"question_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "quiz_text_keys_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "quiz_questions"
      referencedColumns: ["id"]
    }
                  ]
                },"scoring_config": {
                  Row: {
                    "challenge_presets": (number)[],"id": number,"quiz_correct_points": number,"quiz_max_speed_bonus": number,"show_points_per_star": number
                  }
                  ComputedFields: never
                  Insert: {
                    "challenge_presets": (number)[],"id"?: number,"quiz_correct_points": number,"quiz_max_speed_bonus": number,"show_points_per_star": number
                  }
                  Update: {
                    "challenge_presets"?: (number)[],"id"?: number,"quiz_correct_points"?: number,"quiz_max_speed_bonus"?: number,"show_points_per_star"?: number
                  }
                  Relationships: [
                    
                  ]
                },"show_act_members": {
                  Row: {
                    "act_id": string,"player_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "act_id": string,"player_id": string
                  }
                  Update: {
                    "act_id"?: string,"player_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "show_act_members_act_id_fkey"
      columns: ["act_id"]
isOneToOne: false
      referencedRelation: "show_acts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "show_act_members_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "leaderboard"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "show_act_members_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "show_act_members_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "quiz_leaderboard"
      referencedColumns: ["player_id"]
    }
                  ]
                },"show_acts": {
                  Row: {
                    "created_at": string,"created_by": string,"id": string,"position": number | null,"status": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by": string,"id"?: string,"position"?: number | null,"status"?: string,"title": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"id"?: string,"position"?: number | null,"status"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "show_acts_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "leaderboard"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "show_acts_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "show_acts_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "quiz_leaderboard"
      referencedColumns: ["player_id"]
    }
                  ]
                },"show_votes": {
                  Row: {
                    "act_id": string,"score": number,"voted_at": string,"voter_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "act_id": string,"score": number,"voted_at"?: string,"voter_id": string
                  }
                  Update: {
                    "act_id"?: string,"score"?: number,"voted_at"?: string,"voter_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "show_votes_act_id_fkey"
      columns: ["act_id"]
isOneToOne: false
      referencedRelation: "show_acts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "show_votes_voter_id_fkey"
      columns: ["voter_id"]
isOneToOne: false
      referencedRelation: "leaderboard"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "show_votes_voter_id_fkey"
      columns: ["voter_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "show_votes_voter_id_fkey"
      columns: ["voter_id"]
isOneToOne: false
      referencedRelation: "quiz_leaderboard"
      referencedColumns: ["player_id"]
    }
                  ]
                }
          }
          Views: {
            "leaderboard": {
                  Row: {
                    "emoji": string,"name": string,"player_id": string,"rank": number | null,"total": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"quiz_leaderboard": {
                  Row: {
                    "emoji": string,"name": string,"player_id": string,"rank": number | null,"total": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "act_has_points":
{ Args: { "p_act_id": string }; Returns: boolean
                           },
"assert_can_answer":
{ Args: { "p_kind": string,"p_question_id": string }; Returns: {
              "id": string,
"image_url": string | null,
"kind": string,
"number_max": number | null,
"number_tolerance": number,
"position": number,
"text": string,
"time_limit_s": number
            }
                          SetofOptions: {
        from: "*"
        to: "quiz_questions"
        isOneToOne: true
        isSetofReturn: false
      } },
"award_challenge_points":
{ Args: { "p_challenge_id": string,"p_player_ids": (string)[],"p_points": number }; Returns: number
                           },
"cast_vote":
{ Args: { "p_act_id": string,"p_score": number }; Returns: undefined
                           },
"challenge_has_points":
{ Args: { "p_challenge_id": string }; Returns: boolean
                           },
"close_question":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"close_voting":
{ Args: { "p_act_id": string }; Returns: undefined
                           },
"finish_challenge":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"is_host":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"join_party":
{ Args: { "p_emoji": string,"p_name": string }; Returns: {
              "created_at": string,
"emoji": string,
"id": string,
"name": string
            }
                          SetofOptions: {
        from: "*"
        to: "players"
        isOneToOne: true
        isSetofReturn: false
      } },
"normalize_answer":
{ Args: { "p_text": string }; Returns: string
                           },
"open_question":
{ Args: { "p_question_id": string }; Returns: undefined
                           },
"open_voting":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"player_has_activity":
{ Args: { "p_player_id": string }; Returns: boolean
                           },
"reveal_question":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"server_now":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"sign_up_act":
{ Args: { "p_member_ids": (string)[],"p_title": string }; Returns: string
                           },
"start_act":
{ Args: { "p_act_id": string }; Returns: undefined
                           },
"start_challenge":
{ Args: { "p_challenge_id": string }; Returns: undefined
                           },
"submit_answer":
{ Args: { "p_option_id": string,"p_question_id": string }; Returns: undefined
                           },
"submit_multi_answer":
{ Args: { "p_option_ids": (string)[],"p_question_id": string }; Returns: undefined
                           },
"submit_number_answer":
{ Args: { "p_question_id": string,"p_value": number }; Returns: undefined
                           },
"submit_text_answer":
{ Args: { "p_question_id": string,"p_text": string }; Returns: undefined
                           },
"withdraw_act":
{ Args: { "p_act_id": string }; Returns: undefined
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const

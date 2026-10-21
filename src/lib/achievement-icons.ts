import { Award, CircleDot, Crown, Flame, Handshake, Medal, Repeat, RotateCcw, Sparkles, Star, Swords, Target, TrendingUp, Trophy, Users, Zap, type LucideIcon } from "lucide-react";

export const ACHIEVEMENT_ICONS: Record<string, LucideIcon> = { sparkles: Sparkles, star: Star, repeat: Repeat, target: Target, medal: Medal, award: Award, zap: Zap, flame: Flame, "circle-dot": CircleDot, "rotate-ccw": RotateCcw, swords: Swords, handshake: Handshake, users: Users, "trending-up": TrendingUp, crown: Crown, trophy: Trophy };

// Badge colors by tier: [background, text].
export const TIER_COLORS = { bronze: ["#f17e62", "#2e1a16"], silver: ["#8cc9df", "#1b211e"], gold: ["#d8f24e", "#1b211e"] } as const;

"use client";

import { useEffect, useState } from "react";
import { Award, Lock } from "lucide-react";
import { ACHIEVEMENT_ICONS } from "@/lib/achievement-icons";
import { BragButton } from "@/components/brag-button";

type Achievement = { id: string; name: string; description: string; icon: string; tier: "bronze" | "silver" | "gold"; unlocked: boolean; unlockedAt: string | null; progress: { current: number; target: number } };

const TIER_STYLES: Record<Achievement["tier"], string> = { bronze: "bg-[#f17e62] text-[#2e1a16]", silver: "bg-[#8cc9df] text-[#1b211e]", gold: "bg-[#d8f24e] text-[#1b211e]" };

/** Badge grid, earned first. Omit userId for the signed-in player. */
export function AchievementsPanel({ userId }: { userId?: string }) {
  const [achievements, setAchievements] = useState<Achievement[]>([]);

  useEffect(() => {
    fetch(userId ? `/api/achievements?userId=${encodeURIComponent(userId)}` : "/api/achievements").then((response) => response.ok ? response.json() : null).then((achievementData) => { if (achievementData?.achievements) setAchievements(achievementData.achievements); });
  }, [userId]);

  if (achievements.length === 0) return null;
  return (
    <section className="mt-5 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2"><Award size={17} className="text-[var(--lime-deep)]" /><h2 className="font-extrabold">Achievements</h2></div>
        <p className="text-xs font-bold text-[var(--ink-soft)]">{achievements.filter((achievement) => achievement.unlocked).length} of {achievements.length} earned</p>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {[...achievements].sort((a, b) => Number(b.unlocked) - Number(a.unlocked)).map((achievement) => {
          const Icon = ACHIEVEMENT_ICONS[achievement.icon] ?? Award;
          const percent = Math.round((achievement.progress.current / achievement.progress.target) * 100);
          return (
            <div key={achievement.id} title={achievement.description} className={`rounded-2xl border p-4 ${achievement.unlocked ? "border-[var(--line)] bg-[#131f19]" : "border-dashed border-[var(--line)] opacity-60"}`}>
              <span className={`grid h-10 w-10 place-items-center rounded-full ${achievement.unlocked ? TIER_STYLES[achievement.tier] : "bg-[#1c2a1a] text-[var(--ink-soft)]"}`}>{achievement.unlocked ? <Icon size={18} /> : <Lock size={16} />}</span>
              <p className="mt-3 text-sm font-extrabold">{achievement.name}</p>
              <p className="mt-1 text-xs leading-5 text-[var(--ink-soft)]">{achievement.description}</p>
              {achievement.unlocked ? (
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[var(--lime-deep)]">{achievement.unlockedAt ? `Earned ${new Date(achievement.unlockedAt).toLocaleDateString()}` : "Earned"}</p>
                  {!userId && <BragButton card={{ kind: "achievement", achievementId: achievement.id }} label={`Share ${achievement.name}`} compact />}
                </div>
              ) : achievement.progress.target > 1 && (
                <div className="mt-3">
                  <div className="h-1.5 overflow-hidden rounded-full bg-[#1c2a1a]"><div className="h-full rounded-full bg-[var(--lime)]" style={{ width: `${percent}%` }} /></div>
                  <p className="mt-1 text-[10px] font-bold text-[var(--ink-soft)]">{achievement.progress.current} / {achievement.progress.target}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

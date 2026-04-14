"use client";

import { useState, useEffect, useTransition } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Lock, Globe, Save, Loader2, Check } from "lucide-react";
import { getProfile, updateProfile, updatePassword } from "@/actions/settings";
import { SUPPORTED_CURRENCIES, DATE_FORMATS } from "@/lib/constants";
import { getUserStats } from "@/actions/gamification";
import { LevelBadge } from "@/components/dashboard/level-badge";
import { StreakBadge } from "@/components/dashboard/streak-badge";
import { toast } from "sonner";

type Tab = "profile" | "security" | "preferences";

export default function SettingsPage() {
  const { data: session, update: updateSession } = useSession();
  const user = session?.user;
  const [tab, setTab] = useState<Tab>("profile");
  const [pending, startTransition] = useTransition();

  // Profile state
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [dateFormat, setDateFormat] = useState("MM/DD/YYYY");
  const [hasPassword, setHasPassword] = useState(false);

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Gamification state
  const [stats, setStats] = useState<{ xp: number; level: number; streak: number; unlockedCount: number; totalAchievements: number } | null>(null);

  useEffect(() => {
    getProfile().then((profile) => {
      setName(profile.name || "");
      setCurrency(profile.currency);
      setDateFormat(profile.dateFormat);
      setHasPassword(profile.hasPassword);
    });
    getUserStats().then((s) => setStats(s));
  }, []);

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : "U";

  const handleSaveProfile = () => {
    startTransition(async () => {
      try {
        await updateProfile({
          name,
          currency: currency as (typeof SUPPORTED_CURRENCIES)[number],
          dateFormat: dateFormat as (typeof DATE_FORMATS)[number],
        });
        await updateSession({ trigger: "update" });
        toast.success("Profile updated");
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Failed to update profile");
      }
    });
  };

  const handleChangePassword = () => {
    startTransition(async () => {
      try {
        await updatePassword({ currentPassword, newPassword, confirmPassword });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setHasPassword(true);
        toast.success("Password updated");
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Failed to update password");
      }
    });
  };

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "profile", label: "Profile", icon: <User className="w-4 h-4" /> },
    { key: "security", label: "Security", icon: <Lock className="w-4 h-4" /> },
    { key: "preferences", label: "Preferences", icon: <Globe className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">Manage your account preferences</p>
      </div>

      {/* Gamification Stats */}
      {stats && (
        <Card className="bg-gradient-to-r from-emerald-50 via-blue-50 to-purple-50 dark:from-emerald-950/30 dark:via-blue-950/30 dark:to-purple-950/30 border-emerald-200/50 dark:border-emerald-800/30">
          <CardContent className="py-3">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <LevelBadge xp={stats.xp} level={stats.level} />
              </div>
              <StreakBadge streak={stats.streak} />
              <Badge variant="secondary" className="gap-1">
                🏆 {stats.unlockedCount}/{stats.totalAchievements}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab navigation */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors flex-1 justify-center ${
              tab === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {tab === "profile" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profile Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 mb-4">
              <Avatar className="w-16 h-16">
                <AvatarImage src={user?.image || ""} />
                <AvatarFallback className="bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-lg font-semibold">{initials}</AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold text-lg">{name || "User"}</h3>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>
            <Separator />
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={user?.email || ""} disabled className="bg-muted" />
                <p className="text-xs text-muted-foreground">Email cannot be changed</p>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={handleSaveProfile} disabled={pending} className="gap-2">
                {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Changes
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Security Tab */}
      {tab === "security" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{hasPassword ? "Change Password" : "Set Password"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasPassword && (
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input id="currentPassword" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 8 characters" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={handleChangePassword} disabled={pending || !newPassword} className="gap-2">
                {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {hasPassword ? "Update Password" : "Set Password"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preferences Tab */}
      {tab === "preferences" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Display Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={(v) => v && setCurrency(v)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Default currency for all amounts</p>
            </div>
            <div className="space-y-2">
              <Label>Date Format</Label>
              <Select value={dateFormat} onValueChange={(v) => v && setDateFormat(v)}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATE_FORMATS.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Separator />
            <div className="flex justify-end pt-2">
              <Button onClick={handleSaveProfile} disabled={pending} className="gap-2">
                {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Preferences
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* App info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">About</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">MoneyTracker</p>
            <Badge variant="outline">v1.0.0</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

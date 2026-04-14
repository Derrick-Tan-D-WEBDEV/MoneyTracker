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
import { User, Lock, Globe, Save, Loader2, Check, Heart, Copy, Link2, Unlink } from "lucide-react";
import { getProfile, updateProfile, updatePassword } from "@/actions/settings";
import { getCoupleLink, createInviteLink, acceptInviteLink, unlinkPartner } from "@/actions/couple";
import { SUPPORTED_CURRENCIES, DATE_FORMATS } from "@/lib/constants";
import { getUserStats } from "@/actions/gamification";
import { LevelBadge } from "@/components/dashboard/level-badge";
import { StreakBadge } from "@/components/dashboard/streak-badge";
import { toast } from "sonner";

type Tab = "profile" | "security" | "preferences" | "couple";

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

  // Couple link state
  const [coupleLink, setCoupleLink] = useState<{
    id: string;
    status: string;
    inviteCode: string | null;
    partner: { id: string; name: string | null; email: string | null; image: string | null } | null;
    isInitiator: boolean;
    createdAt: string;
    acceptedAt: string | null;
  } | null>(null);
  const [inviteInput, setInviteInput] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    getProfile().then((profile) => {
      setName(profile.name || "");
      setCurrency(profile.currency);
      setDateFormat(profile.dateFormat);
      setHasPassword(profile.hasPassword);
    });
    getUserStats().then((s) => setStats(s));
    getCoupleLink().then((link) => setCoupleLink(link));
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

  const handleCreateInvite = () => {
    startTransition(async () => {
      try {
        const result = await createInviteLink();
        setCoupleLink({
          id: "",
          status: "PENDING",
          inviteCode: result.inviteCode,
          partner: null,
          isInitiator: true,
          createdAt: new Date().toISOString(),
          acceptedAt: null,
        });
        toast.success("Invite code created!");
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Failed to create invite");
      }
    });
  };

  const handleAcceptInvite = () => {
    if (!inviteInput.trim()) return;
    startTransition(async () => {
      try {
        await acceptInviteLink(inviteInput.trim().toUpperCase());
        const link = await getCoupleLink();
        setCoupleLink(link);
        setInviteInput("");
        toast.success("Couple linked successfully! 💕");
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Failed to accept invite");
      }
    });
  };

  const handleUnlink = () => {
    startTransition(async () => {
      try {
        await unlinkPartner();
        setCoupleLink(null);
        toast.success("Couple link removed");
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Failed to unlink");
      }
    });
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "profile", label: "Profile", icon: <User className="w-4 h-4" /> },
    { key: "security", label: "Security", icon: <Lock className="w-4 h-4" /> },
    { key: "preferences", label: "Preferences", icon: <Globe className="w-4 h-4" /> },
    { key: "couple", label: "Couple", icon: <Heart className="w-4 h-4" /> },
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

      {/* Couple Tab */}
      {tab === "couple" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Heart className="w-4 h-4 text-pink-500" />
              Couple Linking
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {coupleLink?.status === "ACCEPTED" && coupleLink.partner ? (
              // Active couple link
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 bg-pink-50 dark:bg-pink-950/20 rounded-lg border border-pink-200 dark:border-pink-800/30">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={coupleLink.partner.image || ""} />
                    <AvatarFallback className="bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-400 font-semibold">{coupleLink.partner.name?.[0]?.toUpperCase() || "P"}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">{coupleLink.partner.name || "Partner"}</p>
                    <p className="text-sm text-muted-foreground">{coupleLink.partner.email}</p>
                    <p className="text-xs text-pink-600 dark:text-pink-400 mt-1">💕 Linked {coupleLink.acceptedAt ? new Date(coupleLink.acceptedAt).toLocaleDateString() : ""}</p>
                  </div>
                  <Badge className="bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-400 border-0">Active</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  You can view each other&apos;s financial dashboard. Visit the{" "}
                  <a href="/partner" className="text-pink-600 dark:text-pink-400 underline font-medium">
                    Partner Dashboard
                  </a>{" "}
                  to see their finances.
                </p>
                <Separator />
                <div className="flex justify-end">
                  <Button variant="destructive" size="sm" onClick={handleUnlink} disabled={pending} className="gap-2">
                    {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
                    Unlink Partner
                  </Button>
                </div>
              </div>
            ) : coupleLink?.status === "PENDING" && coupleLink.inviteCode ? (
              // Pending invite (I created it)
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Share this invite code with your partner. They can enter it in their Settings → Couple tab.</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-muted p-3 rounded-lg font-mono text-lg text-center tracking-widest">{coupleLink.inviteCode}</div>
                  <Button variant="outline" size="icon" onClick={() => handleCopyCode(coupleLink.inviteCode!)} className="shrink-0">
                    {copiedCode ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Waiting for partner to accept...</p>
                <Separator />
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" onClick={handleUnlink} disabled={pending} className="gap-2 text-destructive">
                    Cancel Invite
                  </Button>
                </div>
              </div>
            ) : (
              // No link — show options to create or accept
              <div className="space-y-6">
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Create an Invite</h4>
                  <p className="text-sm text-muted-foreground">Generate a code to share with your partner. Once they accept, you&apos;ll both be able to view each other&apos;s finances.</p>
                  <Button onClick={handleCreateInvite} disabled={pending} className="gap-2">
                    {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                    Generate Invite Code
                  </Button>
                </div>
                <Separator />
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Accept an Invite</h4>
                  <p className="text-sm text-muted-foreground">Enter the invite code your partner shared with you.</p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter code e.g. A1B2C3D4"
                      value={inviteInput}
                      onChange={(e) => setInviteInput(e.target.value.toUpperCase())}
                      className="font-mono tracking-widest"
                      maxLength={8}
                    />
                    <Button onClick={handleAcceptInvite} disabled={pending || !inviteInput.trim()} className="gap-2">
                      {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Heart className="w-4 h-4" />}
                      Link
                    </Button>
                  </div>
                </div>
              </div>
            )}
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

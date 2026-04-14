export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-emerald-50 dark:from-background dark:via-background dark:to-background">
      <div className="w-full max-w-md px-4">{children}</div>
    </div>
  );
}

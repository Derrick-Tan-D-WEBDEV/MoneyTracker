"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, CalendarDays, Landmark, CreditCard, Repeat, Receipt } from "lucide-react";
import { getBillCalendarData, type CalendarEvent } from "@/actions/calendar";
import { currencyFormatter } from "@/lib/format";
import { convertCurrency } from "@/lib/exchange-rates";
import type { RateMap } from "@/lib/exchange-rates";
import { useSession } from "next-auth/react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TYPE_ICONS = {
  debt: Landmark,
  installment: CreditCard,
  recurring: Repeat,
  subscription: Receipt,
};
const TYPE_LABELS = {
  debt: "Debt Payment",
  installment: "Installment",
  recurring: "Recurring",
  subscription: "Subscription",
};

export function CalendarClient() {
  const { data: session } = useSession();
  const userCurrency = session?.user?.currency || "USD";
  const formatCurrency = currencyFormatter(userCurrency);

  const [month, setMonth] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [rates, setRates] = useState<RateMap>({});
  const [serverCurrency, setServerCurrency] = useState<string>("SGD");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getBillCalendarData(month, year)
      .then((data) => {
        setEvents(data.events);
        setRates(data.rates);
        setServerCurrency(data.userCurrency);
      })
      .finally(() => setLoading(false));
  }, [month, year]);

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear(year - 1);
    } else setMonth(month - 1);
  };
  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear(year + 1);
    } else setMonth(month + 1);
  };

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const today = new Date();
  const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;

  // Group events by day
  const eventsByDay = new Map<number, CalendarEvent[]>();
  for (const event of events) {
    const day = new Date(event.date).getDate();
    if (!eventsByDay.has(day)) eventsByDay.set(day, []);
    eventsByDay.get(day)!.push(event);
  }

  const convertToUser = (amount: number, currency: string) =>
    convertCurrency(amount, currency, serverCurrency, rates);
  const totalMonthly = events.reduce((s, e) => s + convertToUser(e.amount, e.currency), 0);
  const upcomingEvents = events.filter((e) => {
    const d = new Date(e.date);
    return isCurrentMonth ? d.getDate() >= today.getDate() : true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bill Calendar</h1>
          <p className="text-muted-foreground">Track upcoming bills and payments</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Total This Month</p>
            <p className="text-2xl font-bold">{formatCurrency(totalMonthly)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Upcoming Bills</p>
            <p className="text-2xl font-bold">{upcomingEvents.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Remaining Due</p>
            <p className="text-2xl font-bold">{formatCurrency(upcomingEvents.reduce((s, e) => s + convertToUser(e.amount, e.currency), 0))}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Calendar Grid */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={prevMonth}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <CardTitle className="text-base">{new Date(year, month).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</CardTitle>
              <Button variant="ghost" size="icon" onClick={nextMonth}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setMonth(today.getMonth());
                setYear(today.getFullYear());
              }}
            >
              Today
            </Button>
          </CardHeader>
          <CardContent>
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-px mb-1">
              {DAYS.map((d) => (
                <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">
                  {d}
                </div>
              ))}
            </div>
            {/* Calendar cells */}
            <div className="grid grid-cols-7 gap-px">
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} className="min-h-[80px] bg-muted/20 rounded-lg" />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const dayEvents = eventsByDay.get(day) || [];
                const isToday = isCurrentMonth && day === today.getDate();
                const isPast = isCurrentMonth && day < today.getDate();
                return (
                  <div key={day} className={`min-h-[80px] rounded-lg p-1 border ${isToday ? "border-emerald-500 bg-emerald-500/5" : isPast ? "bg-muted/30 border-transparent" : "border-transparent"}`}>
                    <div className={`text-xs font-medium ${isToday ? "text-emerald-600" : isPast ? "text-muted-foreground/50" : "text-foreground"}`}>{day}</div>
                    <div className="space-y-0.5 mt-0.5">
                      {dayEvents.slice(0, 3).map((e) => (
                        <div key={e.id} className="text-[10px] truncate rounded px-1 py-0.5" style={{ backgroundColor: e.color + "20", color: e.color }}>
                          {e.name}
                        </div>
                      ))}
                      {dayEvents.length > 3 && <div className="text-[10px] text-muted-foreground px-1">+{dayEvents.length - 3} more</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Bills List */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Upcoming Bills</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Loading...</p>
            ) : upcomingEvents.length === 0 ? (
              <div className="text-center py-8">
                <CalendarDays className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No upcoming bills</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingEvents.map((event) => {
                  const Icon = TYPE_ICONS[event.type];
                  return (
                    <div key={event.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: event.color + "20" }}>
                        <Icon className="w-4 h-4" style={{ color: event.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{event.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(event.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {TYPE_LABELS[event.type]}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold tabular-nums">{currencyFormatter(event.currency)(event.amount)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4">
        {Object.entries(TYPE_LABELS).map(([type, label]) => {
          const Icon = TYPE_ICONS[type as keyof typeof TYPE_ICONS];
          const colors = { debt: "#EF4444", installment: "#F59E0B", recurring: "#8B5CF6", subscription: "#8B5CF6" };
          return (
            <div key={type} className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon className="w-3.5 h-3.5" style={{ color: colors[type as keyof typeof colors] }} />
              {label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

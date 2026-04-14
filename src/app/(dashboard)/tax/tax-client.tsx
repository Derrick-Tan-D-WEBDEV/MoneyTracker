"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Calculator, TrendingUp, PiggyBank, Receipt, AlertTriangle, Info } from "lucide-react";
import { getTaxPredictionData, computeTax, type TaxPredictionData } from "@/actions/tax";
import type { TaxResult } from "@/lib/sg-tax";
import { currencyFormatter } from "@/lib/format";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

export function TaxClient() {
  const { data: session } = useSession();
  const userCurrency = session?.user?.currency || "SGD";
  const formatCurrency = currencyFormatter(userCurrency);
  const formatSGD = currencyFormatter("SGD");

  const [predictionData, setPredictionData] = useState<TaxPredictionData | null>(null);
  const [taxResult, setTaxResult] = useState<TaxResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);

  // Form state
  const [annualIncome, setAnnualIncome] = useState("");
  const [ageGroup, setAgeGroup] = useState<"below55" | "age55to59" | "age60plus">("below55");
  const [isCpfContributor, setIsCpfContributor] = useState(true);
  const [srsContribution, setSrsContribution] = useState("");
  const [cpfCashTopUp, setCpfCashTopUp] = useState("");
  const [spouseRelief, setSpouseRelief] = useState(false);
  const [parentRelief, setParentRelief] = useState("");
  const [additionalReliefs, setAdditionalReliefs] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const data = await getTaxPredictionData();
        setPredictionData(data);
        if (data.projectedAnnualIncome > 0) {
          setAnnualIncome(Math.round(data.projectedAnnualIncome).toString());
        }
      } catch {
        toast.error("Failed to load income data");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleCalculate = useCallback(async () => {
    const income = parseFloat(annualIncome);
    if (!income || income <= 0) {
      toast.error("Enter a valid annual income");
      return;
    }

    setCalculating(true);
    try {
      const result = await computeTax({
        annualIncome: income,
        ageGroup,
        isCpfContributor,
        srsContribution: parseFloat(srsContribution) || 0,
        cpfCashTopUp: parseFloat(cpfCashTopUp) || 0,
        spouseRelief,
        parentRelief: parseFloat(parentRelief) || 0,
        additionalReliefs: parseFloat(additionalReliefs) || 0,
      });
      setTaxResult(result);
    } catch {
      toast.error("Failed to calculate tax");
    } finally {
      setCalculating(false);
    }
  }, [annualIncome, ageGroup, isCpfContributor, srsContribution, cpfCashTopUp, spouseRelief, parentRelief, additionalReliefs]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Tax Prediction</h1>
        <p className="text-muted-foreground">Singapore income tax estimate based on your tracked income</p>
      </div>

      {/* Disclaimer */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-4">
        <div className="flex gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-700 dark:text-amber-400">
            <p className="font-medium">Disclaimer</p>
            <p className="mt-1">
              This is an <strong>estimate only</strong> based on Singapore IRAS YA 2024+ progressive tax brackets for tax residents. Actual tax may differ based on your full circumstances. Consult a
              tax professional for official advice.
            </p>
          </div>
        </div>
      </div>

      {/* Income Summary from Tracked Data */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="pt-4">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-7 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : predictionData ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Income YTD</p>
              <p className="text-2xl font-bold">{formatCurrency(predictionData.incomeYTD)}</p>
              <p className="text-xs text-muted-foreground mt-1">{predictionData.monthsElapsed} months elapsed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Projected Annual</p>
              <p className="text-2xl font-bold">{formatCurrency(predictionData.projectedAnnualIncome)}</p>
              <p className="text-xs text-muted-foreground mt-1">Based on current pace</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Income Sources</p>
              <p className="text-2xl font-bold">{predictionData.incomeSources.length}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {predictionData.incomeSources[0]?.category || "None"} {predictionData.incomeSources.length > 1 && `+ ${predictionData.incomeSources.length - 1} more`}
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calculator Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="w-4 h-4" />
              Tax Calculator
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Annual Income (SGD)</Label>
              <Input type="number" step="1" min="0" value={annualIncome} onChange={(e) => setAnnualIncome(e.target.value)} placeholder="e.g. 60000" />
              <p className="text-xs text-muted-foreground">
                {predictionData && predictionData.projectedAnnualIncome > 0 && (
                  <button type="button" className="text-emerald-600 hover:underline" onClick={() => setAnnualIncome(Math.round(predictionData.projectedAnnualIncome).toString())}>
                    Use projected: {formatCurrency(predictionData.projectedAnnualIncome)}
                  </button>
                )}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Age Group</Label>
              <Select value={ageGroup} onValueChange={(v) => v && setAgeGroup(v as typeof ageGroup)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="below55">Below 55</SelectItem>
                  <SelectItem value="age55to59">55 to 59</SelectItem>
                  <SelectItem value="age60plus">60 and above</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>CPF Contributor</Label>
                <p className="text-xs text-muted-foreground">Employee mandatory CPF (20%)</p>
              </div>
              <Switch checked={isCpfContributor} onCheckedChange={setIsCpfContributor} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>SRS Top-up</Label>
                <Input type="number" step="1" min="0" value={srsContribution} onChange={(e) => setSrsContribution(e.target.value)} placeholder="0" />
                <p className="text-xs text-muted-foreground">Max $15,300</p>
              </div>
              <div className="space-y-2">
                <Label>CPF Cash Top-up</Label>
                <Input type="number" step="1" min="0" value={cpfCashTopUp} onChange={(e) => setCpfCashTopUp(e.target.value)} placeholder="0" />
                <p className="text-xs text-muted-foreground">Max $16,000</p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Spouse Relief</Label>
                <p className="text-xs text-muted-foreground">$2,000 if spouse income &lt; $4,000</p>
              </div>
              <Switch checked={spouseRelief} onCheckedChange={setSpouseRelief} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Parent Relief</Label>
                <Input type="number" step="1" min="0" value={parentRelief} onChange={(e) => setParentRelief(e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>Other Reliefs</Label>
                <Input type="number" step="1" min="0" value={additionalReliefs} onChange={(e) => setAdditionalReliefs(e.target.value)} placeholder="0" />
              </div>
            </div>

            <Button className="w-full" onClick={handleCalculate} disabled={calculating}>
              {calculating ? "Calculating..." : "Calculate Tax"}
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        <div className="space-y-4">
          {taxResult ? (
            <>
              {/* Key Figures */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Receipt className="w-4 h-4" />
                    Tax Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Gross Income</p>
                      <p className="text-xl font-bold">{formatSGD(taxResult.grossIncome)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Reliefs</p>
                      <p className="text-xl font-bold text-emerald-600">-{formatSGD(taxResult.totalReliefs)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Chargeable Income</p>
                      <p className="text-xl font-bold">{formatSGD(taxResult.chargeableIncome)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Tax Payable</p>
                      <p className="text-xl font-bold text-red-500">{formatSGD(taxResult.taxPayable)}</p>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Effective Rate</p>
                      <p className="text-lg font-bold">{taxResult.effectiveRate}%</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Monthly Tax</p>
                      <p className="text-lg font-bold">{formatSGD(taxResult.monthlyTax)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Take-Home/mo</p>
                      <p className="text-lg font-bold text-emerald-600">{formatSGD(taxResult.takeHomeMonthly)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Relief Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <PiggyBank className="w-4 h-4" />
                    Relief Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {taxResult.reliefBreakdown.map((r) => (
                      <div key={r.name} className="flex items-center justify-between text-sm">
                        <span>{r.name}</span>
                        <span className="font-medium">{formatSGD(r.amount)}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between text-sm font-bold pt-2 border-t">
                      <span>Total (capped at $80,000)</span>
                      <span>{formatSGD(taxResult.totalReliefs)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Tax Bracket Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TrendingUp className="w-4 h-4" />
                    Bracket Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {taxResult.bracketBreakdown.map((b) => (
                      <div key={b.bracket} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs tabular-nums">
                            {b.rate}%
                          </Badge>
                          <span className="text-muted-foreground">{b.bracket}</span>
                        </div>
                        <span className="font-medium tabular-nums">{formatSGD(b.tax)}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between text-sm font-bold pt-2 border-t">
                      <span>Total Tax</span>
                      <span>{formatSGD(taxResult.taxPayable)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                <Calculator className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Enter your income details and click Calculate</p>
                <p className="text-xs mt-2 flex items-center justify-center gap-1">
                  <Info className="w-3 h-3" />
                  Uses Singapore IRAS YA 2024+ progressive rates
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Income Sources from tracked data */}
      {predictionData && predictionData.incomeSources.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your Income Sources (YTD)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {predictionData.incomeSources.map((s) => (
                <div key={s.category} className="flex items-center justify-between text-sm">
                  <span>{s.category}</span>
                  <span className="font-medium tabular-nums">{formatCurrency(s.amount)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between text-sm font-bold pt-2 border-t">
                <span>Total YTD</span>
                <span>{formatCurrency(predictionData.incomeYTD)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

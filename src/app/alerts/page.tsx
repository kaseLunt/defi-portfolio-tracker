"use client";

import { useState } from "react";
import { Bell, Plus, Trash2, Edit2, Power, AlertCircle, TrendingUp, Fuel } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/use-auth";
import { formatDistanceToNow } from "date-fns";

const ruleTypeIcons: Record<string, React.ReactNode> = {
  price: <TrendingUp className="h-4 w-4" />,
  yield: <TrendingUp className="h-4 w-4 text-green-500" />,
  gas: <Fuel className="h-4 w-4 text-blue-500" />,
  position: <AlertCircle className="h-4 w-4 text-amber-500" />,
};

const ruleTypeLabels: Record<string, string> = {
  price: "Price Alert",
  yield: "Yield Alert",
  gas: "Gas Alert",
  position: "Position Alert",
};

interface CreateAlertFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

function CreateAlertForm({ onClose, onSuccess }: CreateAlertFormProps) {
  const [name, setName] = useState("");
  const [ruleType, setRuleType] = useState<"price" | "yield" | "gas" | "position">("price");
  const [token, setToken] = useState("ethereum");
  const [operator, setOperator] = useState("lt");
  const [value, setValue] = useState("");

  const createRule = trpc.notification.createAlertRule.useMutation({
    onSuccess: () => {
      onSuccess();
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const conditions: Record<string, unknown> = {};

    if (ruleType === "price") {
      conditions.token = token;
      conditions.operator = operator;
      conditions.value = parseFloat(value);
    }

    createRule.mutate({
      name,
      ruleType,
      conditions,
      channels: ["inApp"],
      cooldownMinutes: 60,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Alert</CardTitle>
        <CardDescription>Set up a new alert rule to be notified when conditions are met</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Alert Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., ETH below $2000"
              className="w-full px-3 py-2 rounded-md border bg-background"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Alert Type</label>
            <select
              value={ruleType}
              onChange={(e) => setRuleType(e.target.value as typeof ruleType)}
              className="w-full px-3 py-2 rounded-md border bg-background"
            >
              <option value="price">Price Alert</option>
              <option value="position">Position Alert</option>
            </select>
          </div>

          {ruleType === "price" && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Token (CoinGecko ID)</label>
                <input
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="e.g., ethereum, bitcoin"
                  className="w-full px-3 py-2 rounded-md border bg-background"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Condition</label>
                  <select
                    value={operator}
                    onChange={(e) => setOperator(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border bg-background"
                  >
                    <option value="lt">Less than</option>
                    <option value="gt">Greater than</option>
                    <option value="lte">Less than or equal</option>
                    <option value="gte">Greater than or equal</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Price (USD)</label>
                  <input
                    type="number"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="2000"
                    step="0.01"
                    className="w-full px-3 py-2 rounded-md border bg-background"
                    required
                  />
                </div>
              </div>
            </>
          )}

          <div className="flex gap-2 justify-end pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createRule.isPending}>
              {createRule.isPending ? "Creating..." : "Create Alert"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default function AlertsPage() {
  const { isLoggedIn, isLoading: authLoading } = useAuth();
  const [showCreateForm, setShowCreateForm] = useState(false);

  const utils = trpc.useUtils();

  const { data: rules, isLoading } = trpc.notification.getAlertRules.useQuery(undefined, {
    enabled: isLoggedIn,
  });

  const updateRule = trpc.notification.updateAlertRule.useMutation({
    onSuccess: () => {
      utils.notification.getAlertRules.invalidate();
    },
  });

  const deleteRule = trpc.notification.deleteAlertRule.useMutation({
    onSuccess: () => {
      utils.notification.getAlertRules.invalidate();
    },
  });

  const toggleRule = (ruleId: string, isActive: boolean) => {
    updateRule.mutate({
      ruleId,
      updates: { isActive: !isActive },
    });
  };

  const handleDelete = (ruleId: string) => {
    if (confirm("Are you sure you want to delete this alert?")) {
      deleteRule.mutate({ ruleId });
    }
  };

  if (authLoading) {
    return (
      <div className="container py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48" />
          <div className="h-32 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="container py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Sign In Required</h2>
            <p className="text-muted-foreground">
              Connect your wallet and sign in to manage your alerts
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Alerts</h1>
          <p className="text-muted-foreground">
            Get notified when important conditions are met
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Alert
        </Button>
      </div>

      {showCreateForm && (
        <div className="mb-6">
          <CreateAlertForm
            onClose={() => setShowCreateForm(false)}
            onSuccess={() => utils.notification.getAlertRules.invalidate()}
          />
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-muted rounded animate-pulse" />
          ))}
        </div>
      ) : rules && rules.length > 0 ? (
        <div className="space-y-4">
          {rules.map((rule) => {
            const conditions = rule.conditions as Record<string, unknown>;
            return (
              <Card key={rule.id} className={!rule.isActive ? "opacity-60" : ""}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-lg bg-secondary">
                        {ruleTypeIcons[rule.ruleType]}
                      </div>
                      <div>
                        <h3 className="font-medium">{rule.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {ruleTypeLabels[rule.ruleType]}
                          {rule.ruleType === "price" && conditions.token ? (
                            <span>
                              {" - "}
                              {String(conditions.token)} {String(conditions.operator)}{" "}
                              ${String(conditions.value)}
                            </span>
                          ) : null}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {rule.triggerCount > 0 && (
                            <>
                              Triggered {rule.triggerCount} time
                              {rule.triggerCount !== 1 && "s"}
                              {rule.lastTriggeredAt && (
                                <>
                                  {" "}
                                  (last{" "}
                                  {formatDistanceToNow(new Date(rule.lastTriggeredAt), {
                                    addSuffix: true,
                                  })}
                                  )
                                </>
                              )}
                            </>
                          )}
                          {rule.triggerCount === 0 && "Never triggered"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleRule(rule.id, rule.isActive)}
                        title={rule.isActive ? "Disable alert" : "Enable alert"}
                      >
                        <Power
                          className={`h-4 w-4 ${
                            rule.isActive ? "text-green-500" : "text-muted-foreground"
                          }`}
                        />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(rule.id)}
                        title="Delete alert"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Alerts Yet</h2>
            <p className="text-muted-foreground mb-4">
              Create your first alert to get notified about price changes and more
            </p>
            <Button onClick={() => setShowCreateForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Alert
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

import { useEffect, useState, useCallback } from "react";
import {
  tauriGetServerStatus,
  tauriGetProcessList,
  tauriGetDatabaseSizes,
  tauriKillProcess,
  tauriGetSlowQueries,
} from "@/lib/tauri";
import type { ServerStatus, ProcessInfo, DatabaseSize } from "@/types/mysql";
import { formatUptime, formatDuration } from "@/lib/utils";
import { toast } from "@/components/common/Toast";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { Progress } from "@/components/ui/progress";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";

interface DashboardPageProps {
  connectionId: string;
}

const POLL_INTERVAL = 5000;
const MAX_HISTORY = 60;

export function DashboardPage({ connectionId }: DashboardPageProps) {
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [dbSizes, setDbSizes] = useState<DatabaseSize[]>([]);
  const [connectionsHistory, setConnectionsHistory] = useState<{ t: number; v: number }[]>([]);
  const [qpsHistory, setQpsHistory] = useState<{ t: number; v: number }[]>([]);
  const [killTarget, setKillTarget] = useState<number | null>(null);
  const [isKilling, setIsKilling] = useState(false);

  const poll = useCallback(async () => {
    try {
      const [s, p, sizes] = await Promise.all([
        tauriGetServerStatus({ connection_id: connectionId }),
        tauriGetProcessList({ connection_id: connectionId }),
        tauriGetDatabaseSizes({ connection_id: connectionId }),
      ]);
      setStatus(s);
      setProcesses(p);
      setDbSizes(sizes);

      const now = Date.now();
      setConnectionsHistory((prev) => [
        ...prev.slice(-MAX_HISTORY + 1),
        { t: now, v: s.active_connections },
      ]);
      setQpsHistory((prev) => [
        ...prev.slice(-MAX_HISTORY + 1),
        { t: now, v: Math.round(s.questions_per_sec * 10) / 10 },
      ]);
    } catch {
      // silently ignore poll errors
    }
  }, [connectionId]);

  useEffect(() => {
    poll();
    const interval = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [poll]);

  const handleKill = async () => {
    if (!killTarget) return;
    setIsKilling(true);
    try {
      await tauriKillProcess({ connection_id: connectionId, process_id: killTarget });
      toast.success(`Process ${killTarget} killed`);
      setKillTarget(null);
      poll();
    } catch (err) {
      toast.error("Failed to kill process", String(err));
    } finally {
      setIsKilling(false);
    }
  };

  if (!status) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <i className="bx bx-loader-alt animate-spin text-2xl mr-3" />
        Loading dashboard...
      </div>
    );
  }

  const connPct = Math.round((status.active_connections / status.max_connections) * 100);

  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      {/* Server Status */}
      <section>
        <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
          Server Status
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard icon="bx-data" label="Version" value={status.version} />
          <MetricCard
            icon="bx-time"
            label="Uptime"
            value={formatUptime(status.uptime_seconds)}
          />
          <MetricCard
            icon="bx-chip"
            label="Queries/sec"
            value={status.questions_per_sec.toFixed(1)}
          />
          <MetricCard
            icon="bx-trending-up"
            label="Slow Queries"
            value={status.slow_queries_count.toString()}
          />
        </div>
      </section>

      {/* Connections */}
      <section>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Active Connections</span>
            <span className="text-sm text-muted-foreground">
              {status.active_connections} / {status.max_connections}
            </span>
          </div>
          <Progress value={connPct} className="h-2 mb-1" />
          <span className="text-xs text-muted-foreground">{connPct}% used</span>
        </div>
      </section>

      {/* Real-time Charts */}
      <section>
        <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
          Real-time
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <ChartCard title="Active Connections" data={connectionsHistory} color="#6366f1" />
          <ChartCard title="Queries/sec" data={qpsHistory} color="#22c55e" />
        </div>
      </section>

      {/* Database Sizes */}
      {dbSizes.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
            Database Sizes
          </h2>
          <div className="rounded-xl border bg-card p-4">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dbSizes} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={100}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  formatter={(v: number) => [`${v.toFixed(2)} MB`, "Size"]}
                  contentStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="size_mb" radius={[0, 4, 4, 0]}>
                  {dbSizes.map((_, i) => (
                    <Cell
                      key={i}
                      fill={`hsl(${(i * 47) % 360}, 70%, 55%)`}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* Process List */}
      <section>
        <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
          Process List
        </h2>
        <div className="rounded-xl border bg-card overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 border-b">
              <tr>
                {["ID", "User", "Host", "DB", "Command", "Time", "State", "Info", ""].map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {processes.map((p) => (
                <tr key={p.id} className="border-b hover:bg-muted/20 transition-colors">
                  <td className="px-3 py-1.5">{p.id}</td>
                  <td className="px-3 py-1.5">{p.user}</td>
                  <td className="px-3 py-1.5 max-w-[120px] truncate">{p.host}</td>
                  <td className="px-3 py-1.5">{p.db ?? "—"}</td>
                  <td className="px-3 py-1.5">{p.command}</td>
                  <td className="px-3 py-1.5">{p.time}s</td>
                  <td className="px-3 py-1.5 text-muted-foreground max-w-[100px] truncate">
                    {p.state ?? "—"}
                  </td>
                  <td className="px-3 py-1.5 max-w-[200px] truncate font-mono text-[10px]">
                    {p.info ?? "—"}
                  </td>
                  <td className="px-3 py-1.5">
                    <button
                      className="px-2 py-0.5 rounded text-destructive hover:bg-destructive/10 transition-colors"
                      onClick={() => setKillTarget(p.id)}
                    >
                      Kill
                    </button>
                  </td>
                </tr>
              ))}
              {processes.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-4 text-center text-muted-foreground">
                    No active processes
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <ConfirmModal
        open={killTarget !== null}
        onClose={() => setKillTarget(null)}
        onConfirm={handleKill}
        title="Kill Process"
        description={`Kill process #${killTarget}? This will immediately terminate the query.`}
        confirmLabel="Kill Process"
        isLoading={isKilling}
      />
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 mb-1">
        <i className={`bx ${icon} text-primary text-lg`} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-sm font-semibold truncate" title={value}>
        {value}
      </p>
    </div>
  );
}

function ChartCard({
  title,
  data,
  color,
}: {
  title: string;
  data: { t: number; v: number }[];
  color: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="text-xs font-medium text-muted-foreground mb-3">{title}</h3>
      <ResponsiveContainer width="100%" height={80}>
        <LineChart data={data}>
          <XAxis dataKey="t" hide />
          <YAxis hide />
          <Tooltip
            formatter={(v: number) => [v, title]}
            labelFormatter={() => ""}
            contentStyle={{ fontSize: 11 }}
          />
          <Line
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

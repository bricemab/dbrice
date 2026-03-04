import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { tauriExportDatabase, tauriGetDatabases } from "@/lib/tauri";
import { toast } from "@/components/common/Toast";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFileExport,
  faFolderOpen,
  faSpinner,
  faCircleCheck,
  faCircleExclamation,
} from "@fortawesome/free-solid-svg-icons";

interface ExportWizardProps {
  connectionId: string;
  defaultDatabase?: string;
}

type ExportType = "structure_and_data" | "structure_only" | "data_only";
type OutputFormat = "sql" | "csv" | "json";

export function ExportWizard({ connectionId, defaultDatabase }: ExportWizardProps) {
  const [databases, setDatabases] = useState<string[]>([]);
  const [selectedDatabase, setSelectedDatabase] = useState(defaultDatabase ?? "");
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
  const [exportType, setExportType] = useState<ExportType>("structure_and_data");
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("sql");
  const [includeDropTable, setIncludeDropTable] = useState(true);
  const [includeCreateDb, setIncludeCreateDb] = useState(false);
  const [useTransactions, setUseTransactions] = useState(true);
  const [disableFkChecks, setDisableFkChecks] = useState(true);
  const [outputPath, setOutputPath] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [exportDone, setExportDone] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    loadDatabases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionId]);

  useEffect(() => {
    if (selectedDatabase) loadTables(selectedDatabase);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDatabase]);

  const loadDatabases = async () => {
    try {
      const dbs = await tauriGetDatabases({ connection_id: connectionId });
      setDatabases(dbs);
      if (!selectedDatabase && dbs.length > 0) {
        setSelectedDatabase(dbs[0]);
      }
    } catch (err) {
      toast.error("Failed to load databases", String(err));
    }
  };

  const loadTables = async (db: string) => {
    try {
      const { tauriGetTables } = await import("@/lib/tauri");
      const tbls = await tauriGetTables({ connection_id: connectionId, database: db });
      const tableNames = tbls.map((t: { name: string }) => t.name);
      setTables(tableNames);
      setSelectedTables(new Set(tableNames));
    } catch {
      setTables([]);
    }
  };

  const toggleTable = (table: string) => {
    setSelectedTables((prev) => {
      const next = new Set(prev);
      if (next.has(table)) next.delete(table);
      else next.add(table);
      return next;
    });
  };

  const selectAllTables = () => setSelectedTables(new Set(tables));
  const unselectAllTables = () => setSelectedTables(new Set());

  const handleBrowse = async () => {
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const ext = outputFormat === "sql" ? ["sql"] : outputFormat === "csv" ? ["csv"] : ["json"];
      const filePath = await save({
        filters: [{ name: outputFormat.toUpperCase(), extensions: ext }],
        defaultPath: `${selectedDatabase}_export.${outputFormat}`,
      });
      if (filePath) setOutputPath(filePath);
    } catch {
      // user cancelled
    }
  };

  const handleExport = async () => {
    if (!selectedDatabase) {
      toast.error("Please select a database");
      return;
    }
    if (selectedTables.size === 0) {
      toast.error("Please select at least one table");
      return;
    }
    if (!outputPath) {
      toast.error("Please select an output path");
      return;
    }

    setIsExporting(true);
    setProgress(0);
    setProgressMessage("Starting export...");
    setExportDone(false);
    setExportError(null);

    const tableList = Array.from(selectedTables);
    try {
      await tauriExportDatabase({
        connection_id: connectionId,
        database: selectedDatabase,
        tables: tableList,
        export_type: exportType,
        format: outputFormat,
        output_path: outputPath,
        include_drop_table: includeDropTable,
        include_create_db: includeCreateDb,
        use_transactions: useTransactions,
        disable_fk_checks: disableFkChecks,
      });
      setProgress(100);
      setProgressMessage("Export completed successfully");
      setExportDone(true);
      toast.success("Export completed successfully");
    } catch (err) {
      setExportError(String(err));
      toast.error("Export failed", String(err));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-card">
        <FontAwesomeIcon icon={faFileExport} className="text-lg text-muted-foreground" />
        <h2 className="font-semibold">Export Database</h2>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 max-w-2xl space-y-6">
          {/* Database & Tables */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Connection & Database</h3>
            <div className="space-y-1.5">
              <Label>Database</Label>
              <Select value={selectedDatabase} onValueChange={setSelectedDatabase}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select database" />
                </SelectTrigger>
                <SelectContent>
                  {databases.map((db) => (
                    <SelectItem key={db} value={db}>
                      {db}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {tables.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>
                    Tables ({selectedTables.size}/{tables.length} selected)
                  </Label>
                  <div className="flex gap-2">
                    <button
                      className="text-xs text-primary hover:underline"
                      onClick={selectAllTables}
                    >
                      Select All
                    </button>
                    <span className="text-muted-foreground text-xs">/</span>
                    <button
                      className="text-xs text-primary hover:underline"
                      onClick={unselectAllTables}
                    >
                      Unselect All
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto border rounded-lg p-3">
                  {tables.map((table) => (
                    <div key={table} className="flex items-center gap-2">
                      <Checkbox
                        id={`tbl-${table}`}
                        checked={selectedTables.has(table)}
                        onCheckedChange={() => toggleTable(table)}
                      />
                      <Label htmlFor={`tbl-${table}`} className="text-xs cursor-pointer truncate">
                        {table}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Export Type */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Export Type</h3>
            <div className="flex gap-3">
              {(
                [
                  ["structure_and_data", "Structure and Data"],
                  ["structure_only", "Structure Only"],
                  ["data_only", "Data Only"],
                ] as [ExportType, string][]
              ).map(([val, label]) => (
                <label
                  key={val}
                  className={`flex-1 flex items-center justify-center gap-2 border rounded-lg py-2 px-3 cursor-pointer text-sm transition-colors ${
                    exportType === val
                      ? "border-primary bg-primary/10 text-primary"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <input
                    type="radio"
                    className="sr-only"
                    checked={exportType === val}
                    onChange={() => setExportType(val)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </section>

          {/* Format */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Output Format</h3>
            <div className="flex gap-3">
              {(["sql", "csv", "json"] as OutputFormat[]).map((fmt) => (
                <label
                  key={fmt}
                  className={`flex-1 flex items-center justify-center gap-2 border rounded-lg py-2 px-3 cursor-pointer text-sm uppercase font-medium transition-colors ${
                    outputFormat === fmt
                      ? "border-primary bg-primary/10 text-primary"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <input
                    type="radio"
                    className="sr-only"
                    checked={outputFormat === fmt}
                    onChange={() => setOutputFormat(fmt)}
                  />
                  {fmt}
                </label>
              ))}
            </div>
          </section>

          {/* SQL Options */}
          {outputFormat === "sql" && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">SQL Dump Options</h3>
              {(
                [
                  [includeDropTable, setIncludeDropTable, "Include DROP TABLE IF EXISTS"],
                  [includeCreateDb, setIncludeCreateDb, "Include CREATE DATABASE"],
                  [useTransactions, setUseTransactions, "Use transactions"],
                  [disableFkChecks, setDisableFkChecks, "Disable foreign key checks"],
                ] as [boolean, (v: boolean) => void, string][]
              ).map(([val, setter, label]) => (
                <div key={label} className="flex items-center gap-2">
                  <Checkbox id={label} checked={val} onCheckedChange={(v) => setter(!!v)} />
                  <Label htmlFor={label} className="text-sm cursor-pointer">
                    {label}
                  </Label>
                </div>
              ))}
            </section>
          )}

          {/* Output destination */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Destination</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={outputPath}
                readOnly
                placeholder="Select output file..."
                className="flex-1 h-9 px-3 text-sm rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <Button variant="outline" onClick={handleBrowse}>
                <FontAwesomeIcon icon={faFolderOpen} />
                Browse...
              </Button>
            </div>
          </section>

          {/* Progress */}
          {isExporting && (
            <section className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{progressMessage}</span>
                <span className="font-medium">{progress}%</span>
              </div>
              <Progress value={progress} />
            </section>
          )}

          {/* Done */}
          {exportDone && (
            <div className="flex items-center gap-2 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">
              <FontAwesomeIcon icon={faCircleCheck} />
              <span>Export completed successfully —</span>
              <button
                className="underline hover:no-underline"
                onClick={() => {
                  const dir = outputPath.replace(/[/\\][^/\\]+$/, "");
                  import("@tauri-apps/plugin-shell").then(({ open }) => open(dir));
                }}
              >
                Open folder
              </button>
            </div>
          )}

          {/* Error */}
          {exportError && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              <FontAwesomeIcon icon={faCircleExclamation} className="shrink-0 mt-0.5" />
              <span>{exportError}</span>
            </div>
          )}

          {/* Start button */}
          <Button
            onClick={handleExport}
            disabled={isExporting || !selectedDatabase || selectedTables.size === 0 || !outputPath}
            className="w-full"
          >
            {isExporting ? (
              <>
                <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <FontAwesomeIcon icon={faFileExport} />
                Start Export
              </>
            )}
          </Button>
        </div>
      </ScrollArea>
    </div>
  );
}

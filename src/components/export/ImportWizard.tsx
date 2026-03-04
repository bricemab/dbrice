import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { tauriImportSql, tauriGetDatabases } from "@/lib/tauri";
import { toast } from "@/components/common/Toast";

interface ImportWizardProps {
  connectionId: string;
  defaultDatabase?: string;
}

export function ImportWizard({ connectionId, defaultDatabase }: ImportWizardProps) {
  const [databases, setDatabases] = useState<string[]>([]);
  const [destinationType, setDestinationType] = useState<"existing" | "new">("existing");
  const [selectedDatabase, setSelectedDatabase] = useState(defaultDatabase ?? "");
  const [newDatabaseName, setNewDatabaseName] = useState("");
  const [filePath, setFilePath] = useState("");
  const [stopOnError, setStopOnError] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [importDone, setImportDone] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    loadDatabases();
  }, [connectionId]);

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

  const handleBrowse = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const result = await open({
        filters: [{ name: "SQL Files", extensions: ["sql"] }],
        multiple: false,
      });
      if (result && typeof result === "string") {
        setFilePath(result);
      }
    } catch {
      // user cancelled
    }
  };

  const handleImport = async () => {
    const targetDb =
      destinationType === "new" ? newDatabaseName.trim() : selectedDatabase;

    if (!targetDb) {
      toast.error("Please select or enter a database name");
      return;
    }
    if (!filePath) {
      toast.error("Please select a SQL file");
      return;
    }

    setIsImporting(true);
    setProgress(0);
    setLogs([]);
    setImportDone(false);
    setImportError(null);

    try {
      setLogs((prev) => [...prev, `Starting import into \`${targetDb}\`...`]);
      setProgress(10);

      await tauriImportSql({
        connection_id: connectionId,
        database: targetDb,
        file_path: filePath,
        stop_on_error: stopOnError,
        create_database: destinationType === "new",
      });

      setProgress(100);
      setLogs((prev) => [...prev, "✅ Import completed successfully"]);
      setImportDone(true);
      toast.success("Import completed successfully");
    } catch (err) {
      const msg = String(err);
      setImportError(msg);
      setLogs((prev) => [...prev, `❌ Error: ${msg}`]);
      toast.error("Import failed", msg);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-card">
        <i className="bx bx-import text-lg text-muted-foreground" />
        <h2 className="font-semibold">Import Database</h2>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 max-w-2xl space-y-6">
          {/* Destination */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Destination</h3>
            <div className="flex gap-3">
              <label
                className={`flex-1 flex items-center justify-center gap-2 border rounded-lg py-2 px-3 cursor-pointer text-sm transition-colors ${
                  destinationType === "existing"
                    ? "border-primary bg-primary/10 text-primary"
                    : "hover:bg-muted/50"
                }`}
              >
                <input
                  type="radio"
                  className="sr-only"
                  checked={destinationType === "existing"}
                  onChange={() => setDestinationType("existing")}
                />
                Import into existing database
              </label>
              <label
                className={`flex-1 flex items-center justify-center gap-2 border rounded-lg py-2 px-3 cursor-pointer text-sm transition-colors ${
                  destinationType === "new"
                    ? "border-primary bg-primary/10 text-primary"
                    : "hover:bg-muted/50"
                }`}
              >
                <input
                  type="radio"
                  className="sr-only"
                  checked={destinationType === "new"}
                  onChange={() => setDestinationType("new")}
                />
                Create new database
              </label>
            </div>

            {destinationType === "existing" ? (
              <div className="space-y-1.5">
                <Label>Database</Label>
                <Select value={selectedDatabase} onValueChange={setSelectedDatabase}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Select database" />
                  </SelectTrigger>
                  <SelectContent>
                    {databases.map((db) => (
                      <SelectItem key={db} value={db}>{db}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>New Database Name</Label>
                <Input
                  value={newDatabaseName}
                  onChange={(e) => setNewDatabaseName(e.target.value)}
                  placeholder="new_database_name"
                  className="w-64"
                />
              </div>
            )}
          </section>

          {/* Source file */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Source File</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={filePath}
                readOnly
                placeholder="Select .sql file..."
                className="flex-1 h-9 px-3 text-sm rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <Button variant="outline" onClick={handleBrowse}>
                <i className="bx bx-folder-open" />
                Browse...
              </Button>
            </div>
          </section>

          {/* Options */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Options</h3>
            <div className="flex items-center gap-2">
              <Checkbox
                id="stop-on-error"
                checked={stopOnError}
                onCheckedChange={(v) => setStopOnError(!!v)}
              />
              <Label htmlFor="stop-on-error" className="text-sm cursor-pointer">
                Stop on error
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              If unchecked, import will continue even if individual statements fail.
            </p>
          </section>

          {/* Progress */}
          {(isImporting || importDone || importError) && (
            <section className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {isImporting ? "Importing..." : importDone ? "Done" : "Failed"}
                </span>
                <span className="font-medium">{progress}%</span>
              </div>
              <Progress value={progress} />

              {/* Log output */}
              <div className="bg-muted/40 border rounded-lg p-3 font-mono text-xs space-y-1 max-h-48 overflow-y-auto">
                {logs.map((line, i) => (
                  <div
                    key={i}
                    className={
                      line.startsWith("❌")
                        ? "text-destructive"
                        : line.startsWith("✅")
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-muted-foreground"
                    }
                  >
                    {line}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Error */}
          {importError && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              <i className="bx bx-error-circle shrink-0 mt-0.5" />
              <span>{importError}</span>
            </div>
          )}

          {/* Start button */}
          <Button
            onClick={handleImport}
            disabled={
              isImporting ||
              !filePath ||
              (destinationType === "existing" ? !selectedDatabase : !newDatabaseName.trim())
            }
            className="w-full"
          >
            {isImporting ? (
              <><i className="bx bx-loader-alt animate-spin" />Importing...</>
            ) : (
              <><i className="bx bx-import" />Start Import</>
            )}
          </Button>
        </div>
      </ScrollArea>
    </div>
  );
}

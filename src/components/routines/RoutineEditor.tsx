import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SqlEditor } from "@/components/editor/SqlEditor";
import { ResultGrid } from "@/components/editor/ResultGrid";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { tauriGetRoutineDefinition, tauriSaveRoutine, tauriDropRoutine, tauriExecuteRoutine } from "@/lib/tauri";
import { toast } from "@/components/common/Toast";
import { useTabStore } from "@/stores/useTabStore";
import type { RoutineDef, RoutineParam } from "@/types/schema";
import type { QueryResult } from "@/types/mysql";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSpinner,
  faCode,
  faPlay,
  faTrash,
  faFloppyDisk,
  faCircleExclamation,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";

interface RoutineEditorProps {
  connectionId: string;
  database: string;
  routineName: string;
  routineType: "PROCEDURE" | "FUNCTION";
  tabId: string;
}

const DEFAULT_PROC = `CREATE PROCEDURE \`procedure_name\`()
BEGIN
  -- Your procedure body here
  SELECT 1;
END`;

const DEFAULT_FUNC = `CREATE FUNCTION \`function_name\`()
RETURNS INT
DETERMINISTIC
BEGIN
  -- Your function body here
  RETURN 1;
END`;

export function RoutineEditor({
  connectionId,
  database,
  routineName,
  routineType,
  tabId,
}: RoutineEditorProps) {
  const { setTabDirty, setTabTitle } = useTabStore();
  const isNew = !routineName;

  const [definition, setDefinition] = useState<string>(
    routineType === "PROCEDURE" ? DEFAULT_PROC : DEFAULT_FUNC
  );
  const [originalDef, setOriginalDef] = useState<string>("");
  const [routineDef, setRoutineDef] = useState<RoutineDef | null>(null);
  const [isLoading, setIsLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDropConfirm, setShowDropConfirm] = useState(false);
  const [showParamModal, setShowParamModal] = useState(false);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isNew) {
      loadDefinition();
    }
  }, [routineName]);

  const loadDefinition = async () => {
    setIsLoading(true);
    try {
      const def = await tauriGetRoutineDefinition({
        connection_id: connectionId,
        database,
        routine_name: routineName,
        routine_type: routineType,
      });
      setRoutineDef(def);
      const body = def.definition ?? "";
      setDefinition(body);
      setOriginalDef(body);
    } catch (err) {
      toast.error("Failed to load routine", String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (val: string) => {
    setDefinition(val);
    setTabDirty(connectionId, tabId, val !== originalDef);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await tauriSaveRoutine({
        connection_id: connectionId,
        database,
        routine_type: routineType,
        sql: definition,
      });
      setOriginalDef(definition);
      setTabDirty(connectionId, tabId, false);
      toast.success(`${routineType} saved successfully`);
      if (isNew) {
        // Try to extract name from SQL
        const match = definition.match(/(?:PROCEDURE|FUNCTION)\s+`?(\w+)`?/i);
        if (match) setTabTitle(connectionId, tabId, `${match[1]} — ${routineType}`);
      }
    } catch (err) {
      setError(String(err));
      toast.error("Failed to save routine", String(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleExecute = () => {
    const params = routineDef?.parameters ?? [];
    if (params.length > 0) {
      // Initialize param values
      const initVals: Record<string, string> = {};
      params.forEach((p) => { initVals[p.name] = ""; });
      setParamValues(initVals);
      setShowParamModal(true);
    } else {
      executeRoutine({});
    }
  };

  const executeRoutine = async (args: Record<string, string>) => {
    setIsExecuting(true);
    setError(null);
    setResult(null);
    try {
      const res = await tauriExecuteRoutine({
        connection_id: connectionId,
        database,
        routine_name: routineName || extractRoutineName(),
        routine_type: routineType,
        params: args,
      });
      setResult(res);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsExecuting(false);
      setShowParamModal(false);
    }
  };

  const extractRoutineName = (): string => {
    const match = definition.match(/(?:PROCEDURE|FUNCTION)\s+`?(\w+)`?/i);
    return match?.[1] ?? "";
  };

  const handleDrop = async () => {
    try {
      await tauriDropRoutine({
        connection_id: connectionId,
        database,
        routine_name: routineName,
        routine_type: routineType,
      });
      toast.success(`${routineType} \`${routineName}\` dropped`);
      setShowDropConfirm(false);
    } catch (err) {
      toast.error("Failed to drop routine", String(err));
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <FontAwesomeIcon icon={faSpinner} className="animate-spin text-2xl text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-card">
        <FontAwesomeIcon icon={faCode} className="text-muted-foreground" />
        <span className="text-sm font-medium">
          {isNew ? `New ${routineType}` : `${routineName} — ${routineType}`}
        </span>
        <span className="text-xs text-muted-foreground">({database})</span>
        <div className="ml-auto flex gap-2">
          {!isNew && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDropConfirm(true)}
              className="text-destructive border-destructive/50 hover:bg-destructive/10"
            >
              <FontAwesomeIcon icon={faTrash} />
              Drop
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExecute}
            disabled={isExecuting}
          >
            {isExecuting ? (
              <><FontAwesomeIcon icon={faSpinner} className="animate-spin" />Executing...</>
            ) : (
              <><FontAwesomeIcon icon={faPlay} />Execute</>
            )}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <><FontAwesomeIcon icon={faSpinner} className="animate-spin" />Saving...</>
            ) : (
              <><FontAwesomeIcon icon={faFloppyDisk} />Save</>
            )}
          </Button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-hidden">
          <SqlEditor
            value={definition}
            onChange={handleChange}
            onExecute={() => handleExecute()}
          />
        </div>

        {/* Error */}
        {error && (
          <div className="mx-4 mb-2 flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
            <FontAwesomeIcon icon={faCircleExclamation} className="shrink-0 mt-0.5" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)}>
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="h-48 border-t">
            <ResultGrid result={result} connectionId={connectionId} />
          </div>
        )}
      </div>

      {/* Drop confirmation */}
      <ConfirmModal
        open={showDropConfirm}
        onClose={() => setShowDropConfirm(false)}
        onConfirm={handleDrop}
        title={`Drop ${routineType}`}
        description={`Are you sure you want to drop ${routineType} \`${routineName}\`? This cannot be undone.`}
        confirmLabel={`Drop ${routineType}`}
        confirmVariant="destructive"
      />

      {/* Parameter input modal */}
      <Dialog open={showParamModal} onOpenChange={setShowParamModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Execute {routineName}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-64">
            <div className="space-y-3 p-1">
              {(routineDef?.parameters ?? []).map((param: RoutineParam) => (
                <div key={param.name} className="space-y-1.5">
                  <Label className="text-xs">
                    {param.name}
                    <span className="text-muted-foreground ml-1">({param.data_type})</span>
                    {param.mode && <span className="text-muted-foreground ml-1">{param.mode}</span>}
                  </Label>
                  <Input
                    value={paramValues[param.name] ?? ""}
                    onChange={(e) =>
                      setParamValues((prev) => ({ ...prev, [param.name]: e.target.value }))
                    }
                    placeholder={`Enter ${param.data_type} value`}
                    className="h-8"
                  />
                </div>
              ))}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowParamModal(false)}>Cancel</Button>
            <Button
              onClick={() => executeRoutine(paramValues)}
              disabled={isExecuting}
            >
              {isExecuting ? (
                <><FontAwesomeIcon icon={faSpinner} className="animate-spin" />Executing...</>
              ) : (
                <><FontAwesomeIcon icon={faPlay} />Execute</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

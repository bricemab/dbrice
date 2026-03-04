import { useState, useCallback } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { tauriCreateTable, tauriAlterTable } from "@/lib/tauri";
import { toast } from "@/components/common/Toast";
import type { TableDef, ColumnDef, FKDef } from "@/types/schema";
import { cn } from "@/lib/utils";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTable,
  faRotateLeft,
  faFileCode,
  faSpinner,
  faCheck,
  faPlus,
  faTrash,
  faBolt,
  faPlay,
} from "@fortawesome/free-solid-svg-icons";

interface TableDesignerProps {
  connectionId: string;
  database: string;
  tableDef?: TableDef; // if editing existing table
  onApplied?: () => void;
}

type ColEdit = {
  id: string;
  name: string;
  datatype: string;
  pk: boolean;
  nn: boolean;
  uq: boolean;
  b: boolean;
  un: boolean;
  zf: boolean;
  ai: boolean;
  g: boolean;
  default_val: string;
  comment: string;
};

type IdxEdit = {
  id: string;
  name: string;
  index_type: string;
  columns: string;
};

type FkEdit = {
  id: string;
  name: string;
  column: string;
  ref_table: string;
  ref_column: string;
  on_delete: string;
  on_update: string;
};

const DATATYPES = [
  "INT",
  "BIGINT",
  "SMALLINT",
  "TINYINT",
  "MEDIUMINT",
  "DECIMAL(10,2)",
  "FLOAT",
  "DOUBLE",
  "VARCHAR(255)",
  "VARCHAR(100)",
  "VARCHAR(50)",
  "TEXT",
  "MEDIUMTEXT",
  "LONGTEXT",
  "TINYTEXT",
  "CHAR(1)",
  "CHAR(36)",
  "DATETIME",
  "TIMESTAMP",
  "DATE",
  "TIME",
  "YEAR",
  "BLOB",
  "MEDIUMBLOB",
  "LONGBLOB",
  "JSON",
  "ENUM",
  "SET",
  "BOOLEAN",
  "BIT(1)",
];

const ENGINES = ["InnoDB", "MyISAM", "MEMORY", "CSV", "ARCHIVE", "BLACKHOLE", "FEDERATED"];
const CHARSETS = ["utf8mb4", "utf8", "latin1", "ascii", "binary"];
const INDEX_TYPES = ["INDEX", "UNIQUE", "PRIMARY", "FULLTEXT", "SPATIAL"];
const FK_ACTIONS = ["RESTRICT", "CASCADE", "SET NULL", "NO ACTION", "SET DEFAULT"];

let colIdCounter = 0;
let idxIdCounter = 0;
let fkIdCounter = 0;
const genColId = () => `col-${++colIdCounter}`;
const genIdxId = () => `idx-${++idxIdCounter}`;
const genFkId = () => `fk-${++fkIdCounter}`;

function defaultCol(): ColEdit {
  return {
    id: genColId(),
    name: "",
    datatype: "VARCHAR(255)",
    pk: false,
    nn: false,
    uq: false,
    b: false,
    un: false,
    zf: false,
    ai: false,
    g: false,
    default_val: "",
    comment: "",
  };
}

function colFromDef(c: ColumnDef): ColEdit {
  return {
    id: genColId(),
    name: c.name,
    datatype: c.data_type,
    pk: c.is_primary_key,
    nn: !c.is_nullable,
    uq: c.is_unique,
    b: c.is_binary,
    un: c.is_unsigned,
    zf: c.is_zero_fill,
    ai: c.is_auto_increment,
    g: c.is_generated,
    default_val: c.default_value ?? "",
    comment: c.comment ?? "",
  };
}

export function TableDesigner({ connectionId, database, tableDef, onApplied }: TableDesignerProps) {
  const isEdit = !!tableDef;
  const [tableName, setTableName] = useState(tableDef?.name ?? "");
  const [engine, setEngine] = useState(tableDef?.options?.engine ?? "InnoDB");
  const [charset, setCharset] = useState(tableDef?.options?.charset ?? "utf8mb4");
  const [collation, setCollation] = useState(tableDef?.options?.collation ?? "utf8mb4_unicode_ci");
  const [tableComment, setTableComment] = useState(tableDef?.options?.comment ?? "");
  const [autoIncrement, setAutoIncrement] = useState(
    tableDef?.options?.auto_increment ? String(tableDef.options.auto_increment) : "",
  );

  const [columns, setColumns] = useState<ColEdit[]>(
    tableDef?.columns?.map(colFromDef) ?? [
      {
        ...defaultCol(),
        name: "id",
        datatype: "INT",
        pk: true,
        nn: true,
        ai: true,
        uq: false,
        b: false,
        un: true,
        zf: false,
        g: false,
        default_val: "",
        comment: "",
      },
    ],
  );

  const [indexes, setIndexes] = useState<IdxEdit[]>(
    tableDef?.indexes
      ?.filter((i) => i.index_type !== "PRIMARY")
      ?.map((i) => ({
        id: genIdxId(),
        name: i.name,
        index_type: i.index_type,
        columns: i.columns.map((c) => c.column_name).join(", "),
      })) ?? [],
  );

  const [foreignKeys, setForeignKeys] = useState<FkEdit[]>(
    tableDef?.foreign_keys?.map((fk: FKDef) => ({
      id: genFkId(),
      name: fk.name,
      column: fk.column,
      ref_table: fk.referenced_table,
      ref_column: fk.referenced_column,
      on_delete: fk.on_delete,
      on_update: fk.on_update,
    })) ?? [],
  );

  const [selectedColId, setSelectedColId] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [previewSql, setPreviewSql] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const updateCol = useCallback((id: string, field: keyof ColEdit, value: unknown) => {
    setColumns((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const updated = { ...c, [field]: value };
        // If setting PK, auto-set NN
        if (field === "pk" && value) updated.nn = true;
        return updated;
      }),
    );
  }, []);

  const addColumn = () => setColumns((prev) => [...prev, defaultCol()]);

  const deleteColumn = () => {
    if (!selectedColId) return;
    setColumns((prev) => prev.filter((c) => c.id !== selectedColId));
    setSelectedColId(null);
  };

  const generateSql = (): string => {
    const colDefs = columns
      .map((c) => {
        const parts = [`  \`${c.name}\` ${c.datatype}`];
        if (c.un) parts.push("UNSIGNED");
        if (c.b) parts.push("BINARY");
        if (c.nn) parts.push("NOT NULL");
        else parts.push("NULL");
        if (c.ai) parts.push("AUTO_INCREMENT");
        if (c.g) parts.push("GENERATED ALWAYS AS (expression) STORED");
        if (c.default_val) parts.push(`DEFAULT ${c.default_val}`);
        if (c.comment) parts.push(`COMMENT '${c.default_val.replace(/'/g, "''")}'`);
        return parts.join(" ");
      })
      .join(",\n");

    const pkCols = columns.filter((c) => c.pk).map((c) => `\`${c.name}\``);
    const pkDef = pkCols.length > 0 ? `,\n  PRIMARY KEY (${pkCols.join(", ")})` : "";

    const uqDefs = columns
      .filter((c) => c.uq && !c.pk)
      .map((c) => `,\n  UNIQUE KEY \`${c.name}_uq\` (\`${c.name}\`)`)
      .join("");

    const idxDefs = indexes
      .map((i) => {
        const cols = i.columns
          .split(",")
          .map((s) => `\`${s.trim()}\``)
          .join(", ");
        const type = i.index_type === "UNIQUE" ? "UNIQUE KEY" : "KEY";
        return `,\n  ${type} \`${i.name}\` (${cols})`;
      })
      .join("");

    const fkDefs = foreignKeys
      .map(
        (fk) =>
          `,\n  CONSTRAINT \`${fk.name}\` FOREIGN KEY (\`${fk.column}\`) REFERENCES \`${fk.ref_table}\` (\`${fk.ref_column}\`) ON DELETE ${fk.on_delete} ON UPDATE ${fk.on_update}`,
      )
      .join("");

    const opts = [
      `ENGINE=${engine}`,
      `DEFAULT CHARSET=${charset}`,
      `COLLATE=${collation}`,
      tableComment ? `COMMENT='${tableComment.replace(/'/g, "''")}'` : "",
      autoIncrement ? `AUTO_INCREMENT=${autoIncrement}` : "",
    ]
      .filter(Boolean)
      .join(" ");

    return `CREATE TABLE \`${database}\`.\`${tableName}\` (\n${colDefs}${pkDef}${uqDefs}${idxDefs}${fkDefs}\n) ${opts};`;
  };

  const handlePreview = () => {
    setPreviewSql(generateSql());
    setShowPreview(true);
  };

  const handleApply = async () => {
    if (!tableName.trim()) {
      toast.error("Table name is required");
      return;
    }
    setIsApplying(true);
    try {
      if (isEdit) {
        await tauriAlterTable({
          connection_id: connectionId,
          database,
          table_name: tableDef!.name,
          sql: generateSql(),
        });
        toast.success(`Table \`${tableName}\` altered successfully`);
      } else {
        await tauriCreateTable({
          connection_id: connectionId,
          database,
          sql: generateSql(),
        });
        toast.success(`Table \`${tableName}\` created successfully`);
      }
      setShowPreview(false);
      onApplied?.();
    } catch (err) {
      toast.error("Failed to apply changes", String(err));
    } finally {
      setIsApplying(false);
    }
  };

  const handleRevert = () => {
    if (tableDef) {
      setTableName(tableDef.name);
      setEngine(tableDef.options?.engine ?? "InnoDB");
      setCharset(tableDef.options?.charset ?? "utf8mb4");
      setCollation(tableDef.options?.collation ?? "utf8mb4_unicode_ci");
      setTableComment(tableDef.options?.comment ?? "");
      setColumns(tableDef.columns?.map(colFromDef) ?? []);
    } else {
      setTableName("");
      setColumns([
        {
          ...defaultCol(),
          name: "id",
          datatype: "INT",
          pk: true,
          nn: true,
          ai: true,
          uq: false,
          b: false,
          un: true,
          zf: false,
          g: false,
          default_val: "",
          comment: "",
        },
      ]);
      setIndexes([]);
      setForeignKeys([]);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-card">
        <FontAwesomeIcon icon={faTable} className="text-lg text-muted-foreground" />
        <div className="flex-1 flex items-center gap-2">
          <Label className="text-sm font-medium whitespace-nowrap">Table Name:</Label>
          <Input
            value={tableName}
            onChange={(e) => setTableName(e.target.value)}
            placeholder="table_name"
            className="h-7 text-sm w-48"
            disabled={isEdit}
          />
          <span className="text-xs text-muted-foreground">in {database}</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRevert}>
            <FontAwesomeIcon icon={faRotateLeft} />
            Revert
          </Button>
          <Button variant="outline" size="sm" onClick={handlePreview}>
            <FontAwesomeIcon icon={faFileCode} />
            Preview SQL
          </Button>
          <Button size="sm" onClick={handleApply} disabled={isApplying || !tableName.trim()}>
            {isApplying ? (
              <>
                <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                Applying...
              </>
            ) : (
              <>
                <FontAwesomeIcon icon={faCheck} />
                Apply
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="columns" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="mx-4 mt-3 w-fit">
          <TabsTrigger value="columns">Columns</TabsTrigger>
          <TabsTrigger value="indexes">Indexes</TabsTrigger>
          <TabsTrigger value="fk">Foreign Keys</TabsTrigger>
          <TabsTrigger value="triggers">Triggers</TabsTrigger>
          <TabsTrigger value="options">Options</TabsTrigger>
        </TabsList>

        {/* Columns Tab */}
        <TabsContent value="columns" className="flex-1 flex flex-col overflow-hidden m-0 p-4">
          <ScrollArea className="flex-1">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-muted/50">
                    {[
                      "Column Name",
                      "Datatype",
                      "PK",
                      "NN",
                      "UQ",
                      "B",
                      "UN",
                      "ZF",
                      "AI",
                      "G",
                      "Default",
                      "Comment",
                    ].map((h) => (
                      <th
                        key={h}
                        className="text-left px-2 py-1.5 border-b font-medium text-muted-foreground whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {columns.map((col) => (
                    <tr
                      key={col.id}
                      className={cn(
                        "hover:bg-muted/30 cursor-pointer border-b border-border/50",
                        selectedColId === col.id && "bg-primary/10",
                      )}
                      onClick={() => setSelectedColId(col.id)}
                    >
                      <td className="px-2 py-1">
                        <Input
                          value={col.name}
                          onChange={(e) => updateCol(col.id, "name", e.target.value)}
                          className="h-6 text-xs w-32"
                          placeholder="column_name"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <Select
                          value={col.datatype}
                          onValueChange={(v) => updateCol(col.id, "datatype", v)}
                        >
                          <SelectTrigger className="h-6 text-xs w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DATATYPES.map((dt) => (
                              <SelectItem key={dt} value={dt}>
                                {dt}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      {(["pk", "nn", "uq", "b", "un", "zf", "ai", "g"] as (keyof ColEdit)[]).map(
                        (f) => (
                          <td key={f} className="px-2 py-1 text-center">
                            <Checkbox
                              checked={col[f] as boolean}
                              onCheckedChange={(v) => updateCol(col.id, f, !!v)}
                            />
                          </td>
                        ),
                      )}
                      <td className="px-2 py-1">
                        <Input
                          value={col.default_val}
                          onChange={(e) => updateCol(col.id, "default_val", e.target.value)}
                          className="h-6 text-xs w-24"
                          placeholder="NULL"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <Input
                          value={col.comment}
                          onChange={(e) => updateCol(col.id, "comment", e.target.value)}
                          className="h-6 text-xs w-28"
                          placeholder=""
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ScrollArea>
          <div className="flex gap-2 mt-3 pt-3 border-t">
            <Button variant="outline" size="sm" onClick={addColumn}>
              <FontAwesomeIcon icon={faPlus} />
              Add Column
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={deleteColumn}
              disabled={!selectedColId}
              className="text-destructive border-destructive/50 hover:bg-destructive/10"
            >
              <FontAwesomeIcon icon={faTrash} />
              Delete Column
            </Button>
          </div>
        </TabsContent>

        {/* Indexes Tab */}
        <TabsContent value="indexes" className="flex-1 flex flex-col overflow-hidden m-0 p-4">
          <ScrollArea className="flex-1">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-muted/50">
                  {["Index Name", "Type", "Columns", "Actions"].map((h) => (
                    <th
                      key={h}
                      className="text-left px-2 py-1.5 border-b font-medium text-muted-foreground"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {indexes.map((idx) => (
                  <tr key={idx.id} className="border-b border-border/50">
                    <td className="px-2 py-1">
                      <Input
                        value={idx.name}
                        onChange={(e) =>
                          setIndexes((prev) =>
                            prev.map((i) => (i.id === idx.id ? { ...i, name: e.target.value } : i)),
                          )
                        }
                        className="h-6 text-xs w-36"
                        placeholder="idx_name"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <Select
                        value={idx.index_type}
                        onValueChange={(v) =>
                          setIndexes((prev) =>
                            prev.map((i) => (i.id === idx.id ? { ...i, index_type: v } : i)),
                          )
                        }
                      >
                        <SelectTrigger className="h-6 text-xs w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {INDEX_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-2 py-1">
                      <Input
                        value={idx.columns}
                        onChange={(e) =>
                          setIndexes((prev) =>
                            prev.map((i) =>
                              i.id === idx.id ? { ...i, columns: e.target.value } : i,
                            ),
                          )
                        }
                        className="h-6 text-xs w-40"
                        placeholder="col1, col2"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive"
                        onClick={() => setIndexes((prev) => prev.filter((i) => i.id !== idx.id))}
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
          <div className="mt-3 pt-3 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setIndexes((prev) => [
                  ...prev,
                  { id: genIdxId(), name: "", index_type: "INDEX", columns: "" },
                ])
              }
            >
              <FontAwesomeIcon icon={faPlus} />
              Add Index
            </Button>
          </div>
        </TabsContent>

        {/* Foreign Keys Tab */}
        <TabsContent value="fk" className="flex-1 flex flex-col overflow-hidden m-0 p-4">
          <ScrollArea className="flex-1">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-muted/50">
                  {[
                    "FK Name",
                    "Column",
                    "Ref Table",
                    "Ref Column",
                    "ON DELETE",
                    "ON UPDATE",
                    "",
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left px-2 py-1.5 border-b font-medium text-muted-foreground whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {foreignKeys.map((fk) => (
                  <tr key={fk.id} className="border-b border-border/50">
                    {(["name", "column", "ref_table", "ref_column"] as (keyof FkEdit)[]).map(
                      (f) => (
                        <td key={f} className="px-2 py-1">
                          <Input
                            value={fk[f] as string}
                            onChange={(e) =>
                              setForeignKeys((prev) =>
                                prev.map((k) =>
                                  k.id === fk.id ? { ...k, [f]: e.target.value } : k,
                                ),
                              )
                            }
                            className="h-6 text-xs w-28"
                          />
                        </td>
                      ),
                    )}
                    {(["on_delete", "on_update"] as (keyof FkEdit)[]).map((f) => (
                      <td key={f} className="px-2 py-1">
                        <Select
                          value={fk[f] as string}
                          onValueChange={(v) =>
                            setForeignKeys((prev) =>
                              prev.map((k) => (k.id === fk.id ? { ...k, [f]: v } : k)),
                            )
                          }
                        >
                          <SelectTrigger className="h-6 text-xs w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FK_ACTIONS.map((a) => (
                              <SelectItem key={a} value={a}>
                                {a}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    ))}
                    <td className="px-2 py-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive"
                        onClick={() => setForeignKeys((prev) => prev.filter((k) => k.id !== fk.id))}
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
          <div className="mt-3 pt-3 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setForeignKeys((prev) => [
                  ...prev,
                  {
                    id: genFkId(),
                    name: "",
                    column: "",
                    ref_table: "",
                    ref_column: "",
                    on_delete: "RESTRICT",
                    on_update: "RESTRICT",
                  },
                ])
              }
            >
              <FontAwesomeIcon icon={faPlus} />
              Add Foreign Key
            </Button>
          </div>
        </TabsContent>

        {/* Triggers Tab */}
        <TabsContent value="triggers" className="flex-1 m-0 p-4">
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <div className="text-center space-y-2">
              <FontAwesomeIcon icon={faBolt} className="text-3xl block" />
              <p className="text-sm">
                Trigger management available via context menu on table in sidebar.
              </p>
              <p className="text-xs">Right-click a table → Manage Triggers</p>
            </div>
          </div>
        </TabsContent>

        {/* Options Tab */}
        <TabsContent value="options" className="flex-1 m-0 p-4">
          <div className="max-w-md space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Storage Engine</Label>
                <Select value={engine} onValueChange={setEngine}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENGINES.map((e) => (
                      <SelectItem key={e} value={e}>
                        {e}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Charset</Label>
                <Select value={charset} onValueChange={setCharset}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHARSETS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Collation</Label>
                <Input
                  value={collation}
                  onChange={(e) => setCollation(e.target.value)}
                  placeholder="utf8mb4_unicode_ci"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Auto Increment</Label>
                <Input
                  type="number"
                  value={autoIncrement}
                  onChange={(e) => setAutoIncrement(e.target.value)}
                  placeholder="1"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Table Comment</Label>
              <Input
                value={tableComment}
                onChange={(e) => setTableComment(e.target.value)}
                placeholder="Optional comment..."
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* SQL Preview Modal */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>SQL Preview</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-80">
            <pre className="text-xs font-mono bg-muted rounded-lg p-4 whitespace-pre-wrap">
              {previewSql}
            </pre>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Cancel
            </Button>
            <Button onClick={handleApply} disabled={isApplying}>
              {isApplying ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                  Executing...
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faPlay} />
                  Execute
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

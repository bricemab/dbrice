import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ColorPickerInput } from "./ColorPickerInput";
import { TestConnectionBanner } from "./TestConnectionBanner";
import { useConnectionStore } from "@/stores/useConnectionStore";
import { tauriTestConnection } from "@/lib/tauri";
import type { Connection, CreateConnectionInput } from "@/types/connection";
import { generateConnectionColor } from "@/lib/utils";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner, faEye, faEyeSlash, faFloppyDisk } from "@fortawesome/free-solid-svg-icons";

interface ConnectionFormModalProps {
  open: boolean;
  onClose: () => void;
  editConnection?: Connection;
}

const defaultForm = (): CreateConnectionInput => ({
  name: "",
  folder_id: undefined,
  color: generateConnectionColor(),
  method: "tcp_ip",
  mysql_hostname: "127.0.0.1",
  mysql_port: 3306,
  mysql_username: "root",
  mysql_password: "",
  mysql_default_schema: "",
  ssh_hostname: "",
  ssh_port: 22,
  ssh_username: "",
  ssh_password: "",
  ssh_auth_method: "password",
  ssh_key_file_path: "",
  ssh_key_passphrase: "",
});

export function ConnectionFormModal({ open, onClose, editConnection }: ConnectionFormModalProps) {
  const { folders, createConnection, updateConnection } = useConnectionStore();
  const [form, setForm] = useState<CreateConnectionInput>(() => {
    if (editConnection) {
      return {
        name: editConnection.name,
        folder_id: editConnection.folder_id,
        color: editConnection.color ?? generateConnectionColor(),
        method: editConnection.method,
        mysql_hostname: editConnection.mysql.hostname,
        mysql_port: editConnection.mysql.port,
        mysql_username: editConnection.mysql.username,
        mysql_password: "",
        mysql_default_schema: editConnection.mysql.default_schema ?? "",
        ssh_hostname: editConnection.ssh?.hostname ?? "",
        ssh_port: editConnection.ssh?.port ?? 22,
        ssh_username: editConnection.ssh?.username ?? "",
        ssh_password: "",
        ssh_auth_method: editConnection.ssh?.auth_method ?? "password",
        ssh_key_file_path: editConnection.ssh?.key_file_path ?? "",
        ssh_key_passphrase: "",
      };
    }
    return defaultForm();
  });

  const [showMysqlPassword, setShowMysqlPassword] = useState(false);
  const [showSshPassword, setShowSshPassword] = useState(false);
  const [showSshPassphrase, setShowSshPassphrase] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testError, setTestError] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);

  const update = (field: keyof CreateConnectionInput, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setTestStatus("idle");
  };

  const handleTest = async () => {
    setTestStatus("testing");
    setTestError(undefined);
    try {
      await tauriTestConnection({
        method: form.method,
        mysql_hostname: form.mysql_hostname,
        mysql_port: form.mysql_port,
        mysql_username: form.mysql_username,
        mysql_password: form.mysql_password,
        mysql_default_schema: form.mysql_default_schema,
        ssh_hostname: form.ssh_hostname,
        ssh_port: form.ssh_port,
        ssh_username: form.ssh_username,
        ssh_password: form.ssh_password,
        ssh_auth_method: form.ssh_auth_method,
        ssh_key_file_path: form.ssh_key_file_path,
        ssh_key_passphrase: form.ssh_key_passphrase,
      });
      setTestStatus("success");
    } catch (err) {
      setTestStatus("error");
      setTestError(String(err));
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setIsSaving(true);
    try {
      if (editConnection) {
        await updateConnection(editConnection.id, form);
      } else {
        await createConnection(form);
      }
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const isSSH = form.method === "tcp_ip_over_ssh";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editConnection ? "Edit Connection" : "New Connection"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Header fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label>Connection Name *</Label>
              <div className="flex gap-2 items-center">
                <div
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: form.color || "#6366f1" }}
                />
                <Input
                  placeholder="Production DB"
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Folder</Label>
              <Select
                value={form.folder_id ?? "none"}
                onValueChange={(v) => update("folder_id", v === "none" ? undefined : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No folder" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No folder</SelectItem>
                  {folders.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Color</Label>
              <ColorPickerInput
                value={form.color ?? "#6366f1"}
                onChange={(c) => update("color", c)}
              />
            </div>

            <div className="col-span-2 space-y-1.5">
              <Label>Connection Method</Label>
              <Select value={form.method} onValueChange={(v) => update("method", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tcp_ip">Standard (TCP/IP)</SelectItem>
                  <SelectItem value="tcp_ip_over_ssh">Standard TCP/IP over SSH</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue={isSSH ? "ssh" : "mysql"}>
            <TabsList>
              {isSSH && <TabsTrigger value="ssh">SSH</TabsTrigger>}
              <TabsTrigger value="mysql">MySQL</TabsTrigger>
            </TabsList>

            {isSSH && (
              <TabsContent value="ssh" className="space-y-4 mt-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2 space-y-1.5">
                    <Label>SSH Hostname</Label>
                    <Input
                      placeholder="ssh.example.com"
                      value={form.ssh_hostname ?? ""}
                      onChange={(e) => update("ssh_hostname", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>SSH Port</Label>
                    <Input
                      type="number"
                      value={form.ssh_port ?? 22}
                      onChange={(e) => update("ssh_port", parseInt(e.target.value) || 22)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>SSH Username</Label>
                  <Input
                    placeholder="username"
                    value={form.ssh_username ?? ""}
                    onChange={(e) => update("ssh_username", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>SSH Password</Label>
                  <div className="relative">
                    <Input
                      type={showSshPassword ? "text" : "password"}
                      placeholder="Optional if using key file"
                      value={form.ssh_password ?? ""}
                      onChange={(e) => update("ssh_password", e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowSshPassword((v) => !v)}
                    >
                      <FontAwesomeIcon icon={showSshPassword ? faEyeSlash : faEye} />
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>SSH Key File</Label>
                  <Input
                    placeholder="/path/to/key.pem"
                    value={form.ssh_key_file_path ?? ""}
                    onChange={(e) => update("ssh_key_file_path", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>SSH Key Passphrase</Label>
                  <div className="relative">
                    <Input
                      type={showSshPassphrase ? "text" : "password"}
                      placeholder="Optional"
                      value={form.ssh_key_passphrase ?? ""}
                      onChange={(e) => update("ssh_key_passphrase", e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowSshPassphrase((v) => !v)}
                    >
                      <FontAwesomeIcon icon={showSshPassphrase ? faEyeSlash : faEye} />
                    </button>
                  </div>
                </div>
              </TabsContent>
            )}

            <TabsContent value="mysql" className="space-y-4 mt-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-1.5">
                  <Label>Hostname</Label>
                  <Input
                    placeholder={isSSH ? "127.0.0.1" : "db.example.com"}
                    value={form.mysql_hostname}
                    onChange={(e) => update("mysql_hostname", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Port</Label>
                  <Input
                    type="number"
                    value={form.mysql_port}
                    onChange={(e) => update("mysql_port", parseInt(e.target.value) || 3306)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Username</Label>
                <Input
                  placeholder="root"
                  value={form.mysql_username}
                  onChange={(e) => update("mysql_username", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Password</Label>
                <div className="relative">
                  <Input
                    type={showMysqlPassword ? "text" : "password"}
                    placeholder="Password"
                    value={form.mysql_password ?? ""}
                    onChange={(e) => update("mysql_password", e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowMysqlPassword((v) => !v)}
                  >
                    <FontAwesomeIcon icon={showMysqlPassword ? faEyeSlash : faEye} />
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Default Schema</Label>
                <Input
                  placeholder="Optional"
                  value={form.mysql_default_schema ?? ""}
                  onChange={(e) => update("mysql_default_schema", e.target.value)}
                />
              </div>
            </TabsContent>
          </Tabs>

          {/* Test connection result */}
          <TestConnectionBanner status={testStatus} error={testError} />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleTest} disabled={testStatus === "testing"}>
            {testStatus === "testing" ? (
              <>
                <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                Testing...
              </>
            ) : (
              <>Test Connection</>
            )}
          </Button>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!form.name.trim() || isSaving}>
              {isSaving ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faFloppyDisk} />
                  Save
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

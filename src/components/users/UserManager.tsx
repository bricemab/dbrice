import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import {
  tauriGetUsers,
  tauriCreateUser,
  tauriDeleteUser,
  tauriGrantPrivileges,
  tauriRevokePrivileges,
  tauriGetUserPrivileges,
} from "@/lib/tauri";
import { toast } from "@/components/common/Toast";
import type { MySQLUser } from "@/types/schema";
import { cn } from "@/lib/utils";

interface UserManagerProps {
  connectionId: string;
}

const SCHEMA_PRIVILEGES = [
  "SELECT", "INSERT", "UPDATE", "DELETE", "CREATE", "DROP",
  "INDEX", "ALTER", "CREATE TEMPORARY TABLES", "LOCK TABLES",
  "EXECUTE", "CREATE VIEW", "SHOW VIEW", "CREATE ROUTINE",
  "ALTER ROUTINE", "EVENT", "TRIGGER", "REFERENCES",
];

const ADMIN_ROLES = [
  "SUPER", "PROCESS", "RELOAD", "SHUTDOWN", "FILE",
  "REPLICATION CLIENT", "REPLICATION SLAVE", "CREATE USER",
  "SHOW DATABASES", "CREATE TABLESPACE",
];

const AUTH_PLUGINS = [
  "caching_sha2_password",
  "mysql_native_password",
  "sha256_password",
  "auth_socket",
];

interface UserForm {
  username: string;
  host: string;
  auth_plugin: string;
  password: string;
  password_confirm: string;
  require_ssl: boolean;
  max_queries_per_hour: string;
  max_updates_per_hour: string;
  max_connections_per_hour: string;
  max_user_connections: string;
}

const defaultForm = (): UserForm => ({
  username: "",
  host: "%",
  auth_plugin: "caching_sha2_password",
  password: "",
  password_confirm: "",
  require_ssl: false,
  max_queries_per_hour: "0",
  max_updates_per_hour: "0",
  max_connections_per_hour: "0",
  max_user_connections: "0",
});

export function UserManager({ connectionId }: UserManagerProps) {
  const [users, setUsers] = useState<MySQLUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<MySQLUser | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editUser, setEditUser] = useState<MySQLUser | null>(null);
  const [form, setForm] = useState<UserForm>(defaultForm());
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState<MySQLUser | null>(null);

  // Privileges state
  const [schemaPrivileges, setSchemaPrivileges] = useState<Record<string, Record<string, boolean>>>({});
  const [adminPrivileges, setAdminPrivileges] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadUsers();
  }, [connectionId]);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const data = await tauriGetUsers({ connection_id: connectionId });
      setUsers(data);
    } catch (err) {
      toast.error("Failed to load users", String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectUser = async (user: MySQLUser) => {
    setSelectedUser(user);
    try {
      const privs = await tauriGetUserPrivileges({
        connection_id: connectionId,
        username: user.user,
        host: user.host,
      });
      // Build privilege state from raw grants
      const schemaPrivs: Record<string, Record<string, boolean>> = {};
      const adminPrivs: Record<string, boolean> = {};
      if (privs) {
        // Parse the privileges structure
        for (const priv of ADMIN_ROLES) {
          adminPrivs[priv] = false;
        }
      }
      setSchemaPrivileges(schemaPrivs);
      setAdminPrivileges(adminPrivs);
    } catch {
      // ignore
    }
  };

  const openNewUser = () => {
    setEditUser(null);
    setForm(defaultForm());
    setShowUserModal(true);
  };

  const openEditUser = (user: MySQLUser) => {
    setEditUser(user);
    setForm({
      ...defaultForm(),
      username: user.user,
      host: user.host,
      auth_plugin: user.plugin ?? "caching_sha2_password",
    });
    setShowUserModal(true);
  };

  const handleSaveUser = async () => {
    if (!form.username.trim()) {
      toast.error("Username is required");
      return;
    }
    if (form.password !== form.password_confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setIsSaving(true);
    try {
      await tauriCreateUser({
        connection_id: connectionId,
        username: form.username,
        host: form.host,
        password: form.password,
        auth_plugin: form.auth_plugin,
        require_ssl: form.require_ssl,
        max_queries_per_hour: parseInt(form.max_queries_per_hour) || 0,
        max_updates_per_hour: parseInt(form.max_updates_per_hour) || 0,
        max_connections_per_hour: parseInt(form.max_connections_per_hour) || 0,
        max_user_connections: parseInt(form.max_user_connections) || 0,
      });
      toast.success(`User \`${form.username}\`@\`${form.host}\` ${editUser ? "updated" : "created"}`);
      setShowUserModal(false);
      loadUsers();
    } catch (err) {
      toast.error("Failed to save user", String(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      await tauriDeleteUser({
        connection_id: connectionId,
        username: userToDelete.user,
        host: userToDelete.host,
      });
      toast.success(`User \`${userToDelete.user}\`@\`${userToDelete.host}\` deleted`);
      if (selectedUser?.user === userToDelete.user) setSelectedUser(null);
      loadUsers();
    } catch (err) {
      toast.error("Failed to delete user", String(err));
    } finally {
      setShowDeleteConfirm(false);
      setUserToDelete(null);
    }
  };

  const handleApplyPrivileges = async (schema: string, privs: Record<string, boolean>) => {
    if (!selectedUser) return;
    const granted = Object.entries(privs).filter(([, v]) => v).map(([k]) => k);
    const revoked = Object.entries(privs).filter(([, v]) => !v).map(([k]) => k);
    try {
      if (granted.length > 0) {
        await tauriGrantPrivileges({
          connection_id: connectionId,
          username: selectedUser.user,
          host: selectedUser.host,
          database: schema,
          privileges: granted,
        });
      }
      if (revoked.length > 0) {
        await tauriRevokePrivileges({
          connection_id: connectionId,
          username: selectedUser.user,
          host: selectedUser.host,
          database: schema,
          privileges: revoked,
        });
      }
      toast.success("Privileges updated");
    } catch (err) {
      toast.error("Failed to update privileges", String(err));
    }
  };

  return (
    <div className="flex h-full bg-background">
      {/* Left: User list */}
      <div className="w-72 border-r flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold text-sm">MySQL Users</h3>
          <Button size="sm" onClick={openNewUser}>
            <i className="bx bx-plus" />
            Add User
          </Button>
        </div>
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <i className="bx bx-loader-alt animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {users.map((user) => (
                <div
                  key={`${user.user}@${user.host}`}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer hover:bg-muted/60 group",
                    selectedUser?.user === user.user &&
                      selectedUser?.host === user.host &&
                      "bg-primary/10 text-primary"
                  )}
                  onClick={() => handleSelectUser(user)}
                >
                  <i className="bx bx-user text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{user.user}</div>
                    <div className="text-xs text-muted-foreground">@{user.host}</div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      className="p-1 hover:text-foreground text-muted-foreground"
                      onClick={(e) => { e.stopPropagation(); openEditUser(user); }}
                    >
                      <i className="bx bx-pencil text-sm" />
                    </button>
                    <button
                      className="p-1 hover:text-destructive text-muted-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        setUserToDelete(user);
                        setShowDeleteConfirm(true);
                      }}
                    >
                      <i className="bx bx-trash text-sm" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Right: Privileges panel */}
      <div className="flex-1 overflow-hidden">
        {!selectedUser ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <div className="text-center space-y-2">
              <i className="bx bx-user-circle text-4xl block" />
              <p className="text-sm">Select a user to manage privileges</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <div className="px-4 py-3 border-b">
              <h3 className="font-semibold">
                {selectedUser.user}@{selectedUser.host}
              </h3>
              <div className="flex gap-2 mt-1">
                {selectedUser.plugin && (
                  <Badge variant="secondary" className="text-xs">{selectedUser.plugin}</Badge>
                )}
                {selectedUser.account_locked && (
                  <Badge variant="warning" className="text-xs">Locked</Badge>
                )}
              </div>
            </div>

            <Tabs defaultValue="schema" className="flex-1 overflow-hidden flex flex-col">
              <TabsList className="mx-4 mt-3 w-fit">
                <TabsTrigger value="schema">Schema Privileges</TabsTrigger>
                <TabsTrigger value="admin">Administrative Roles</TabsTrigger>
              </TabsList>

              <TabsContent value="schema" className="flex-1 overflow-hidden m-0 p-4">
                <SchemaPrivilegesPanel
                  connectionId={connectionId}
                  user={selectedUser}
                  onApply={handleApplyPrivileges}
                />
              </TabsContent>

              <TabsContent value="admin" className="flex-1 m-0 p-4">
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Administrative roles grant global-level MySQL privileges.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {ADMIN_ROLES.map((role) => (
                      <div key={role} className="flex items-center gap-2">
                        <Checkbox
                          id={`admin-${role}`}
                          checked={adminPrivileges[role] ?? false}
                          onCheckedChange={(v) =>
                            setAdminPrivileges((prev) => ({ ...prev, [role]: !!v }))
                          }
                        />
                        <Label htmlFor={`admin-${role}`} className="text-sm cursor-pointer">
                          {role}
                        </Label>
                      </div>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    onClick={() =>
                      handleApplyPrivileges("*", adminPrivileges)
                    }
                  >
                    Apply Admin Roles
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>

      {/* User Form Modal */}
      <Dialog open={showUserModal} onOpenChange={setShowUserModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editUser ? "Edit User" : "New User"}</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="login">
            <TabsList>
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="limits">Account Limits</TabsTrigger>
            </TabsList>
            <TabsContent value="login" className="space-y-3 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Username</Label>
                  <Input
                    value={form.username}
                    onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
                    placeholder="newuser"
                    disabled={!!editUser}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Host</Label>
                  <Input
                    value={form.host}
                    onChange={(e) => setForm((prev) => ({ ...prev, host: e.target.value }))}
                    placeholder="%"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Authentication Plugin</Label>
                <Select
                  value={form.auth_plugin}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, auth_plugin: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AUTH_PLUGINS.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Password</Label>
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Confirm Password</Label>
                  <Input
                    type="password"
                    value={form.password_confirm}
                    onChange={(e) => setForm((prev) => ({ ...prev, password_confirm: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="require-ssl"
                  checked={form.require_ssl}
                  onCheckedChange={(v) => setForm((prev) => ({ ...prev, require_ssl: !!v }))}
                />
                <Label htmlFor="require-ssl">Require SSL</Label>
              </div>
            </TabsContent>
            <TabsContent value="limits" className="space-y-3 mt-4">
              {(
                [
                  ["max_queries_per_hour", "MAX_QUERIES_PER_HOUR"],
                  ["max_updates_per_hour", "MAX_UPDATES_PER_HOUR"],
                  ["max_connections_per_hour", "MAX_CONNECTIONS_PER_HOUR"],
                  ["max_user_connections", "MAX_USER_CONNECTIONS"],
                ] as [keyof UserForm, string][]
              ).map(([field, label]) => (
                <div key={field} className="grid grid-cols-2 items-center gap-3">
                  <Label>{label}</Label>
                  <Input
                    type="number"
                    value={form[field] as string}
                    onChange={(e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))}
                    placeholder="0 = unlimited"
                  />
                </div>
              ))}
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUserModal(false)}>Cancel</Button>
            <Button onClick={handleSaveUser} disabled={isSaving}>
              {isSaving ? (
                <><i className="bx bx-loader-alt animate-spin" />Saving...</>
              ) : (
                <><i className="bx bx-save" />Save</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <ConfirmModal
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteUser}
        title="Delete User"
        description={`Are you sure you want to delete user \`${userToDelete?.user}\`@\`${userToDelete?.host}\`? This cannot be undone.`}
        confirmLabel="Delete User"
        confirmVariant="destructive"
      />
    </div>
  );
}

// Schema privileges sub-panel
function SchemaPrivilegesPanel({
  connectionId,
  user,
  onApply,
}: {
  connectionId: string;
  user: MySQLUser;
  onApply: (schema: string, privs: Record<string, boolean>) => void;
}) {
  const [schema, setSchema] = useState("*");
  const [privs, setPrivs] = useState<Record<string, boolean>>(
    Object.fromEntries(SCHEMA_PRIVILEGES.map((p) => [p, false]))
  );

  const toggleAll = (val: boolean) => {
    setPrivs(Object.fromEntries(SCHEMA_PRIVILEGES.map((p) => [p, val])));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Schema</Label>
          <Input
            value={schema}
            onChange={(e) => setSchema(e.target.value)}
            placeholder="database_name or *"
            className="h-7 text-xs w-40"
          />
        </div>
        <div className="flex gap-2 mt-5">
          <Button variant="outline" size="sm" onClick={() => toggleAll(true)}>
            Select All
          </Button>
          <Button variant="outline" size="sm" onClick={() => toggleAll(false)}>
            Unselect All
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {SCHEMA_PRIVILEGES.map((priv) => (
          <div key={priv} className="flex items-center gap-2">
            <Checkbox
              id={`priv-${priv}`}
              checked={privs[priv] ?? false}
              onCheckedChange={(v) =>
                setPrivs((prev) => ({ ...prev, [priv]: !!v }))
              }
            />
            <Label htmlFor={`priv-${priv}`} className="text-xs cursor-pointer">
              {priv}
            </Label>
          </div>
        ))}
      </div>
      <Button size="sm" onClick={() => onApply(schema, privs)}>
        Apply Privileges
      </Button>
    </div>
  );
}

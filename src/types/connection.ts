export type ConnectionMethod = "tcp_ip" | "tcp_ip_over_ssh";

export interface MySQLConfig {
  hostname: string;
  port: number;
  username: string;
  default_schema?: string;
}

export type SSHAuthMethod = "password" | "key_file" | "both";

export interface SSHConfig {
  hostname: string;
  port: number;
  username: string;
  auth_method: SSHAuthMethod;
  key_file_path?: string;
}

export interface Connection {
  id: string;
  name: string;
  folder_id?: string;
  color?: string;
  method: ConnectionMethod;
  mysql: MySQLConfig;
  ssh?: SSHConfig;
  sort_order: number;
  last_connected_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Folder {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface CreateConnectionInput {
  name: string;
  folder_id?: string;
  color?: string;
  method: string;
  mysql_hostname: string;
  mysql_port: number;
  mysql_username: string;
  mysql_password?: string;
  mysql_default_schema?: string;
  ssh_hostname?: string;
  ssh_port?: number;
  ssh_username?: string;
  ssh_password?: string;
  ssh_auth_method?: string;
  ssh_key_file_path?: string;
  ssh_key_passphrase?: string;
}

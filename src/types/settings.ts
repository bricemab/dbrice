export type Theme = "light" | "dark" | "system";
export type DefaultLimit = 10 | 100 | 1000 | 10000;

export interface Settings {
  theme: Theme;
  default_limit: DefaultLimit;
  app_version: string;
}

export interface LogEntry {
  id: string;
  connection_id: string;
  level: "INFO" | "WARNING" | "ERROR";
  message: string;
  created_at: string;
}

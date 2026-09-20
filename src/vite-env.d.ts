/// <reference types="vite/client" />

declare module "*.module.css" {
  const classes: Record<string, string>;
  export default classes;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

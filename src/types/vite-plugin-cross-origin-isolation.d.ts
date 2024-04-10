declare module 'vite-plugin-cross-origin-isolation' {
  import { ViteDevServer } from 'vite'

  interface CrossOriginIsolationPlugin {
    name: string
    configureServer(server: ViteDevServer): void
  }

  const crossOriginIsolation: () => CrossOriginIsolationPlugin

  export default crossOriginIsolation
}

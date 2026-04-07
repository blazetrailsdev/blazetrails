import { defineConfig } from "vitepress";
import typedocSidebar from "../api/typedoc-sidebar.json";

export default defineConfig({
  title: "Trails Docs",
  description: "Documentation for the Trails TypeScript framework",
  themeConfig: {
    nav: [
      { text: "Guide", link: "/guide/" },
      { text: "API Reference", link: "/api/" },
    ],
    sidebar: {
      "/guide/": [
        {
          text: "Guide",
          items: [{ text: "Getting Started", link: "/guide/" }],
        },
      ],
      "/api/": typedocSidebar,
    },
    socialLinks: [{ icon: "github", link: "https://github.com/blazetrailsdev/trails" }],
  },
});

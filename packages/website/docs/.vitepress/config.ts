import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Trails",
  description: "Rails API for TypeScript",
  base: "/docs/",
  outDir: "../build/docs",
  cleanUrls: true,

  themeConfig: {
    nav: [
      { text: "Home", link: "/" },
      { text: "API Reference", link: "/api/" },
    ],

    sidebar: {
      "/api/": [
        {
          text: "Packages",
          items: [
            { text: "Arel", link: "/api/@blazetrails/arel/" },
            { text: "ActiveModel", link: "/api/@blazetrails/activemodel/" },
            { text: "ActiveRecord", link: "/api/@blazetrails/activerecord/" },
            { text: "ActiveSupport", link: "/api/@blazetrails/activesupport/" },
            { text: "Rack", link: "/api/@blazetrails/rack/" },
            { text: "ActionPack", link: "/api/@blazetrails/actionpack/" },
          ],
        },
      ],
    },

    socialLinks: [{ icon: "github", link: "https://github.com/blazetrailsdev/trails" }],

    search: {
      provider: "local",
    },
  },
});

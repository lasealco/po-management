export type SettingsNavLink = {
  href: string;
  label: string;
  description: string;
};

export type SettingsNavSection = {
  title: string;
  links: readonly SettingsNavLink[];
};

export const SETTINGS_SECTIONS: readonly SettingsNavSection[] = [
  {
    title: "Organization",
    links: [
      {
        href: "/settings/organization",
        label: "Company profile",
        description: "Display name and tenant identifier",
      },
    ],
  },
  {
    title: "Product catalog",
    links: [
      {
        href: "/settings/catalog",
        label: "Categories & divisions",
        description: "Taxonomy used on products",
      },
    ],
  },
  {
    title: "Purchase orders",
    links: [
      {
        href: "/settings/workflow",
        label: "Order workflow",
        description: "Statuses and allowed transitions",
      },
    ],
  },
] as const;

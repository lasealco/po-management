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
    title: "People",
    links: [
      {
        href: "/settings/users",
        label: "Users",
        description: "Who can sign in and their status",
      },
      {
        href: "/settings/roles",
        label: "Roles",
        description: "Named roles for permissions",
      },
      {
        href: "/settings/permissions",
        label: "Permissions",
        description: "What each role may do",
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

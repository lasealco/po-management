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
    title: "Demo & session",
    links: [
      {
        href: "/settings/demo",
        label: "Demo session",
        description: "Switch demo user, optional password login, clear session",
      },
    ],
  },
  {
    title: "Organization",
    links: [
      {
        href: "/settings/organization",
        label: "Company profile",
        description: "Legal name, address, web & social, links to users and CRM contacts",
      },
      {
        href: "/settings/organization/structure",
        label: "Org & sites",
        description: "Geographic and legal hierarchy (HQ, regions, countries, sites)",
      },
      {
        href: "/settings/warehouses",
        label: "CFS & Warehouses",
        description: "Create and manage consolidation locations",
      },
      {
        href: "/settings/logistics",
        label: "Logistics master data",
        description: "Forwarders, offices, contacts, and lane references",
      },
    ],
  },
  {
    title: "Reference & standards",
    links: [
      {
        href: "/settings/reference-data",
        label: "Countries & transport codes",
        description: "ISO list, ocean SCACs, airline IATA + AWB prefixes for tariffs and ops",
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
  {
    title: "Control Tower",
    links: [
      {
        href: "/settings/control-tower-exception-codes",
        label: "Exception types",
        description: "Catalog codes for Shipment 360 exceptions (label, severity, sort)",
      },
    ],
  },
  {
    title: "Risk intelligence",
    links: [
      {
        href: "/settings/risk-intelligence",
        label: "Watchlists & tuning",
        description: "Rules, trust floor, geo aliases, optional auto-watch on ingest",
      },
    ],
  },
] as const;

const STATUS_STYLES = {
  now: {
    dotClass: "bg-emerald-500",
    labelClass: "text-emerald-600",
    stateLabel: "Available",
  },
  progress: {
    dotClass: "bg-sky-400",
    labelClass: "text-sky-600",
    stateLabel: "In progress",
  },
  soon: {
    dotClass: "bg-amber-400",
    labelClass: "text-amber-600",
    stateLabel: "Planned",
  },
};

export const getStatusMeta = (status) => STATUS_STYLES[status] || STATUS_STYLES.progress;

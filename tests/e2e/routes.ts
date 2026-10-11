// Routes the quality gates cover (Task 10). ROUTES is the set Lighthouse measures and the
// per-route gates walk; ALL_ROUTES adds every other public page so axe and the overflow
// check still see the pages the earlier dev-project sweeps covered.
export const ROUTES = [
  "/",
  "/manual/",
  "/manual/the-clock/",
  "/manual/write/",
  "/manual/sources/",
  "/manual/printables/",
  "/trails/",
  "/trails/the-lectern/",
  "/trails/the-camera/",
  "/about/",
  "/corrections/",
  "/search/",
] as const;

export const ALL_ROUTES = [
  ...ROUTES,
  "/manual/your-rights/",
  "/manual/who-may-request/",
  "/manual/what-it-costs/",
  "/manual/exemptions/",
  "/manual/write-a-request/",
  "/manual/denied/",
  "/trails/the-meeting/",
] as const;

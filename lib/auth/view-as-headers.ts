// Names shared by middleware.ts (edge) and the server code. Middleware strips these headers from every incoming
// request and sets them again only from the URL, so a browser cannot forge them.
export const VIEW_AS_HEADER = 'x-sim-as';
export const VIEW_AS_ACT_HEADER = 'x-sim-act';
export const SIM_CLASS_HEADER = 'x-sim-class';

/** Query parameters (routes.md 6.1 and 7.3). */
export const VIEW_AS_PARAM = 'sim_as';
export const VIEW_AS_ACT_PARAM = 'sim_act';
export const SIM_CLASS_PARAM = 'sim_class';

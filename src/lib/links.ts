/** Link to a character's page. Query-string form so it also works when the app is a static website. */
export const charHref = (id: string) => `/characters/view?id=${encodeURIComponent(id)}`;

// scripts/advising_table.js
// Barrel — re-exports the same public symbols as before so that content.js
// and any other consumers need no changes.

export { COURSE_TABLE_ID }           from "./advising_table/state.js";
export { LIST_UPDATED_EVENT }        from "./advising_table/fetch_updates.js";
export { applyAdvisingLayoutStyles } from "./advising_table/styles.js";
export { addCourseSearchBar }        from "./advising_table/search_bar.js";
export { injectSlipFaculty }         from "./advising_table/slip.js";
export { fetchCourseUpdates }        from "./advising_table/fetch_updates.js";
export { injectSavedCourseMetadata } from "./advising_table/metadata.js";
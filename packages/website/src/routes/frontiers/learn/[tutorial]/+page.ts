import { redirect } from "@sveltejs/kit";
import type { PageLoad } from "./$types.js";

export const load: PageLoad = ({ params }) => {
  redirect(307, `/frontiers/learn/${params.tutorial}/1`);
};

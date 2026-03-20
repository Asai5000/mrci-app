import { getPmisDrugs } from "@/actions/pmisDb";
import PmisDbClient from "./PmisDbClient";

export default async function PmisDbPage() {
  const drugs = await getPmisDrugs();
  return <PmisDbClient initialData={drugs} />;
}
